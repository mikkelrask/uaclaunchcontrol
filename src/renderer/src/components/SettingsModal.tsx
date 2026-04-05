import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { FolderOpenIcon } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { gameService } from '@/lib/gameService'
import type { IAppSettings } from '@shared/schema'

interface SettingsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [settings, setSettings] = useState<IAppSettings>({
    gzDoomPath: '',
    savegamesPath: '',
    screenshotsPath: '',
    defaultSourcePort: 'gzdoom',
    theme: 'dark'
  })

  // Load settings when the modal opens
  useEffect(() => {
    if (open) {
      loadSettings()
    }
  }, [open])

  const applyTheme = (theme: string) => {
    document.documentElement.classList.remove('dark', 'light')
    if (theme !== 'system') {
      document.documentElement.classList.add(theme)
    }
  }

  const loadSettings = async () => {
    setIsLoading(true)
    try {
      const loadedSettings = await gameService.getSettings()
      console.log('Loaded settings:', loadedSettings)
      setSettings(loadedSettings)
      if (loadedSettings.theme) {
        applyTheme(loadedSettings.theme)
      }
    } catch (error) {
      console.error('Failed to load settings:', error)
      toast({
        title: 'Error',
        description: 'Failed to load settings',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleSaveSettings = async () => {
    setIsLoading(true)
    try {
      await gameService.updateSettings(settings)
      applyTheme(settings.theme || 'dark')
      toast({
        title: 'Success',
        description: 'Settings saved successfully'
      })
      onOpenChange(false)
    } catch (error) {
      console.error('Failed to save settings:', error)
      toast({
        title: 'Error',
        description: 'Failed to save settings',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleBrowseFile = async (settingKey: keyof IAppSettings) => {
    try {
      const result = await gameService.showOpenDialog({
        properties: settingKey === 'gzDoomPath' ? ['openFile'] : ['openDirectory'],
        filters:
          settingKey === 'gzDoomPath'
            ? [{ name: 'Executables', extensions: ['exe', ''] }]
            : undefined
      })

      if (!result.canceled && result.filePaths.length > 0) {
        setSettings({
          ...settings,
          [settingKey]: result.filePaths[0]
        })
      }
    } catch (error) {
      console.error('Failed to open file dialog:', error)
      toast({
        title: 'Error',
        description: 'Failed to open file dialog',
        variant: 'destructive'
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[hsl(var(--bg-popover))] border-[hsl(var(--border))] text-[hsl(var(--text-popover))]">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="gzDoomPath">GZDoom Path</Label>
            <div className="flex space-x-2">
              <Input
                id="gzDoomPath"
                value={settings.gzDoomPath || ''}
                onChange={(e) => setSettings({ ...settings, gzDoomPath: e.target.value })}
                placeholder="/usr/bin/gzdoom"
                className="bg-[hsl(var(--bg-primary))] border-[hsl(var(--border))] flex-1"
              />
              <Button
                variant="outline"
                onClick={() => handleBrowseFile('gzDoomPath')}
                className="border-[hsl(var(--border))]"
              >
                <FolderOpenIcon className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="savegamesPath">Savegames Path</Label>
            <div className="flex space-x-2">
              <Input
                id="savegamesPath"
                value={settings.savegamesPath || ''}
                onChange={(e) => setSettings({ ...settings, savegamesPath: e.target.value })}
                placeholder="~/.config/gzdoom/savegames"
                className="bg-[hsl(var(--bg-primary))] border-[hsl(var(--border))] flex-1"
              />
              <Button
                variant="outline"
                onClick={() => handleBrowseFile('savegamesPath')}
                className="border-[hsl(var(--border))]"
              >
                <FolderOpenIcon className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="screenshotsPath">Screenshots Path</Label>
            <div className="flex space-x-2">
              <Input
                id="screenshotsPath"
                value={settings.screenshotsPath || ''}
                onChange={(e) => setSettings({ ...settings, screenshotsPath: e.target.value })}
                placeholder="~/.config/gzdoom/screenshots"
                className="bg-[hsl(var(--bg-primary))] border-[hsl(var(--border))] flex-1"
              />
              <Button
                variant="outline"
                onClick={() => handleBrowseFile('screenshotsPath')}
                className="border-[hsl(var(--border))]"
              >
                <FolderOpenIcon className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="theme">Theme</Label>
            <select
              id="theme"
              value={settings.theme || 'dark'}
              onChange={(e) => setSettings({ ...settings, theme: e.target.value })}
              className="flex h-10 w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--bg-primary))] px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
            >
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </select>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-[hsl(var(--border))]"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSaveSettings}
            className="bg-[hsl(var(--accent-highlight))] hover:opacity-90"
            disabled={isLoading}
          >
            {isLoading ? 'Saving...' : 'Save Settings'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
