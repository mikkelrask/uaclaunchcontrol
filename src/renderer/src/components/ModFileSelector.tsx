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
import { FolderOpenIcon, PlusIcon, TrashIcon } from 'lucide-react'
import { gameService } from '@/lib/gameService'
import type { IModFile } from '@shared/schema'
import { useToast } from '@/hooks/use-toast'
import { api } from '@/api'

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
      id: Date.now(),
      name: '',
      filePath: '',
      fileType: 'WAD',
      isRequired: true,
      fileName: ''
    }
    onChange([...value, newFile])
  }

  const handleMoveFileToModFolder = async (sourcePath: string): Promise<string> => {
    try {
      const result = await api.moveToModFolder(sourcePath)
      console.log('[DEBUG] File moved successfully:', result)
      toast({
        title: 'SYSTEM: copy_done',
        description: 'You mod have been successfully been copied to your mods directory.',
        variant: 'default'
      })
      return result.fullPath
    } catch (error) {
      console.error('Failed to move file:', error)
      toast({
        title: 'FATAL: copy.fail',
        description:
          'Could not copy file to mods directory - check settings and mod, and try again.',
        variant: 'destructive'
      })
      return sourcePath
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
      if (extension === 'PK3' || extension === 'IPK3' || extension === 'ZIP') {
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
            if (ext === 'PK3' || ext === 'IPK3' || ext === 'ZIP') fileType = 'PK3'
            else if (ext === 'DEH' || ext === 'BEX') fileType = 'DEH'
            else fileType = 'WAD'
          }
          filesToInsert.push({
            id: reqFile.id,
            name: reqFile.name,
            filePath: reqFile.filePath,
            fileType: fileType || 'WAD',
            fileName: reqFile.fileName,
            isRequired: true
          })
        }
      }
    } else {
      let fileType = catalogFile.fileType
      if (!fileType && catalogFile.fileName) {
        const ext = catalogFile.fileName.split('.').pop()?.toUpperCase() || ''
        if (ext === 'PK3' || ext === 'IPK3' || ext === 'ZIP') fileType = 'PK3'
        else if (ext === 'DEH' || ext === 'BEX') fileType = 'DEH'
        else fileType = 'WAD'
      }
      filesToInsert.push({
        id: catalogFile.id,
        name: catalogFile.name,
        filePath: catalogFile.filePath,
        fileType: fileType || 'WAD',
        fileName: catalogFile.fileName,
        isRequired: true
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
        if (extension === 'PK3' || extension === 'IPK3' || extension === 'ZIP') {
          detectedType = 'PK3'
        } else if (extension === 'DEH' || extension === 'BEX') {
          detectedType = 'DEH'
        } else if (extension === 'WAD') {
          detectedType = 'WAD'
        }

        const newFilePath = await handleMoveFileToModFolder(selectedFilePath)

        let catalogId = Date.now()
        try {
          const savedCatalogFile = await api.addToCatalog({
            name: fileName,
            filePath: newFilePath,
            fileType: detectedType,
            fileName: fileName
          })
          catalogId = savedCatalogFile.id
          loadCatalogFiles()
        } catch (err) {
          console.error('Failed to add to catalog eagerly:', err)
        }

        console.log('Selected file:', selectedFilePath)
        console.log('New file path:', newFilePath)
        console.log('File name:', fileName)
        console.log('Detected type:', detectedType)

        const newFiles = [...value]
        newFiles[index] = {
          ...newFiles[index],
          id: catalogId,
          filePath: newFilePath,
          fileName: fileName,
          fileType: detectedType,
          name: !newFiles[index].name ? fileName : newFiles[index].name,
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
        title: 'Error',
        description: err.message || 'Failed to open file dialog',
        variant: 'destructive'
      })
    }
  }

  return (
    <div>
      <div className="flex items-center mb-4 mt-4">
        <div className="flex flex-col w-full">
          <h2 className="text-lg font-semibold">Mod Files</h2>
          <p className="text-sm text-app-secondary mb-4">
            Add the mod files in the order they should be loaded.
          </p>
        </div>
        <div className="flex justify-end w-full">
          <Button
            size="sm"
            variant={'default'}
            onClick={handleAddFile}
            className="bg-accent-highlight text-app-primary opacity-90 hover:opacity-100 hover:bg-accent-highlight"
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
              <div className="flex-1 flex items-center gap-2">
                <Input
                  placeholder="Pretty name"
                  value={file.name || ''}
                  onChange={(e) => handleUpdateFile(index, 'name', e.target.value)}
                  className="bg-app-primary border-app"
                />
                {file.version && (
                  <span className="text-xs text-app-muted whitespace-nowrap">({file.version})</span>
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
                    <SelectItem value="DEH">DEH</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex-1 flex gap-1">
                <Input
                  placeholder="File path"
                  value={file.filePath || ''}
                  onChange={(e) => handleUpdateFile(index, 'filePath', e.target.value)}
                  className="bg-app-primary border-app flex-1"
                />
                <Button
                  variant="outline"
                  onClick={() => handleBrowseFile(index)}
                  className="border-app"
                  type="button"
                >
                  <FolderOpenIcon className="h-4 w-4" />
                </Button>
              </div>

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
