import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { IModFile } from '@shared/schema'
import { Trash2, Plus, FolderOpen, Pencil, Check, X } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { api } from '@/api'

interface CatalogManagerProps {
  files: IModFile[]
  onChange: (files: IModFile[]) => void
}

export function CatalogManager({ files, onChange }: CatalogManagerProps): React.ReactElement {
  const { toast } = useToast()
  const [newFilePath, setNewFilePath] = useState('')
  const [newFileName, setNewFileName] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')

  const handleRemoveFile = (id: number): void => {
    onChange(files.filter((f) => f.id !== id))
  }

  const handleMoveFileToModFolder = async (sourcePath: string): Promise<string> => {
    try {
      const result = await api.moveToModFolder(sourcePath)
      return result.fullPath
    } catch (error) {
      console.error('Failed to move file:', error)
      return sourcePath
    }
  }

  const handleAddFile = async (): Promise<void> => {
    if (!newFilePath.trim()) return

    const fileName = newFilePath.split(/[\\/]/).pop() || newFilePath
    const prettyName = newFileName.trim() || fileName.replace(/\.[^.]+$/, '')
    const extension = fileName.split('.').pop()?.toUpperCase() || ''
    let fileType = 'WAD'

    if (extension === 'PK3' || extension === 'IPK3' || extension === 'ZIP') {
      fileType = 'PK3'
    } else if (extension === 'DEH' || extension === 'BEX') {
      fileType = 'DEH'
    } else if (extension === 'WAD') {
      fileType = 'WAD'
    }

    // Check if file already exists in catalog by file path
    const exists = files.some((f) => f.filePath === newFilePath || f.fileName === fileName)
    if (exists) {
      toast({
        title: 'File already exists',
        description: 'This file is already in your catalog',
        variant: 'destructive'
      })
      return
    }

    try {
      const newFilePathMoved = await handleMoveFileToModFolder(newFilePath)

      const newFile: IModFile = {
        id: Date.now(),
        modId: '0',
        name: prettyName,
        filePath: newFilePathMoved,
        fileType,
        loadOrder: 0,
        isRequired: true,
        fileName
      }

      // Add to top
      onChange([newFile, ...files])

      // Save to catalog
      await api.addToCatalog({
        name: prettyName,
        filePath: newFilePathMoved,
        fileType,
        fileName,
        loadOrder: 0,
        isRequired: true
      })

      toast({
        title: 'Success',
        description: `Added "${prettyName}" to catalog`
      })

      setNewFilePath('')
      setNewFileName('')
    } catch (error) {
      toast({
        title: 'Error',
        description: `Failed to add file: ${error}`,
        variant: 'destructive'
      })
    }
  }

  const handleBrowseFile = async (): Promise<void> => {
    try {
      const result = await api.showOpenDialog({
        title: 'Select Mod File',
        properties: ['openFile'],
        filters: [{ name: 'DOOM Files', extensions: ['wad', 'pk3', 'ipk3', 'deh', 'bex', 'zip'] }]
      })

      if (!result.canceled && result.filePaths.length > 0) {
        setNewFilePath(result.filePaths[0])
      }
    } catch (error) {
      console.error('Failed to open file dialog:', error)
    }
  }

  const handleDeleteFromCatalog = async (file: IModFile): Promise<void> => {
    if (
      !confirm(`Are you sure you want to remove "${file.name || file.fileName}" from the catalog?`)
    ) {
      return
    }
    try {
      await api.deleteFromCatalog(file.id)
      handleRemoveFile(file.id)
      toast({
        title: 'Success',
        description: `Removed "${file.name || file.fileName}" from catalog`
      })
    } catch {
      handleRemoveFile(file.id)
      toast({
        title: 'Warning',
        description: 'File removed from view (may need manual deletion from catalog)'
      })
    }
  }

  const handleStartEdit = (file: IModFile): void => {
    setEditingId(file.id)
    setEditName(file.name || '')
  }

  const handleSaveEdit = async (file: IModFile): Promise<void> => {
    if (!editName.trim()) {
      toast({
        title: 'Error',
        description: 'Name cannot be empty',
        variant: 'destructive'
      })
      return
    }
    try {
      await api.updateInCatalog(file.id, { name: editName.trim() })
      const updatedFiles = files.map((f) =>
        f.id === file.id ? { ...f, name: editName.trim() } : f
      )
      onChange(updatedFiles)
      toast({
        title: 'Success',
        description: 'Name updated'
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: `Failed to update name: ${error}`,
        variant: 'destructive'
      })
    }
    setEditingId(null)
    setEditName('')
  }

  const handleCancelEdit = (): void => {
    setEditingId(null)
    setEditName('')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Input
          value={newFilePath}
          onChange={(e) => setNewFilePath(e.target.value)}
          placeholder="Path to mod file (.wad, .pk3, etc.)"
          className="bg-app-primary border-app flex-1"
        />
        <Input
          value={newFileName}
          onChange={(e) => setNewFileName(e.target.value)}
          placeholder="Pretty name (optional)"
          className="bg-app-primary border-app w-48"
        />
        <Button
          type="button"
          variant="outline"
          onClick={handleBrowseFile}
          className="bg-app-secondary border-app"
        >
          <FolderOpen className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          onClick={handleAddFile}
          className="bg-accent-highlight hover:opacity-90"
          disabled={!newFilePath.trim()}
        >
          <Plus className="h-4 w-4 mr-1" />
          Add
        </Button>
      </div>

      {files.length === 0 ? (
        <div className="text-center text-app-secondary py-8">
          No files in catalog. Add files using the input above.
        </div>
      ) : (
        <div className="border border-app rounded-md overflow-hidden">
          <table className="w-full">
            <thead className="bg-app-primary">
              <tr>
                <th className="text-left p-3 text-xs font-semibold text-app-muted uppercase">
                  Name
                </th>
                <th className="text-left p-3 text-xs font-semibold text-app-muted uppercase">
                  Type
                </th>
                <th className="text-left p-3 text-xs font-semibold text-app-muted uppercase">
                  Path
                </th>
                <th className="text-right p-3 text-xs font-semibold text-app-muted uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {files.map((file) => (
                <tr key={file.id} className="group border-t border-app hover:bg-app-primary/50">
                  <td className="p-3 text-sm">
                    {editingId === file.id ? (
                      <div className="flex items-center gap-1">
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="bg-app-secondary border-app text-sm py-1"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveEdit(file)
                            if (e.key === 'Escape') handleCancelEdit()
                          }}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSaveEdit(file)}
                          className="text-green-500 hover:text-green-700 p-1"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleCancelEdit}
                          className="text-red-500 hover:text-red-700 p-1"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span>{file.name || file.fileName}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleStartEdit(file)}
                          className="text-app-muted hover:text-app-primary p-1 opacity-0 group-hover:opacity-100"
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </td>
                  <td className="p-3 text-sm">
                    <span className="px-2 py-1 bg-app-primary rounded text-xs">
                      {file.fileType}
                    </span>
                  </td>
                  <td
                    className="p-3 text-sm text-app-muted truncate max-w-[200px]"
                    title={file.filePath}
                  >
                    {file.filePath}
                  </td>
                  <td className="p-3 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteFromCatalog(file)}
                      className="text-red-500 hover:text-red-700 hover:bg-transparent"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="text-sm text-app-muted">{files.length} files in catalog</div>
    </div>
  )
}

export default CatalogManager
