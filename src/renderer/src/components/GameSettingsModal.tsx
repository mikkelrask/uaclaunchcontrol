import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { IMod, IModFile, IDoomVersion } from '@shared/schema'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { gameService } from '@/lib/gameService'
import { useToast } from '@/hooks/use-toast'
import { api } from '@/api'
import ModFileList from './ModFileList'
import LaunchOptions from './LaunchOptions'
import { FolderOpen } from 'lucide-react'
import { slugify } from '@/lib/utils'
import placeholder from '@renderer/assets/placeholder.png'

interface GameSettingsModalProps {
  modId: string | null
  isOpen: boolean
  onClose: () => void
  doomVersions: IDoomVersion[] | undefined
}

export const GameSettingsModal: React.FC<GameSettingsModalProps> = ({
  modId,
  isOpen,
  onClose,
  doomVersions
}) => {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [mod, setMod] = useState<IMod | null>(null)
  const [files, setFiles] = useState<IModFile[]>([])

  // Fetch mod details
  const { data, isLoading } = useQuery({
    queryKey: [`/api/mods/${modId}`],
    queryFn: () => (modId ? gameService.getMod(modId) : Promise.resolve(null)),
    enabled: !!modId && isOpen
  })

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
        title: 'Success',
        description: 'Mod settings saved successfully'
      })
      // Update both the list and the individual mod cache
      queryClient.invalidateQueries({ queryKey: ['/api/mods'] })
      queryClient.setQueryData([`/api/mods/${variables.id}`], {
        mod: updatedMod,
        files: variables.files
      })
      onClose()
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to save settings: ${error}`,
        variant: 'destructive'
      })
    }
  })

  // Delete mod mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => gameService.deleteMod(id),
    onSuccess: () => {
      toast({
        title: 'Success',
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
        title: 'Game launched',
        description: `${mod?.title} is now running`
      })
    },
    onError: (error) => {
      toast({
        title: 'Launch failed',
        description: `Failed to launch game: ${error}`,
        variant: 'destructive'
      })
    }
  })

  // Initialize form state when data is loaded
  useEffect(() => {
    if (data && typeof data === 'object' && data !== null) {
      // Type-safe check if data has a 'mod' property
      if ('mod' in data && data.mod) {
        setMod(data.mod as IMod)
      } else {
        setMod(null)
      }

      // Type-safe check if data has a 'files' property
      if ('files' in data && Array.isArray(data.files)) {
        setFiles(data.files as IModFile[])
      } else {
        setFiles([])
      }
    }
  }, [data])

  const handleSave = (): void => {
    if (!mod || !modId) return

    const filesWithoutIds = files.map((f) => ({
      fileName: f.fileName,
      filePath: f.filePath,
      fileType: f.fileType,
      loadOrder: f.loadOrder,
      isRequired: f.isRequired
    }))

    updateMutation.mutate({
      id: modId,
      mod,
      files: filesWithoutIds
    })
  }

  const handleDelete = (): void => {
    if (!modId) return
    if (confirm('Are you sure you want to delete this mod?')) {
      deleteMutation.mutate(modId)
    }
  }

  const handleLaunch = (): void => {
    if (!modId) return
    launchMutation.mutate(modId)
  }

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ): void => {
    const { name, value } = e.target
    setMod((prev) => (prev ? { ...prev, [name]: value } : null))
  }

  const handleSelectChange = (name: string, value: string): void => {
    setMod((prev) => (prev ? { ...prev, [name]: value } : null))
  }

  if (!isOpen) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-app-secondary text-app-primary border-app max-w-4xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-sans font-bold">
            {mod?.title || mod?.name || 'Mod Settings'}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="p-4 text-center">Loading mod details...</div>
        ) : (
          <>
            <div className="space-y-4">
              <div className="mb-4 group relative">
                <button
                  type="button"
                  className="w-full h-64 rounded overflow-hidden relative"
                  onClick={async () => {
                    const result = await api.showOpenDialog({
                      title: 'Select Screenshot',
                      properties: ['openFile'],
                      filters: [
                        { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] }
                      ]
                    })
                    if (!result.canceled && result.filePaths.length > 0) {
                      try {
                        const { fileName } = await api.uploadScreenshot(result.filePaths[0])
                        setMod((prev) => (prev ? { ...prev, screenshotPath: fileName } : null))
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
                      mod?.screenshotPath
                        ? mod.screenshotPath.startsWith('http') ||
                          mod.screenshotPath.includes('/') ||
                          mod.screenshotPath.includes('\\')
                          ? mod.screenshotPath
                          : `http://localhost:7666/images/${mod.screenshotPath}`
                        : placeholder
                    }
                    alt={mod?.title}
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
                  <Label htmlFor="title">Mod Title</Label>
                  <Input
                    id="title"
                    name="title"
                    value={mod?.title || mod?.name || ''}
                    onChange={handleInputChange}
                    className="bg-app-primary border-app"
                  />
                </div>

                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    name="description"
                    value={mod?.description || ''}
                    onChange={handleInputChange}
                    className="bg-app-primary border-app"
                    rows={3}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="text-lg font-sans mb-2">Game Configuration</h3>
                  <div className="bg-app-primary p-3 rounded space-y-2">
                    <div>
                      <Label htmlFor="doomVersionId">Base Game</Label>
                      <Select
                        value={mod?.doomVersionId?.toString() || ''}
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
                      <Label htmlFor="sourcePort">Source Port</Label>
                      <Input
                        id="sourcePort"
                        name="sourcePort"
                        value={mod?.sourcePort || 'GZDoom'}
                        onChange={handleInputChange}
                        className="bg-app-secondary border-app"
                      />
                    </div>

                    <div>
                      <Label htmlFor="saveDirectory">Save Directory</Label>
                      <Input
                        id="saveDirectory"
                        name="saveDirectory"
                        value={mod?.saveDirectory || ''}
                        placeholder={`e.g. ~/saves/${slugify(mod?.title || 'game')}`}
                        onChange={handleInputChange}
                        className="bg-app-secondary border-app"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-sans mb-2">Mod Files</h3>
                  <ModFileList files={files} onChange={setFiles} />
                </div>
              </div>

              <LaunchOptions
                launchParameters={mod?.launchParameters || ''}
                onChange={(params) =>
                  setMod((prev) => (prev ? { ...prev, launchParameters: params } : null))
                }
              />
            </div>

            <DialogFooter className="flex justify-between mt-6">
              <div>
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
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default GameSettingsModal
