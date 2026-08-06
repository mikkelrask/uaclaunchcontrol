import { useState } from 'react'
import { useToast } from '@/hooks/use-toast'
import { api } from '@/api'
import { REGISTRY_API_URL } from '@shared/registry-config'
import { debug } from '@shared/debug'
import { deriveFileType } from '@/lib/install/parsers'
import { useRequiredModsActions } from '@/lib/catalog/useRequiredModsActions'
import type { RequiredModEntry, EditFormState } from '@/lib/catalog/types'
import type { IModFile } from '@shared/schema'

interface UseCatalogEditOptions {
  onChange: (files: IModFile[]) => void
  catalogFiles: IModFile[]
  availableRequiredFiles: IModFile[]
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function useCatalogEdit({
  onChange,
  catalogFiles,
  availableRequiredFiles
}: UseCatalogEditOptions) {
  const { toast } = useToast()

  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [selectedFile, setSelectedFile] = useState<IModFile | null>(null)

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

  const selectableFilesForEdit = availableRequiredFiles.filter(
    (f) =>
      !editForm.loadOrder.some((r) => r.hash === f.hashValue) &&
      f.hashValue !== selectedFile?.hashValue
  )

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
        if (!hash) continue

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
                // Silently ignore
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

  const handleEditClearConfigFile = (): void => {
    setEditForm((prev) => ({ ...prev, configTemplate: null }))
  }

  return {
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
  }
}
