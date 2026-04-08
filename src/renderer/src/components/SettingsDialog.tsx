import React, { useState, useEffect, useId } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Settings } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { api } from '@/api'
import { queryClient } from '@/lib/queryClient'
import type { IDoomVersion, IAppSettings } from '@shared/schema'
import { DoomVersionIcon } from '@/icons/DoomIcons'
import { FolderOpen } from 'lucide-react'
import { Switch } from '@/components/ui/switch'

interface SettingsDialogProps {
  isOpen: boolean
  onClose: () => void
}

// remove local toFileUrl as it's now in utils

export const SettingsDialog: React.FC<SettingsDialogProps> = ({ isOpen, onClose }) => {
  const { toast } = useToast()
  const id = useId()
  const [settings, setSettings] = useState<IAppSettings>({
    gzDoomPath: '',
    theme: 'dark',
    savegamesPath: '',
    modsDirectory: '',
    screenshotsPath: '',
    wadFilesDirectory: '',
    defaultSourcePort: 'gzdoom',
    configPath: ''
  })

  // Doom versions state
  const [doomVersions, setDoomVersions] = useState<IDoomVersion[]>([])
  const [isLoadingVersions, setIsLoadingVersions] = useState(false)
  const [selectedWadIndex, setSelectedWadIndex] = useState(0)

  // Fetch settings from API when dialog opens
  useEffect(() => {
    if (!isOpen) return
    api
      .getSettings()
      .then((data) => {
        if (data) {
          setSettings((prev) => ({ ...prev, ...data }))
        }
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
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const { name, value } = e.target
    setSettings((prev) => ({
      ...prev,
      [name]: value
    }))
  }

  // Handle doom version field changes
  const handleVersionChange = (
    index: number,
    field: keyof IDoomVersion,
    value: string | boolean
  ): void => {
    setDoomVersions((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  const handleIconBrowse = async (index: number): Promise<void> => {
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
  const handleSave = async (): Promise<void> => {
    try {
      const payload = {
        gzDoomPath: settings.gzDoomPath,
        savegamesPath: settings.savegamesPath,
        modsDirectory: settings.modsDirectory,
        screenshotsPath: settings.screenshotsPath,
        wadFilesDirectory: settings.wadFilesDirectory,
        theme: settings.theme,
        defaultSourcePort: settings.defaultSourcePort
      }
      await api.updateSettings(payload)

      // Also save doom versions
      await api.updateDoomVersions(doomVersions)

      // Invalidate queries to trigger global theme sync
      await queryClient.invalidateQueries({ queryKey: ['/api/settings'] })

      toast({
        title: 'Settings Saved',
        description: 'Your settings have been saved successfully.'
      })
      onClose()
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to save settings',
        variant: 'destructive'
      })
    }
  }

  // Handle folder/file browse
  const handleBrowse = async (settingName: string): Promise<void> => {
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
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden border-app bg-app-primary shadow-2xl h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-app bg-app-secondary">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-accent-highlight/10 rounded-md">
              <Settings className="w-5 h-5 text-accent-highlight" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold tracking-tight text-app-primary font-sans lowercase">
                core_settings
              </DialogTitle>
              <p className="text-xs font-semibold font-mono text-app-muted uppercase tracking-widest opacity-80">
                UAC Launch Control // System Configuration
              </p>
            </div>
          </div>
        </div>

        <Tabs defaultValue="general" className="flex-1 flex flex-col min-h-0">
          <div className="px-4 bg-app-secondary">
            <TabsList className="bg-transparent border-b-0 gap-6 h-12">
              <TabsTrigger
                value="general"
                className="font-sans text-sm tracking-wide uppercase data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-accent-highlight rounded-none px-0 h-full border-b-2 border-transparent transition-all"
              >
                General
              </TabsTrigger>
              <TabsTrigger
                value="paths"
                className="font-sans text-sm tracking-wide uppercase data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-accent-highlight rounded-none px-0 h-full border-b-2 border-transparent transition-all"
              >
                Paths
              </TabsTrigger>
              <TabsTrigger
                value="wad-config"
                className="font-sans text-sm tracking-wide uppercase data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-accent-highlight rounded-none px-0 h-full border-b-2 border-transparent transition-all"
              >
                Wad Config
              </TabsTrigger>
              <TabsTrigger
                value="advanced"
                className="font-sans text-sm tracking-wide uppercase data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-accent-highlight rounded-none px-0 h-full border-b-2 border-transparent transition-all opacity-50"
              >
                Advanced
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto">
            <TabsContent value="general" className="space-y-8 mt-0 p-6">
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <Label className="text-xs uppercase tracking-widest text-app-muted font-mono font-bold">
                      Visual Interface
                    </Label>
                    <div className="p-4 bg-app-secondary border border-app rounded-lg flex items-center justify-between shadow-md">
                      <span className="text-sm font-sans font-medium text-app-primary">
                        App Theme
                      </span>
                      <div className="flex gap-2 p-1 bg-app-primary/50 rounded-md border border-app">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSettings((s) => ({ ...s, theme: 'dark' }))}
                          className={`h-8 font-sans text-xs transition-all ${
                            settings.theme === 'dark'
                              ? 'bg-accent-highlight text-white shadow-sm'
                              : 'text-app-muted hover:text-app-primary'
                          }`}
                        >
                          DARK
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSettings((s) => ({ ...s, theme: 'light' }))}
                          className={`h-8 font-sans text-xs transition-all ${
                            settings.theme === 'light'
                              ? 'bg-accent-highlight text-white shadow-sm'
                              : 'text-app-muted hover:text-app-primary'
                          }`}
                        >
                          LIGHT
                        </Button>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <Label className="text-xs uppercase tracking-widest text-app-muted font-mono font-bold">
                      System Protocol
                    </Label>
                    <div className="p-4 bg-app-secondary border border-app rounded-lg flex flex-col gap-3 shadow-md">
                      <span className="text-xs font-sans text-app-muted">Default Engine</span>
                      <select
                        value={settings.defaultSourcePort}
                        onChange={(e) =>
                          setSettings((s) => ({ ...s, defaultSourcePort: e.target.value }))
                        }
                        className="bg-app-primary border-app text-sm font-sans p-2 rounded-md outline-none text-app-primary focus:ring-2 ring-accent-highlight/30 h-10 w-full appearance-none transition-all hover:border-app-muted"
                      >
                        <option value="gzdoom">GZDOOM</option>
                        <option value="uzdoom">UZDOOM</option>
                        <option value="zandronum">ZANDRONUM</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <Label className="text-xs uppercase tracking-widest text-app-muted font-mono font-bold block border-b border-app pb-2">
                  TECHNICAL SPECIFICATIONS
                </Label>
                <div className="bg-app-secondary/50 p-4 rounded-xl border border-app border-dashed space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-sans text-app-muted font-bold uppercase tracking-wider">
                      App Configuration
                    </Label>
                    <span className="text-xs px-2 py-0.5 rounded bg-app-primary text-app-muted font-mono border border-app">
                      SYSTEM
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <div className="bg-app-primary/40 border border-app font-sans h-10 px-3 text-sm flex-1 flex items-center text-app-muted opacity-80 rounded-md truncate">
                      {settings.configPath}
                    </div>
                  </div>
                  <p className="text-xs text-app-muted font-sans italic opacity-70">
                    Internal master directory for settings, telemetry catalogues, and system state.
                  </p>
                </div>
              </div>
            </TabsContent>

            <TabsContent
              value="paths"
              className="space-y-8 mt-0 p-6 flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-app-hover"
            >
              <div className="space-y-4">
                <Label className="text-xs uppercase tracking-widest text-app-muted font-mono font-bold block border-b border-app pb-2">
                  CORE INFRASTRUCTURE
                </Label>
                <div className="bg-app-secondary p-4 rounded-xl border border-app shadow-sm space-y-3">
                  <Label
                    htmlFor={`${id}-gzDoomPath`}
                    className="text-xs font-sans text-app-muted font-bold uppercase tracking-wider"
                  >
                    Source Port Executable
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id={`${id}-gzDoomPath`}
                      name="gzDoomPath"
                      value={settings.gzDoomPath}
                      onChange={handleChange}
                      className="bg-app-primary border-app font-sans h-10 text-sm flex-1 focus-visible:ring-2 focus-visible:ring-accent-highlight/40"
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-10 w-10 shrink-0 hover:bg-accent-highlight/10 text-accent-highlight transition-colors border border-app/30"
                      onClick={() => handleBrowse('gzDoomPath')}
                    >
                      <FolderOpen className="w-5 h-5" />
                    </Button>
                  </div>
                  <p className="text-xs text-app-muted font-sans italic opacity-70">
                    Main system binary used for launching telemetry streams.
                  </p>
                </div>
              </div>

              <div className="space-y-6">
                <Label className="text-xs uppercase tracking-widest text-app-muted font-mono font-bold block border-b border-app pb-2">
                  DATA REPOSITORIES
                </Label>
                <div className="grid grid-cols-1 gap-4">
                  {[
                    {
                      id: 'wadFilesDirectory',
                      label: 'WAD Assets',
                      desc: 'Central repository for .WAD and .PK3 data structures.'
                    },
                    {
                      id: 'modsDirectory',
                      label: 'Mod Logic',
                      desc: 'Localized storage for external mod modifications.'
                    },
                    {
                      id: 'savegamesPath',
                      label: 'Telemetry/Saves',
                      desc: 'Secure sector for game state and progress backups.'
                    },
                    {
                      id: 'screenshotsPath',
                      label: 'Optical/Screens',
                      desc: 'Visual capture repository for mission debriefings.'
                    }
                  ].map((field) => (
                    <div
                      key={field.id}
                      className="bg-app-secondary p-4 rounded-xl border border-app shadow-sm space-y-3"
                    >
                      <Label
                        htmlFor={`${id}-${field.id}`}
                        className="text-xs font-sans text-app-muted font-bold uppercase tracking-wider"
                      >
                        {field.label}
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          id={`${id}-${field.id}`}
                          name={field.id}
                          value={settings[field.id as keyof typeof settings]}
                          onChange={handleChange}
                          className="bg-app-primary border-app font-sans h-10 text-sm flex-1 focus-visible:ring-2 focus-visible:ring-accent-highlight/40"
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-10 w-10 shrink-0 hover:bg-app-primary/50 text-app-primary transition-colors border border-app/30 hover:border-app"
                          onClick={() => handleBrowse(field.id)}
                        >
                          <FolderOpen className="w-5 h-5" />
                        </Button>
                      </div>
                      <p className="text-xs text-app-muted font-sans italic opacity-70">
                        {field.desc}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="wad-config" className="flex-1 min-h-0 pt-0">
              {isLoadingVersions ? (
                <div className="flex items-center justify-center h-full gap-3 text-app-secondary font-mono italic">
                  <div className="w-2 h-2 rounded-full bg-accent-highlight animate-pulse" />
                  CALIBRATING WAD REPOSITORIES...
                </div>
              ) : doomVersions.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-app-secondary font-sans italic opacity-60">
                    No WAD files detected in the secure sector.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-[240px,1fr] h-full overflow-hidden">
                  {/* Master: WAD List Sidebar */}
                  <div className="flex flex-col overflow-y-auto border-r border-app bg-app-secondary/20 scrollbar-thin scrollbar-thumb-app-hover">
                    <div className="p-2 space-y-1">
                      {doomVersions.map((version, index) => (
                        <button
                          key={version.id || index}
                          onClick={() => setSelectedWadIndex(index)}
                          className={`flex items-center gap-3 p-3 rounded-lg transition-all text-left group shrink-0 border border-transparent ${
                            selectedWadIndex === index
                              ? 'bg-app-primary border-app shadow-sm outline-accent-highlight/30 outline-1'
                              : 'hover:bg-app-primary/40'
                          }`}
                        >
                          <div className="w-8 h-8 shrink-0 flex items-center justify-center overflow-hidden rounded bg-black/20 group-hover:bg-black/40 transition-colors">
                            <DoomVersionIcon
                              version={version.slug}
                              customIcon={version.icon}
                              className="w-full h-full object-contain"
                            />
                          </div>
                          <span
                            className={`text-sm font-sans font-medium truncate flex-1 ${
                              selectedWadIndex === index
                                ? 'text-accent-highlight'
                                : 'text-app-primary'
                            }`}
                          >
                            {version.name}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Detail: WAD Settings Editor */}
                  <div className="flex flex-col gap-8 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-app-hover bg-app-primary">
                    {doomVersions[selectedWadIndex] && (
                      <>
                        <div className="flex items-start gap-6">
                          <div className="w-32 h-32 rounded-xl bg-app-secondary border border-app shadow-2xl group relative overflow-hidden shrink-0 flex items-center justify-center p-2 transition-transform hover:scale-[1.02]">
                            <DoomVersionIcon
                              version={doomVersions[selectedWadIndex].slug}
                              customIcon={doomVersions[selectedWadIndex].icon}
                              className="w-full h-full object-contain"
                            />
                            <button
                              onClick={() => handleIconBrowse(selectedWadIndex)}
                              className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-xs font-bold text-white transition-opacity uppercase"
                            >
                              Relocate Icon
                            </button>
                          </div>
                          <div className="flex-1 space-y-6 min-w-0">
                            <div className="space-y-2">
                              <Label className="text-xs uppercase tracking-widest text-app-muted font-mono font-bold">
                                WAD Identity
                              </Label>
                              <Input
                                value={doomVersions[selectedWadIndex].name}
                                onChange={(e) =>
                                  handleVersionChange(selectedWadIndex, 'name', e.target.value)
                                }
                                className="bg-app-secondary border-app font-sans h-11 text-base focus-visible:ring-accent-highlight/40"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs uppercase tracking-widest text-app-muted font-mono font-bold">
                                Engine Runtime
                              </Label>
                              <Input
                                value={doomVersions[selectedWadIndex].executable}
                                onChange={(e) =>
                                  handleVersionChange(
                                    selectedWadIndex,
                                    'executable',
                                    e.target.value
                                  )
                                }
                                className="bg-app-secondary border-app font-sans h-11 text-base focus-visible:ring-accent-highlight/40"
                                placeholder="default: gzdoom"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4 p-5 bg-app-secondary border border-app rounded-xl shadow-lg">
                          <Label className="text-xs uppercase tracking-widest text-app-muted font-mono font-bold block">
                            Technical Parameters
                          </Label>
                          <div className="space-y-4 pt-1">
                            <div className="flex flex-col gap-2">
                              <span className="text-xs text-app-primary font-medium font-sans">
                                Launch Arguments
                              </span>
                              <Input
                                value={doomVersions[selectedWadIndex].args || ''}
                                onChange={(e) =>
                                  handleVersionChange(selectedWadIndex, 'args', e.target.value)
                                }
                                className="bg-app-primary border-app font-sans h-10 text-sm text-app-primary focus-visible:ring-accent-highlight/40"
                              />
                            </div>
                            <div className="pt-2">
                              <div className="flex items-center justify-between pb-4">
                                <div className="space-y-0.5">
                                  <Label className="text-sm font-sans font-semibold text-app-primary">
                                    Hide from Interface
                                  </Label>
                                  <p className="text-[11px] text-app-muted font-medium leading-tight">
                                    Useful for data-only WADs like voice-overs. Will be hidden from
                                    sidebar & mod install pages.
                                  </p>
                                </div>
                                <Switch
                                  checked={doomVersions[selectedWadIndex].ignored || false}
                                  onCheckedChange={(checked) =>
                                    handleVersionChange(selectedWadIndex, 'ignored', checked)
                                  }
                                />
                              </div>
                            </div>
                            <div className="flex flex-col gap-2 overflow-hidden">
                              <span className="text-xs text-app-primary font-medium font-sans">
                                File Source
                              </span>
                              <code className="text-xs font-mono p-3 bg-black/30 rounded-lg border border-app/50 break-all text-app-muted leading-relaxed">
                                {doomVersions[selectedWadIndex].defaultIwad}
                              </code>
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="advanced" className="space-y-4 mt-0 p-6">
              <p className="text-app-secondary">Permission denied. Red keycard required.</p>
            </TabsContent>
          </div>
        </Tabs>

        <div className="flex justify-between items-center p-4 border-t border-app bg-app-secondary shrink-0">
          <Button
            variant="outline"
            onClick={onClose}
            className="font-sans text-xs uppercase bg-transparent border-app hover:bg-app-hover text-app-muted hover:text-app-primary h-9 px-6"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            className="font-sans text-xs font-bold uppercase bg-accent-highlight text-white hover:bg-accent-highlight/90 h-9 px-8 shadow-lg shadow-accent-highlight/20"
          >
            Save Configuration
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default SettingsDialog
