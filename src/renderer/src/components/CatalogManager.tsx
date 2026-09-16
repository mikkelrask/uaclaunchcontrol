import { useState } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { DataTable } from '@/components/ui/data-table'
import { getCatalogColumns } from '@/components/catalog-columns'
import type { IModFile, CatalogFileDeleteOutcome } from '@shared/schema'
import { Upload } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { api } from '@/api'
import { CATEGORIES } from '@shared/categories'
import { ARCHIVE_EXTENSIONS, getArchiveExtension } from '@shared/archive'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArchiveImportModal } from '@/components/ArchiveImportModal'
import { useFileImport } from '@/hooks/useFileImport'
import { useCatalogAdd } from '@/hooks/useCatalogAdd'
import { useCatalogEdit } from '@/hooks/useCatalogEdit'
import { parseBatContent, resolveRelativePaths } from '@/lib/install/parsers'
import { useFileDrop } from '@/lib/catalog/useFileDrop'
import { AddFileDialog } from '@/components/catalog/AddFileDialog'
import { EditFileDialog } from '@/components/catalog/EditFileDialog'
import { DeleteConfirmDialog } from '@/components/catalog/DeleteConfirmDialog'
import { SIDECAR_EXPLANATION } from '@/lib/catalog/types'
import { InfoTooltip } from '@/components/ui/info-tooltip'

import { createLogger } from '@shared/logger'

const log = createLogger('CatalogManagerx')

/**
 * Toast for a catalog deletion, worded from what actually happened to the file
 * on disk — a failed disk deletion still removed the catalog entry.
 */
function deleteOutcomeToast(
  fileOutcome: CatalogFileDeleteOutcome,
  label: string
): { title: string; description: string; variant: 'default' | 'destructive' } {
  const removed = `Removed "${label}" from your mod file catalog`
  if (fileOutcome === 'deleted') {
    return {
      title: 'SYSTEM: remove_success',
      description: `${removed} and deleted its file from disk.`,
      variant: 'default'
    }
  }
  if (fileOutcome === 'already-absent') {
    return {
      title: 'SYSTEM: remove_success',
      description: `${removed}. Its file was already gone from disk.`,
      variant: 'default'
    }
  }
  if (fileOutcome === 'failed') {
    return {
      title: 'SYSTEM: file_delete_failed',
      description: `${removed}, but its file could not be deleted from disk — remove it manually.`,
      variant: 'destructive'
    }
  }
  return { title: 'SYSTEM: remove_success', description: `${removed}.`, variant: 'default' }
}

interface CatalogManagerProps {
  files: IModFile[]
  onChange: (files: IModFile[]) => void
}

export function CatalogManager({ files, onChange }: CatalogManagerProps): React.ReactElement {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { data: catalogFiles = [] } = useQuery({
    queryKey: ['/api/mod-files/catalog'],
    queryFn: () => api.getModFileCatalog()
  })

  const availableRequiredFiles = catalogFiles.filter((f) => !f.sidecarOnly && f.hashValue)

  const {
    isArchiveModalOpen,
    setIsArchiveModalOpen,
    archiveScanResult,
    archiveFilePath,
    tryArchiveImport,
    handleArchiveImportComplete
  } = useFileImport({ onChange })

  const {
    addForm,
    setAddForm,
    isAddModalOpen,
    setIsAddModalOpen,
    isAddingFile,
    selectableFilesForAdd,
    addRequiredMods,
    handleAddFile,
    initializeAddFormFromPath,
    handleBrowseFile,
    handleBrowseConfigFile,
    handleClearConfigFile,
    resetLookupState
  } = useCatalogAdd({ onChange, catalogFiles, availableRequiredFiles, tryArchiveImport })

  const {
    editForm,
    setEditForm,
    isEditModalOpen,
    setIsEditModalOpen,
    selectedFile,
    selectableFilesForEdit,
    editRequiredMods,
    handleOpenEditModal,
    handleSaveEdit,
    handleEditBrowseConfigFile,
    handleEditClearConfigFile
  } = useCatalogEdit({ onChange, catalogFiles, availableRequiredFiles })

  const [deleteTarget, setDeleteTarget] = useState<IModFile | null>(null)
  const [deleteFromDisk, setDeleteFromDisk] = useState(false)

  const { isDraggingFile, handleFileDragOver, handleFileDragLeave, processDrop } = useFileDrop()
  const [showSidecarOnly, setShowSidecarOnly] = useState(false)
  const [fileTypeFilter, setFileTypeFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')

  const handleRemoveFile = (id: number): void => {
    onChange(files.filter((f) => f.id !== id))
  }

  const handleFileDrop = async (e: React.DragEvent): Promise<void> => {
    const droppedPath = processDrop(e)
    if (!droppedPath) return

    if (getArchiveExtension(droppedPath)) {
      await tryArchiveImport(droppedPath)
      return
    }

    const ext = droppedPath.split('.').pop()?.toUpperCase()
    const validExtensions = ['WAD', 'PK3', 'PK7', 'IPK3', 'DEH', 'BEX', 'BAT']
    if (!ext || !validExtensions.includes(ext)) {
      toast({
        title: 'FATAL: type_unknow',
        description: `Please only use supported files: ${[
          ...validExtensions.map((supported) => supported.toLowerCase()),
          ...ARCHIVE_EXTENSIONS
        ].join(', ')}`,
        variant: 'destructive'
      })
      return
    }

    if (ext === 'BAT') {
      try {
        const content = await e.dataTransfer.files[0].text()
        const parsed = parseBatContent(content)
        const resolvedFiles = resolveRelativePaths(droppedPath, parsed.modFiles)

        if (resolvedFiles.length === 0) {
          toast({
            title: 'FATAL: bat_no_files',
            description: 'No -file entries found in .bat file',
            variant: 'destructive'
          })
          return
        }

        const updatedForm = await initializeAddFormFromPath(resolvedFiles[0])
        if (!updatedForm) return

        const additionalReqs = resolvedFiles.slice(1).map((fp, idx) => ({
          hash: '',
          name:
            fp
              .split(/[\\/]/)
              .pop()
              ?.replace(/\.[^.]+$/, '') || fp,
          filePath: fp,
          isNew: true,
          offset: (updatedForm.loadOrder?.length || 0) + idx + 1,
          sidecarOnly: false
        }))

        updatedForm.loadOrder = [...(updatedForm.loadOrder || []), ...additionalReqs]
        setAddForm((prev) => ({ ...prev, ...updatedForm }) as typeof addForm)
        setIsAddModalOpen(true)
      } catch (error: unknown) {
        log.error('Failed to parse .bat:', error)
        toast({
          title: 'FATAL: bat_parse_failed',
          description: 'Failed to parse .bat file',
          variant: 'destructive'
        })
      }
      return
    }

    const updatedForm = await initializeAddFormFromPath(droppedPath)
    if (updatedForm) {
      setAddForm((prev) => ({ ...prev, ...updatedForm }) as typeof addForm)
      setIsAddModalOpen(true)
    }
  }

  const handleDeleteFromCatalog = async (file: IModFile): Promise<void> => {
    setDeleteTarget(file)
    setDeleteFromDisk(false)
  }

  const confirmDelete = async (): Promise<void> => {
    const file = deleteTarget
    if (!file) return
    setDeleteTarget(null)
    try {
      const { fileOutcome } = await api.deleteFromCatalog(file.id, deleteFromDisk)
      handleRemoveFile(file.id)
      // The catalog query caches with staleTime: Infinity — without
      // invalidating, other views (install page, file lists, re-hydration)
      // keep seeing the deleted entry until a full reload.
      void queryClient.invalidateQueries({ queryKey: ['/api/mod-files/catalog'] })
      void queryClient.invalidateQueries({ queryKey: ['/api/mod-files/catalog/search'] })
      const label = file.name || file.fileName || 'this file'
      toast(deleteOutcomeToast(fileOutcome, label))
    } catch {
      handleRemoveFile(file.id)
      toast({
        title: 'SYSTEM: Warning!',
        description: `File "${file.name || file.fileName}" removed from view (may need manual deletion from catalog)`
      })
    }
  }

  const handleOpenUrl = (url: string): void => {
    if (url) {
      window.open(url, '_blank')
    }
  }

  return (
    <div className="space-y-4">
      <div
        onClick={handleBrowseFile}
        onDragOver={handleFileDragOver}
        onDragLeave={handleFileDragLeave}
        onDrop={handleFileDrop}
        className={`border-2 border-dashed rounded-lg p-8 cursor-pointer transition-all duration-200 ${
          isDraggingFile
            ? 'border-accent-highlight bg-accent-highlight/10'
            : 'border-app hover:border-accent-highlight/50 hover:bg-app-primary/50'
        }`}
      >
        <div className="flex items-center justify-center gap-2 text-app-muted">
          <Upload className="h-5 w-5" />
          <span className="text-sm">Drag/drop file here, or click to select</span>
        </div>
      </div>

      {(() => {
        const visibleFiles = showSidecarOnly ? files : files.filter((f) => !f.sidecarOnly)
        const filteredByType =
          fileTypeFilter === 'all'
            ? visibleFiles
            : visibleFiles.filter((f) => f.fileType === fileTypeFilter)
        const filteredByCategory =
          categoryFilter === 'all'
            ? filteredByType
            : filteredByType.filter((f) => f.category === categoryFilter)

        const columns = getCatalogColumns({
          catalogFiles,
          onEdit: handleOpenEditModal,
          onDelete: handleDeleteFromCatalog,
          onOpenUrl: handleOpenUrl
        })

        if (files.length === 0) {
          return (
            <div className="text-center text-app-secondary py-8">
              No files in catalog yet. Add files using the dropzone above.
            </div>
          )
        }

        return (
          <DataTable
            columns={columns}
            data={filteredByCategory}
            searchKey="name"
            searchPlaceholder="Search catalog..."
            pageSize={20}
            toolbar={
              <>
                <Select value={fileTypeFilter} onValueChange={setFileTypeFilter}>
                  <SelectTrigger className="w-[100px] h-9 bg-app-primary border-app text-xs">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent className="bg-app-secondary border-app text-app-primary">
                    <SelectItem value="all" className="text-xs">
                      All types
                    </SelectItem>
                    <SelectItem value="WAD" className="text-xs">
                      WAD
                    </SelectItem>
                    <SelectItem value="PK3" className="text-xs">
                      PK3
                    </SelectItem>
                    <SelectItem value="DEH" className="text-xs">
                      DEH
                    </SelectItem>
                    <SelectItem value="ZIP" className="text-xs">
                      ZIP
                    </SelectItem>
                  </SelectContent>
                </Select>

                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-[130px] h-9 bg-app-primary border-app text-xs">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent className="bg-app-secondary border-app text-app-primary">
                    <SelectItem value="all" className="text-xs">
                      All categories
                    </SelectItem>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat} className="text-xs">
                        {cat.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {files.some((f) => f.sidecarOnly) && (
                  <label className="flex items-center gap-2 text-sm text-app-muted cursor-pointer whitespace-nowrap">
                    <Checkbox
                      checked={showSidecarOnly}
                      onCheckedChange={(checked) => setShowSidecarOnly(checked === true)}
                    />
                    Sidecars
                    <InfoTooltip text={SIDECAR_EXPLANATION} />
                  </label>
                )}
              </>
            }
          />
        )
      })()}

      <AddFileDialog
        open={isAddModalOpen}
        onOpenChange={(open) => !open && !isAddingFile && setIsAddModalOpen(false)}
        form={addForm}
        setForm={setAddForm}
        selectableFiles={selectableFilesForAdd}
        requiredModsActions={addRequiredMods}
        onAddFile={handleAddFile}
        isSubmitting={isAddingFile}
        onBrowseFile={handleBrowseFile}
        onBrowseConfigFile={handleBrowseConfigFile}
        onClearConfigFile={handleClearConfigFile}
        onCancel={() => {
          if (isAddingFile) return
          resetLookupState()
          setIsAddModalOpen(false)
        }}
      />

      <EditFileDialog
        open={isEditModalOpen}
        onOpenChange={(open) => !open && setIsEditModalOpen(false)}
        form={editForm}
        setForm={setEditForm}
        selectedFile={selectedFile}
        selectableFiles={selectableFilesForEdit}
        requiredModsActions={editRequiredMods}
        onSaveEdit={handleSaveEdit}
        onBrowseConfigFile={handleEditBrowseConfigFile}
        onClearConfigFile={handleEditClearConfigFile}
      />

      <DeleteConfirmDialog
        target={deleteTarget}
        deleteFromDisk={deleteFromDisk}
        onDeleteFromDiskChange={(checked) => setDeleteFromDisk(checked)}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />

      <ArchiveImportModal
        open={isArchiveModalOpen}
        onOpenChange={setIsArchiveModalOpen}
        scanResult={archiveScanResult}
        archiveFilePath={archiveFilePath || undefined}
        onImportComplete={handleArchiveImportComplete}
      />
    </div>
  )
}

export default CatalogManager
