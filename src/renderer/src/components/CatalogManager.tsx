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
import { IModFile, IAppSettings } from '@shared/schema'
import { Upload } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { api, IRegistryMod } from '@/api'
import { dispatchAchievementEvent, buildUnlockToasts } from '@/lib/achievements'
import { gameService } from '@/lib/gameService'
import { REGISTRY_API_URL } from '@shared/registry-config'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ZipImportModal } from '@/components/ZipImportModal'
import { ZipScanResult } from '@/types/zipImport'
import { parseBatContent, resolveRelativePaths, deriveFileType } from '@/lib/install/parsers'
import { useFileDrop } from '@/lib/catalog/useFileDrop'
import { useRequiredModsActions } from '@/lib/catalog/useRequiredModsActions'
import { AddFileDialog } from '@/components/catalog/AddFileDialog'
import { EditFileDialog } from '@/components/catalog/EditFileDialog'
import type { RequiredModEntry, AddFormState, EditFormState } from '@/lib/catalog/types'

interface CatalogManagerProps {
  files: IModFile[]
  onChange: (files: IModFile[]) => void
}

export function CatalogManager({ files, onChange }: CatalogManagerProps): React.ReactElement {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { data: catalogFiles = [] } = useQuery({
    queryKey: ['/api/mod-files/catalog'],
    queryFn: () => gameService.getModFileCatalog()
  })

  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [selectedFile, setSelectedFile] = useState<IModFile | null>(null)

  const [isZipModalOpen, setIsZipModalOpen] = useState(false)
  const [zipScanResult, setZipScanResult] = useState<ZipScanResult | null>(null)
  const [zipFilePath, setZipFilePath] = useState<string>('')

  const [addForm, setAddForm] = useState<AddFormState>({
    name: '',
    filePath: '',
    fileType: 'PK3',
    version: '',
    url: '',
    loadOrder: [],
    sidecarOnly: false
  })
  const {
    isDraggingFile,
    handleFileDragOver,
    handleFileDragLeave,
    processDrop
  } = useFileDrop()
  const [showSidecarOnly, setShowSidecarOnly] = useState(false)
  const [fileTypeFilter, setFileTypeFilter] = useState<string>('all')

  const [editForm, setEditForm] = useState<EditFormState>({
    name: '',
    version: '',
    url: '',
    loadOrder: [],
    sidecarOnly: false
  })

  const [lastLookupHash, setLastLookupHash] = useState<string | null>(null)
  const [lastLookupFound, setLastLookupFound] = useState<boolean>(false)
  const [lastLookupData, setLastLookupData] = useState<IRegistryMod | null>(null)

  const availableRequiredFiles = catalogFiles.filter((f) => !f.sidecarOnly && f.hashValue)

  const addRequiredMods = useRequiredModsActions(
    addForm.loadOrder,
    (updater) => setAddForm((prev) => ({ ...prev, loadOrder: typeof updater === 'function' ? updater(prev.loadOrder) : updater })),
    catalogFiles,
    toast
  )

  const editRequiredMods = useRequiredModsActions(
    editForm.loadOrder,
    (updater) => setEditForm((prev) => ({ ...prev, loadOrder: typeof updater === 'function' ? updater(prev.loadOrder) : updater })),
    catalogFiles,
    toast
  )

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

        const reqFileType = deriveFileType(fileName.split('.').pop()?.toUpperCase() || '')

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

  const resetLookupState = (): void => {
    setLastLookupHash(null)
    setLastLookupFound(false)
    setLastLookupData(null)
  }

  const handleAddFile = async (): Promise<void> => {
    if (!addForm.filePath.trim()) return

    const fileName = addForm.filePath.split(/[\\/]/).pop() || addForm.filePath
    const prettyName = addForm.name.trim() || fileName.replace(/\.[^.]+$/, '')
    const fileType = deriveFileType(fileName.split('.').pop()?.toUpperCase() || '')

    try {
      // Move file first to get hash-based filename
      const newFilePathMoved = await handleMoveFileToModFolder(addForm.filePath)
      const hashValue = await api.computeHash(newFilePathMoved)

      // Check for duplicates based on hashValue (content-based)
      const exists = files.some((f) => f.hashValue === hashValue)
      if (exists) {
        toast({
          title: 'File already exists',
          description: 'This file is already in your catalog',
          variant: 'destructive'
        })
        return
      }

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

      // Check if we should submit to pending registry
      if (lastLookupHash === hashValue) {
        let shouldSubmit = false

        if (!lastLookupFound) {
          // Hash not in registry - new submission
          shouldSubmit = true
        } else if (lastLookupData) {
          // Hash in registry - check if user provided NEW info
          const urlInRegistry = lastLookupData.urls?.some((u) => u.url === addForm.url)
          const hasNewUrl = !!(addForm.url && !urlInRegistry)
          const hasNewVersion = !!(addForm.version && !lastLookupData.version)
          shouldSubmit = hasNewUrl || hasNewVersion
        }

        if (shouldSubmit && addForm.url) {
          // Fire and forget - get settings for UUID
          api
            .getSettings()
            .then((settings) => {
              if (settings?.registryUuid) {
                api.submitToPending(
                  {
                    hash: hashValue,
                    suggested_name: prettyName,
                    url: addForm.url,
                    version: addForm.version || undefined,
                    is_sidecar: addForm.sidecarOnly ? 1 : 0,
                    load_order: processedLoadOrder ? JSON.stringify(processedLoadOrder) : undefined
                  },
                  settings.registryUuid,
                  REGISTRY_API_URL
                )
              }
            })
            .catch(() => {
              // Silently ignore
            })
        }
      }

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
        title: 'SYSTEM: add_success',
        description: `Added "${prettyName}" to your mod file catalog.`
      })

      // Dispatch MOD_FILE_ADDED achievement event
      dispatchAchievementEvent({
        type: 'MOD_FILE_ADDED',
        count: 1
      })
        .then((result) => {
          const unlockToasts = buildUnlockToasts(result)
          for (const t of unlockToasts) {
            toast({
              title: t.title,
              description: t.description,
              duration: t.duration as 6000 | 8000
            })
          }
        })
        .catch((err) => {
          console.error('Achievement dispatch failed:', err)
        })

      resetLookupState()
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
      queryClient.setQueryData(['/api/mod-files/catalog'], freshCatalog)
      onChange(freshCatalog)
    } catch (error) {
      toast({
        title: 'Error',
        description: `Failed to add file: ${error}`,
        variant: 'destructive'
      })
    }
  }

  const initializeAddFormFromPath = async (
    filePath: string
  ): Promise<Partial<typeof addForm> | null> => {
    const fileName = filePath.split(/[\\/]/).pop() || ''
    const name = fileName.replace(/\.[^.]+$/, '')
    const fileType = deriveFileType(fileName.split('.').pop()?.toUpperCase() || '')

    let hash = ''
    try {
      hash = await api.computeHash(filePath)
      console.log('[Registry] Computed hash:', hash)
    } catch {
      console.error('Failed to compute hash')
    }

    let settings: IAppSettings | null = null
    try {
      settings = await api.getSettings()
    } catch {
      console.error('Failed to fetch settings')
    }

    let registryData: IRegistryMod | null = null
    if (settings?.registryLookupEnabled && hash) {
      try {
        registryData = await api.lookupMod(hash, REGISTRY_API_URL)
      } catch (error: unknown) {
        console.error('[Registry] Lookup failed:', error)
      }
    }

    if (registryData) {
      setLastLookupHash(hash)
      setLastLookupFound(true)
      setLastLookupData(registryData)
    } else {
      setLastLookupHash(hash)
      setLastLookupFound(false)
      setLastLookupData(null)
    }

    const mainEntry = {
      hash: hash || '',
      name,
      filePath,
      isNew: true,
      offset: 1,
      sidecarOnly: false,
      isMain: true
    }

    const updatedForm: Partial<typeof addForm> = {
      filePath,
      name: registryData?.family_name || name,
      fileType,
      version: registryData?.version || '',
      url: '',
      loadOrder: [mainEntry],
      sidecarOnly: registryData?.is_sidecar === 1
    }

    if (registryData?.urls && registryData.urls.length > 0) {
      let selectedUrl = registryData.urls[0].url
      if (settings?.databaseLinkPresets && settings?.selectedPresetIndex !== undefined) {
        const preset = settings.databaseLinkPresets[settings.selectedPresetIndex]
        if (preset) {
          try {
            const presetDomain = new URL(preset.url).hostname.replace('www.', '')
            const matchingUrl = registryData.urls.find(
              (u) => u.domain.replace('www.', '') === presetDomain
            )
            if (matchingUrl) selectedUrl = matchingUrl.url
          } catch {
            // use default
          }
        }
      }
      updatedForm.url = selectedUrl
    }

    if (registryData?.load_order) {
      const loadOrderEntries = Object.entries(registryData.load_order)
        .filter(([h]) => h !== hash)
        .map(([h, offset]) => ({
          hash: h,
          name: h,
          filePath: '',
          isNew: false,
          offset: offset as number,
          sidecarOnly: false
        }))
      updatedForm.loadOrder = [mainEntry, ...loadOrderEntries]
    }

    console.log('[Registry] Setting form with:', updatedForm)
    return updatedForm
  }

  const handleBrowseFile = async (): Promise<void> => {
    try {
      const result = await api.showOpenDialog({
        title: 'Select Mod File',
        properties: ['openFile'],
        filters: [
          {
            name: 'Mod stuff',
            extensions: ['wad', 'pk3', 'pk7', 'ipk3', 'deh', 'bex', 'zip', 'bat']
          }
        ]
      })

      if (!result.canceled && result.filePaths.length > 0) {
        const selectedPath = result.filePaths[0]

        if (selectedPath.toLowerCase().endsWith('.zip')) {
          try {
            toast({
              title: 'Extracting archive...',
              description: 'Analyzing zip contents.'
            })
            const scan = (await api.unzipScan(selectedPath)) as ZipScanResult
            setZipScanResult(scan)
            setZipFilePath(selectedPath)
            setIsZipModalOpen(true)
          } catch (error) {
            console.error(error)
            toast({
              title: 'Failed to process ZIP',
              description: error instanceof Error ? error.message : 'Failed to scan zip file',
              variant: 'destructive'
            })
          }
          return
        }

        if (selectedPath.toLowerCase().endsWith('.bat')) {
          try {
            const content = await api.readFile(selectedPath)
            const parsed = parseBatContent(content)
            const resolvedFiles = resolveRelativePaths(selectedPath, parsed.modFiles)

            if (resolvedFiles.length === 0) {
              toast({
                title: 'Error',
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
          } catch (error) {
            console.error('Failed to parse .bat:', error)
            toast({
              title: 'Error',
              description: 'Failed to parse .bat file',
              variant: 'destructive'
            })
          }
          return
        }

        const updatedForm = await initializeAddFormFromPath(selectedPath)
        if (updatedForm) {
          setAddForm((prev) => ({ ...prev, ...updatedForm }) as typeof addForm)
          setIsAddModalOpen(true)
        }
      }
    } catch (error) {
      console.error('Failed to open file dialog:', error)
    }
  }

  const handleFileDrop = async (e: React.DragEvent): Promise<void> => {
    const droppedPath = processDrop(e)
    if (!droppedPath) return

    const ext = droppedPath.split('.').pop()?.toUpperCase()
    const validExtensions = ['WAD', 'PK3', 'PK7', 'IPK3', 'DEH', 'BEX', 'ZIP', 'BAT']
    if (!ext || !validExtensions.includes(ext)) {
      toast({
        title: 'FATAL: type_unknow',
        description: 'Please only use supported files: wad, pk3, pk7, ipk3, deh, bex, zip, bat',
        variant: 'destructive'
      })
      return
    }

    if (ext === 'ZIP') {
      try {
        toast({ title: 'Extracting archive...', description: 'Analyzing zip contents.' })
        const scan = (await api.unzipScan(droppedPath)) as ZipScanResult
        setZipScanResult(scan)
        setZipFilePath(droppedPath)
        setIsZipModalOpen(true)
      } catch (error) {
        console.error(error)
        toast({
          title: 'Failed to process ZIP',
          description: error instanceof Error ? error.message : 'Failed to scan zip file',
          variant: 'destructive'
        })
      }
      return
    }

    if (ext === 'BAT') {
      try {
        const content = await e.dataTransfer.files[0].text()
        const parsed = parseBatContent(content)
        const resolvedFiles = resolveRelativePaths(droppedPath, parsed.modFiles)

        if (resolvedFiles.length === 0) {
          toast({
            title: 'Error',
            description: 'No -file entries found in .bat file',
            variant: 'destructive'
          })
          return
        }

        const updatedForm = await initializeAddFormFromPath(resolvedFiles[0])
        if (!updatedForm) return

        const additionalReqs = resolvedFiles.slice(1).map((fp, idx) => ({
          hash: '',
          name: fp.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, '') || fp,
          filePath: fp,
          isNew: true,
          offset: (updatedForm.loadOrder?.length || 0) + idx + 1,
          sidecarOnly: false
        }))

        updatedForm.loadOrder = [...(updatedForm.loadOrder || []), ...additionalReqs]
        setAddForm((prev) => ({ ...prev, ...updatedForm }) as typeof addForm)
        setIsAddModalOpen(true)
      } catch (error) {
        console.error('Failed to parse .bat:', error)
        toast({
          title: 'Error',
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
    if (
      !confirm(`Are you sure you want to remove "${file.name || file.fileName}" from the catalog?`)
    ) {
      return
    }
    try {
      await api.deleteFromCatalog(file.id)
      handleRemoveFile(file.id)
      toast({
        title: 'SYSTEM: remove_success',
        description: `Removed "${file.name || file.fileName}" from your mod file catalog.`
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

      const processedLoadOrder = await processRequiredMods(
        editForm.loadOrder,
        selectedFile.hashValue
      )

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

      // Submit to pending if hash not in registry and we have URL
      if (hashValue && editForm.url) {
        api
          .getSettings()
          .then(async (settings) => {
            if (settings?.registryLookupEnabled && settings?.registryUuid) {
              try {
                const lookup = await api.lookupMod(hashValue, REGISTRY_API_URL)
                if (!lookup) {
                  // Not in registry, submit to pending
                  await api.submitToPending(
                    {
                      hash: hashValue,
                      suggested_name: editForm.name.trim(),
                      url: editForm.url,
                      version: editForm.version || undefined,
                      is_sidecar: editForm.sidecarOnly ? 1 : 0,
                      load_order: processedLoadOrder
                        ? JSON.stringify(processedLoadOrder)
                        : undefined
                    },
                    settings.registryUuid,
                    REGISTRY_API_URL
                  )
                  console.log('[Registry] Submitted updated file to pending:', hashValue)
                }
              } catch {
                // Silently ignore - registry lookup failed
              }
            }
          })
          .catch(() => {
            // Silently ignore
          })
      }

      toast({
        title: 'SYSTEM: save_success',
        description: `Updated info: "${editForm.name}"`
      })

      setIsEditModalOpen(false)

      // Fetch fresh authoritative list and notify parent
      const freshCatalog = await gameService.getModFileCatalog()
      onChange(freshCatalog)
      setSelectedFile(null)
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
        data-tour="mod-files-panel"
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
                    <SelectItem value="ZIP" className="text-xs">
                      ZIP
                    </SelectItem>
                  </SelectContent>
                </Select>

                {files.some((f) => f.sidecarOnly) && (
                  <label className="flex items-center gap-2 text-sm text-app-muted cursor-pointer whitespace-nowrap">
                    <Checkbox
                      checked={showSidecarOnly}
                      onCheckedChange={(checked) => setShowSidecarOnly(checked === true)}
                    />
                    Sidecars
                  </label>
                )}
              </>
            }
          />
        )
      })()}

      <AddFileDialog
        open={isAddModalOpen}
        onOpenChange={(open) => !open && setIsAddModalOpen(false)}
        form={addForm}
        setForm={setAddForm}
        selectableFiles={selectableFilesForAdd}
        requiredModsActions={addRequiredMods}
        onAddFile={handleAddFile}
        onBrowseFile={handleBrowseFile}
        onCancel={() => {
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
      />

      <ZipImportModal
        open={isZipModalOpen}
        onOpenChange={setIsZipModalOpen}
        scanResult={zipScanResult}
        zipFilePath={zipFilePath || undefined}
        onImportComplete={async () => {
          const freshCatalog = await gameService.getModFileCatalog()
          queryClient.setQueryData(['/api/mod-files/catalog'], freshCatalog)
          onChange(freshCatalog)
          setZipScanResult(null)
          setZipFilePath('')
        }}
      />
    </div>
  )
}

export default CatalogManager
