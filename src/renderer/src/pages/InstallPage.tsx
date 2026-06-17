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
import { gameService } from '@/lib/gameService'
import { IProtocol, IModFile, IAppSettings, IDoomVersion } from '@shared/schema'
import { buildLaunchCommand } from '@/lib/utils'
import { dispatchAchievementEvent, buildUnlockToasts } from '@/lib/achievements'
import { CatalogManager } from '@/components/CatalogManager'
import { api } from '@/api'
import { formSchema } from '@/lib/install/schema'
import { useFileReorder } from '@/lib/install/useFileReorder'
import { useJsonDrop } from '@/lib/install/useJsonDrop'
import { useWadImport } from '@/lib/install/useWadImport'
import { ConfigurationTab } from '@/components/install/ConfigurationTab'
import { WadImportTab } from '@/components/install/WadImportTab'

export const InstallPage: React.FC = () => {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [location, setLocation] = useLocation()

  const [activeVersion] = useState<string | null>(null)
  // const [searchQuery] = useState('');
  const [files, setFiles] = useState<IModFile[]>([])
  const [catalogFiles, setCatalogFiles] = useState<IModFile[]>([])
  const [activeTab, setActiveTab] = useState('install')
  // const [currentFilePath, setCurrentFilePath] = useState<string>('');

  // Fetch doom versions
  const { data: versions = [] } = useQuery<IDoomVersion[]>({
    queryKey: ['/api/versions'],
    queryFn: api.getDoomVersions
  })

  // Fetch settings with proper typing
  const { data: settings = { savegamesPath: '' } as IAppSettings } = useQuery<IAppSettings>({
    queryKey: ['/api/settings'],
    queryFn: gameService.getSettings
  })

  // Fetch catalog files for Add Files tab
  const { data: catalogData } = useQuery<IModFile[]>({
    queryKey: ['/api/mod-files/catalog'],
    queryFn: () => gameService.getModFileCatalog()
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
      launchParameters: ''
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
    }) => gameService.createProtocol(data.protocol, data.files),
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
      } catch (err) {
        // Fire-and-forget: don't block navigation on achievement failures
        console.error('Achievement dispatch failed:', err)
      }

      queryClient.invalidateQueries({ queryKey: ['/api/protocols'] })
      form.reset()
      setFiles([])
      // Navigate to the Games page
      setLocation('/')
    },
    onError: (error) => {
      toast({
        title: 'Error',
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
  const jsonDrop = useJsonDrop({ form, versions, settings: settings as IAppSettings, toast, setFiles })

  // const removeFile = (index: number) => {
  //   const newFiles = [...files]
  //   newFiles.splice(index, 1)
  //
  //   // Update load orders to maintain spacing
  //   const updatedFiles = newFiles.map((file, idx) => ({
  //     ...file,
  //     loadOrder: idx * 10
  //   }))
  //
  //   setFiles(updatedFiles)
  // }

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

    // Use a single timestamp for both mod and image naming consistency
    const uniqueId = Date.now().toString()

    // Download screenshot if it's a URL
    let localScreenshotPath = data.screenshotPath
    if (data.screenshotPath && data.screenshotPath.startsWith('http')) {
      try {
        console.log(`[DEBUG] Downloading screenshot for mod: ${data.screenshotPath}`)
        const result = await api.downloadImage(data.screenshotPath, uniqueId)
        localScreenshotPath = result.fileName
        console.log(`[DEBUG] Screenshot saved as: ${localScreenshotPath}`)
      } catch (error) {
        console.error('Failed to download screenshot, following with original URL:', error)
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

    console.log('[DEBUG] Final protocol object for submission:', protocol)
    console.log('[DEBUG] files state at submit:', files)
    console.log('[DEBUG] fileData to process:', fileData)

    // Update catalog entries with any name changes
    try {
      console.log(`[DEBUG] Attempting to update catalog for ${files.length} files`)
      for (const file of files) {
        if (file.id && Number(file.id) > 0) {
          console.log(`[DEBUG] Updating catalog entry ${file.id} with name: ${file.name}`)
          // Update the catalog title/pretty name
          await api.updateInCatalog(file.id, {
            name: file.name,
            fileType: file.fileType
          })
        } else {
          console.log(`[DEBUG] Skipping catalog update for file with ID: ${file.id}`)
        }
      }
    } catch (err) {
      console.warn('[DEBUG] Failed to update some catalog entries:', err)
    }

    // Check if any file has a config template to seed a protocol-specific config
    const templateFile = files.find((f) => f.configTemplate)
    if (templateFile?.configTemplate) {
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
      } catch (err) {
        console.warn('[DEBUG] Failed to seed config for protocol:', err)
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
            data-tour="protocol-form"
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
    </div>
  )
}

export default InstallPage
