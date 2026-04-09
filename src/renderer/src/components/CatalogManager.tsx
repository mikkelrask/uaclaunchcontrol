import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { IModFile } from '@shared/schema'
import {
  Trash2,
  Plus,
  FolderOpen,
  Pencil,
  Check,
  ExternalLink,
  ChevronUp,
  ChevronDown
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { api } from '@/api'
import { gameService } from '@/lib/gameService'

interface CatalogManagerProps {
  files: IModFile[]
  onChange: (files: IModFile[]) => void
}

interface RequiredModEntry {
  hash: string
  name: string
  filePath: string
  isNew: boolean
  offset: number
  sidecarOnly: boolean
}

export function CatalogManager({ files, onChange }: CatalogManagerProps): React.ReactElement {
  const { toast } = useToast()
  const [catalogFiles, setCatalogFiles] = useState<IModFile[]>([])
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [selectedFile, setSelectedFile] = useState<IModFile | null>(null)

  const [addForm, setAddForm] = useState({
    name: '',
    filePath: '',
    fileType: 'PK3',
    version: '',
    url: '',
    requires: [] as RequiredModEntry[],
    sidecarOnly: false
  })

  const [editForm, setEditForm] = useState({
    name: '',
    version: '',
    url: '',
    requires: [] as RequiredModEntry[],
    sidecarOnly: false
  })

  const loadCatalogFiles = async (): Promise<void> => {
    try {
      const allFiles = await gameService.getModFileCatalog()
      setCatalogFiles(Array.isArray(allFiles) ? allFiles : [])
    } catch (error) {
      console.error('Failed to load catalog files:', error)
    }
  }

  useEffect(() => {
    loadCatalogFiles()
  }, [])

  const availableRequiredFiles = catalogFiles.filter((f) => !f.sidecarOnly && f.hashValue)

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

  const processRequiredMods = async (
    requiredMods: RequiredModEntry[]
  ): Promise<Record<string, number>> => {
    const result: Record<string, number> = {}

    for (const req of requiredMods) {
      if (req.isNew && req.filePath) {
        const newFilePath = await handleMoveFileToModFolder(req.filePath)
        const hash = await api.computeHash(newFilePath)
        const fileName = req.filePath.split(/[\\/]/).pop() || req.filePath

        await api.addToCatalog({
          name: req.name,
          filePath: newFilePath,
          fileType: addForm.fileType,
          fileName: fileName,
          sidecarOnly: req.sidecarOnly
        })

        result[hash] = req.offset
      } else {
        result[req.hash] = req.offset
      }
    }

    return result
  }

  const handleAddFile = async (): Promise<void> => {
    if (!addForm.filePath.trim()) return

    const fileName = addForm.filePath.split(/[\\/]/).pop() || addForm.filePath
    const prettyName = addForm.name.trim() || fileName.replace(/\.[^.]+$/, '')
    const extension = fileName.split('.').pop()?.toUpperCase() || ''
    let fileType = 'WAD'

    if (extension === 'PK3' || extension === 'IPK3' || extension === 'ZIP') {
      fileType = 'PK3'
    } else if (extension === 'DEH' || extension === 'BEX') {
      fileType = 'DEH'
    } else if (extension === 'WAD') {
      fileType = 'WAD'
    }

    const exists = files.some((f) => f.filePath === addForm.filePath || f.fileName === fileName)
    if (exists) {
      toast({
        title: 'File already exists',
        description: 'This file is already in your catalog',
        variant: 'destructive'
      })
      return
    }

    try {
      const newFilePathMoved = await handleMoveFileToModFolder(addForm.filePath)
      const hashValue = await api.computeHash(newFilePathMoved)

      const selfRefCheck = addForm.requires.some((r) => r.isNew && r.filePath === addForm.filePath)
      if (selfRefCheck) {
        toast({
          title: 'Invalid required mod',
          description: 'A mod cannot require itself',
          variant: 'destructive'
        })
        return
      }

      const processedRequires = await processRequiredMods(addForm.requires)

      const newFile: IModFile = {
        id: Date.now(),
        name: prettyName,
        filePath: newFilePathMoved,
        fileType,
        fileName,
        version: addForm.version,
        url: addForm.url,
        hashValue,
        requires: processedRequires,
        sidecarOnly: addForm.sidecarOnly
      }

      onChange([newFile, ...files])

      await api.addToCatalog({
        name: prettyName,
        filePath: newFilePathMoved,
        fileType,
        fileName,
        version: addForm.version,
        url: addForm.url,
        hashValue,
        requires: processedRequires,
        sidecarOnly: addForm.sidecarOnly
      })

      for (const req of addForm.requires) {
        if (req.isNew && req.filePath) {
          continue
        }
        const reqFile = catalogFiles.find((f) => f.hashValue === req.hash)
        if (reqFile) {
          const updates: Partial<IModFile> = {
            requiredBy: [...(reqFile.requiredBy || []), hashValue].filter(Boolean)
          }
          if (req.sidecarOnly !== reqFile.sidecarOnly) {
            updates.sidecarOnly = req.sidecarOnly
          }
          await api.updateInCatalog(reqFile.id, updates)
        }
      }

      toast({
        title: 'Success',
        description: `Added "${prettyName}" to catalog`
      })

      setIsAddModalOpen(false)
      setAddForm({
        name: '',
        filePath: '',
        fileType: 'PK3',
        version: '',
        url: '',
        requires: [],
        sidecarOnly: false
      })
      loadCatalogFiles()
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
        const selectedPath = result.filePaths[0]
        setAddForm((prev) => ({
          ...prev,
          filePath: selectedPath,
          name:
            prev.name ||
            selectedPath
              .split(/[\\/]/)
              .pop()
              ?.replace(/\.[^.]+$/, '') ||
            ''
        }))
      }
    } catch (error) {
      console.error('Failed to open file dialog:', error)
    }
  }

  const handleAddRequiredFromCatalog = (form: 'add' | 'edit', catalogFileId: number): void => {
    const catalogFile = catalogFiles.find((f) => f.id === catalogFileId)
    if (!catalogFile || !catalogFile.hashValue) return

    const newReq: RequiredModEntry = {
      hash: catalogFile.hashValue,
      name: catalogFile.name || '',
      filePath: catalogFile.filePath || '',
      isNew: false,
      offset: form === 'add' ? addForm.requires.length + 1 : editForm.requires.length + 1,
      sidecarOnly: catalogFile.sidecarOnly || false
    }

    if (form === 'add') {
      setAddForm((prev) => ({ ...prev, requires: [...prev.requires, newReq] }))
    } else {
      setEditForm((prev) => ({ ...prev, requires: [...prev.requires, newReq] }))
    }
  }

  const handleBrowseRequiredFile = async (form: 'add' | 'edit'): Promise<void> => {
    try {
      const result = await api.showOpenDialog({
        title: 'Select Required Mod File',
        properties: ['openFile'],
        filters: [{ name: 'DOOM Files', extensions: ['wad', 'pk3', 'ipk3', 'deh', 'bex', 'zip'] }]
      })

      if (!result.canceled && result.filePaths.length > 0) {
        const selectedPath = result.filePaths[0]
        const fileName = selectedPath.split(/[\\/]/).pop() || selectedPath

        const newReq: RequiredModEntry = {
          hash: '',
          name: fileName.replace(/\.[^.]+$/, ''),
          filePath: selectedPath,
          isNew: true,
          offset: form === 'add' ? addForm.requires.length + 1 : editForm.requires.length + 1,
          sidecarOnly: false
        }

        if (form === 'add') {
          setAddForm((prev) => ({ ...prev, requires: [...prev.requires, newReq] }))
        } else {
          setEditForm((prev) => ({ ...prev, requires: [...prev.requires, newReq] }))
        }
      }
    } catch (error) {
      console.error('Failed to open file dialog:', error)
    }
  }

  const handleRemoveRequiredMod = (form: 'add' | 'edit', index: number): void => {
    if (form === 'add') {
      setAddForm((prev) => ({ ...prev, requires: prev.requires.filter((_, i) => i !== index) }))
    } else {
      setEditForm((prev) => ({ ...prev, requires: prev.requires.filter((_, i) => i !== index) }))
    }
  }

  const handleMoveRequiredUp = (form: 'add' | 'edit', index: number): void => {
    if (index === 0) return
    if (form === 'add') {
      setAddForm((prev) => {
        const newRequires = [...prev.requires]
        const temp = newRequires[index]
        newRequires[index] = newRequires[index - 1]
        newRequires[index - 1] = temp
        return { ...prev, requires: newRequires }
      })
    } else {
      setEditForm((prev) => {
        const newRequires = [...prev.requires]
        const temp = newRequires[index]
        newRequires[index] = newRequires[index - 1]
        newRequires[index - 1] = temp
        return { ...prev, requires: newRequires }
      })
    }
  }

  const handleMoveRequiredDown = (form: 'add' | 'edit', index: number): void => {
    const currentList = form === 'add' ? addForm.requires : editForm.requires
    if (index >= currentList.length - 1) return
    if (form === 'add') {
      setAddForm((prev) => {
        const newRequires = [...prev.requires]
        const temp = newRequires[index]
        newRequires[index] = newRequires[index + 1]
        newRequires[index + 1] = temp
        return { ...prev, requires: newRequires }
      })
    } else {
      setEditForm((prev) => {
        const newRequires = [...prev.requires]
        const temp = newRequires[index]
        newRequires[index] = newRequires[index + 1]
        newRequires[index + 1] = temp
        return { ...prev, requires: newRequires }
      })
    }
  }

  const handleToggleRequiredSidecar = async (
    form: 'add' | 'edit',
    index: number
  ): Promise<void> => {
    const currentForm = form === 'add' ? addForm : editForm
    const req = currentForm.requires[index]
    if (!req || !req.hash) return

    const newValue = !req.sidecarOnly
    if (form === 'add') {
      setAddForm((prev) => ({
        ...prev,
        requires: prev.requires.map((r, i) => (i === index ? { ...r, sidecarOnly: newValue } : r))
      }))
    } else {
      setEditForm((prev) => ({
        ...prev,
        requires: prev.requires.map((r, i) => (i === index ? { ...r, sidecarOnly: newValue } : r))
      }))
    }

    const reqFile = catalogFiles.find((f) => f.hashValue === req.hash)
    if (!reqFile) return

    await api.updateInCatalog(reqFile.id, { sidecarOnly: newValue })

    onChange(files.map((f) => (f.hashValue === req.hash ? { ...f, sidecarOnly: newValue } : f)))

    loadCatalogFiles()
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

  const handleOpenEditModal = (file: IModFile): void => {
    const existingRequires: RequiredModEntry[] = []
    if (file.requires) {
      for (const [hash, offset] of Object.entries(file.requires)) {
        const reqFile = catalogFiles.find((f) => f.hashValue === hash)
        if (reqFile) {
          existingRequires.push({
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

    setSelectedFile(file)
    setEditForm({
      name: file.name || '',
      version: file.version || '',
      url: file.url || '',
      requires: existingRequires,
      sidecarOnly: file.sidecarOnly || false
    })
    setIsEditModalOpen(true)
  }

  const handleSaveEdit = async (): Promise<void> => {
    if (!selectedFile || !editForm.name.trim()) {
      toast({
        title: 'Error',
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

      const selfRefCheck = editForm.requires.some(
        (r) => r.isNew && r.filePath === selectedFile.filePath
      )
      if (selfRefCheck) {
        toast({
          title: 'Invalid required mod',
          description: 'A mod cannot require itself',
          variant: 'destructive'
        })
        return
      }

      const processedRequires = await processRequiredMods(editForm.requires)

      const updates: Partial<IModFile> = {
        name: editForm.name.trim(),
        version: editForm.version,
        url: editForm.url,
        requires: processedRequires,
        sidecarOnly: editForm.sidecarOnly
      }

      if (hashValue) {
        updates.hashValue = hashValue
      }

      await api.updateInCatalog(selectedFile.id, updates)
      const updatedFiles = files.map((f) => (f.id === selectedFile.id ? { ...f, ...updates } : f))
      onChange(updatedFiles)

      for (const req of editForm.requires) {
        if (req.isNew && req.filePath) {
          continue
        }
        const reqFile = catalogFiles.find((f) => f.hashValue === req.hash)
        if (reqFile && req.sidecarOnly !== reqFile.sidecarOnly) {
          await api.updateInCatalog(reqFile.id, { sidecarOnly: req.sidecarOnly })
        }
      }

      toast({
        title: 'Success',
        description: 'File updated'
      })
      setIsEditModalOpen(false)
      setSelectedFile(null)
      loadCatalogFiles()
    } catch (error) {
      toast({
        title: 'Error',
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

  const openAddModal = (): void => {
    setAddForm({
      name: '',
      filePath: '',
      fileType: 'PK3',
      version: '',
      url: '',
      requires: [],
      sidecarOnly: false
    })
    setIsAddModalOpen(true)
  }

  const selectableFilesForAdd = availableRequiredFiles.filter(
    (f) => !addForm.requires.some((r) => r.hash === f.hashValue)
  )

  const selectableFilesForEdit = availableRequiredFiles.filter(
    (f) =>
      !editForm.requires.some((r) => r.hash === f.hashValue) &&
      f.hashValue !== selectedFile?.hashValue
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          onClick={openAddModal}
          className="bg-accent-highlight hover:opacity-90"
        >
          <Plus className="h-4 w-4 mr-1" />
          Add Mod File
        </Button>
      </div>

      {files.length === 0 ? (
        <div className="text-center text-app-secondary py-8">
          No files in catalog. Add files using the button above.
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
                  Version
                </th>
                <th className="text-left p-3 text-xs font-semibold text-app-muted uppercase">
                  Type
                </th>
                <th className="text-left p-3 text-xs font-semibold text-app-muted uppercase">
                  Hash
                </th>
                <th className="text-left p-3 text-xs font-semibold text-app-muted uppercase">
                  Requires
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
                    <div className="flex items-center gap-2">
                      <span>{file.name || file.fileName}</span>
                      {file.sidecarOnly && (
                        <span className="px-1.5 py-0.5 bg-yellow-900/50 text-yellow-500 text-xs rounded">
                          sidecar
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-3 text-sm text-app-muted">{file.version || '-'}</td>
                  <td className="p-3 text-sm">
                    <span className="px-2 py-1 bg-app-primary rounded text-xs">
                      {file.fileType}
                    </span>
                  </td>
                  <td className="p-3 text-sm text-app-muted font-mono text-xs">
                    {file.hashValue ? (
                      <span title={file.hashValue}>{file.hashValue.slice(0, 8)}...</span>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="p-3 text-sm text-app-muted">
                    {file.requires && Object.keys(file.requires).length > 0
                      ? Object.keys(file.requires).length
                      : '-'}
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex items-center gap-1 justify-end">
                      {file.url && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenUrl(file.url!)}
                          className="text-app-muted hover:text-app-primary p-1"
                          title="Open URL"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenEditModal(file)}
                        className="text-app-muted hover:text-app-primary p-1"
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteFromCatalog(file)}
                        className="text-red-500 hover:text-red-700 hover:bg-transparent"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="text-sm text-app-muted">{files.length} files in catalog</div>

      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="bg-app-primary border-app max-w-md max-h-[80vh] overflow-y-auto">
          <DialogTitle>Add Mod File to Catalog</DialogTitle>
          <DialogDescription>
            Add a mod file to your catalog. The file will be copied to your mods folder.
          </DialogDescription>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="add-file-select">Select File</Label>
              <div className="flex gap-2">
                <Input
                  id="add-file-select"
                  value={addForm.filePath}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, filePath: e.target.value }))}
                  placeholder="Path to mod file"
                  className="bg-app-secondary border-app flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBrowseFile}
                  className="bg-app-secondary border-app"
                >
                  <FolderOpen className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="add-name">Name</Label>
              <Input
                id="add-name"
                value={addForm.name}
                onChange={(e) => setAddForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Pretty name for the mod"
                className="bg-app-secondary border-app"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="add-version">Version</Label>
              <Input
                id="add-version"
                value={addForm.version}
                onChange={(e) => setAddForm((prev) => ({ ...prev, version: e.target.value }))}
                placeholder="e.g., 1.0, v2.1"
                className="bg-app-secondary border-app"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="add-url">URL (ModDB, forum)</Label>
              <Input
                id="add-url"
                value={addForm.url}
                onChange={(e) => setAddForm((prev) => ({ ...prev, url: e.target.value }))}
                placeholder="https://www.moddb.com/mods/..."
                className="bg-app-secondary border-app"
              />
            </div>

            <div className="space-y-2">
              <Label>Required Mods (optional)</Label>
              <div className="space-y-2">
                {addForm.requires.map((req, idx) => (
                  <div key={idx} className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleMoveRequiredUp('add', idx)}
                      disabled={idx === 0}
                      className="text-app-primary hover:text-app-primary disabled:opacity-30 p-1"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleMoveRequiredDown('add', idx)}
                      disabled={idx >= addForm.requires.length - 1}
                      className="text-app-primary hover:text-app-primary disabled:opacity-30 p-1"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                    <span className="text-xs mr-2 w-6 text-center">{idx + 1}.</span>
                    <Input
                      value={req.isNew ? `[NEW] ${req.name}` : req.name}
                      readOnly
                      className="bg-app-secondary border-app flex-1"
                    />
                    <input
                      type="checkbox"
                      checked={req.sidecarOnly}
                      onChange={() => handleToggleRequiredSidecar('add', idx)}
                      className="w-4 h-4"
                      title="Sidecar only"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveRequiredMod('add', idx)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <Select
                    onValueChange={(value) => {
                      const fileId = parseInt(value, 10)
                      if (fileId) handleAddRequiredFromCatalog('add', fileId)
                    }}
                  >
                    <SelectTrigger className="bg-app-secondary border-app flex-1">
                      <SelectValue placeholder="Add from catalog..." />
                    </SelectTrigger>
                    <SelectContent className="bg-app-secondary border-app">
                      {selectableFilesForAdd.length === 0 ? (
                        <SelectItem value="none" disabled>
                          No mods available
                        </SelectItem>
                      ) : (
                        selectableFilesForAdd.map((f) => (
                          <SelectItem key={f.id} value={f.id.toString()}>
                            {f.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleBrowseRequiredFile('add')}
                    className="bg-app-secondary border-app"
                  >
                    <FolderOpen className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                id="add-sidecar"
                type="checkbox"
                checked={addForm.sidecarOnly}
                onChange={(e) => setAddForm((prev) => ({ ...prev, sidecarOnly: e.target.checked }))}
                className="w-4 h-4"
              />
              <Label htmlFor="add-sidecar" className="text-sm font-normal">
                Sidecar only (only shown when adding required mods)
              </Label>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setIsAddModalOpen(false)}
              className="bg-app-secondary"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddFile}
              disabled={!addForm.filePath.trim()}
              className="bg-accent-highlight"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add to Catalog
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="bg-app-primary border-app max-w-md max-h-[80vh] overflow-y-auto">
          <DialogTitle>Edit Mod File</DialogTitle>
          <DialogDescription>Update the mod file details in your catalog.</DialogDescription>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={editForm.name}
                onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                className="bg-app-secondary border-app"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-version">Version</Label>
              <Input
                id="edit-version"
                value={editForm.version}
                onChange={(e) => setEditForm((prev) => ({ ...prev, version: e.target.value }))}
                className="bg-app-secondary border-app"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-url">URL</Label>
              <Input
                id="edit-url"
                value={editForm.url}
                onChange={(e) => setEditForm((prev) => ({ ...prev, url: e.target.value }))}
                className="bg-app-secondary border-app"
              />
            </div>

            <div className="space-y-2">
              <Label>Required Mods (optional)</Label>
              <div className="space-y-2">
                {editForm.requires.map((req, idx) => (
                  <div key={idx} className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleMoveRequiredUp('edit', idx)}
                      disabled={idx === 0}
                      className="text-app-primary hover:text-app-primary disabled:opacity-30 p-1"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleMoveRequiredDown('edit', idx)}
                      disabled={idx >= editForm.requires.length - 1}
                      className="text-app-primary hover:text-app-primary disabled:opacity-30 p-1"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                    <span className="text-xs mr-2 w-6 text-center">{idx + 1}.</span>
                    <Input
                      value={req.isNew ? `[NEW] ${req.name}` : req.name}
                      readOnly
                      className="bg-app-secondary border-app flex-1"
                    />
                    <input
                      type="checkbox"
                      checked={req.sidecarOnly}
                      onChange={() => handleToggleRequiredSidecar('edit', idx)}
                      className="w-4 h-4"
                      title="Sidecar only"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveRequiredMod('edit', idx)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <Select
                    onValueChange={(value) => {
                      const fileId = parseInt(value, 10)
                      if (fileId) handleAddRequiredFromCatalog('edit', fileId)
                    }}
                  >
                    <SelectTrigger className="bg-app-secondary border-app flex-1">
                      <SelectValue placeholder="Add from catalog..." />
                    </SelectTrigger>
                    <SelectContent className="bg-app-secondary border-app">
                      {selectableFilesForEdit.length === 0 ? (
                        <SelectItem value="none" disabled>
                          No mods available
                        </SelectItem>
                      ) : (
                        selectableFilesForEdit.map((f) => (
                          <SelectItem key={f.id} value={f.id.toString()}>
                            {f.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleBrowseRequiredFile('edit')}
                    className="bg-app-secondary border-app"
                  >
                    <FolderOpen className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                id="edit-sidecar"
                type="checkbox"
                checked={editForm.sidecarOnly}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, sidecarOnly: e.target.checked }))
                }
                className="w-4 h-4"
              />
              <Label htmlFor="edit-sidecar" className="text-sm font-normal">
                Sidecar only
              </Label>
            </div>

            {selectedFile?.hashValue && (
              <div className="text-xs text-app-muted">
                <span className="font-semibold">Hash:</span> {selectedFile.hashValue}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setIsEditModalOpen(false)}
              className="bg-app-secondary"
            >
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} className="bg-accent-highlight">
              <Check className="h-4 w-4 mr-1" />
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default CatalogManager
