import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Combobox } from '@/components/ui/combobox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { DataTable } from '@/components/ui/data-table'
import { getCatalogColumns } from '@/components/catalog-columns'
import { IModFile } from '@shared/schema'
import { Trash2, Plus, FolderOpen, Check, ChevronUp, ChevronDown, Upload } from 'lucide-react'
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
  isMain?: boolean
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
    loadOrder: [] as RequiredModEntry[],
    sidecarOnly: false
  })
  const [isDraggingFile, setIsDraggingFile] = useState(false)
  const [showSidecarOnly, setShowSidecarOnly] = useState(false)
  const [fileTypeFilter, setFileTypeFilter] = useState<string>('all')

  const [editForm, setEditForm] = useState({
    name: '',
    version: '',
    url: '',
    loadOrder: [] as RequiredModEntry[],
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
    const result = await api.moveToModFolder(sourcePath)
    return result.fullPath
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
        const newFilePath = await handleMoveFileToModFolder(req.filePath)
        const hash = await api.computeHash(newFilePath)
        if (!hash) continue // Skip if hash computation failed

        const fileName = req.filePath.split(/[\\/]/).pop() || req.filePath

        // Derive fileType from extension
        const ext = fileName.split('.').pop()?.toUpperCase() || ''
        let reqFileType = 'WAD'
        if (ext === 'PK3' || ext === 'IPK3' || ext === 'ZIP') reqFileType = 'PK3'
        else if (ext === 'DEH' || ext === 'BEX') reqFileType = 'DEH'

        await api.addToCatalog({
          name: req.name,
          filePath: newFilePath,
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

      const selfRefCheck = addForm.loadOrder.some(
        (r) => r.isNew && !r.isMain && r.filePath === addForm.filePath
      )
      if (selfRefCheck) {
        toast({
          title: 'Invalid required mod',
          description: 'A mod cannot require itself',
          variant: 'destructive'
        })
        return
      }

      const processedLoadOrder = await processRequiredMods(addForm.loadOrder, hashValue)

      await api.addToCatalog({
        name: prettyName,
        filePath: newFilePathMoved,
        fileType,
        fileName,
        version: addForm.version,
        url: addForm.url,
        hashValue,
        loadOrder: processedLoadOrder,
        sidecarOnly: addForm.sidecarOnly
      })

      for (const req of addForm.loadOrder) {
        if (req.isMain) continue
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
        loadOrder: [],
        sidecarOnly: false
      })

      // Fetch fresh authoritative list and notify parent
      const freshCatalog = await gameService.getModFileCatalog()
      setCatalogFiles(freshCatalog)
      onChange(freshCatalog)
    } catch (error) {
      toast({
        title: 'Error',
        description: `Failed to add file: ${error}`,
        variant: 'destructive'
      })
    }
  }

  const handleBrowseFile = async (): Promise<void> => {
    setAddForm({
      name: '',
      filePath: '',
      fileType: 'PK3',
      version: '',
      url: '',
      loadOrder: [],
      sidecarOnly: false
    })

    try {
      const result = await api.showOpenDialog({
        title: 'Select Mod File',
        properties: ['openFile'],
        filters: [{ name: 'Mod stuff', extensions: ['wad', 'pk3', 'ipk3', 'deh', 'bex', 'zip'] }]
      })

      if (!result.canceled && result.filePaths.length > 0) {
        const selectedPath = result.filePaths[0]
        setAddForm((prev) => {
          const name =
            selectedPath
              .split(/[\\/]/)
              .pop()
              ?.replace(/\.[^.]+$/, '') || ''
          const newLoadOrder = [...prev.loadOrder]
          const mainIdx = newLoadOrder.findIndex((req) => req.isMain)
          if (mainIdx >= 0) {
            newLoadOrder[mainIdx] = { ...newLoadOrder[mainIdx], filePath: selectedPath, name }
          } else {
            newLoadOrder.unshift({
              hash: '',
              name,
              filePath: selectedPath,
              isNew: true,
              offset: 1,
              sidecarOnly: false,
              isMain: true
            })
          }
          return {
            ...prev,
            filePath: selectedPath,
            name: prev.name || name,
            loadOrder: newLoadOrder
          }
        })
        setIsAddModalOpen(true)
      }
    } catch (error) {
      console.error('Failed to open file dialog:', error)
    }
  }

  const handleFileDragOver = (e: React.DragEvent): void => {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingFile(true)
  }

  const handleFileDragLeave = (e: React.DragEvent): void => {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingFile(false)
  }

  const handleFileDrop = (e: React.DragEvent): void => {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingFile(false)

    const droppedFiles = e.dataTransfer.files
    if (droppedFiles.length > 0) {
      const file = droppedFiles[0]
      const droppedPath = (window as any).api.getPathForFile(file) || file.name

      const ext = droppedPath.split('.').pop()?.toLowerCase()
      const validExtensions = ['wad', 'pk3', 'ipk3', 'deh', 'bex', 'zip']
      if (!ext || !validExtensions.includes(ext)) {
        toast({
          title: 'FATAL: type_unknow',
          description: 'Please only use supported files: wad, pk3, ipk3, deh, bex, zip',
          variant: 'destructive'
        })
        return
      }

      setAddForm((prev) => {
        const name =
          droppedPath
            .split(/[\\/]/)
            .pop()
            ?.replace(/\.[^.]+$/, '') || ''
        const newLoadOrder = [...prev.loadOrder]
        const mainIdx = newLoadOrder.findIndex((req) => req.isMain)
        if (mainIdx >= 0) {
          newLoadOrder[mainIdx] = { ...newLoadOrder[mainIdx], filePath: droppedPath, name }
        } else {
          newLoadOrder.unshift({
            hash: '',
            name,
            filePath: droppedPath,
            isNew: true,
            offset: 1,
            sidecarOnly: false,
            isMain: true
          })
        }
        return {
          ...prev,
          filePath: droppedPath,
          name: prev.name || name,
          loadOrder: newLoadOrder
        }
      })
      setIsAddModalOpen(true)
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
      offset: form === 'add' ? addForm.loadOrder.length + 1 : editForm.loadOrder.length + 1,
      sidecarOnly: catalogFile.sidecarOnly || false
    }

    if (form === 'add') {
      setAddForm((prev) => ({ ...prev, loadOrder: [...prev.loadOrder, newReq] }))
    } else {
      setEditForm((prev) => ({ ...prev, loadOrder: [...prev.loadOrder, newReq] }))
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
          offset: form === 'add' ? addForm.loadOrder.length + 1 : editForm.loadOrder.length + 1,
          sidecarOnly: false
        }

        if (form === 'add') {
          setAddForm((prev) => ({ ...prev, loadOrder: [...prev.loadOrder, newReq] }))
        } else {
          setEditForm((prev) => ({ ...prev, loadOrder: [...prev.loadOrder, newReq] }))
        }
      }
    } catch (error) {
      console.error('Failed to open file dialog:', error)
    }
  }

  const handleRemoveRequiredMod = (form: 'add' | 'edit', index: number): void => {
    if (form === 'add') {
      setAddForm((prev) => ({ ...prev, loadOrder: prev.loadOrder.filter((_, i) => i !== index) }))
    } else {
      setEditForm((prev) => ({ ...prev, loadOrder: prev.loadOrder.filter((_, i) => i !== index) }))
    }
  }

  const handleMoveRequiredUp = (form: 'add' | 'edit', index: number): void => {
    if (index === 0) return
    if (form === 'add') {
      setAddForm((prev) => {
        const newLoadOrder = [...prev.loadOrder]
        const temp = newLoadOrder[index]
        newLoadOrder[index] = newLoadOrder[index - 1]
        newLoadOrder[index - 1] = temp
        return { ...prev, loadOrder: newLoadOrder }
      })
    } else {
      setEditForm((prev) => {
        const newLoadOrder = [...prev.loadOrder]
        const temp = newLoadOrder[index]
        newLoadOrder[index] = newLoadOrder[index - 1]
        newLoadOrder[index - 1] = temp
        return { ...prev, loadOrder: newLoadOrder }
      })
    }
  }

  const handleMoveRequiredDown = (form: 'add' | 'edit', index: number): void => {
    const currentList = form === 'add' ? addForm.loadOrder : editForm.loadOrder
    if (index >= currentList.length - 1) return
    if (form === 'add') {
      setAddForm((prev) => {
        const newLoadOrder = [...prev.loadOrder]
        const temp = newLoadOrder[index]
        newLoadOrder[index] = newLoadOrder[index + 1]
        newLoadOrder[index + 1] = temp
        return { ...prev, loadOrder: newLoadOrder }
      })
    } else {
      setEditForm((prev) => {
        const newLoadOrder = [...prev.loadOrder]
        const temp = newLoadOrder[index]
        newLoadOrder[index] = newLoadOrder[index + 1]
        newLoadOrder[index + 1] = temp
        return { ...prev, loadOrder: newLoadOrder }
      })
    }
  }

  const handleToggleRequiredSidecar = (form: 'add' | 'edit', index: number): void => {
    const currentForm = form === 'add' ? addForm : editForm
    const req = currentForm.loadOrder[index]
    if (!req) return

    const newValue = !req.sidecarOnly
    if (form === 'add') {
      setAddForm((prev) => ({
        ...prev,
        loadOrder: prev.loadOrder.map((r, i) => (i === index ? { ...r, sidecarOnly: newValue } : r))
      }))
    } else {
      setEditForm((prev) => ({
        ...prev,
        loadOrder: prev.loadOrder.map((r, i) => (i === index ? { ...r, sidecarOnly: newValue } : r))
      }))
    }
  }

  const handleRequiredNameChange = (form: 'add' | 'edit', index: number, name: string): void => {
    if (form === 'add') {
      setAddForm((prev) => ({
        ...prev,
        loadOrder: prev.loadOrder.map((r, i) => (i === index ? { ...r, name } : r))
      }))
    } else {
      setEditForm((prev) => ({
        ...prev,
        loadOrder: prev.loadOrder.map((r, i) => (i === index ? { ...r, name } : r))
      }))
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

      const selfRefCheck = editForm.loadOrder.some(
        (r) => r.isNew && !r.isMain && r.filePath === selectedFile.filePath
      )
      if (selfRefCheck) {
        toast({
          title: 'Invalid required mod',
          description: 'A mod cannot require itself',
          variant: 'destructive'
        })
        return
      }

      const processedLoadOrder = await processRequiredMods(editForm.loadOrder, selectedFile.hashValue)

      const updates: Partial<IModFile> = {
        name: editForm.name.trim(),
        version: editForm.version,
        url: editForm.url,
        loadOrder: processedLoadOrder,
        sidecarOnly: editForm.sidecarOnly
      }

      if (hashValue) {
        updates.hashValue = hashValue
      }

      await api.updateInCatalog(selectedFile.id, updates)

      toast({
        title: 'Success',
        description: `Updated "${editForm.name}"`
      })

      setIsEditModalOpen(false)

      // Fetch fresh authoritative list and notify parent
      const freshCatalog = await gameService.getModFileCatalog()
      setCatalogFiles(freshCatalog)
      onChange(freshCatalog)
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

  const selectableFilesForAdd = availableRequiredFiles.filter(
    (f) => !addForm.loadOrder.some((r) => r.hash === f.hashValue)
  )

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
            data={filteredByType}
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
                  </SelectContent>
                </Select>

                {files.some((f) => f.sidecarOnly) && (
                  <label className="flex items-center gap-2 text-sm text-app-muted cursor-pointer whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={showSidecarOnly}
                      onChange={(e) => setShowSidecarOnly(e.target.checked)}
                      className="w-4 h-4"
                    />
                    Sidecars
                  </label>
                )}
              </>
            }
          />
        )
      })()}

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
              <Label>Load Order</Label>
              <div className="space-y-2">
                {addForm.loadOrder.length > 1 &&
                  addForm.loadOrder.map((req, idx) => (
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
                        disabled={idx >= addForm.loadOrder.length - 1}
                        className="text-app-primary hover:text-app-primary disabled:opacity-30 p-1"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                      <span className="text-xs mr-2 w-6 text-center">{idx + 1}.</span>
                      <Input
                        value={req.name}
                        onChange={(e) => handleRequiredNameChange('add', idx, e.target.value)}
                        disabled={req.isMain}
                        className={`bg-app-secondary border-app flex-1 ${req.isMain ? 'opacity-70 italic' : ''}`}
                      />
                      <input
                        type="checkbox"
                        checked={req.sidecarOnly}
                        onChange={() => handleToggleRequiredSidecar('add', idx)}
                        disabled={req.isMain}
                        className="w-4 h-4"
                        title="Sidecar only"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveRequiredMod('add', idx)}
                        disabled={req.isMain}
                        className={`text-red-500 hover:text-red-700 ${req.isMain ? 'opacity-30' : ''}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                <div className="flex gap-2">
                  <Combobox
                    value=""
                    onValueChange={(value) => {
                      const fileId = parseInt(value, 10)
                      if (fileId) handleAddRequiredFromCatalog('add', fileId)
                    }}
                    options={selectableFilesForAdd.map((f) => ({
                      value: f.id.toString(),
                      label: f.name || 'Unnamed'
                    }))}
                    placeholder="Add from catalog..."
                    className="bg-app-secondary border-app flex-1"
                    disabled={selectableFilesForAdd.length === 0}
                  />
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
                Sidecar mod (Check if this mod doesn't work without other mod files)
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
              <Label>Load Order</Label>
              <div className="space-y-2">
                {editForm.loadOrder.length > 1 &&
                  editForm.loadOrder.map((req, idx) => (
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
                        disabled={idx >= editForm.loadOrder.length - 1}
                        className="text-app-primary hover:text-app-primary disabled:opacity-30 p-1"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                      <span className="text-xs mr-2 w-6 text-center">{idx + 1}.</span>
                      <Input
                        value={req.name}
                        onChange={(e) => handleRequiredNameChange('edit', idx, e.target.value)}
                        disabled={req.isMain}
                        className={`bg-app-secondary border-app flex-1 ${req.isMain ? 'opacity-70 italic' : ''}`}
                      />
                      <input
                        type="checkbox"
                        checked={req.sidecarOnly}
                        onChange={() => handleToggleRequiredSidecar('edit', idx)}
                        disabled={req.isMain}
                        className="w-4 h-4"
                        title="Sidecar only"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveRequiredMod('edit', idx)}
                        disabled={req.isMain}
                        className={`text-red-500 hover:text-red-700 ${req.isMain ? 'opacity-30' : ''}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                <div className="flex gap-2">
                  <Combobox
                    value=""
                    onValueChange={(value) => {
                      const fileId = parseInt(value, 10)
                      if (fileId) handleAddRequiredFromCatalog('edit', fileId)
                    }}
                    options={selectableFilesForEdit.map((f) => ({
                      value: f.id.toString(),
                      label: f.name || 'Unnamed'
                    }))}
                    placeholder="Add from catalog..."
                    className="bg-app-secondary border-app flex-1"
                    disabled={selectableFilesForEdit.length === 0}
                  />
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
