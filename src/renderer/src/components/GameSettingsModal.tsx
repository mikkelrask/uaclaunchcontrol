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
import { IMod, IModFile, IDoomVersion, InsertModFile, ISourcePort, IAppSettings } from '@shared/schema'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { gameService } from '@/lib/gameService'
import { useToast } from '@/hooks/use-toast'
import { api } from '@/api'
import ModFileList from './ModFileList'
import LaunchOptions from './LaunchOptions'
import { FolderOpen, Download, Gamepad2 } from 'lucide-react'
import { slugify } from '@/lib/utils'
import placeholder from '@renderer/assets/placeholder.png'

interface GameSettingsModalProps {
  modId: string | null
  isOpen: boolean
  onClose: () => void
  doomVersions: IDoomVersion[] | undefined
}

interface GameSettingsContentProps {
  initialMod: IMod
  initialFiles: IModFile[]
  modId: string
  onClose: () => void
  doomVersions: IDoomVersion[] | undefined
  sourcePorts: ISourcePort[]
  defaultSourcePortId?: string
}

const GameSettingsContent: React.FC<GameSettingsContentProps> = ({
  initialMod,
  initialFiles,
  modId,
  onClose,
  doomVersions,
  sourcePorts
}) => {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [mod, setMod] = useState<IMod>(initialMod)
  const [files, setFiles] = useState<InsertModFile[]>(initialFiles)

  // Update mod mutation
  const updateMutation = useMutation({
    mutationFn: ({
      id,
      mod,
      files
    }: {
      id: string
      mod: Partial<IMod>
      files: Omit<IModFile, 'id' | 'modId'>[]
    }) => gameService.updateMod(id, mod, files),
    onSuccess: (updatedMod, variables) => {
      toast({
        title: 'SYSTEM: mod_saved',
        description: 'Protocol settings successfully saved.'
      })
      queryClient.invalidateQueries({ queryKey: ['/api/mods'] })
      queryClient.setQueryData([`/api/mods/${variables.id}`], {
        mod: updatedMod,
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

  // Delete mod mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => gameService.deleteMod(id),
    onSuccess: () => {
      toast({
        title: 'SYSTEM: delete_mod',
        description: 'Mod deleted successfully'
      })
      queryClient.invalidateQueries({ queryKey: ['/api/mods'] })
      onClose()
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to delete mod: ${error}`,
        variant: 'destructive'
      })
    }
  })

  // Launch mod mutation
  const launchMutation = useMutation({
    mutationFn: (id: string) => gameService.launchMod(id),
    onSuccess: () => {
      toast({
        title: 'SYSTEM: launch_protocol',
        description: `Process "${mod.title}" is now running`
      })
    },
    onError: (error) => {
      toast({
        title: 'FATA: launch_protocol',
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
      hashValue: f.hashValue
    }))

    updateMutation.mutate({
      id: modId,
      mod,
      files: filesWithoutIds
    })
  }

  const handleDelete = (): void => {
    if (confirm('Are you sure you want to delete this mod?')) {
      deleteMutation.mutate(modId)
    }
  }

  const handleLaunch = (): void => {
    launchMutation.mutate(modId)
  }

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ): void => {
    const { name, value } = e.target
    setMod((prev) => ({ ...prev, [name]: value }))
  }

  const handleSelectChange = (name: string, value: string): void => {
    setMod((prev) => ({ ...prev, [name]: value }))
  }

  const handleExport = (): void => {
    const doomVersion = doomVersions?.find((v) => v.id === mod.doomVersionId)
    const portName = mod.sourcePortId
      ? sourcePorts.find((p) => p.id === mod.sourcePortId)?.name || 'gzdoom'
      : 'gzdoom'
    const exportData = {
      format: 'uac-modpack',
      version: '1.0',
      game: {
        title: mod.title || mod.name,
        description: mod.description || '',
        doomVersionSlug: doomVersion?.slug || '',
        sourcePort: portName,
        launchParameters: mod.launchParameters || ''
      },
      files: files.map((f) => ({
        name: f.name || f.fileName,
        hashValue: f.hashValue || '',
        loadOrder: f.loadOrder ?? 0
      }))
    }

    const jsonStr = JSON.stringify(exportData, null, 2)
    const blob = new Blob([jsonStr], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${slugify(mod.title || mod.name || 'modpack')}.json`
    a.click()
    URL.revokeObjectURL(url)

    toast({
      title: 'Exported',
      description: 'Modpack JSON downloaded'
    })
  }

  return (
    <div className="flex-1 overflow-y-auto min-h-0">
      <div className="space-y-4 p-4">
        <div className="mb-4 group relative">
          <button
            type="button"
            className="w-full h-64 rounded overflow-hidden relative"
            onClick={async () => {
              const result = await api.showOpenDialog({
                title: 'Select Screenshot',
                properties: ['openFile'],
                filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] }]
              })
              if (!result.canceled && result.filePaths.length > 0) {
                try {
                  const { fileName } = await api.uploadScreenshot(result.filePaths[0])
                  setMod((prev) => ({ ...prev, screenshotPath: fileName }))
                  toast({
                    title: 'Screenshot updated',
                    description: 'New screenshot saved. Click Save to apply.'
                  })
                } catch (error) {
                  toast({
                    title: 'Error',
                    description: `Failed to upload screenshot: ${error}`,
                    variant: 'destructive'
                  })
                }
              }
            }}
          >
            <img
              src={
                mod.screenshotPath
                  ? mod.screenshotPath.startsWith('http') ||
                    mod.screenshotPath.includes('/') ||
                    mod.screenshotPath.includes('\\')
                    ? mod.screenshotPath
                    : `http://localhost:7666/images/${mod.screenshotPath}`
                  : placeholder
              }
              alt={mod.title}
              className="w-full h-64 object-cover"
            />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
              <span className="text-white text-sm font-medium flex items-center gap-2">
                <FolderOpen className="h-5 w-5" />
                Change Screenshot
              </span>
            </div>
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4">
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
              value={mod.title || mod.name || ''}
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
              value={mod.description || ''}
              onChange={handleInputChange}
              className="bg-app-primary border-app"
              rows={3}
            />
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
                  value={mod.doomVersionId?.toString() || ''}
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
                  value={mod.sourcePortId || ''}
                  onValueChange={(value) => handleSelectChange('sourcePortId', value)}
                  options={sourcePorts
                    .filter((p) => !p.ignored)
                    .map((p) => ({
                      value: p.id,
                      label: p.version ? `${p.name} ${p.version}` : p.name
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
                  value={mod.saveDirectory || ''}
                  placeholder={`e.g. ~/saves/${slugify(mod.title || 'game')}`}
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
          launchParameters={mod.launchParameters || ''}
          onChange={(params) => setMod((prev) => ({ ...prev, launchParameters: params }))}
        />
      </div>

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
  modId,
  isOpen,
  onClose,
  doomVersions
}) => {
  // Fetch mod details
  const { data, isLoading } = useQuery({
    queryKey: [`/api/mods/${modId}`],
    queryFn: () => (modId ? gameService.getMod(modId) : Promise.resolve(null)),
    enabled: !!modId && isOpen
  })

  // Fetch settings for source ports list
  const { data: settings } = useQuery<IAppSettings>({
    queryKey: ['/api/settings'],
    queryFn: () => gameService.getSettings(),
    enabled: isOpen
  })

  const sourcePorts: ISourcePort[] = (settings as IAppSettings)?.sourcePorts || []
  const defaultSourcePortId = (settings as IAppSettings)?.defaultSourcePortId

  // Fetch catalog for hydrating files with hashValue
  const { data: catalogFiles } = useQuery({
    queryKey: ['/api/mod-files/catalog'],
    queryFn: () => gameService.getModFileCatalog(),
    enabled: isOpen
  })

  const { hydratedMod, hydratedFiles } = useMemo(() => {
    if (!data || !('mod' in data) || !data.mod) return { hydratedMod: null, hydratedFiles: [] }

    const mod = data.mod as IMod
    const modFiles = (data.files || []) as IModFile[]

    if (catalogFiles && catalogFiles.length > 0) {
      const files = modFiles.map((file) => {
        const catalogMatch = catalogFiles.find(
          (c) => c.hashValue === file.hashValue || c.fileName === file.fileName
        )
        if (catalogMatch) {
          return {
            ...file,
            hashValue: file.hashValue || catalogMatch.hashValue || '',
            filePath: file.filePath || catalogMatch.filePath || ''
          }
        }
        return file
      })
      return { hydratedMod: mod, hydratedFiles: files }
    }

    return { hydratedMod: mod, hydratedFiles: modFiles }
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
                {hydratedMod?.title || hydratedMod?.name || 'mod_settings'}
              </DialogTitle>
              <DialogDescription className="text-xs font-semibold font-mono text-app-muted uppercase tracking-widest opacity-80">
                UAC Launch Control // Mod Configuration
              </DialogDescription>
            </div>
          </div>
        </div>

        {isLoading || !hydratedMod ? (
          <div className="p-4 text-center">Loading mod details...</div>
        ) : (
          <GameSettingsContent
            initialMod={hydratedMod}
            initialFiles={hydratedFiles}
            modId={modId!}
            onClose={onClose}
            doomVersions={doomVersions}
            sourcePorts={sourcePorts}
            defaultSourcePortId={defaultSourcePortId}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

export default GameSettingsModal
