import { useState } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog'
import { DataTable } from '@/components/ui/data-table'
import { getCatalogColumns } from '@/components/catalog-columns'
import { IModFile } from '@shared/schema'
import { Button } from '@/components/ui/button'
import { Upload } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { api } from '@/api'
import { REGISTRY_API_URL } from '@shared/registry-config'
import { CATEGORIES } from '@shared/categories'
import { debug } from '@shared/debug'
import { useQuery } from '@tanstack/react-query'
import { ZipImportModal } from '@/components/ZipImportModal'
import { useFileImport } from '@/hooks/useFileImport'
import { useCatalogAdd } from '@/hooks/useCatalogAdd'
import { parseBatContent, resolveRelativePaths, deriveFileType } from '@/lib/install/parsers'
import { useFileDrop } from '@/lib/catalog/useFileDrop'
import { useRequiredModsActions } from '@/lib/catalog/useRequiredModsActions'
import { AddFileDialog } from '@/components/catalog/AddFileDialog'
import { EditFileDialog } from '@/components/catalog/EditFileDialog'
import { SIDECAR_EXPLANATION } from '@/lib/catalog/types'
import type { RequiredModEntry, EditFormState } from '@/lib/catalog/types'
import { InfoTooltip } from '@/components/ui/info-tooltip'

interface CatalogManagerProps {
  files: IModFile[]
  onChange: (files: IModFile[]) => void
}

export function CatalogManager({ files, onChange }: CatalogManagerProps): React.ReactElement {
  const { toast } = useToast()
  const { data: catalogFiles = [] } = useQuery({
    queryKey: ['/api/mod-files/catalog'],
    queryFn: () => api.getModFileCatalog()
  })

  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [selectedFile, setSelectedFile] = useState<IModFile | null>(null)

  const {
    isZipModalOpen,
    setIsZipModalOpen,
    zipScanResult,
    zipFilePath,
    tryZipImport,
    handleZipImportComplete
  } = useFileImport({ onChange })

  const availableRequiredFiles = catalogFiles.filter((f) => !f.sidecarOnly && f.hashValue)

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
  } = useCatalogAdd({ files, onChange, catalogFiles, availableRequiredFiles, tryZipImport })

  const [deleteTarget, setDeleteTarget] = useState<IModFile | null>(null)
  const [deleteFromDisk, setDeleteFromDisk] = useState(false)

  const { isDraggingFile, handleFileDragOver, handleFileDragLeave, processDrop } = useFileDrop()
  const [showSidecarOnly, setShowSidecarOnly] = useState(false)
  const [fileTypeFilter, setFileTypeFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')

  const [editForm, setEditForm] = useState<EditFormState>({
    name: '',
    version: '',
    url: '',
    loadOrder: [],
    sidecarOnly: false,
    category: '',
    configTemplate: null
  })

  const editRequiredMods = useRequiredModsActions(
    editForm.loadOrder,
    (updater) =>
      setEditForm((prev) => ({
        ...prev,
        loadOrder: typeof updater === 'function' ? updater(prev.loadOrder) : updater
      })),
    catalogFiles,
    toast
  )

  const handleRemoveFile = (id: number): void => {
    onChange(files.filter((f) => f.id !== id))
  }

  const processRequiredMods = async (
    requiredMods: RequiredModEntry[],
    mainHash?: string
  ): Promise<Record<string, number>> => {
    const result: Record<string, number> = {}

    for (const req of requiredMods) {
      if (req.isMain) {
        if (mainHash) {
          result[mainHash] = req.offset
        }
        continue
      }

      if (req.isNew && req.filePath) {
        const moveResult = await api.moveToModFolder(req.filePath)
        const hash = moveResult.hashValue
        if (!hash) continue // Skip if hash computation failed

        const fileName = req.filePath.split(/[\\/]/).pop() || req.filePath

        const reqFileType = deriveFileType(fileName.split('.').pop()?.toUpperCase() || '')

        await api.addToCatalog({
          name: req.name,
          filePath: moveResult.relativePath,
          fileType: reqFileType,
          fileName: fileName,
          hashValue: hash,
          sidecarOnly: req.sidecarOnly
        })

        result[hash] = req.offset
      } else if (req.hash) {
        result[req.hash] = req.offset
      }
    }

    return result
  }

  const handleFileDrop = async (e: React.DragEvent): Promise<void> => {
    const droppedPath = processDrop(e)
    if (!droppedPath) return

    const ext = droppedPath.split('.').pop()?.toUpperCase()
    const validExtensions = ['WAD', 'PK3', 'PK7', 'IPK3', 'DEH', 'BEX', 'ZIP', 'RAR', 'BAT']
    if (!ext || !validExtensions.includes(ext)) {
      toast({
        title: 'FATAL: type_unknow',
        description:
          'Please only use supported files: wad, pk3, pk7, ipk3, deh, bex, zip, rar, bat',
        variant: 'destructive'
      })
      return
    }

    if (ext === 'ZIP' || ext === 'RAR') {
      const handled = await tryZipImport(droppedPath, ext)
      if (handled) return
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
        console.error('Failed to parse .bat:', error)
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

  /** Browse for a config file to link as template in the edit dialog. */
  const handleEditBrowseConfigFile = async (): Promise<void> => {
    try {
      const result = await api.showOpenDialog({
        title: 'Select Config File',
        properties: ['openFile'],
        filters: [
          {
            name: 'Config files',
            extensions: ['cfg', 'ini', 'conf']
          }
        ]
      })

      if (!result.canceled && result.filePaths.length > 0) {
        const configPath = result.filePaths[0]
        const uploadResult = await api.uploadConfigFile(configPath)
        setEditForm((prev) => ({
          ...prev,
          configTemplate: {
            filePath: configPath,
            configFile: uploadResult.configFile,
            md5Hash: uploadResult.hash
          }
        }))
        toast({
          title: 'SYSTEM: config_linked',
          description: `Config template linked: ${configPath.split(/[\\/]/).pop()}`
        })
      }
    } catch (error: unknown) {
      console.error('Failed to browse config file:', error)
      toast({
        title: 'FATAL: config_link_failed',
        description: `Failed to link config file: ${error}`,
        variant: 'destructive'
      })
    }
  }

  /** Clear the config template selection in edit dialog. */
  const handleEditClearConfigFile = (): void => {
    setEditForm((prev) => ({ ...prev, configTemplate: null }))
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
      await api.deleteFromCatalog(file.id, deleteFromDisk)
      handleRemoveFile(file.id)
      const extra = deleteFromDisk ? ' and its file from disk' : ''
      toast({
        title: 'SYSTEM: remove_success',
        description: `Removed "${file.name || file.fileName}" from your mod file catalog${extra}.`
      })
    } catch {
      handleRemoveFile(file.id)
      toast({
        title: 'SYSTEM: Warning!',
        description: `File "${file.name || file.fileName}" removed from view (may need manual deletion from catalog)`
      })
    }
  }

  const handleOpenEditModal = (file: IModFile): void => {
    const existingLoadOrder: RequiredModEntry[] = []

    existingLoadOrder.push({
      hash: file.hashValue || '',
      name: file.name || '',
      filePath: file.filePath || '',
      isNew: false,
      offset: file.loadOrder?.[file.hashValue || ''] ?? 1,
      sidecarOnly: file.sidecarOnly || false,
      isMain: true
    })

    if (file.loadOrder) {
      for (const [hash, offset] of Object.entries(file.loadOrder)) {
        if (hash === file.hashValue) continue
        const reqFile = catalogFiles.find((f) => f.hashValue === hash)
        if (reqFile) {
          existingLoadOrder.push({
            hash,
            name: reqFile.name || '',
            filePath: reqFile.filePath || '',
            isNew: false,
            offset,
            sidecarOnly: reqFile.sidecarOnly || false
          })
        }
      }
    }

    existingLoadOrder.sort((a, b) => a.offset - b.offset)

    setSelectedFile(file)
    setEditForm({
      name: file.name || '',
      version: file.version || '',
      url: file.url || '',
      loadOrder: existingLoadOrder,
      sidecarOnly: file.sidecarOnly || false,
      category: file.category || '',
      configTemplate: file.configTemplate
        ? {
            filePath: file.configTemplate.configFile,
            configFile: file.configTemplate.configFile,
            md5Hash: file.configTemplate.md5Hash
          }
        : null
    })
    setIsEditModalOpen(true)
  }

  const handleSaveEdit = async (): Promise<void> => {
    if (!selectedFile || !editForm.name.trim()) {
      toast({
        title: 'WARNING: name_required',
        description: 'Name cannot be empty',
        variant: 'destructive'
      })
      return
    }
    try {
      let hashValue = selectedFile.hashValue

      if (!hashValue && selectedFile.filePath) {
        try {
          hashValue = await api.computeHash(selectedFile.filePath)
        } catch {
          console.error('Failed to compute hash')
        }
      }

      const selfRefCheck = editForm.loadOrder.some(
        (r) => r.isNew && !r.isMain && r.filePath === selectedFile.filePath
      )
      if (selfRefCheck) {
        toast({
          title: 'SYSTEM: circular_ref',
          description: 'A mod cannot require itself',
          variant: 'destructive'
        })
        return
      }

      const processedLoadOrder = await processRequiredMods(editForm.loadOrder, hashValue)

      const updates: Partial<IModFile> = {
        name: editForm.name.trim(),
        version: editForm.version,
        url: editForm.url,
        loadOrder: processedLoadOrder,
        sidecarOnly: editForm.sidecarOnly,
        category: editForm.category || undefined,
        configTemplate: editForm.configTemplate
          ? {
              configFile: editForm.configTemplate.configFile,
              md5Hash: editForm.configTemplate.md5Hash
            }
          : undefined
      }

      if (hashValue) {
        updates.hashValue = hashValue
      }

      await api.updateInCatalog(selectedFile.id, updates)

      // Submit to pending if hash not in registry and we have URL
      if (hashValue && editForm.url) {
        void (async () => {
          try {
            const settings = await api.getSettings()
            if (settings?.registryLookupEnabled && settings?.registryUuid) {
              try {
                const lookup = await api.lookupMod(hashValue, REGISTRY_API_URL)
                if (!lookup) {
                  await api.submitToPending(
                    {
                      hash: hashValue,
                      suggested_name: editForm.name.trim(),
                      url: editForm.url,
                      version: editForm.version || undefined,
                      category: editForm.category || undefined,
                      is_sidecar: editForm.sidecarOnly ? 1 : 0,
                      load_order: processedLoadOrder
                        ? JSON.stringify(processedLoadOrder)
                        : undefined
                    },
                    settings.registryUuid,
                    REGISTRY_API_URL
                  )
                  debug('[Registry] Submitted updated file to pending:', hashValue)
                }
              } catch {
                // Silently ignore - registry lookup failed
              }
            }
          } catch {
            // Silently ignore
          }
        })()
      }

      toast({
        title: 'SYSTEM: save_success',
        description: `Updated info: "${editForm.name}"`
      })

      setIsEditModalOpen(false)

      // Fetch fresh authoritative list and notify parent
      const freshCatalog = await api.getModFileCatalog()
      onChange(freshCatalog)
      setSelectedFile(null)
    } catch (error: unknown) {
      toast({
        title: 'FATAL: update_failed',
        description: `Failed to update: ${error}`,
        variant: 'destructive'
      })
    }
  }

  const handleOpenUrl = (url: string): void => {
    if (url) {
      window.open(url, '_blank')
    }
  }

  const selectableFilesForEdit = availableRequiredFiles.filter(
    (f) =>
      !editForm.loadOrder.some((r) => r.hash === f.hashValue) &&
      f.hashValue !== selectedFile?.hashValue
  )

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

      {/* Delete confirmation dialog */}
      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remove from catalog</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove{' '}
              <strong>{deleteTarget ? deleteTarget.name || deleteTarget.fileName : ''}</strong> from
              your mod file catalog?
            </DialogDescription>
          </DialogHeader>
          <label className="flex items-center gap-2 text-sm cursor-pointer py-2">
            <Checkbox
              checked={deleteFromDisk}
              onCheckedChange={(checked) => setDeleteFromDisk(checked === true)}
            />
            <span>Also delete the file from disk</span>
          </label>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ZipImportModal
        open={isZipModalOpen}
        onOpenChange={setIsZipModalOpen}
        scanResult={zipScanResult}
        zipFilePath={zipFilePath || undefined}
        onImportComplete={handleZipImportComplete}
      />
    </div>
  )
}

export default CatalogManager
