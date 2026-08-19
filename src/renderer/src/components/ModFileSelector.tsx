import { Fragment, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Combobox } from '@/components/ui/combobox'
import { FolderOpenIcon, PlusIcon, TrashIcon, ExternalLink, GripVertical } from 'lucide-react'
import type { IModFile } from '@shared/schema'
import { useToast } from '@/hooks/use-toast'
import { api } from '@/api'
import { debug } from '@shared/debug'
import type { FileReorderHandlers } from '@/hooks/useFileReorder'

import { createLogger } from '@shared/logger'

const log = createLogger('ModFileSelectorx')
let _nextTempId = Date.now()

/** True if `candidate` (matched by hash, falling back to path) already exists
 *  elsewhere in `files` — used to keep the same mod from being added twice. */
function isDuplicateFile(
  files: IModFile[],
  excludeIndex: number,
  candidate: { hashValue?: string; filePath?: string }
): boolean {
  return files.some((f, i) => {
    if (i === excludeIndex) return false
    if (candidate.hashValue && f.hashValue) return f.hashValue === candidate.hashValue
    if (candidate.filePath && f.filePath) return f.filePath === candidate.filePath
    return false
  })
}

interface ModFileSelectorProps {
  value: IModFile[]
  onChange: (files: IModFile[]) => void
  fileReorder: FileReorderHandlers
}

export function ModFileSelector({
  value = [],
  onChange,
  fileReorder: {
    draggedIndex,
    insertionIndex,
    handleDragStart,
    handleDragOver,
    handleDrop,
    handleDragEnd
  }
}: ModFileSelectorProps): React.ReactElement {
  const { toast } = useToast()
  const { data: catalogFiles = [], refetch: loadCatalogFiles } = useQuery({
    queryKey: ['/api/mod-files/catalog'],
    queryFn: () => api.getModFileCatalog()
  })

  const selectableFiles = catalogFiles.filter((f) => !f.sidecarOnly)

  // Re-hydrate entries that lost their path (e.g. a missing file re-downloaded
  // via its open-link icon): once the catalog refreshes, fill empty filePath,
  // url and registry metadata (name/version/category) from the matching
  // catalog entry. Never overwrites existing values.
  useEffect(() => {
    if (catalogFiles.length === 0) return
    let changed = false
    const updated = value.map((f) => {
      if (f.filePath) return f
      const match = catalogFiles.find(
        (c) => (f.hashValue && c.hashValue === f.hashValue) || c.fileName === f.fileName
      )
      if (!match || !match.filePath) return f
      changed = true
      return {
        ...f,
        filePath: match.filePath,
        url: f.url || match.url || '',
        name: f.name || match.name || '',
        version: f.version || match.version || '',
        category: f.category || match.category || '',
        sidecarOnly: f.sidecarOnly ?? match.sidecarOnly ?? false
      }
    })
    if (changed) onChange(updated)
  }, [catalogFiles, value, onChange])

  const handleAddFile = (): void => {
    const newFile: IModFile = {
      id: ++_nextTempId,
      name: '',
      filePath: '',
      fileType: 'WAD',
      isRequired: true,
      fileName: ''
    }
    onChange([...value, newFile])
  }

  const handleMoveFileToModFolder = async (
    sourcePath: string
  ): Promise<{ fullPath: string; relativePath: string; hashValue: string }> => {
    try {
      const result = await api.moveToModFolder(sourcePath)
      debug('[DEBUG] File moved successfully:', result)
      return result
    } catch (error: unknown) {
      log.error('Failed to move file:', error)
      toast({
        title: 'FATAL: copy.fail',
        description:
          error instanceof Error
            ? error.message
            : 'Could not copy file to mods directory - check settings and mod, and try again.',
        variant: 'destructive'
      })
      return { fullPath: sourcePath, relativePath: '', hashValue: '' }
    }
  }

  const handleRemoveFile = (index: number): void => {
    const newFiles = [...value]
    newFiles.splice(index, 1)

    const updatedFiles = newFiles.map((file) => ({
      ...file
    }))

    onChange(updatedFiles)
  }

  const handleUpdateFile = (index: number, field: keyof IModFile, newValue: string): void => {
    const newFiles = [...value]
    const updatedFile = {
      ...newFiles[index],
      [field]: newValue
    }

    updatedFile.fileName =
      field === 'name'
        ? newValue
        : updatedFile.name ||
          (updatedFile.filePath ? updatedFile.filePath.split(/[\\/]/).pop() : '')

    if (field === 'filePath') {
      const fileName = newValue.split(/[\\/]/).pop() || ''
      const extension = fileName.split('.').pop()?.toUpperCase() || ''
      if (extension === 'ZIP') {
        updatedFile.fileType = 'ZIP'
      } else if (extension === 'PK3' || extension === 'IPK3') {
        updatedFile.fileType = 'PK3'
      } else if (extension === 'DEH' || extension === 'BEX') {
        updatedFile.fileType = 'DEH'
      } else if (extension === 'WAD') {
        updatedFile.fileType = 'WAD'
      }
    }

    updatedFile.isRequired = updatedFile.isRequired !== undefined ? updatedFile.isRequired : true

    newFiles[index] = updatedFile
    onChange(newFiles)
  }

  const handleSelectCatalogFile = (index: number, catalogFileId: number): void => {
    const catalogFile = catalogFiles.find((f) => f.id === parseInt(catalogFileId + '', 10))
    if (!catalogFile) return

    const newFiles = [...value]
    const filesToInsert: IModFile[] = []

    if (catalogFile.loadOrder && Object.keys(catalogFile.loadOrder).length > 0) {
      const entries = Object.entries(catalogFile.loadOrder).sort((a, b) => a[1] - b[1])
      for (const [hash] of entries) {
        const reqFile = catalogFiles.find((f) => f.hashValue === hash)
        if (reqFile) {
          let fileType = reqFile.fileType
          if (!fileType && reqFile.fileName) {
            const ext = reqFile.fileName.split('.').pop()?.toUpperCase() || ''
            if (ext === 'ZIP') fileType = 'ZIP'
            else if (ext === 'PK3' || ext === 'IPK3') fileType = 'PK3'
            else if (ext === 'DEH' || ext === 'BEX') fileType = 'DEH'
            else fileType = 'WAD'
          }
          filesToInsert.push({
            id: reqFile.id,
            name: reqFile.name,
            filePath: reqFile.filePath,
            fileType: fileType || 'WAD',
            fileName: reqFile.fileName,
            isRequired: true,
            hashValue: reqFile.hashValue || '',
            url: reqFile.url || ''
          })
        }
      }
    } else {
      let fileType = catalogFile.fileType
      if (!fileType && catalogFile.fileName) {
        const ext = catalogFile.fileName.split('.').pop()?.toUpperCase() || ''
        if (ext === 'ZIP') fileType = 'ZIP'
        else if (ext === 'PK3' || ext === 'IPK3') fileType = 'PK3'
        else if (ext === 'DEH' || ext === 'BEX') fileType = 'DEH'
        else fileType = 'WAD'
      }
      filesToInsert.push({
        id: catalogFile.id,
        name: catalogFile.name,
        filePath: catalogFile.filePath,
        fileType: fileType || 'WAD',
        fileName: catalogFile.fileName,
        isRequired: true,
        hashValue: catalogFile.hashValue || '',
        url: catalogFile.url || ''
      })
    }

    const deduped = filesToInsert.filter(
      (f, i) =>
        !isDuplicateFile(newFiles, index, f) &&
        // Also drop repeats within this same load-order chain
        filesToInsert.findIndex(
          (other) =>
            (f.hashValue && other.hashValue === f.hashValue) || other.filePath === f.filePath
        ) === i
    )

    if (deduped.length < filesToInsert.length) {
      toast({
        title: 'SYSTEM: dupe_skipped',
        description:
          filesToInsert.length === 1
            ? 'That file is already in this protocol.'
            : 'Skipped one or more files already in this protocol.',
        variant: 'default'
      })
    }

    if (deduped.length === 0) return

    newFiles.splice(index, 1, ...deduped)
    onChange(newFiles)
  }

  const handleBrowseFile = async (index: number): Promise<void> => {
    try {
      const result = await api.showOpenDialog({
        title: 'Select Mod File',
        properties: ['openFile'],
        filters: [{ name: 'DOOM Files', extensions: ['wad', 'pk3', 'ipk3', 'deh', 'bex', 'zip'] }]
      })

      if (!result.canceled && result.filePaths.length > 0) {
        const selectedFilePath = result.filePaths[0]
        const fileName = selectedFilePath.split(/[\\/]/).pop() || 'No file selected'

        const extension = fileName.split('.').pop()?.toUpperCase() || ''
        let detectedType = 'WAD'
        if (extension === 'ZIP') {
          detectedType = 'ZIP'
        } else if (extension === 'PK3' || extension === 'IPK3') {
          detectedType = 'PK3'
        } else if (extension === 'DEH' || extension === 'BEX') {
          detectedType = 'DEH'
        } else if (extension === 'WAD') {
          detectedType = 'WAD'
        }

        const moveResult = await handleMoveFileToModFolder(selectedFilePath)
        const newFullPath = moveResult.fullPath
        const relativePath = moveResult.relativePath
        const fileHashValue = moveResult.hashValue

        let fileToUse: IModFile = {
          id: ++_nextTempId,
          filePath: relativePath,
          fileName: fileName,
          fileType: detectedType,
          hashValue: fileHashValue,
          name: fileName,
          isRequired: true
        }
        let isDuplicate = false

        // Check for existing entry by hash — reuse it if found
        if (fileHashValue) {
          const existingEntry = catalogFiles.find((f) => f.hashValue === fileHashValue)
          if (existingEntry) {
            debug(
              `[DEBUG] Duplicate file detected by hash ${fileHashValue}, using existing catalog entry ${existingEntry.id}`
            )
            toast({
              title: 'SYSTEM: already_in_catalog',
              description: `"${existingEntry.name}" exists in catalog. Using existing entry.`,
              variant: 'default'
            })
            fileToUse = existingEntry
            isDuplicate = true
          }
        }

        if (!isDuplicate) {
          // Not a duplicate — save to catalog
          try {
            const savedCatalogFile = await api.addToCatalog({
              name: fileName,
              filePath: relativePath,
              fileType: detectedType,
              fileName: fileName,
              hashValue: fileHashValue
            })
            fileToUse = { ...fileToUse, ...savedCatalogFile }
            loadCatalogFiles()
            toast({
              title: 'SYSTEM: copy_done',
              description: 'Mod file copied to your mods directory.',
              variant: 'default'
            })
          } catch (err: unknown) {
            log.error('Failed to add to catalog eagerly:', err)
          }
        }

        debug('Selected file:', selectedFilePath)
        debug('New file path:', newFullPath)
        debug('File name:', fileName)
        debug('Detected type:', detectedType)

        const resolvedPath = fileToUse.filePath || relativePath
        const resolvedHash = fileToUse.hashValue || fileHashValue

        if (isDuplicateFile(value, index, { hashValue: resolvedHash, filePath: resolvedPath })) {
          toast({
            title: 'SYSTEM: dupe_skipped',
            description: 'That file is already in this protocol.',
            variant: 'default'
          })
          return
        }

        const newFiles = [...value]
        newFiles[index] = {
          ...newFiles[index],
          id: fileToUse.id,
          filePath: resolvedPath,
          fileName: fileToUse.fileName || fileName,
          fileType: fileToUse.fileType || detectedType,
          hashValue: resolvedHash,
          name: !newFiles[index].name ? fileToUse.name : newFiles[index].name,
          isRequired: newFiles[index].isRequired !== undefined ? newFiles[index].isRequired : true
        }

        debug('Updating files with:', newFiles)
        onChange(newFiles)
      } else {
        debug('No file selected or dialog canceled')
      }
    } catch (error: unknown) {
      const err = error as Error
      log.error('Failed to open file dialog:', error)
      toast({
        title: 'FATAL: dialog_err',
        description: err.message || 'Failed to open file dialog',
        variant: 'destructive'
      })
    }
  }

  return (
    <div>
      <div className="flex items-center mb-4 mt-4">
        <div className="flex flex-col w-full">
          <h3 className="text-lg mb-2">Add Mod Files</h3>
          <p className="text-sm text-app-secondary mb-4">
            Add the mod files in the order they should be loaded. Drag the handle to reorder.
          </p>
        </div>
        <div className="flex justify-end w-full">
          <Button
            size="sm"
            variant="outline"
            onClick={handleAddFile}
            className="bg-app-primary hover:bg-app-hover text-app-primary border-app"
            type="button"
          >
            <PlusIcon className="h-4 w-4 mr-1" />
            Add file
          </Button>
        </div>
      </div>

      {value.length === 0 ? (
        <div className="text-center text-app-muted py-8 border border-dashed border-app rounded">
          No mod files added. Click &quot;Add file&quot; to begin.
        </div>
      ) : (
        <div className="space-y-3" onDragOver={handleDragOver} onDrop={handleDrop}>
          {value.map((file, index) => {
            const isDragged = draggedIndex === index
            const showPlaceholderBefore = insertionIndex === index && draggedIndex !== index

            return (
              <Fragment key={file.id}>
                {showPlaceholderBefore && (
                  <div className="h-12 border-2 border-dashed border-accent-highlight/30 rounded-md flex items-center justify-center bg-accent-highlight/5 animate-in fade-in zoom-in-95 duration-200">
                    <span className="text-accent-highlight text-sm tracking-widest uppercase opacity-60">
                      drop here
                    </span>
                  </div>
                )}

                <div
                  data-drag-index={index}
                  className={`flex items-center gap-2 bg-app-primary p-2 rounded transition-all duration-150 border select-none ${
                    isDragged
                      ? 'hidden'
                      : 'border-transparent hover:border-accent-highlight/30 group'
                  }`}
                >
                  <button
                    type="button"
                    draggable
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragEnd={handleDragEnd}
                    className="shrink-0 cursor-grab active:cursor-grabbing text-app-muted opacity-40 group-hover:opacity-100 transition-opacity"
                    tabIndex={-1}
                    aria-label="Reorder"
                  >
                    <GripVertical className="h-4 w-4" />
                  </button>

                  <div className="text-app-muted text-xs font-semibold font-mono w-4 text-center shrink-0">
                    {index + 1}
                  </div>

                  <div className="flex-1 flex items-center gap-1">
                    <Input
                      placeholder="Pretty name"
                      value={file.name || ''}
                      onChange={(e) => handleUpdateFile(index, 'name', e.target.value)}
                      className="bg-app-primary border-app"
                    />
                    {file.version && (
                      <span className="text-xs text-app-muted whitespace-nowrap shrink-0">
                        ({file.version})
                      </span>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => file.url && window.open(file.url, '_blank')}
                      className={`p-1 h-8 w-8 shrink-0 opacity-40 group-hover:opacity-100 transition-opacity ${file.url ? 'text-app-muted hover:text-app-primary' : 'text-app-muted/30 cursor-not-allowed'}`}
                      title={file.url || 'No URL'}
                      type="button"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                    {!file.filePath && (
                      <span className="text-xs bg-red-900/50 text-red-300 px-1.5 py-0.5 rounded shrink-0">
                        missing
                      </span>
                    )}
                  </div>

                  <div className="w-24">
                    <Select
                      value={file.fileType}
                      onValueChange={(value) => handleUpdateFile(index, 'fileType', value)}
                    >
                      <SelectTrigger className="bg-app-primary border-app">
                        <SelectValue placeholder="Type" />
                      </SelectTrigger>
                      <SelectContent className="bg-app-secondary border-app">
                        <SelectItem value="WAD">WAD</SelectItem>
                        <SelectItem value="PK3">PK3</SelectItem>
                        <SelectItem value="ZIP">ZIP</SelectItem>
                        <SelectItem value="DEH">DEH</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Button
                    variant="outline"
                    onClick={() => handleBrowseFile(index)}
                    className="border-app shrink-0 opacity-40 group-hover:opacity-100 transition-opacity"
                    type="button"
                  >
                    <FolderOpenIcon className="h-4 w-4" />
                  </Button>

                  <div className="w-32">
                    <Combobox
                      value=""
                      onValueChange={(value) => {
                        if (value) handleSelectCatalogFile(index, parseInt(value, 10))
                      }}
                      options={selectableFiles.map((f) => ({
                        value: f.id.toString(),
                        label: f.name + (f.version ? ` (${f.version})` : '')
                      }))}
                      placeholder="Catalog..."
                      className="bg-app-primary border-app"
                      disabled={selectableFiles.length === 0}
                    />
                  </div>

                  <Button
                    variant="ghost"
                    onClick={() => handleRemoveFile(index)}
                    className="text-red-500 hover:text-red-700 hover:bg-transparent opacity-40 group-hover:opacity-100 transition-opacity"
                    type="button"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </Button>
                </div>
              </Fragment>
            )
          })}

          {insertionIndex === value.length && draggedIndex !== value.length - 1 && (
            <div className="h-12 border-2 border-dashed border-accent-highlight/30 rounded-md flex items-center justify-center bg-accent-highlight/5 animate-in fade-in zoom-in-95 duration-200">
              <span className="text-sm text-accent-highlight tracking-widest uppercase opacity-60">
                new placement
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
