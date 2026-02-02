import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { FolderOpenIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { gameService } from '@/lib/gameService';
import type { IAppSettings } from '@shared/schema';

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [settings, setSettings] = useState<IAppSettings>({
    gzDoomPath: '',
    savegamesPath: '',
    screenshotsPath: '',
    defaultSourcePort: 'gzdoom',
    theme: 'system'
  });

  // Load settings when the modal opens
  useEffect(() => {
    if (open) {
      loadSettings();
    }
  }, [open]);

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const loadedSettings = await gameService.getSettings();
      console.log('Loaded settings:', loadedSettings);
      setSettings(loadedSettings);
    } catch (error) {
      console.error('Failed to load settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to load settings',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    setIsLoading(true);
    try {
      await gameService.updateSettings(settings);
      toast({
        title: 'Success',
        description: 'Settings saved successfully',
      });
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to save settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to save settings',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBrowseFile = async (settingKey: keyof IAppSettings) => {
    try {
      const result = await gameService.showOpenDialog({
        properties: settingKey === 'gzDoomPath' ? ['openFile'] : ['openDirectory'],
        filters: settingKey === 'gzDoomPath' ? [
          { name: 'Executables', extensions: ['exe', ''] }
        ] : undefined
      });
      
      if (!result.canceled && result.filePaths.length > 0) {
        setSettings({
          ...settings,
          [settingKey]: result.filePaths[0]
        });
      }
    } catch (error) {
      console.error('Failed to open file dialog:', error);
      toast({
        title: 'Error',
        description: 'Failed to open file dialog',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#162b3d] border-[#262626] text-white">
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
                className="bg-[#0c1c2a] border-[#262626] flex-1"
              />
              <Button
                variant="outline"
                onClick={() => handleBrowseFile('gzDoomPath')}
                className="border-[#262626]"
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
                className="bg-[#0c1c2a] border-[#262626] flex-1"
              />
              <Button
                variant="outline"
                onClick={() => handleBrowseFile('savegamesPath')}
                className="border-[#262626]"
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
                className="bg-[#0c1c2a] border-[#262626] flex-1"
              />
              <Button
                variant="outline"
                onClick={() => handleBrowseFile('screenshotsPath')}
                className="border-[#262626]"
              >
                <FolderOpenIcon className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
        
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-[#262626]"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSaveSettings}
            className="bg-[#d41c1c] hover:bg-[#b21616]"
            disabled={isLoading}
          >
            {isLoading ? 'Saving...' : 'Save Settings'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}