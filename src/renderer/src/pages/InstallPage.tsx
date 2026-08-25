import React, { useState, useEffect, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useLocation } from 'wouter'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { IProtocol, IModFile, IAppSettings, IDoomVersion } from '@shared/schema'
import { buildLaunchCommand } from '@/lib/utils'
import { debug } from '@shared/debug'
import { dispatchAchievementEvent, buildUnlockToasts } from '@/lib/achievements'
import { CatalogManager } from '@/components/CatalogManager'
import { api } from '@/api'
import { formSchema } from '@/lib/install/schema'
import { useFileReorder } from '@/hooks/useFileReorder'
import { useJsonDrop } from '@/lib/install/useJsonDrop'
import { applyModpackImport, matchImportFiles } from '@/lib/install/applyModpackImport'
import {
  classifyMissingDownloads,
  openDownloadLinks,
  type MissingDownloadClassification
} from '@/lib/install/classifyMissingDownloads'
import { consumePendingProtocolImport } from '@/lib/install/pendingProtocolImport'
import { useWadImport } from '@/lib/install/useWadImport'
import { ConfigurationTab } from '@/components/install/ConfigurationTab'
import { WadImportTab } from '@/components/install/WadImportTab'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Download, ExternalLink } from 'lucide-react'
import { createLogger } from '@shared/logger'

const log = createLogger('InstallPage')

export const InstallPage: React.FC = () => {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [location, setLocation] = useLocation()

  const [activeVersion] = useState<string | null>(null)
  const [files, setFiles] = useState<IModFile[]>([])
  const [catalogFiles, setCatalogFiles] = useState<IModFile[]>([])
  const [activeTab, setActiveTab] = useState('install')
  const [missingDownloadPrompt, setMissingDownloadPrompt] =
    useState<MissingDownloadClassification | null>(null)
  const [downloadsStarted, setDownloadsStarted] = useState(false)
  const [browserLinksOpened, setBrowserLinksOpened] = useState(false)

  // Generated up front (not at submit time) so it's stable across the whole
  // time the form is being filled out — used as the protocol's real id and,
  // if "isolated config" is checked, as the id a fresh config file is
  // created against at submit time. InstallPage fully unmounts on
  // navigation back to '/', so a fresh value is naturally generated again
  // next time this page is visited.
  const [pendingProtocolId] = useState(() => Date.now().toString())

  // Fetch doom versions
  const { data: versions = [] } = useQuery<IDoomVersion[]>({
    queryKey: ['/api/versions'],
    queryFn: api.getDoomVersions
  })

  // Fetch settings with proper typing
  const { data: settings = { savegamesPath: '' } as IAppSettings } = useQuery<IAppSettings>({
    queryKey: ['/api/settings'],
    queryFn: api.getSettings
  })

  // Fetch catalog files for Add Files tab
  const { data: catalogData } = useQuery<IModFile[]>({
    queryKey: ['/api/mod-files/catalog'],
    queryFn: () => api.getModFileCatalog()
  })

  useEffect(() => {
    if (catalogData) {
      setCatalogFiles(catalogData)
    }
  }, [catalogData])

  useEffect(() => {
    const handleTabChange = (): void => {
      const params = new URLSearchParams(window.location.search)
      const tab = params.get('tab')
      if (tab === 'install' || tab === 'files' || tab === 'wads') {
        setActiveTab(tab)
      }
    }

    handleTabChange()
    window.addEventListener('uac:switch-tab', handleTabChange)
    return () => window.removeEventListener('uac:switch-tab', handleTabChange)
  }, [location])

  // Default source port ID from settings
  const defaultPortId = (settings as IAppSettings)?.sourcePorts?.length
    ? (settings as IAppSettings).defaultSourcePortId
      ? (settings as IAppSettings).defaultSourcePortId
      : (settings as IAppSettings).sourcePorts.find((p) => !p.ignored)?.id || ''
    : ''

  // Setup form
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      description: '',
      doomVersionId: '',
      sourcePortId: defaultPortId,
      saveDirectory: '',
      launchParameters: '',
      isolatedConfig: false
    }
  })

  // Update sourcePortId default when settings load
  useEffect(() => {
    const ports = (settings as IAppSettings)?.sourcePorts
    if (ports && ports.length > 0 && !form.getValues('sourcePortId')) {
      const defaultId =
        (settings as IAppSettings).defaultSourcePortId ||
        ports.find((p) => !p.ignored)?.id ||
        ports[0].id
      form.setValue('sourcePortId', defaultId)
    }
  }, [settings, form])

  // Update doomVersionId default when settings/versions load — mirrors the
  // sourcePortId default above.
  useEffect(() => {
    if (versions.length > 0 && !form.getValues('doomVersionId')) {
      const defaultId =
        (settings as IAppSettings).defaultDoomVersionId ||
        versions.find((v) => !v.ignored)?.id ||
        versions[0].id
      form.setValue('doomVersionId', defaultId)
    }
  }, [settings, versions, form])

  // Registry handoff: "Install Protocol" in the registry page stashes the
  // parsed export and navigates here; apply it like a JSON drop once
  // versions/settings have loaded (needed to match port and version).
  useEffect(() => {
    if (versions.length === 0 || !(settings as IAppSettings)?.sourcePorts?.length) return
    const pending = consumePendingProtocolImport()
    if (!pending) return
    void applyModpackImport(pending, {
      form,
      versions,
      settings: settings as IAppSettings,
      setFiles,
      toast
    })
      .then(async () => {
        toast({
          title: 'SYSTEM: registry_import',
          description: `Imported "${pending.game.title}" from the registry — review, then create.`
        })

        // Offer to auto-download the missing files the app can fetch itself
        // (GitHub release assets, ModDB start pages); everything else stays
        // a manual browser open. applyModpackImport doesn't return the
        // ordered list, so re-derive it — matchImportFiles is pure and
        // deterministic, so this matches exactly what's in the form.
        const catalog = await api.getModFileCatalog()
        const { files: orderedFiles } = matchImportFiles(pending.files, catalog, pending.configs)
        const classification = classifyMissingDownloads(orderedFiles)
        if (classification.inApp.length > 0 || classification.browserOnly.length > 0) {
          setDownloadsStarted(false)
          setBrowserLinksOpened(false)
          setMissingDownloadPrompt(classification)
        }
      })
      .catch((err: unknown) => {
        log.error('Failed to apply registry import:', err)
        toast({
          title: 'FATAL: registry_import_failed',
          description: 'Failed to apply the registry protocol.',
          variant: 'destructive'
        })
      })
  }, [versions, settings, form, toast, setFiles])

  // Compute launch command preview
  const watchedSourcePortId = form.watch('sourcePortId')
  const watchedDoomVersionId = form.watch('doomVersionId')
  const watchedSaveDir = form.watch('saveDirectory')
  const watchedLaunchParams = form.watch('launchParameters')

  const launchCommand = useMemo(() => {
    const sp = (settings as IAppSettings)?.sourcePorts?.find((p) => p.id === watchedSourcePortId)
    const dv = versions.find((v) => v.id === watchedDoomVersionId)

    return buildLaunchCommand({
      executable: sp?.executablePath,
      iwad: dv?.defaultIwad,
      doomVersionArgs: dv?.args,
      files,
      saveDirectory: watchedSaveDir,
      launchParameters: watchedLaunchParams,
      modsDirectory: (settings as IAppSettings)?.modsDirectory,
      savegamesPath: (settings as IAppSettings)?.savegamesPath
    })
  }, [
    watchedSourcePortId,
    watchedDoomVersionId,
    watchedSaveDir,
    watchedLaunchParams,
    files,
    settings,
    versions
  ])

  // Create mod mutation
  const createMutation = useMutation({
    mutationFn: (data: {
      protocol: Omit<IProtocol, 'id'>
      files: Omit<IModFile, 'id' | 'modId'>[]
    }) => api.createProtocol(data.protocol, data.files),
    onSuccess: async () => {
      toast({
        title: 'SYSTEM: params_accepted',
        description: 'Successfully added new launch configuration.'
      })

      // Dispatch achievement event for PROTOCOL_CREATED
      try {
        const result = await dispatchAchievementEvent({
          type: 'PROTOCOL_CREATED',
          count: 1,
          fileCount: files.length
        })

        // Show unlock toasts
        const unlockToasts = buildUnlockToasts(result)
        for (const t of unlockToasts) {
          toast({
            title: t.title,
            description: t.description,
            duration: t.duration as 6000 | 8000
          })
        }
      } catch (err: unknown) {
        // Fire-and-forget: don't block navigation on achievement failures
        log.error('Achievement dispatch failed:', err)
      }

      queryClient.invalidateQueries({ queryKey: ['/api/protocols'] })
      // The submit loop renamed catalog entries via updateInCatalog — refresh
      // the catalog cache too, or add-file dialogs keep the old names.
      queryClient.invalidateQueries({ queryKey: ['/api/mod-files/catalog'] })
      queryClient.invalidateQueries({ queryKey: ['/api/mod-files/catalog/search'] })
      form.reset()
      setFiles([])
      // Navigate to the Games page
      setLocation('/')
    },
    onError: (error) => {
      toast({
        title: 'FATAL: install_failed',
        description: `Failed to install mod: ${error}`,
        variant: 'destructive'
      })
    }
  })

  const handleVersionSelect = (version: string): void => {
    setLocation(`/?version=${encodeURIComponent(version)}`)
  }

  const handleSearch = (query: string): void => {
    // setSearchQuery(query); // Removed unused state
    setLocation(`/?search=${encodeURIComponent(query)}`)
  }

  const wadImport = useWadImport(settings as IAppSettings, toast)
  const jsonDrop = useJsonDrop({
    form,
    versions,
    settings: settings as IAppSettings,
    toast,
    setFiles
  })

  // Mod file carrying a config template, if one of the chosen files has one —
  // surfaced as a note next to the isolated-config checkbox, since checking
  // it overrides this auto-seed (see onSubmit).
  const templateFile = files.find((f) => f.configTemplate)
  const templateSeedName = templateFile
    ? templateFile.name || templateFile.fileName || 'a mod file'
    : null

  // Copy for the post-import download prompt (registry handoff).
  const missingDownloadCopy = useMemo(() => {
    if (!missingDownloadPrompt) return ''
    const { inApp, browserOnly } = missingDownloadPrompt
    const total = inApp.length + browserOnly.length
    if (inApp.length > 0 && browserOnly.length > 0) {
      return `${inApp.length} of ${total} missing files can be downloaded automatically — the other ${browserOnly.length} can only be fetched in your browser. Start the downloads?`
    }
    if (inApp.length > 0) {
      return `${inApp.length} missing file${inApp.length > 1 ? 's' : ''} can be downloaded automatically. Start now?`
    }
    return `${browserOnly.length} missing file${browserOnly.length > 1 ? 's' : ''} can only be fetched in your browser — open the link${browserOnly.length > 1 ? 's' : ''} to download them manually.`
  }, [missingDownloadPrompt])

  // Each action starts its links and keeps the prompt open so the user can
  // do both (in-app downloads + browser links); a used action disables its
  // button (double-clicking would re-download). The prompt closes itself
  // once every available action has been taken.
  const handleStartInAppDownloads = (): void => {
    if (!missingDownloadPrompt || downloadsStarted) return
    openDownloadLinks(missingDownloadPrompt.inApp.map((f) => f.url as string))
    setDownloadsStarted(true)
  }

  const handleOpenBrowserLinks = (): void => {
    if (!missingDownloadPrompt || browserLinksOpened) return
    openDownloadLinks(missingDownloadPrompt.browserOnly.map((f) => f.url as string))
    setBrowserLinksOpened(true)
  }

  const closeDownloadPrompt = (): void => {
    setMissingDownloadPrompt(null)
    setDownloadsStarted(false)
    setBrowserLinksOpened(false)
  }

  useEffect(() => {
    if (!missingDownloadPrompt) return
    const inAppDone = missingDownloadPrompt.inApp.length === 0 || downloadsStarted
    const browserDone = missingDownloadPrompt.browserOnly.length === 0 || browserLinksOpened
    if (inAppDone && browserDone) {
      setMissingDownloadPrompt(null)
      setDownloadsStarted(false)
      setBrowserLinksOpened(false)
    }
  }, [missingDownloadPrompt, downloadsStarted, browserLinksOpened])

  const onSubmit = async (data: z.infer<typeof formSchema>): Promise<void> => {
    const fileData: IModFile[] = files.map((file) => {
      // Strip directory from filePath and saveDirectory for shareability
      const pathValue = file.filePath || ''
      const fileNameOnly = pathValue.split(/[\\/]/).pop() || pathValue

      return {
        ...file,
        filePath: fileNameOnly, // Store only the filename
        hashValue: file.hashValue || ''
      }
    })

    const finalSaveDir = data.saveDirectory || settings?.savegamesPath || ''
    // Strip parent directory from saveDirectory if it starts with the default path
    let relativeSaveDir = finalSaveDir
    if (settings?.savegamesPath && finalSaveDir.startsWith(settings.savegamesPath)) {
      relativeSaveDir = finalSaveDir.replace(settings.savegamesPath, '').replace(/^[\\/]/, '')
    }

    // Generated up front (not here) so a fresh config can be created against
    // a stable ID while the form is still being filled out — see pendingProtocolId.
    const uniqueId = pendingProtocolId

    // Download screenshot if it's a URL
    let localScreenshotPath = data.screenshotPath
    if (data.screenshotPath && data.screenshotPath.startsWith('http')) {
      try {
        debug(`[DEBUG] Downloading screenshot for mod: ${data.screenshotPath}`)
        const result = await api.downloadImage(data.screenshotPath, uniqueId)
        localScreenshotPath = result.fileName
        debug(`[DEBUG] Screenshot saved as: ${localScreenshotPath}`)
      } catch (error: unknown) {
        log.error('Failed to download screenshot, following with original URL:', error)
      }
    }

    const protocol: Omit<IProtocol, 'id'> & { id?: string } = {
      id: uniqueId,
      name: data.title,
      title: data.title,
      description: data.description || '',
      doomVersionId: data.doomVersionId,
      sourcePortId: data.sourcePortId,
      saveDirectory: relativeSaveDir,
      screenshotPath: localScreenshotPath,
      launchParameters: data.launchParameters,
      files: fileData
    }

    debug('[DEBUG] Final protocol object for submission:', protocol)
    debug('[DEBUG] files state at submit:', files)
    debug('[DEBUG] fileData to process:', fileData)

    // Update catalog entries with any name changes
    try {
      debug(`[DEBUG] Attempting to update catalog for ${files.length} files`)
      for (const file of files) {
        // Only rows backed by a real catalog entry can be updated — imported
        // rows that never matched (e.g. still-missing downloads) keep a temp
        // id and would 404 on the server.
        if (file.id && Number(file.id) > 0 && file.filePath) {
          debug(`[DEBUG] Updating catalog entry ${file.id} with name: ${file.name}`)
          // Update the catalog title/pretty name
          await api.updateInCatalog(file.id, {
            name: file.name,
            fileType: file.fileType
          })
        } else {
          debug(`[DEBUG] Skipping catalog update for file with ID: ${file.id}`)
        }
      }
    } catch (err: unknown) {
      log.warn('[DEBUG] Failed to update some catalog entries:', err)
    }

    // An explicit "isolated config" checkbox always wins over auto-seeding
    // from a mod's template. The config file itself is only created here,
    // at actual submit time — not when the checkbox is ticked — so
    // abandoning the form never leaves an orphaned config file on disk for
    // a protocol that was never created.
    if (data.isolatedConfig) {
      try {
        const result = await api.createBlankConfig(uniqueId)
        protocol.protocolConfig = { configFile: result.configFile }
      } catch (error: unknown) {
        toast({
          title: 'FATAL: config_create_failed',
          description: `Failed to create isolated config: ${error}`,
          variant: 'destructive'
        })
        return
      }
    } else if (templateFile?.configTemplate) {
      try {
        const protocolConfig = await api.copyConfigForProtocol(
          templateFile.configTemplate.md5Hash,
          uniqueId
        )
        protocol.protocolConfig = protocolConfig
        toast({
          title: 'SYSTEM: config_seeded',
          description: `Seeded config from "${templateFile.name || templateFile.fileName || 'unknown'}"`
        })
      } catch (err: unknown) {
        log.warn('[DEBUG] Failed to seed config for protocol:', err)
        // Non-fatal — protocol still created without config
      }
    }

    createMutation.mutate({ protocol, files: fileData })
  }

  // Wrapper to update file list
  const handleFilesChange = (newFiles: IModFile[]): void => {
    setFiles(newFiles)
  }

  const {
    draggedIndex,
    insertionIndex,
    handleDragStart,
    handleDragOver,
    handleDrop,
    handleDragEnd
  } = useFileReorder(files, setFiles)

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar activeVersion={activeVersion} onVersionSelect={handleVersionSelect} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header onSearch={handleSearch} />

        <div className="flex-1 overflow-y-auto p-4 min-h-0">
          <Card
            className={`bg-app-secondary border-app mb-6 transition-all ${
              jsonDrop.isJsonDragging
                ? 'border-accent-highlight border-4 ring-2 ring-accent-highlight/30'
                : ''
            }`}
            onDrop={jsonDrop.handleJsonDrop}
            onDragOver={jsonDrop.handleJsonDragOver}
            onDragLeave={jsonDrop.handleJsonDragLeave}
          >
            <CardHeader>
              <CardTitle>New Launch Protocol</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="mb-4 bg-app-primary border-app p-1">
                  <TabsTrigger
                    value="install"
                    className="data-[state=active]:bg-accent-highlight data-[state=active]:text-foreground data-[state=active]:shadow-sm rounded px-4 text-app-secondary dark:data-[state=active]:text-foreground"
                  >
                    Configuration
                  </TabsTrigger>
                  <TabsTrigger
                    value="files"
                    className="data-[state=active]:bg-accent-highlight data-[state=active]:text-foreground data-[state=active]:shadow-sm rounded px-4 text-app-secondary dark:data-[state=active]:text-foreground"
                  >
                    Mod Files
                  </TabsTrigger>
                  <TabsTrigger
                    value="wads"
                    className="data-[state=active]:bg-accent-highlight data-[state=active]:text-foreground data-[state=active]:shadow-sm rounded px-4 text-app-secondary dark:data-[state=active]:text-foreground"
                  >
                    WAD Files
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="install">
                  <ConfigurationTab
                    form={form}
                    versions={versions}
                    settings={settings as IAppSettings}
                    files={files}
                    fileReorder={{
                      draggedIndex,
                      insertionIndex,
                      handleDragStart,
                      handleDragOver,
                      handleDrop,
                      handleDragEnd
                    }}
                    launchCommand={launchCommand}
                    createMutation={createMutation}
                    toast={toast}
                    onSubmit={onSubmit}
                    handleFilesChange={handleFilesChange}
                    templateSeedName={templateSeedName}
                  />
                </TabsContent>

                <TabsContent value="files">
                  <div className="space-y-4">
                    <p className="text-sm text-app-secondary">
                      Manage your file catalog. Add new files or remove existing ones from the
                      catalog.
                    </p>
                    <CatalogManager
                      files={catalogFiles}
                      onChange={(newFiles) => setCatalogFiles(newFiles)}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="wads">
                  <WadImportTab
                    wadImport={wadImport}
                    wadFilesDirectory={settings?.wadFilesDirectory}
                  />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Registry-install download prompt: auto-start the in-app downloads,
          leave browser-only links to the user. */}
      <Dialog
        open={missingDownloadPrompt !== null}
        onOpenChange={(open) => {
          if (!open) closeDownloadPrompt()
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Download missing mod files?</DialogTitle>
            <DialogDescription>{missingDownloadCopy}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={closeDownloadPrompt}>
              Cancel
            </Button>
            {missingDownloadPrompt && missingDownloadPrompt.browserOnly.length > 0 && (
              <Button
                variant="outline"
                onClick={handleOpenBrowserLinks}
                disabled={browserLinksOpened}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Open {missingDownloadPrompt.browserOnly.length} in browser
              </Button>
            )}
            {missingDownloadPrompt && missingDownloadPrompt.inApp.length > 0 && (
              <Button onClick={handleStartInAppDownloads} disabled={downloadsStarted}>
                <Download className="w-4 h-4 mr-2" />
                Download {missingDownloadPrompt.inApp.length} in-app
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default InstallPage
