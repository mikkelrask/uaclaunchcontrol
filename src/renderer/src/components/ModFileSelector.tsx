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
import { FolderOpenIcon, PlusIcon, TrashIcon, ExternalLink } from 'lucide-react'
import { gameService } from '@/lib/gameService'
import type { IModFile } from '@shared/schema'
import { useToast } from '@/hooks/use-toast'
import { api } from '@/api'

let _nextTempId = Date.now()

interface ModFileSelectorProps {
  value: IModFile[]
  onChange: (files: IModFile[]) => void
}

export function ModFileSelector({
  value = [],
  onChange
}: ModFileSelectorProps): React.ReactElement {
  const { toast } = useToast()
  const { data: catalogFiles = [], refetch: loadCatalogFiles } = useQuery({
    queryKey: ['/api/mod-files/catalog'],
    queryFn: () => gameService.getModFileCatalog()
  })

  const selectableFiles = catalogFiles.filter((f) => !f.sidecarOnly)

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
      console.log('[DEBUG] File moved successfully:', result)
      return result
    } catch (error) {
      console.error('Failed to move file:', error)
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

    newFiles.splice(index, 1, ...filesToInsert)
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
            console.log(
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
          } catch (err) {
            console.error('Failed to add to catalog eagerly:', err)
          }
        }

        console.log('Selected file:', selectedFilePath)
        console.log('New file path:', newFullPath)
        console.log('File name:', fileName)
        console.log('Detected type:', detectedType)

        const newFiles = [...value]
        newFiles[index] = {
          ...newFiles[index],
          id: fileToUse.id,
          filePath: fileToUse.filePath || relativePath,
          fileName: fileToUse.fileName || fileName,
          fileType: fileToUse.fileType || detectedType,
          hashValue: fileToUse.hashValue || fileHashValue,
          name: !newFiles[index].name ? fileToUse.name : newFiles[index].name,
          isRequired: newFiles[index].isRequired !== undefined ? newFiles[index].isRequired : true
        }

        console.log('Updating files with:', newFiles)
        onChange(newFiles)
      } else {
        console.log('No file selected or dialog canceled')
      }
    } catch (error) {
      const err = error as Error
      console.error('Failed to open file dialog:', error)
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
          <h3 className="text-lg mb-2">Mod Files</h3>
          <p className="text-sm text-app-secondary mb-4">
            Add the mod files in the order they should be loaded.
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
        <div className="text-center text-gray-400 py-4">
          No mod files added. Click &quot;Add File&quot; to begin.
        </div>
      ) : (
        <div className="space-y-3">
          {value.map((file, index) => (
            <div key={index} className="flex items-center gap-2">
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
                  className={`p-1 h-8 w-8 shrink-0 ${file.url ? 'text-app-muted hover:text-app-primary' : 'text-app-muted/30 cursor-not-allowed'}`}
                  title={file.url || 'No URL'}
                  type="button"
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
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
                className="border-app shrink-0"
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
                className="text-red-500 hover:text-red-700 hover:bg-transparent"
                type="button"
              >
                <TrashIcon className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
