import React, { useState, useEffect } from 'react'
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

interface SettingsDialogProps {
  isOpen: boolean
  onClose: () => void
}

export const SettingsDialog: React.FC<SettingsDialogProps> = ({ isOpen, onClose }) => {
  const { toast } = useToast()

  // Settings state
  const [settings, setSettings] = useState({
    gzDoomPath: '',
    saveDirectory: '',
    modsDirectory: '',
    screenshotsDirectory: ''
  })

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
          screenshotsDirectory: data.screenshotsPath || ''
        })
      })
      .catch(() => {
        toast({ title: 'Error', description: 'Failed to load settings', variant: 'destructive' })
      })
  }, [isOpen, toast])

  // Handle input changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setSettings((prev) => ({
      ...prev,
      [name]: value
    }))
  }

  // Handle save
  const handleSave = async () => {
    try {
      const payload = {
        gzDoomPath: settings.gzDoomPath,
        savegamesPath: settings.saveDirectory,
        modsDirectory: settings.modsDirectory,
        screenshotsPath: settings.screenshotsDirectory,
        theme: 'dark' // or get from UI if you have a theme selector
      }
      await api.updateSettings(payload)
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

  // Handle folder browse
  const handleBrowse = async (settingName: string) => {
    const currentPath = settings[settingName as keyof typeof settings] as string | undefined
    const result = await api.showOpenDialog({
      properties: ['openDirectory'],
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
      <DialogContent className="bg-[#162b3d] border-[#262626] text-white max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-mono mb-2">Settings</DialogTitle>
          <DialogDescription className="text-[#e6e6e6]">
            Configure your Doom launcher settings
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="paths" className="w-full mt-4">
          <TabsList className="bg-[#0c1c2a] mb-4">
            <TabsTrigger value="paths" className="data-[state=active]:bg-[#1f3547]">
              Paths
            </TabsTrigger>
            <TabsTrigger value="appearance" className="data-[state=active]:bg-[#1f3547]">
              Appearance
            </TabsTrigger>
            <TabsTrigger value="advanced" className="data-[state=active]:bg-[#1f3547]">
              Advanced
            </TabsTrigger>
          </TabsList>

          <TabsContent value="paths" className="space-y-4">
            <div className="grid grid-cols-[1fr,auto] gap-2 items-center">
              <div>
                <Label htmlFor="gzDoomPath" className="font-mono">
                  GZDoom Executable
                </Label>
                <Input
                  id="gzDoomPath"
                  name="gzDoomPath"
                  value={settings.gzDoomPath}
                  onChange={handleChange}
                  className="bg-[#0c1c2a] border-[#262626] mt-1"
                />
              </div>
              <Button
                className="mt-7 bg-[#0c1c2a] hover:bg-[#1f3547]"
                onClick={() => handleBrowse('gzDoomPath')}
              >
                Browse...
              </Button>
            </div>

            <div className="grid grid-cols-[1fr,auto] gap-2 items-center">
              <div>
                <Label htmlFor="saveDirectory" className="font-mono">
                  Save Files Directory
                </Label>
                <Input
                  id="saveDirectory"
                  name="saveDirectory"
                  value={settings.saveDirectory}
                  onChange={handleChange}
                  className="bg-[#0c1c2a] border-[#262626] mt-1"
                />
              </div>
              <Button
                className="mt-7 bg-[#0c1c2a] hover:bg-[#1f3547]"
                onClick={() => handleBrowse('saveDirectory')}
              >
                Browse...
              </Button>
            </div>

            <div className="grid grid-cols-[1fr,auto] gap-2 items-center">
              <div>
                <Label htmlFor="modsDirectory" className="font-mono">
                  Mods Directory
                </Label>
                <Input
                  id="modsDirectory"
                  name="modsDirectory"
                  value={settings.modsDirectory}
                  onChange={handleChange}
                  className="bg-[#0c1c2a] border-[#262626] mt-1"
                />
              </div>
              <Button
                className="mt-7 bg-[#0c1c2a] hover:bg-[#1f3547]"
                onClick={() => handleBrowse('modsDirectory')}
              >
                Browse...
              </Button>
            </div>

            <div className="grid grid-cols-[1fr,auto] gap-2 items-center">
              <div>
                <Label htmlFor="screenshotsDirectory" className="font-mono">
                  Screenshots Directory
                </Label>
                <Input
                  id="screenshotsDirectory"
                  name="screenshotsDirectory"
                  value={settings.screenshotsDirectory}
                  onChange={handleChange}
                  className="bg-[#0c1c2a] border-[#262626] mt-1"
                />
              </div>
              <Button
                className="mt-7 bg-[#0c1c2a] hover:bg-[#1f3547]"
                onClick={() => handleBrowse('screenshotsDirectory')}
              >
                Browse...
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="appearance" className="space-y-4">
            <p className="text-[#e6e6e6]">
              Appearance settings will be implemented in a future update.
            </p>
          </TabsContent>

          <TabsContent value="advanced" className="space-y-4">
            <p className="text-[#e6e6e6]">
              Advanced settings will be implemented in a future update.
            </p>
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex justify-between mt-4">
          <Button
            variant="outline"
            onClick={onClose}
            className="bg-transparent border-[#262626] hover:bg-[#1f3547] hover:text-white text-[#e6e6e6]"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            className="bg-[#d41c1c] hover:bg-[#b21616] text-white font-mono"
          >
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default SettingsDialog
