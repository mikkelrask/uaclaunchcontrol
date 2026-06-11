import React, { useState, useEffect, useId, useRef, useCallback } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Settings,
  Eye,
  EyeOff,
  Pencil,
  Trash2,
  FolderOpen,
  LayoutGrid,
  List,
  BookOpen
} from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { api } from '@/api'
import { dispatchAchievementEvent, buildUnlockToasts } from '@/lib/achievements'
import { queryClient } from '@/lib/queryClient'
import type { IDoomVersion, IAppSettings, ISourcePort, SourcePortFamily } from '@shared/schema'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { DoomVersionIcon } from '@/icons/DoomIcons'
import { Switch } from '@/components/ui/switch'
import uacLogo from '@/assets/UAC Logo.svg'

interface SettingsDialogProps {
  isOpen: boolean
  onClose: () => void
}

export const SettingsDialog: React.FC<SettingsDialogProps> = ({ isOpen, onClose }) => {
  const { toast } = useToast()
  const id = useId()
  const [settings, setSettings] = useState<IAppSettings>({
    sourcePorts: [],
    defaultSourcePortId: undefined,
    theme: 'dark',
    savegamesPath: '',
    modsDirectory: '',
    screenshotsPath: '',
    wadFilesDirectory: '',
    databaseLinkPresets: [
      { name: 'MODDB', url: 'https://www.moddb.com/games/doom-ii' },
      { name: 'ZDOOM', url: 'https://forum.zdoom.org/' },
      { name: 'DOOMWORLD', url: 'https://www.doomworld.com/' },
      { name: 'ITCH', url: 'https://itch.io/game-mods/tag-doom' }
    ],
    selectedPresetIndex: 0,
    configPath: '',
    autoUpdateEnabled: true,
    registryLookupEnabled: false,
    showLaunchPreview: true,
    customThemeCss: '',
    defaultView: 'grid'
  })

  // Doom versions state
  const [doomVersions, setDoomVersions] = useState<IDoomVersion[]>([])
  const [editingPort, setEditingPort] = useState<ISourcePort | null>(null)
  const [showPortForm, setShowPortForm] = useState(false)
  const [isLoadingVersions, setIsLoadingVersions] = useState(false)
  const [selectedWadIndex, setSelectedWadIndex] = useState(0)
  const [appVersion, setAppVersion] = useState<string>('')

  // Snapshot of the saved theme for revert-on-close
  const savedRef = useRef<{ theme: string; customThemeCss?: string }>({
    theme: 'dark',
    customThemeCss: ''
  })

  // Track the original wadFilesDirectory for change detection
  const initialWadDirRef = useRef<string>('')

  // Track whether the initial fetch has completed so live-preview doesn't
  // briefly apply the default theme before the saved one arrives.
  const fetchedRef = useRef(false)

  // Snapshot of source port state at dialog open, for achievement tracking
  const initialPortCountRef = useRef<number>(0)
  const initialPortFamiliesRef = useRef<string[]>([])

  // Fetch settings from API when dialog opens
  useEffect(() => {
    if (!isOpen) return

    // Fetch app version
    api
      .getVersion()
      .then(setAppVersion)
      .catch(() => {})

    api
      .getSettings()
      .then((data) => {
        if (data) {
          savedRef.current = { theme: data.theme, customThemeCss: data.customThemeCss }
          initialWadDirRef.current = data.wadFilesDirectory || ''
          setSettings((prev) => ({ ...prev, ...data }))
          fetchedRef.current = true
          // Capture initial source port state for achievement tracking
          const activePorts = (data.sourcePorts || []).filter(
            (p: { ignored?: boolean }) => !p.ignored
          )
          initialPortCountRef.current = activePorts.length
          initialPortFamiliesRef.current = [
            ...new Set(
              activePorts.map((p: { family?: string }) => p.family).filter((f): f is string => !!f)
            )
          ]
        }
      })
      .catch(() => {
        toast({ title: 'Error', description: 'Failed to load settings', variant: 'destructive' })
      })

    // Fetch doom versions
    const fetchVersions = async (): Promise<void> => {
      setIsLoadingVersions(true)
      try {
        const versions = await api.getDoomVersions()
        setDoomVersions(versions)
      } catch {
        console.error('[settings] Failed to load doom versions')
        toast({
          title: 'Error',
          description: 'Failed to load doom versions',
          variant: 'destructive'
        })
      } finally {
        setIsLoadingVersions(false)
      }
    }

    fetchVersions()
  }, [isOpen, toast])

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

  // Live-preview theme changes immediately on the DOM
  useEffect(() => {
    if (!isOpen || !fetchedRef.current) return

    document.documentElement.classList.remove('dark', 'light', 'terminal', 'custom')
    document.documentElement.classList.add(settings.theme)

    const existingStyle = document.getElementById('custom-theme-style')
    if (settings.theme === 'custom' && settings.customThemeCss) {
      if (existingStyle) {
        existingStyle.textContent = settings.customThemeCss
      } else {
        const style = document.createElement('style')
        style.id = 'custom-theme-style'
        style.textContent = settings.customThemeCss
        document.head.appendChild(style)
      }
    } else if (existingStyle) {
      existingStyle.remove()
    }
  }, [isOpen, settings.theme, settings.customThemeCss])

  // Restore saved theme when closing without saving
  const handleClose = useCallback((): void => {
    fetchedRef.current = false
    document.documentElement.classList.remove('dark', 'light', 'terminal', 'custom')
    document.documentElement.classList.add(savedRef.current.theme)

    const existingStyle = document.getElementById('custom-theme-style')
    if (savedRef.current.theme === 'custom' && savedRef.current.customThemeCss) {
      if (existingStyle) {
        existingStyle.textContent = savedRef.current.customThemeCss
      } else {
        const style = document.createElement('style')
        style.id = 'custom-theme-style'
        style.textContent = savedRef.current.customThemeCss
        document.head.appendChild(style)
      }
    } else if (existingStyle) {
      existingStyle.remove()
    }

    onClose()
  }, [onClose])

  // Handle save
  const handleSave = async (): Promise<void> => {
    try {
      const payload = {
        sourcePorts: settings.sourcePorts,
        defaultSourcePortId: settings.defaultSourcePortId,
        savegamesPath: settings.savegamesPath,
        modsDirectory: settings.modsDirectory,
        screenshotsPath: settings.screenshotsPath,
        wadFilesDirectory: settings.wadFilesDirectory,
        theme: settings.theme,
        databaseLinkPresets: settings.databaseLinkPresets,
        selectedPresetIndex: settings.selectedPresetIndex,
        autoUpdateEnabled: settings.autoUpdateEnabled,
        registryLookupEnabled: settings.registryLookupEnabled,
        registryUuid: settings.registryUuid,
        showLaunchPreview: settings.showLaunchPreview,
        customThemeCss: settings.customThemeCss,
        defaultView: settings.defaultView
      }
      // Dispatch SOURCE_PORT_ADDED achievements for each newly added port
      const oldPortCount = initialPortCountRef.current
      const newPorts = (settings.sourcePorts || []).filter((p) => !p.ignored)
      const addedCount = newPorts.length - oldPortCount
      if (addedCount > 0) {
        // Collect newly seen families
        const oldFamilies = new Set(initialPortFamiliesRef.current)
        for (const port of newPorts) {
          if (port.family && !oldFamilies.has(port.family)) {
            dispatchAchievementEvent({
              type: 'SOURCE_PORT_ADDED',
              count: 1,
              family: port.family
            })
              .then((srcResult) => {
                const unlockToasts = buildUnlockToasts(srcResult)
                for (const t of unlockToasts) {
                  toast({
                    title: t.title,
                    description: t.description,
                    duration: t.duration as 6000 | 8000
                  })
                }
              })
              .catch(() => {})
            oldFamilies.add(port.family)
          }
        }
      }

      await api.updateSettings(payload)

      // Re-fetch versions from the server (it re-scanned if wad dir changed)
      const freshVersions = await api.getDoomVersions()

      if (initialWadDirRef.current !== payload.wadFilesDirectory) {
        // WAD dir changed → server already re-scanned; use its result.
        // Discard any local edits to versions since they were against the old scan.
        setDoomVersions(freshVersions)
        await api.updateDoomVersions(freshVersions)
      } else {
        // No directory change → preserve local metadata edits (name, icon, ignored, etc.)
        setDoomVersions(freshVersions)
        await api.updateDoomVersions(doomVersions)
      }

      // Invalidate queries to trigger global theme sync
      await queryClient.invalidateQueries({ queryKey: ['/api/versions'] })
      await queryClient.invalidateQueries({ queryKey: ['/api/settings'] })

      // Update savedRef so close-restore is a no-op (theme is already persisted)
      savedRef.current = { theme: settings.theme, customThemeCss: settings.customThemeCss }

      toast({
        title: 'SYSTEM: core_settings',
        description: 'Your changes have been approved.'
      })
      onClose()
    } catch {
      toast({
        title: 'SYSTEM: core_settings',
        description: 'No changes have been applied. Could not save settings.',
        variant: 'destructive'
      })
    }
  }

  // Handle folder browse
  const handleBrowse = async (settingName: string): Promise<void> => {
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

  // Source port management
  const handleAddPort = async (): Promise<void> => {
    const result = await api.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Executables', extensions: ['*'] }]
    })

    if (!result.canceled && result.filePaths.length > 0) {
      const exePath = result.filePaths[0]
      const fileName = exePath.split(/[\\/]/).pop() || ''
      const lower = fileName.toLowerCase()
      let family: SourcePortFamily = 'other'
      if (lower.includes('uzdoom')) family = 'uzdoom'
      else if (lower.includes('lzdoom')) family = 'lzdoom'
      else if (lower.includes('helion')) family = 'helion'
      else if (lower.includes('gzdoom')) family = 'gzdoom'
      else if (lower.includes('zdoom')) family = 'zdoom'
      else if (lower.includes('zandronum')) family = 'zandronum'

      const newPort: ISourcePort = {
        id: crypto.randomUUID(),
        name: fileName.replace(/\.(exe|AppImage)$/i, ''),
        executablePath: exePath,
        family,
        ignored: false
      }
      setEditingPort(newPort)
      setShowPortForm(true)
    }
  }

  const handleSavePort = (port: ISourcePort): void => {
    setSettings((prev) => {
      const existing = prev.sourcePorts.findIndex((p) => p.id === port.id)
      let updated: ISourcePort[]
      if (existing >= 0) {
        updated = [...prev.sourcePorts]
        updated[existing] = port
      } else {
        updated = [...prev.sourcePorts, port]
      }
      return { ...prev, sourcePorts: updated }
    })
    setShowPortForm(false)
    setEditingPort(null)
  }

  const handleDeletePort = (id: string): void => {
    setSettings((prev) => {
      const updated = prev.sourcePorts.filter((p) => p.id !== id)
      const newDefault =
        prev.defaultSourcePortId === id
          ? updated.length > 0
            ? updated[0].id
            : undefined
          : prev.defaultSourcePortId
      return { ...prev, sourcePorts: updated, defaultSourcePortId: newDefault }
    })
  }

  const handleSetDefaultPort = (id: string): void => {
    setSettings((prev) => ({ ...prev, defaultSourcePortId: id }))
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden border-app bg-app-primary shadow-2xl h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-app bg-app-secondary">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-accent-highlight/10 rounded-md">
              <Settings className="w-5 h-5 text-accent-highlight" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold tracking-tight text-app-primary lowercase">
                core_settings
              </DialogTitle>
              <p className="text-xs font-semibold font-mono text-app-muted uppercase tracking-widest opacity-80">
                UAC Launch Control // System Configuration
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              api.reenableFirstRun().catch(() => {})
              onClose()
              // Dispatch custom event so FirstRunTour picks it up
              window.dispatchEvent(new CustomEvent('uac:replay-tour'))
            }}
            className="text-xs border-app hover:bg-app-hover text-app-muted"
          >
            Guided Tour
          </Button>
        </div>

        <Tabs defaultValue="general" className="flex-1 flex flex-col min-h-0">
          <div className="px-4 bg-app-secondary">
            <TabsList className="bg-transparent border-b-0 gap-6 h-12">
              <TabsTrigger
                value="general"
                className="text-sm tracking-wide uppercase data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-accent-highlight rounded-none px-0 h-full border-b-2 border-transparent transition-all"
              >
                General
              </TabsTrigger>
              <TabsTrigger
                value="paths"
                className="text-sm tracking-wide uppercase data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-accent-highlight rounded-none px-0 h-full border-b-2 border-transparent transition-all"
              >
                Paths
              </TabsTrigger>
              <TabsTrigger
                value="wad-config"
                className="text-sm tracking-wide uppercase data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-accent-highlight rounded-none px-0 h-full border-b-2 border-transparent transition-all"
              >
                WAD Config
              </TabsTrigger>
              <TabsTrigger
                value="advanced"
                className="text-sm tracking-wide uppercase data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-accent-highlight rounded-none px-0 h-full border-b-2 border-transparent transition-all"
              >
                Advanced
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto">
            <TabsContent value="general" className="space-y-4 mt-0 p-6">
              <div className="bg-app-secondary p-4 rounded-xl border border-app shadow-sm space-y-5">
                <Label className="text-xs uppercase tracking-widest text-app-muted font-mono font-bold">
                  INTERFACE
                </Label>

                <div className="flex items-start justify-between gap-6">
                  <div className="min-w-0">
                    <Label className="text-sm font-medium text-app-primary">App Theme</Label>
                    <p className="text-[10px] text-app-muted leading-tight mt-0.5">
                      Visual colour profile for the terminal.
                    </p>
                  </div>
                  <Select
                    value={settings.theme}
                    onValueChange={(value) =>
                      setSettings((s) => ({
                        ...s,
                        theme: value as IAppSettings['theme']
                      }))
                    }
                  >
                    <SelectTrigger className="bg-app-primary border-app text-app-primary w-[260px] shrink-0">
                      <SelectValue placeholder="Select theme" />
                    </SelectTrigger>
                    <SelectContent className="bg-app-secondary border-app text-app-primary">
                      {[
                        { value: 'dark', label: 'UAC PHOBOS — Default, dark/red' },
                        { value: 'light', label: 'MAYKR — Bright argent energy' },
                        { value: 'terminal', label: 'PLUTONIA TERMINAL — Green phosphor' },
                        { value: 'custom', label: 'CUSTOM — User-defined palette' }
                      ].map(({ value, label }) => (
                        <SelectItem
                          key={value}
                          value={value}
                          className="focus:bg-app-hover focus:text-app-primary"
                        >
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-start justify-between gap-6">
                  <div className="min-w-0">
                    <Label className="text-sm font-medium text-app-primary">Database Link</Label>
                    <p className="text-[10px] text-app-muted leading-tight mt-0.5">
                      Navigation shortcut to your preferred source of mods.
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <Select
                      value={settings.selectedPresetIndex.toString()}
                      onValueChange={(value) =>
                        setSettings((s) => ({
                          ...s,
                          selectedPresetIndex: parseInt(value, 10)
                        }))
                      }
                    >
                      <SelectTrigger className="bg-app-primary border-app text-app-primary w-[260px] shrink-0">
                        <SelectValue placeholder="Select a database" />
                      </SelectTrigger>
                      <SelectContent className="bg-app-secondary border-app text-app-primary">
                        {settings.databaseLinkPresets.map((preset, index) => (
                          <SelectItem
                            key={index}
                            value={index.toString()}
                            className="focus:bg-app-hover focus:text-app-primary"
                          >
                            {preset.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p
                      className="text-[10px] text-app-muted truncate max-w-48 text-right"
                      title={settings.databaseLinkPresets[settings.selectedPresetIndex]?.url || ''}
                    >
                      {settings.databaseLinkPresets[settings.selectedPresetIndex]?.url || ''}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-6">
                  <div className="min-w-0">
                    <Label className="text-sm font-medium text-app-primary">Default View</Label>
                    <p className="text-[10px] text-app-muted leading-tight mt-0.5">
                      Starting view mode when opening the games page.
                    </p>
                  </div>
                  <div className="flex rounded-lg border border-app overflow-hidden shrink-0">
                    {[
                      { value: 'grid' as const, icon: LayoutGrid, label: 'Grid' },
                      { value: 'list' as const, icon: List, label: 'List' },
                      { value: 'detail' as const, icon: BookOpen, label: 'Detail' }
                    ].map(({ value, icon: Icon, label }) => (
                      <button
                        key={value}
                        onClick={() => setSettings((s) => ({ ...s, defaultView: value }))}
                        className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors ${
                          settings.defaultView === value
                            ? 'bg-accent-highlight text-white'
                            : 'bg-app-primary text-app-muted hover:text-app-primary hover:bg-app-hover'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span className="max-sm:sr-only">{label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-6">
                  <div className="min-w-0">
                    <Label className="text-sm font-medium text-app-primary">Launch Preview</Label>
                    <p className="text-[10px] text-app-muted leading-tight mt-0.5">
                      Show the generated launch command in settings and install page.
                    </p>
                  </div>
                  <Switch
                    checked={settings.showLaunchPreview ?? true}
                    onCheckedChange={(checked) =>
                      setSettings((s) => ({ ...s, showLaunchPreview: checked }))
                    }
                  />
                </div>
              </div>

              <div className="bg-app-secondary/50 p-4 rounded-xl border border-app border-dashed space-y-4">
                {appVersion && (
                  <>
                    <div className="flex items-center justify-between pt-2">
                      <Label className="text-xs text-app-muted font-bold uppercase tracking-wider">
                        LIVE SYSTEM
                      </Label>
                      <span className="text-xs px-2 py-0.5 rounded bg-app-primary text-app-muted border border-app">
                        E1M{appVersion}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-xs text-app-primary font-medium">
                          Check for updates on Startup
                        </Label>
                        <p className="text-[10px] text-app-muted leading-tight">
                          Automatically notify about application updates. <br />
                          Updating is always optional - new updates will never be downloaded/applied
                          without interaction.
                        </p>
                      </div>
                      <Switch
                        checked={settings.autoUpdateEnabled ?? true}
                        onCheckedChange={(checked) =>
                          setSettings((s) => ({ ...s, autoUpdateEnabled: checked }))
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-xs text-app-primary font-medium">
                          Registry Lookup
                        </Label>
                        <p className="text-[10px] text-app-muted leading-tight">
                          Look up mod files in the online registry when adding to catalog.
                          <br />
                          Requires an active connection to the UAC Registry.
                        </p>
                      </div>
                      <Switch
                        checked={settings.registryLookupEnabled ?? false}
                        onCheckedChange={(checked) => {
                          if (checked && !settings.registryUuid) {
                            const uuid = crypto.randomUUID()
                            setSettings((s) => ({
                              ...s,
                              registryLookupEnabled: checked,
                              registryUuid: uuid
                            }))
                          } else {
                            setSettings((s) => ({ ...s, registryLookupEnabled: checked }))
                          }
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-app-primary font-medium">
                        Manually check for app updates
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => api.checkForUpdates()}
                        className="text-xs h-7 bg-app-primary hover:bg-app-hover text-app-primary border-app"
                      >
                        Check
                      </Button>
                    </div>
                  </>
                )}
                <div className="flex items-center justify-between border-t pt-6 border-app/30">
                  <Label className="text-xs text-app-muted font-bold uppercase tracking-wider">
                    Application Ini
                  </Label>
                  <span className="text-xs px-2 py-0.5 rounded bg-accent-highlight/10 text-accent-highlight/60 font-mono border border-accent-highlight/25">
                    RESTRICTED AREA
                  </span>
                </div>
                <div className="flex gap-2">
                  <div className="bg-app-primary/40 border border-app h-10 px-3 text-sm flex-1 flex items-center text-app-muted opacity-80 rounded-md truncate">
                    {settings.configPath}
                  </div>
                </div>
                <p className="text-xs text-app-muted italic opacity-70">
                  Internal master directory for settings, telemetry catalogues, and system state.
                </p>
              </div>
              <div className="flex-col items-center pt-8 border-t border-dashed">
                <img
                  src={uacLogo}
                  alt=""
                  className="w-12 opacity-30 hover:opacity-60 mx-auto animate-pulse color-accent-highlight"
                />
                <p className="text-xs text-app-muted text-center transition-opacity opacity-30 italic uppercase mt-2">
                  This software is developed by The Union Aerospace Corporation, UAC.
                  <br />
                  Unauthorized access or usage outside Phobos facility is strictly prohibited
                  <br />
                  Any violations will result in termination.
                </p>
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

                {/* Source Ports List */}
                <div className="bg-app-secondary p-4 rounded-xl border border-app shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-app-muted font-bold uppercase tracking-wider">
                      Source Ports
                    </Label>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleAddPort}
                      className="text-xs h-8 bg-app-primary hover:bg-app-hover text-app-primary border-app"
                    >
                      + Add Port
                    </Button>
                  </div>

                  {settings.sourcePorts.length === 0 ? (
                    <p className="text-xs text-app-muted italic py-2">
                      No source ports configured. Add at least one to launch games.
                    </p>
                  ) : (
                    <div className="space-y-2 pt-1">
                      {settings.sourcePorts.map((port) => (
                        <div
                          key={port.id}
                          className="flex items-center gap-3 p-2.5 bg-app-primary rounded-lg border border-app group hover:border-accent-highlight/30 transition-colors"
                        >
                          {/* Default indicator */}
                          <button
                            onClick={() => handleSetDefaultPort(port.id)}
                            className={`shrink-0 w-4 h-4 rounded-full border-2 transition-colors ${
                              settings.defaultSourcePortId === port.id
                                ? 'border-accent-highlight bg-accent-highlight'
                                : 'border-app-muted/40 hover:border-app-muted'
                            }`}
                            title={
                              settings.defaultSourcePortId === port.id
                                ? 'Default port'
                                : 'Set as default'
                            }
                          />

                          {/* Family badge */}
                          <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-app-secondary border border-app/50 text-app-muted shrink-0">
                            {port.family}
                          </span>

                          {/* Name + version */}
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-medium text-app-primary block truncate">
                              {port.name}
                            </span>
                            <span className="text-xs text-app-muted truncate block">
                              {port.version ? `${port.version} — ` : ''}
                              {port.executablePath}
                            </span>
                          </div>

                          {/* Ignored toggle */}
                          <button
                            onClick={() => handleSavePort({ ...port, ignored: !port.ignored })}
                            className={`shrink-0 p-1.5 rounded transition-colors ${
                              port.ignored
                                ? 'text-red-400 hover:text-red-300'
                                : 'text-app-muted hover:text-app-primary'
                            }`}
                            title={port.ignored ? 'Show port' : 'Hide port'}
                          >
                            {port.ignored ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </button>

                          {/* Edit */}
                          <button
                            onClick={() => {
                              setEditingPort(port)
                              setShowPortForm(true)
                            }}
                            className="shrink-0 p-1.5 text-app-muted hover:text-accent-highlight transition-colors rounded"
                            title="Edit port"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => handleDeletePort(port.id)}
                            className="shrink-0 p-1.5 text-app-muted hover:text-red-400 transition-colors rounded"
                            title="Delete port"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Inline Port Form (add/edit) */}
                {showPortForm && editingPort && (
                  <PortForm
                    port={editingPort}
                    onSave={handleSavePort}
                    onCancel={() => {
                      setShowPortForm(false)
                      setEditingPort(null)
                    }}
                  />
                )}
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
                        className="text-xs text-app-muted font-bold uppercase tracking-wider"
                      >
                        {field.label}
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          id={`${id}-${field.id}`}
                          name={field.id}
                          value={String(settings[field.id as keyof typeof settings] ?? '')}
                          onChange={handleChange}
                          className="bg-app-primary border-app h-10 text-sm flex-1 focus-visible:ring-2 focus-visible:ring-accent-highlight/40"
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
                      <p className="text-xs text-app-muted italic opacity-70">{field.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="wad-config" className="flex-1 min-h-0 pt-0">
              {isLoadingVersions ? (
                <div className="flex items-center justify-center h-full gap-3 text-app-secondary font-mono italic">
                  <div className="w-2 h-2 rounded-full bg-accent-highlight animate-pulse" />
                  CALIBRATING REPOSITORIES ...
                </div>
              ) : doomVersions.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-app-secondary italic opacity-60">
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
                            className={`text-sm font-medium truncate flex-1 ${
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
                                className="bg-app-secondary border-app h-11 text-base focus-visible:ring-accent-highlight/40"
                              />
                            </div>
                            {/* Engine Runtime removed — source port is now configured per-game via ISourcePort */}
                          </div>
                        </div>

                        <div className="space-y-4 p-5 bg-app-secondary border border-app rounded-xl shadow-lg">
                          <Label className="text-xs uppercase tracking-widest text-app-muted font-mono font-bold block">
                            Technical Parameters
                          </Label>
                          <div className="space-y-4 pt-1">
                            <div className="flex flex-col gap-2">
                              <span className="text-xs text-app-primary font-medium">
                                Launch Arguments
                              </span>
                              <Input
                                value={doomVersions[selectedWadIndex].args || ''}
                                onChange={(e) =>
                                  handleVersionChange(selectedWadIndex, 'args', e.target.value)
                                }
                                className="bg-app-primary border-app h-10 text-sm text-app-primary focus-visible:ring-accent-highlight/40"
                              />
                            </div>
                            <div className="flex flex-col gap-2">
                              <span className="text-xs text-app-primary font-medium">
                                Additional Parameters
                              </span>
                              <Input
                                value={doomVersions[selectedWadIndex].parameters || ''}
                                onChange={(e) =>
                                  handleVersionChange(
                                    selectedWadIndex,
                                    'parameters',
                                    e.target.value
                                  )
                                }
                                className="bg-app-primary border-app h-10 text-sm text-app-primary focus-visible:ring-accent-highlight/40"
                                placeholder="e.g. -nomonsters -warp 01"
                              />
                            </div>
                            <div className="pt-2">
                              <div className="flex items-center justify-between pb-4">
                                <div className="space-y-0.5">
                                  <Label className="text-xs text-app-primary font-medium">
                                    Hide from Interface
                                  </Label>
                                  <p className="text-xs text-app-muted italic opacity-70">
                                    Toggling will excluded this WAD from the sidebar and general WAD
                                    selectors.
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
                              <span className="text-xs text-app-primary font-medium">
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
              <Label className="text-xs uppercase tracking-widest text-app-muted font-mono font-bold block border-b border-app pb-2">
                CUSTOM THEME EDITOR
              </Label>
              <div className="bg-app-secondary p-4 rounded-xl border border-app space-y-4">
                <div className="space-y-2">
                  <p className="text-xs text-app-muted leading-relaxed">
                    Paste HSL variable overrides below. Each line should follow the format:
                    <code className="block font-mono text-xs mt-1 p-2 bg-app-primary rounded border border-app/50">
                      --variable-name: hue saturation lightness;
                    </code>
                    Example:
                    <code className="block font-mono text-xs mt-1 p-2 bg-app-primary rounded border border-app/50 whitespace-pre">
                      --bg-primary: 220 18% 5%; --text-primary: 210 20% 92%; --accent-highlight: 0
                      84% 60%;
                    </code>
                    Wrap the overrides in{' '}
                    <code className="font-mono text-xs">.custom &#123; ... &#125;</code> or just
                    paste the variable lines — the app will wrap them automatically.
                  </p>
                  <p className="text-xs text-app-muted leading-relaxed">
                    See the{' '}
                    <a
                      href="https://github.com/mikkelrask/uaclaunchcontrol/wiki/Theming#custom-theme"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline underline-offset-2 hover:text-accent-highlight transition-colors"
                    >
                      Theming guide on GitHub
                    </a>{' '}
                    for the full variable reference and examples.
                  </p>
                </div>
                <textarea
                  className="w-full h-64 bg-app-primary border border-app rounded-md p-3 font-mono text-xs text-app-primary resize-none focus:outline-none focus:ring-1 focus:ring-accent-highlight/40"
                  value={settings.customThemeCss || ''}
                  onChange={(e) => setSettings((s) => ({ ...s, customThemeCss: e.target.value }))}
                  placeholder={`--bg-primary: 220 18% 5%;\n--text-primary: 210 20% 92%;\n--accent-highlight: 0 84% 60%;`}
                  spellCheck={false}
                />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSettings((s) => ({
                        ...s,
                        customThemeCss: s.customThemeCss ? `.custom {\n${s.customThemeCss}\n}` : ''
                      }))
                    }}
                    className="text-xs bg-app-primary hover:bg-app-hover text-app-primary border-app h-8"
                  >
                    Wrap in .custom &#123; &#125;
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      // Copy dark theme values as a starter
                      const darkThemeVars = [
                        '--bg-primary: 220 18% 5%;',
                        '--bg-secondary: 220 15% 9%;',
                        '--bg-tertiary: 220 12% 14%;',
                        '--bg-card: 220 18% 8%;',
                        '--bg-popover: 220 18% 9%;',
                        '--bg-muted: 220 10% 18%;',
                        '--bg-sidebar: 220 18% 6%;',
                        '--bg-hover: 220 12% 16%;',
                        '',
                        '--text-primary: 210 20% 92%;',
                        '--text-secondary: 215 12% 70%;',
                        '--text-muted: 215 10% 75%;',
                        '--text-sidebar: 210 20% 92%;',
                        '--text-card: 210 20% 92%;',
                        '--text-popover: 210 20% 92%;',
                        '',
                        '--accent-highlight: 0 84% 60%;',
                        '--accent-destructive: 0 65% 45%;',
                        '',
                        '--border: 220 12% 18%;'
                      ].join('\n')
                      setSettings((s) => ({
                        ...s,
                        customThemeCss: darkThemeVars
                      }))
                    }}
                    className="text-xs bg-app-primary hover:bg-app-hover text-app-primary border-app h-8"
                  >
                    Reset to defaults
                  </Button>
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>

        <div className="flex justify-between items-center p-4 border-t border-app bg-app-secondary shrink-0">
          <Button
            variant="outline"
            onClick={handleClose}
            className="text-xs uppercase bg-transparent border-app hover:bg-app-hover text-app-muted hover:text-app-primary h-9 px-6"
          >
            Abort
          </Button>
          <Button
            onClick={handleSave}
            className="text-xs font-bold uppercase bg-accent-highlight text-white hover:bg-accent-highlight/90 h-9 px-4 shadow-lg shadow-accent-highlight/20"
          >
            {'> Apply <'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Source Port inline form ────────────────────────────────────────────────
interface PortFormProps {
  port: ISourcePort
  onSave: (port: ISourcePort) => void
  onCancel: () => void
}

const PortForm: React.FC<PortFormProps> = ({ port, onSave, onCancel }) => {
  const [name, setName] = useState(port.name)
  const [version, setVersion] = useState(port.version || '')
  const [family, setFamily] = useState<SourcePortFamily>(port.family)
  const [executablePath, setExecutablePath] = useState(port.executablePath)

  return (
    <div className="bg-app-secondary p-4 rounded-xl border border-app shadow-sm space-y-3 animate-in slide-in-from-top-2 duration-200">
      <Label className="text-xs uppercase tracking-widest text-app-muted font-mono font-bold">
        {port.id ? 'Edit Source Port' : 'New Source Port'}
      </Label>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-app-muted">Name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="bg-app-primary border-app h-9 text-sm"
            placeholder="e.g. GZDoom 4.12.2"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-app-muted">Version (optional)</Label>
          <Input
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            className="bg-app-primary border-app h-9 text-sm"
            placeholder="e.g. 4.12.2"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-app-muted">Executable Path</Label>
        <div className="flex gap-2">
          <Input
            value={executablePath}
            onChange={(e) => setExecutablePath(e.target.value)}
            className="bg-app-primary border-app h-9 text-sm flex-1"
          />
          <Button
            size="icon"
            variant="ghost"
            className="h-9 w-9 shrink-0 hover:bg-accent-highlight/10 text-accent-highlight border border-app/30"
            onClick={async () => {
              const result = await api.showOpenDialog({
                properties: ['openFile'],
                filters: [{ name: 'Executables', extensions: ['*'] }]
              })
              if (!result.canceled && result.filePaths.length > 0) {
                setExecutablePath(result.filePaths[0])
              }
            }}
          >
            <FolderOpen className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-app-muted">Family</Label>
        <Select value={family} onValueChange={(v) => setFamily(v as SourcePortFamily)}>
          <SelectTrigger className="bg-app-primary border-app h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-app-secondary border-app">
            {(['uzdoom', 'gzdoom', 'zdoom', 'zandronum', 'lzdoom', 'helion', 'other'] as const).map((f) => (
              <SelectItem key={f} value={f} className="text-app-primary">
                {f}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onCancel}
          className="text-xs bg-transparent border-app hover:bg-app-hover text-app-muted h-8"
        >
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={() =>
            onSave({
              ...port,
              name,
              version: version || undefined,
              family,
              executablePath
            })
          }
          disabled={!name.trim() || !executablePath.trim()}
          className="text-xs bg-accent-highlight text-white hover:bg-accent-highlight/90 h-8"
        >
          Save
        </Button>
      </div>
    </div>
  )
}

export default SettingsDialog
