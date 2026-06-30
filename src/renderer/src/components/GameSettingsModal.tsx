import React, { useState, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Combobox } from '@/components/ui/combobox'
import {
  IProtocol,
  IModFile,
  IDoomVersion,
  InsertModFile,
  ISourcePort,
  IAppSettings
} from '@shared/schema'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { gameService } from '@/lib/gameService'
import { useToast } from '@/hooks/use-toast'
import { api } from '@/api'
import ModFileList from './ModFileList'
import LaunchOptions from './LaunchOptions'
import { FolderOpen, Download, Gamepad2 } from 'lucide-react'
import { slugify, buildLaunchCommand } from '@/lib/utils'
import placeholder from '@renderer/assets/placeholder.png'

interface GameSettingsModalProps {
  protocolId: string | null
  isOpen: boolean
  onClose: () => void
  doomVersions: IDoomVersion[] | undefined
}

interface GameSettingsContentProps {
  initialProtocol: IProtocol
  initialFiles: IModFile[]
  protocolId: string
  onClose: () => void
  doomVersions: IDoomVersion[] | undefined
  sourcePorts: ISourcePort[]
  defaultSourcePortId?: string
  showLaunchPreview?: boolean
}

const GameSettingsContent: React.FC<GameSettingsContentProps> = ({
  initialProtocol,
  initialFiles,
  protocolId,
  onClose,
  doomVersions,
  sourcePorts,
  showLaunchPreview = true
}) => {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [protocol, setProtocol] = useState<IProtocol>(initialProtocol)
  const [files, setFiles] = useState<InsertModFile[]>(initialFiles)

  const { data: settings } = useQuery<IAppSettings>({
    queryKey: ['/api/settings'],
    queryFn: gameService.getSettings
  })

  // Compute launch command preview
  const launchCommand = useMemo(() => {
    const sourcePort = sourcePorts.find((p) => p.id === protocol.sourcePortId)
    const doomVersion = doomVersions?.find((v) => v.id === protocol.doomVersionId)

    // Compute config file path for protocol-specific config
    let configPath: string | undefined
    if (protocol.protocolConfig?.configFile && settings?.modsDirectory) {
      const baseDir = settings.modsDirectory.replace(/\/mods$/, '').replace(/\\mods$/, '')
      configPath = `${baseDir}/data/cfgs/${protocol.protocolConfig.configFile}`
    }

    return buildLaunchCommand({
      executable: sourcePort?.executablePath,
      iwad: doomVersion?.defaultIwad,
      doomVersionArgs: doomVersion?.args,
      files,
      saveDirectory: protocol.saveDirectory,
      launchParameters: protocol.launchParameters,
      modsDirectory: settings?.modsDirectory,
      savegamesPath: settings?.savegamesPath,
      configPath
    })
  }, [protocol, files, sourcePorts, doomVersions, settings])

  // Update protocol mutation
  const updateMutation = useMutation({
    mutationFn: ({
      id,
      protocol,
      files
    }: {
      id: string
      protocol: Partial<IProtocol>
      files: Omit<IModFile, 'id' | 'modId'>[]
    }) => gameService.updateProtocol(id, protocol, files),
    onSuccess: (updatedProtocol, variables) => {
      toast({
        title: 'SYSTEM: protocol_saved',
        description: 'Protocol settings successfully saved.'
      })
      queryClient.invalidateQueries({ queryKey: ['/api/protocols'] })
      queryClient.setQueryData([`/api/protocols/${variables.id}`], {
        protocol: updatedProtocol,
        files: variables.files
      })
      onClose()
    },
    onError: (error) => {
      toast({
        title: 'FATAL: settings.save()',
        description: `Failed to save changes: ${error}`,
        variant: 'destructive'
      })
    }
  })

  // Delete protocol mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => gameService.deleteProtocol(id),
    onSuccess: () => {
      toast({
        title: 'SYSTEM: delete_protocol',
        description: 'Protocol deleted successfully'
      })
      queryClient.invalidateQueries({ queryKey: ['/api/protocols'] })
      onClose()
    },
    onError: (error) => {
      toast({
        title: 'FATAL: delete_failed',
        description: `Failed to delete protocol: ${error}`,
        variant: 'destructive'
      })
    }
  })

  // Launch protocol mutation
  const launchMutation = useMutation({
    mutationFn: (id: string) => gameService.launchProtocol(id),
    onSuccess: () => {
      toast({
        title: 'SYSTEM: launch_protocol',
        description: `Process "${protocol.title}" is now running`
      })
    },
    onError: (error) => {
      toast({
        title: 'FATAL: launch_protocol',
        description: `Failed to launch protocol: "${error}"`,
        variant: 'destructive'
      })
    }
  })

  const handleSave = (): void => {
    const filesWithoutIds = files.map((f) => ({
      name: f.name,
      fileName: f.fileName,
      filePath: f.filePath,
      fileType: f.fileType,
      loadOrder: f.loadOrder,
      isRequired: f.isRequired,
      hashValue: f.hashValue,
      url: f.url || ''
    }))

    updateMutation.mutate({
      id: protocolId,
      protocol,
      files: filesWithoutIds
    })
  }

  const handleDelete = (): void => {
    if (confirm('Are you sure you want to delete this protocol?')) {
      deleteMutation.mutate(protocolId)
    }
  }

  const handleLaunch = (): void => {
    launchMutation.mutate(protocolId)
  }

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ): void => {
    const { name, value } = e.target
    setProtocol((prev) => ({ ...prev, [name]: value }))
  }

  const handleSelectChange = (name: string, value: string): void => {
    setProtocol((prev) => ({ ...prev, [name]: value }))
  }

  const handleExport = async (): Promise<void> => {
    const doomVersion = doomVersions?.find((v) => v.id === protocol.doomVersionId)
    const portName = protocol.sourcePortId
      ? sourcePorts.find((p) => p.id === protocol.sourcePortId)?.name || 'gzdoom'
      : 'gzdoom'

    // Collect config file contents referenced by files and protocol
    const configs: Record<string, { content: string }> = {}

    // From file configTemplates
    for (const f of files) {
      if (f.configTemplate?.md5Hash && !configs[f.configTemplate.md5Hash]) {
        try {
          const content = await api.readConfigContent(f.configTemplate.md5Hash)
          configs[f.configTemplate.md5Hash] = { content }
        } catch {
          console.warn(`Failed to read config ${f.configTemplate.md5Hash} for export`)
        }
      }
    }

    // From protocolConfig (the template it was seeded from)
    if (protocol.protocolConfig?.templateHash && !configs[protocol.protocolConfig.templateHash]) {
      try {
        const content = await api.readConfigContent(protocol.protocolConfig.templateHash)
        configs[protocol.protocolConfig.templateHash] = { content }
      } catch {
        console.warn(`Failed to read protocol config ${protocol.protocolConfig.templateHash} for export`)
      }
    }

    const exportData = {
      format: 'uac-modpack',
      version: '1.1',
      game: {
        title: protocol.title || protocol.name,
        description: protocol.description || '',
        doomVersionSlug: doomVersion?.slug || '',
        sourcePort: portName,
        launchParameters: protocol.launchParameters || '',
        ...(protocol.protocolConfig ? { protocolConfig: protocol.protocolConfig } : {})
      },
      files: files.map((f) => ({
        name: f.name || f.fileName,
        hashValue: f.hashValue || '',
        loadOrder: f.loadOrder ?? 0,
        url: f.url || '',
        ...(f.configTemplate ? { configHash: f.configTemplate.md5Hash } : {})
      })),
      ...(Object.keys(configs).length > 0 ? { configs } : {})
    }

    const jsonStr = JSON.stringify(exportData, null, 2)
    const blob = new Blob([jsonStr], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${slugify(protocol.title || protocol.name || 'modpack')}.json`
    a.click()
    URL.revokeObjectURL(url)

    toast({
      title: 'SYSTEM: export_done',
      description: `Modpack downloaded${Object.keys(configs).length > 0 ? ' with configs' : ''}`
    })
  }

  return (
    <div className="flex-1 overflow-y-auto min-h-0">
      <div className="space-y-4 p-4">
        <div className="flex gap-4 mb-4">
          <div className="w-1/3">
            <Label className="text-xs uppercase tracking-widest text-app-muted font-mono font-bold">
              Screenshot
            </Label>
            <button
              type="button"
              className="w-full rounded overflow-hidden relative group"
              onClick={async () => {
                const result = await api.showOpenDialog({
                  title: 'Select Screenshot',
                  properties: ['openFile'],
                  filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] }]
                })
                if (!result.canceled && result.filePaths.length > 0) {
                  try {
                    const { fileName } = await api.uploadScreenshot(result.filePaths[0])
                    setProtocol((prev) => ({ ...prev, screenshotPath: fileName }))
                    toast({
                      title: 'SYSTEM: screenshot_saved',
                      description: 'New screenshot saved. Click Save to apply.'
                    })
                  } catch (error) {
                    toast({
                      title: 'FATAL: upload_failed',
                      description: `Failed to upload screenshot: ${error}`,
                      variant: 'destructive'
                    })
                  }
                }
              }}
            >
              <img
                src={
                  protocol.screenshotPath
                    ? protocol.screenshotPath.startsWith('http') ||
                      protocol.screenshotPath.includes('/') ||
                      protocol.screenshotPath.includes('\\')
                      ? protocol.screenshotPath
                      : `http://localhost:7666/images/${protocol.screenshotPath}`
                    : placeholder
                }
                alt={protocol.title}
                className="w-full aspect-video object-cover"
              />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded">
                <span className="text-white text-sm font-medium flex items-center gap-2">
                  <FolderOpen className="h-5 w-5" />
                  Change Screenshot
                </span>
              </div>
            </button>
          </div>
          <div className="flex-1 space-y-4">
            <div>
              <Label
                htmlFor="title"
                className="text-xs uppercase tracking-widest text-app-muted font-mono font-bold"
              >
                Label
              </Label>
              <Input
                id="title"
                name="title"
                value={protocol.title || protocol.name || ''}
                onChange={handleInputChange}
                className="bg-app-primary border-app "
              />
            </div>
            <div>
              <Label
                htmlFor="description"
                className="text-xs uppercase tracking-widest text-app-muted font-mono font-bold"
              >
                Description
              </Label>
              <Textarea
                id="description"
                name="description"
                value={protocol.description || ''}
                onChange={handleInputChange}
                className="bg-app-primary border-app"
                rows={3}
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h3 className="text-lg mb-2">Base Configuration</h3>
            <div className="bg-app-primary p-3 rounded space-y-2">
              <div>
                <Label
                  htmlFor="doomVersionId"
                  className="text-xs uppercase tracking-widest text-app-muted font-mono font-bold"
                >
                  Base WAD
                </Label>
                <Select
                  value={protocol.doomVersionId?.toString() || ''}
                  onValueChange={(value) => handleSelectChange('doomVersionId', value)}
                >
                  <SelectTrigger className="bg-app-secondary border-app">
                    <SelectValue placeholder="Select Doom Version" />
                  </SelectTrigger>
                  <SelectContent className="bg-app-secondary border-app text-app-primary">
                    {doomVersions?.map((version) => (
                      <SelectItem key={version.id} value={version.id.toString()}>
                        {version.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label
                  htmlFor="sourcePortId"
                  className="text-xs uppercase tracking-widest text-app-muted font-mono font-bold"
                >
                  Source Port
                </Label>
                <Combobox
                  value={protocol.sourcePortId || ''}
                  onValueChange={(value) => handleSelectChange('sourcePortId', value)}
                  options={sourcePorts
                    .filter((p) => !p.ignored)
                    .map((p) => ({
                      value: p.id,
                      label: p.name,
                      description: p.version
                    }))}
                  placeholder="Select a source port"
                  className="w-full bg-app-secondary border-app"
                />
              </div>

              <div>
                <Label
                  htmlFor="saveDirectory"
                  className="text-xs uppercase tracking-widest text-app-muted font-mono font-bold"
                >
                  Save Directory
                </Label>
                <Input
                  id="saveDirectory"
                  name="saveDirectory"
                  value={protocol.saveDirectory || ''}
                  placeholder={`e.g. ~/saves/${slugify(protocol.title || 'game')}`}
                  onChange={handleInputChange}
                  className="bg-app-secondary border-app"
                />
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg mb-2">Mod Files</h3>
            <ModFileList files={files} onChange={setFiles} />
          </div>
        </div>

        <LaunchOptions
          launchParameters={protocol.launchParameters || ''}
          onChange={(params) => setProtocol((prev) => ({ ...prev, launchParameters: params }))}
        />
      </div>

      {showLaunchPreview && launchCommand && (
        <div className="px-4 py-2 bg-app-primary border-t border-app shrink-0">
          <div className="text-[10px] uppercase tracking-widest text-app-muted font-mono font-bold mb-0.5 opacity-60">
            Launch Preview
          </div>
          <code className="text-xs text-app-muted font-mono break-all opacity-70">
            {launchCommand}
          </code>
        </div>
      )}
      <DialogFooter className="flex justify-between items-center bg-app-secondary border-t border-app p-4 shrink-0">
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleExport}
            className="bg-app-primary hover:bg-app-hover text-app-primary border-app"
            disabled={files.length === 0}
          >
            <Download className="w-4 h-4 mr-2" />
            Export JSON
          </Button>
          <Button
            variant="outline"
            onClick={handleDelete}
            className="bg-app-primary hover:bg-app-hover text-app-primary border-app"
            disabled={deleteMutation.isPending}
          >
            Delete Instance
          </Button>
        </div>

        <div>
          <Button
            variant="outline"
            onClick={handleSave}
            className="mr-2 bg-app-primary hover:bg-app-hover text-app-primary border-app"
            disabled={updateMutation.isPending}
          >
            Save Changes
          </Button>
          <Button
            onClick={handleLaunch}
            className="bg-accent-highlight hover:opacity-90 text-white"
            disabled={launchMutation.isPending}
          >
            PLAY
          </Button>
        </div>
      </DialogFooter>
    </div>
  )
}

export const GameSettingsModal: React.FC<GameSettingsModalProps> = ({
  protocolId,
  isOpen,
  onClose,
  doomVersions
}) => {
  // Fetch protocol details
  const { data, isLoading } = useQuery({
    queryKey: [`/api/protocols/${protocolId}`],
    queryFn: () => (protocolId ? gameService.getProtocol(protocolId) : Promise.resolve(null)),
    enabled: !!protocolId && isOpen
  })

  // Fetch settings for source ports list
  const { data: settings } = useQuery<IAppSettings>({
    queryKey: ['/api/settings'],
    queryFn: () => gameService.getSettings(),
    enabled: isOpen
  })

  const sourcePorts: ISourcePort[] = (settings as IAppSettings)?.sourcePorts || []
  const defaultSourcePortId = (settings as IAppSettings)?.defaultSourcePortId
  const showLaunchPreview = (settings as IAppSettings)?.showLaunchPreview ?? true

  // Fetch catalog for hydrating files with hashValue
  const { data: catalogFiles } = useQuery({
    queryKey: ['/api/mod-files/catalog'],
    queryFn: () => gameService.getModFileCatalog(),
    enabled: isOpen
  })

  const { hydratedProtocol, hydratedFiles } = useMemo(() => {
    if (!data || !('protocol' in data) || !data.protocol)
      return { hydratedProtocol: null, hydratedFiles: [] }

    const proto = data.protocol as IProtocol
    const protoFiles = (data.files || []) as IModFile[]

    if (catalogFiles && catalogFiles.length > 0) {
      const files = protoFiles.map((file) => {
        const catalogMatch = catalogFiles.find(
          (c) => c.hashValue === file.hashValue || c.fileName === file.fileName
        )
        if (catalogMatch) {
          return {
            ...file,
            hashValue: file.hashValue || catalogMatch.hashValue || '',
            filePath: file.filePath || catalogMatch.filePath || '',
            url: file.url || catalogMatch.url || ''
          }
        }
        return file
      })
      return { hydratedProtocol: proto, hydratedFiles: files }
    }

    return { hydratedProtocol: proto, hydratedFiles: protoFiles }
  }, [data, catalogFiles])

  if (!isOpen) return null

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-app-primary shadow-2xl border-app max-w-4xl h-[85vh] flex flex-col p-0 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-app bg-app-secondary">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-accent-highlight/10 rounded-md">
              <Gamepad2 className="w-5 h-5 text-accent-highlight" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold tracking-tight text-app-primary lowercase">
                {hydratedProtocol?.title || hydratedProtocol?.name || 'mod_settings'}
              </DialogTitle>
              <DialogDescription className="text-xs font-semibold font-mono text-app-muted uppercase tracking-widest opacity-80">
                UAC Launch Control // Mod Configuration
              </DialogDescription>
            </div>
          </div>
        </div>

        {isLoading || !hydratedProtocol ? (
          <div className="p-4 text-center">Loading protocol details...</div>
        ) : (
          <GameSettingsContent
            initialProtocol={hydratedProtocol}
            initialFiles={hydratedFiles}
            protocolId={protocolId!}
            onClose={onClose}
            doomVersions={doomVersions}
            sourcePorts={sourcePorts}
            defaultSourcePortId={defaultSourcePortId}
            showLaunchPreview={showLaunchPreview}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

export default GameSettingsModal
