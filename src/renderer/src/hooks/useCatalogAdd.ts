import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/use-toast'
import { api, IRegistryMod } from '@/api'
import { dispatchAchievementEvent, buildUnlockToasts } from '@/lib/achievements'
import { formatRegistryName } from '@/lib/registryName'
import { REGISTRY_API_URL } from '@shared/registry-config'
import { ARCHIVE_EXTENSIONS, getArchiveExtension } from '@shared/archive'
import { debug } from '@shared/debug'
import { parseBatContent, resolveRelativePaths, deriveFileType } from '@/lib/install/parsers'
import { useRequiredModsActions } from '@/lib/catalog/useRequiredModsActions'
import type { RequiredModEntry, AddFormState } from '@/lib/catalog/types'
import type { IModFile, IAppSettings } from '@shared/schema'

import { createLogger } from '@shared/logger'

const log = createLogger('useCatalogAdd')
interface UseCatalogAddOptions {
  onChange: (files: IModFile[]) => void
  catalogFiles: IModFile[]
  availableRequiredFiles: IModFile[]
  tryArchiveImport: (filePath: string) => Promise<boolean>
}

const EMPTY_ADD_FORM: AddFormState = {
  name: '',
  filePath: '',
  fileType: 'PK3',
  version: '',
  url: '',
  loadOrder: [],
  sidecarOnly: false,
  category: '',
  configTemplate: null
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function useCatalogAdd({
  onChange,
  catalogFiles,
  availableRequiredFiles,
  tryArchiveImport
}: UseCatalogAddOptions) {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isAddingFile, setIsAddingFile] = useState(false)

  const [addForm, setAddForm] = useState<AddFormState>(EMPTY_ADD_FORM)

  const [lastLookupHash, setLastLookupHash] = useState<string | null>(null)
  const [lastLookupFound, setLastLookupFound] = useState<boolean>(false)
  const [lastLookupData, setLastLookupData] = useState<IRegistryMod | null>(null)

  const resetLookupState = (): void => {
    setLastLookupHash(null)
    setLastLookupFound(false)
    setLastLookupData(null)
  }

  const addRequiredMods = useRequiredModsActions(
    addForm.loadOrder,
    (updater) =>
      setAddForm((prev) => ({
        ...prev,
        loadOrder: typeof updater === 'function' ? updater(prev.loadOrder) : updater
      })),
    catalogFiles,
    toast
  )

  const selectableFilesForAdd = availableRequiredFiles.filter(
    (f) => !addForm.loadOrder.some((r) => r.hash === f.hashValue)
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
        // Hash the source; addToCatalog copies it into the mods dir only when
        // this content isn't catalogued yet.
        const hash = await api.computeHash(req.filePath)
        if (!hash) continue

        const fileName = req.filePath.split(/[\\/]/).pop() || req.filePath
        const reqFileType = deriveFileType(fileName.split('.').pop()?.toUpperCase() || '')

        await api.addToCatalog({
          name: req.name,
          filePath: req.filePath,
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
    if (!addForm.filePath.trim() || isAddingFile) return

    const fileName = addForm.filePath.split(/[\\/]/).pop() || addForm.filePath
    const prettyName = addForm.name.trim() || fileName.replace(/\.[^.]+$/, '')
    const fileType = deriveFileType(fileName.split('.').pop()?.toUpperCase() || '')

    setIsAddingFile(true)
    try {
      // Hash the source instead of copying it first: content that is already
      // catalogued must never be copied into the mods dir a second time.
      const hashValue = await api.computeHash(addForm.filePath)

      const duplicate = catalogFiles.find((f) => f.hashValue === hashValue)
      if (duplicate) {
        toast({
          title: 'SYSTEM: already_in_catalog',
          description: `"${duplicate.name || duplicate.fileName}" is already in your catalog — nothing was added.`,
          variant: 'default'
        })
        return
      }

      const selfRefCheck = addForm.loadOrder.some(
        (r) => r.isNew && !r.isMain && r.filePath === addForm.filePath
      )
      if (selfRefCheck) {
        toast({
          title: 'SYSTEM: circular_ref',
          description: 'A mod cannot require itself',
          variant: 'destructive'
        })
        return
      }

      const processedLoadOrder = await processRequiredMods(addForm.loadOrder, hashValue)

      // The server copies the source into the mods dir, and answers with the
      // entry that owns this hash — the new one, or one added concurrently.
      const { file: savedFile, existing } = await api.addToCatalog({
        name: prettyName,
        filePath: addForm.filePath,
        fileType,
        fileName,
        version: addForm.version,
        url: addForm.url,
        hashValue,
        loadOrder: processedLoadOrder,
        sidecarOnly: addForm.sidecarOnly,
        category: addForm.category || undefined,
        configTemplate: addForm.configTemplate
          ? {
              configFile: addForm.configTemplate.configFile,
              md5Hash: addForm.configTemplate.md5Hash
            }
          : undefined
      })

      if (existing) {
        toast({
          title: 'SYSTEM: already_in_catalog',
          description: `"${savedFile.name || savedFile.fileName}" is already in your catalog — nothing was added.`,
          variant: 'default'
        })
        resetLookupState()
        setIsAddModalOpen(false)
        setAddForm(EMPTY_ADD_FORM)
        const freshCatalog = await api.getModFileCatalog()
        queryClient.setQueryData(['/api/mod-files/catalog'], freshCatalog)
        queryClient.invalidateQueries({ queryKey: ['/api/mod-files/catalog/search'] })
        onChange(freshCatalog)
        return
      }

      if (lastLookupHash === hashValue) {
        let shouldSubmit = false

        if (!lastLookupFound) {
          shouldSubmit = true
        } else if (lastLookupData) {
          const urlInRegistry = lastLookupData.urls?.some((u) => u.url === addForm.url)
          const hasNewUrl = !!(addForm.url && !urlInRegistry)
          const hasNewVersion = !!(addForm.version && !lastLookupData.version)
          shouldSubmit = hasNewUrl || hasNewVersion
        }

        if (shouldSubmit && addForm.url) {
          void (async () => {
            try {
              const settings = await api.getSettings()
              if (settings?.registryUuid) {
                await api.submitToPending(
                  {
                    hash: hashValue,
                    suggested_name: prettyName,
                    url: addForm.url,
                    version: addForm.version || undefined,
                    category: addForm.category || undefined,
                    is_sidecar: addForm.sidecarOnly ? 1 : 0,
                    load_order: processedLoadOrder ? JSON.stringify(processedLoadOrder) : undefined
                  },
                  settings.registryUuid,
                  REGISTRY_API_URL
                )
              }
            } catch {
              // Silently ignore
            }
          })()
        }
      }

      for (const req of addForm.loadOrder) {
        if (req.isMain) continue
        if (req.isNew && req.filePath) continue
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

      const result = await dispatchAchievementEvent({
        type: 'MOD_FILE_ADDED',
        count: 1
      })
      const unlockToasts = buildUnlockToasts(result)
      for (const t of unlockToasts) {
        toast({
          title: t.title,
          description: t.description,
          duration: t.duration as 6000 | 8000
        })
      }

      resetLookupState()
      setIsAddModalOpen(false)
      setAddForm(EMPTY_ADD_FORM)

      const freshCatalog = await api.getModFileCatalog()
      queryClient.setQueryData(['/api/mod-files/catalog'], freshCatalog)
      queryClient.invalidateQueries({ queryKey: ['/api/mod-files/catalog/search'] })
      onChange(freshCatalog)
    } catch (error: unknown) {
      toast({
        title: 'FATAL: add_failed',
        description: `Failed to add file: ${error}`,
        variant: 'destructive'
      })
    } finally {
      setIsAddingFile(false)
    }
  }

  const initializeAddFormFromPath = async (
    filePath: string
  ): Promise<Partial<typeof addForm> | null> => {
    const fileName = filePath.split(/[\\/]/).pop() || ''
    const name = fileName.replace(/\.[^.]+$/, '')
    const fileType = deriveFileType(fileName.split('.').pop()?.toUpperCase() || '')

    const hashingToast = toast({
      title: 'SYSTEM: hashing',
      description: `Hashing ${fileName} — this can take a while for large files.`
    })

    let hash = ''
    try {
      hash = await api.computeHash(filePath)
      debug('[Registry] Computed hash:', hash)
    } catch {
      log.error('Failed to compute hash')
    } finally {
      hashingToast.dismiss()
    }

    let settings: IAppSettings | null = null
    try {
      settings = await api.getSettings()
    } catch {
      log.error('Failed to fetch settings')
    }

    let registryData: IRegistryMod | null = null
    if (settings?.registryLookupEnabled && hash) {
      try {
        registryData = await api.lookupMod(hash, REGISTRY_API_URL)
      } catch (error: unknown) {
        log.error('[Registry] Lookup failed:', error)
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
      name: registryData?.family_name
        ? formatRegistryName(registryData.family_name, registryData.display_name)
        : name,
      fileType,
      version: registryData?.version || '',
      url: '',
      loadOrder: [mainEntry],
      sidecarOnly: registryData?.is_sidecar === 1
    }

    if (registryData?.category) {
      updatedForm.category = registryData.category
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

    debug('[Registry] Setting form with:', updatedForm)
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
            extensions: ['wad', 'pk3', 'pk7', 'ipk3', 'deh', 'bex', 'bat', ...ARCHIVE_EXTENSIONS]
          }
        ]
      })

      if (!result.canceled && result.filePaths.length > 0) {
        const selectedPath = result.filePaths[0]

        if (getArchiveExtension(selectedPath)) {
          await tryArchiveImport(selectedPath)
          return
        }

        if (selectedPath.toLowerCase().endsWith('.bat')) {
          try {
            const content = await api.readFile(selectedPath)
            const parsed = parseBatContent(content)
            const resolvedFiles = resolveRelativePaths(selectedPath, parsed.modFiles)

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

        const updatedForm = await initializeAddFormFromPath(selectedPath)
        if (updatedForm) {
          setAddForm((prev) => ({ ...prev, ...updatedForm }) as typeof addForm)
          setIsAddModalOpen(true)
        }
      }
    } catch (error: unknown) {
      log.error('Failed to open file dialog:', error)
    }
  }

  const handleBrowseConfigFile = async (): Promise<void> => {
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
        setAddForm((prev) => ({
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
      log.error('Failed to browse config file:', error)
      toast({
        title: 'FATAL: config_link_failed',
        description: `Failed to link config file: ${error}`,
        variant: 'destructive'
      })
    }
  }

  const handleClearConfigFile = (): void => {
    setAddForm((prev) => ({ ...prev, configTemplate: null }))
  }

  return {
    addForm,
    setAddForm,
    isAddModalOpen,
    setIsAddModalOpen,
    isAddingFile,
    lastLookupHash,
    lastLookupFound,
    lastLookupData,
    selectableFilesForAdd,
    addRequiredMods,
    handleAddFile,
    initializeAddFormFromPath,
    handleBrowseFile,
    handleBrowseConfigFile,
    handleClearConfigFile,
    resetLookupState
  }
}
