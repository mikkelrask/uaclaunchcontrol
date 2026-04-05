import React, { useState, useEffect, useId } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { api } from '@/api'
import type { IDoomVersion } from '@shared/schema'

interface SettingsDialogProps {
  isOpen: boolean
  onClose: () => void
}

// Convert local file path to proper file:// URL
const toFileUrl = (filePath: string): string => {
  if (!filePath) return ''
  // Handle Windows paths with backslashes
  const normalized = filePath.replace(/\\/g, '/')
  // Encode spaces and special characters
  const encoded = normalized
    .split('/')
    .map((p) => encodeURIComponent(p))
    .join('/')
  return `file:///${encoded}`
}

export const SettingsDialog: React.FC<SettingsDialogProps> = ({ isOpen, onClose }) => {
  const { toast } = useToast()
  const id = useId()

  // Settings state
  const [settings, setSettings] = useState({
    gzDoomPath: '',
    saveDirectory: '',
    modsDirectory: '',
    screenshotsDirectory: '',
    wadFilesDirectory: ''
  })

  // Doom versions state
  const [doomVersions, setDoomVersions] = useState<IDoomVersion[]>([])
  const [isLoadingVersions, setIsLoadingVersions] = useState(false)

  // Fetch settings from API when dialog opens
  useEffect(() => {
    if (!isOpen) return
    api
      .getSettings()
      .then((data) => {
        setSettings({
          gzDoomPath: data.gzDoomPath || '',
          saveDirectory: data.savegamesPath || '',
          modsDirectory: data.modsDirectory || '',
          screenshotsDirectory: data.screenshotsPath || '',
          wadFilesDirectory: data.wadFilesDirectory || ''
        })
      })
      .catch(() => {
        toast({ title: 'Error', description: 'Failed to load settings', variant: 'destructive' })
      })

    // Fetch doom versions
    setIsLoadingVersions(true)
    api
      .getDoomVersions()
      .then((versions) => {
        setDoomVersions(versions)
      })
      .catch(() => {
        toast({
          title: 'Error',
          description: 'Failed to load doom versions',
          variant: 'destructive'
        })
      })
      .finally(() => {
        setIsLoadingVersions(false)
      })
  }, [isOpen])

  // Handle input changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setSettings((prev) => ({
      ...prev,
      [name]: value
    }))
  }

  // Handle doom version field changes
  const handleVersionChange = (index: number, field: keyof IDoomVersion, value: string) => {
    setDoomVersions((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  const handleIconBrowse = async (index: number) => {
    const version = doomVersions[index]
    const result = await api.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] }],
      defaultPath: version.icon || undefined
    })

    if (!result.canceled && result.filePaths.length > 0) {
      const selectedIconPath = result.filePaths[0]
      const iconFileName = selectedIconPath.split(/[\\/]/).pop() || 'icon.png'

      // If wads directory is set, move the icon there
      if (settings.wadFilesDirectory) {
        const destPath = `${settings.wadFilesDirectory}/${iconFileName}`
        try {
          await api.moveFile(selectedIconPath, destPath)
          handleVersionChange(index, 'icon', destPath)
          toast({ title: 'Icon moved', description: `Icon moved to ${destPath}` })
        } catch {
          // If move fails, just use the selected path
          handleVersionChange(index, 'icon', selectedIconPath)
        }
      } else {
        handleVersionChange(index, 'icon', selectedIconPath)
      }
    }
  }

  // Handle save
  const handleSave = async () => {
    try {
      const payload = {
        gzDoomPath: settings.gzDoomPath,
        savegamesPath: settings.saveDirectory,
        modsDirectory: settings.modsDirectory,
        screenshotsPath: settings.screenshotsDirectory,
        wadFilesDirectory: settings.wadFilesDirectory,
        theme: 'dark' // or get from UI if you have a theme selector
      }
      await api.updateSettings(payload)

      // Also save doom versions
      await api.updateDoomVersions(doomVersions)

      toast({
        title: 'Settings Saved',
        description: 'Your settings have been saved successfully.'
      })
      onClose()
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to save settings',
        variant: 'destructive'
      })
    }
  }

  // Handle folder/file browse
  const handleBrowse = async (settingName: string) => {
    const currentPath = settings[settingName as keyof typeof settings] as string | undefined
    const isFile = settingName === 'gzDoomPath'

    const result = await api.showOpenDialog({
      properties: isFile ? ['openFile'] : ['openDirectory'],
      defaultPath: currentPath
    })

    if (!result.canceled && result.filePaths.length > 0) {
      setSettings((prev) => ({
        ...prev,
        [settingName]: result.filePaths[0]
      }))
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-app-secondary border-app text-app-primary max-w-2xl flex flex-col max-h-[95vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-2xl font-mono mb-2">Settings</DialogTitle>
          <DialogDescription className="text-app-secondary">
            Configure your Doom launcher settings
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="paths" className="flex flex-col flex-1 min-h-0 w-full mt-4">
          <TabsList className="bg-app-primary mb-4 shrink-0">
            <TabsTrigger value="paths" className="data-[state=active]:bg-app-hover">
              Paths
            </TabsTrigger>
            <TabsTrigger value="appearance" className="data-[state=active]:bg-app-hover">
              Wad Settings
            </TabsTrigger>
            <TabsTrigger value="advanced" className="data-[state=active]:bg-app-hover">
              Advanced
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto pr-4 -mr-2 pb-2">
            <TabsContent value="paths" className="space-y-4 mt-0">
            <div className="grid grid-cols-[1fr,auto] gap-2 items-center">
              <div>
                <Label htmlFor={`${id}-gzDoomPath`} className="font-mono">
                  GZDoom Executable
                </Label>
                <Input
                  id={`${id}-gzDoomPath`}
                  name="gzDoomPath"
                  value={settings.gzDoomPath}
                  onChange={handleChange}
                  className="bg-app-primary border-app mt-1"
                />
              </div>
              <Button
                className="mt-7 bg-app-primary hover:bg-app-hover"
                onClick={() => handleBrowse('gzDoomPath')}
              >
                Browse...
              </Button>
            </div>

            <div className="grid grid-cols-[1fr,auto] gap-2 items-center">
              <div>
                <Label htmlFor={`${id}-saveDirectory`} className="font-mono">
                  Save Files Directory
                </Label>
                <Input
                  id={`${id}-saveDirectory`}
                  name="saveDirectory"
                  value={settings.saveDirectory}
                  onChange={handleChange}
                  className="bg-app-primary border-app mt-1"
                />
              </div>
              <Button
                className="mt-7 bg-app-primary hover:bg-app-hover"
                onClick={() => handleBrowse('saveDirectory')}
              >
                Browse...
              </Button>
            </div>

            <div className="grid grid-cols-[1fr,auto] gap-2 items-center">
              <div>
                <Label htmlFor={`${id}-modsDirectory`} className="font-mono">
                  Mods Directory
                </Label>
                <Input
                  id={`${id}-modsDirectory`}
                  name="modsDirectory"
                  value={settings.modsDirectory}
                  onChange={handleChange}
                  className="bg-app-primary border-app mt-1"
                />
              </div>
              <Button
                className="mt-7 bg-app-primary hover:bg-app-hover"
                onClick={() => handleBrowse('modsDirectory')}
              >
                Browse...
              </Button>
            </div>

            <div className="grid grid-cols-[1fr,auto] gap-2 items-center">
              <div>
                <Label htmlFor={`${id}-screenshotsDirectory`} className="font-mono">
                  Screenshots Directory
                </Label>
                <Input
                  id={`${id}-screenshotsDirectory`}
                  name="screenshotsDirectory"
                  value={settings.screenshotsDirectory}
                  onChange={handleChange}
                  className="bg-app-primary border-app mt-1"
                />
              </div>
              <Button
                className="mt-7 bg-app-primary hover:bg-app-hover"
                onClick={() => handleBrowse('screenshotsDirectory')}
              >
                Browse...
              </Button>
            </div>

            <div className="grid grid-cols-[1fr,auto] gap-2 items-center">
              <div>
                <Label htmlFor={`${id}-wadFilesDirectory`} className="font-mono">
                  Wad Files Directory
                </Label>
                <Input
                  id={`${id}-wadFilesDirectory`}
                  name="wadFilesDirectory"
                  value={settings.wadFilesDirectory}
                  onChange={handleChange}
                  className="bg-app-primary border-app mt-1"
                />
              </div>
              <Button
                className="mt-7 bg-app-primary hover:bg-app-hover"
                onClick={() => handleBrowse('wadFilesDirectory')}
              >
                Browse...
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="appearance" className="space-y-4 mt-0">
            {!settings.wadFilesDirectory ? (
              <p className="text-app-secondary">
                Set the Wad Files Directory in the Paths tab to configure individual wads.
              </p>
            ) : isLoadingVersions ? (
              <p className="text-app-secondary">Loading wads...</p>
            ) : doomVersions.length === 0 ? (
              <p className="text-app-secondary">No wads found in the specified directory.</p>
            ) : (
              <div className="space-y-4 overflow-visible">
                {doomVersions.map((version, index) => (
                  <div
                    key={version.id || index}
                    className="bg-app-primary border border-app rounded-md p-3 space-y-2"
                  >
                    <div className="flex items-center gap-2">
                      {version.icon ? (
                        <div className="relative w-8 h-8">
                          <img
                            src={toFileUrl(version.icon)}
                            alt={version.name}
                            className="w-8 h-8 object-contain bg-app-secondary rounded"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none'
                            }}
                          />
                        </div>
                      ) : (
                        <div className="w-8 h-8 bg-app-secondary rounded flex items-center justify-center text-xs text-app-secondary">
                          No img
                        </div>
                      )}
                      <div className="flex-1">
                        <Label className="text-xs text-app-secondary">Name</Label>
                        <Input
                          value={version.name}
                          onChange={(e) => handleVersionChange(index, 'name', e.target.value)}
                          className="bg-app-secondary border-app text-sm"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-[1fr,auto] gap-2 items-center">
                      <div>
                        <Label className="text-xs text-app-secondary">Executable</Label>
                        <Input
                          value={version.executable}
                          onChange={(e) => handleVersionChange(index, 'executable', e.target.value)}
                          className="bg-app-secondary border-app text-sm"
                          placeholder="gzdoom"
                        />
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleIconBrowse(index)}
                        className="mt-4 border-app"
                      >
                        Icon
                      </Button>
                    </div>

                    <div>
                      <Label className="text-xs text-app-secondary">WAD File</Label>
                      <Input
                        value={version.defaultIwad}
                        readOnly
                        className="bg-app-primary border-app text-sm text-app-muted"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="advanced" className="space-y-4 mt-0">
            <p className="text-app-secondary">
              Advanced settings will be implemented in a future update.
            </p>
          </TabsContent>
          </div>
        </Tabs>

        <DialogFooter className="flex justify-between mt-4 shrink-0 pt-4 border-t border-app">
          <Button
            variant="outline"
            onClick={onClose}
            className="bg-transparent border-app hover:bg-app-hover hover:text-app-primary text-app-secondary"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            className="bg-accent-highlight hover:opacity-90 text-white font-mono"
          >
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default SettingsDialog
