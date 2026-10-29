import { useTranslate } from '@tolgee/react'
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { SlidersHorizontal, FolderOpen, Cpu, Gamepad2, Palette } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { api } from '@/api'
import { dispatchAchievementEvent, buildUnlockToasts } from '@/lib/achievements'
import { queryClient } from '@/lib/queryClient'
import type { IDoomVersion, IAppSettings } from '@shared/schema'
import { SourcePortsTab } from '@/components/SourcePortsTab'
import { SettingsGeneralTab } from './settings/SettingsGeneralTab'
import { SettingsPathsTab } from './settings/SettingsPathsTab'
import { SettingsWadsTab } from './settings/SettingsWadsTab'
import { SettingsThemeTab } from './settings/SettingsThemeTab'
import { applyLanguage } from '@/lib/i18n'
import uacLogo from '@/assets/UAC Logo.svg'
import { createLogger } from '@shared/logger'
import './settings/settings.css'

const log = createLogger('SettingsDialogx')
interface SettingsDialogProps {
  isOpen: boolean
  onClose: () => void
}

const EMPTY_SETTINGS: IAppSettings = {
  language: 'system',
  sourcePorts: [],
  defaultSourcePortId: undefined,
  defaultDoomVersionId: undefined,
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
  defaultView: 'grid',
  uiScale: 100
}

export const SettingsDialog: React.FC<SettingsDialogProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslate('desktop')
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState('general')
  const [isLoadingSettings, setIsLoadingSettings] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [initialSettings, setInitialSettings] = useState('')
  const [initialVersions, setInitialVersions] = useState('')
  const translateRef = useRef(t)
  useEffect(() => {
    translateRef.current = t
  }, [t])
  const [settings, setSettings] = useState<IAppSettings>(EMPTY_SETTINGS)

  // Doom versions state
  const [doomVersions, setDoomVersions] = useState<IDoomVersion[]>([])
  const [isLoadingVersions, setIsLoadingVersions] = useState(true)
  const [selectedWadIndex, setSelectedWadIndex] = useState(0)
  const [freedoomDownloading, setFreedoomDownloading] = useState<'phase12' | 'freedm' | null>(null)
  const [freedoomError, setFreedoomError] = useState('')
  const [appVersion, setAppVersion] = useState<string>('')

  // Snapshot of the saved theme/scale for revert-on-close
  const savedRef = useRef<{ theme: string; customThemeCss?: string; uiScale: number }>({
    theme: 'dark',
    customThemeCss: '',
    uiScale: 100
  })

  // Track the original wadFilesDirectory for change detection
  const initialWadDirRef = useRef<string>('')

  // Track whether the initial fetch has completed so live-preview doesn't
  // briefly apply the default theme before the saved one arrives.
  const fetchedRef = useRef(false)

  // Snapshot of source port state at dialog open, for achievement tracking
  const initialPortFamiliesRef = useRef<string[]>([])

  // Keep the opening snapshot stable while previews and translations change.
  useEffect(() => {
    if (!isOpen) return
    let active = true
    setActiveTab('general')
    setSelectedWadIndex(0)
    setIsLoadingSettings(true)
    setLoadFailed(false)
    setSaveError('')
    setIsLoadingVersions(true)
    setFreedoomError('')
    fetchedRef.current = false
    setInitialSettings('')
    setInitialVersions('')
    api
      .getVersion()
      .then((version) => {
        if (active) setAppVersion(version)
      })
      .catch(log.error)
    api
      .getSettings()
      .then((data) => {
        if (!active || !data) return
        savedRef.current = {
          theme: data.theme,
          customThemeCss: data.customThemeCss,
          uiScale: data.uiScale ?? 100
        }
        initialWadDirRef.current = data.wadFilesDirectory || ''
        const next = { ...EMPTY_SETTINGS, ...data }
        setInitialSettings(JSON.stringify(next))
        setSettings(next)
        fetchedRef.current = true
        initialPortFamiliesRef.current = [
          ...new Set(
            (data.sourcePorts || [])
              .filter((port) => !port.ignored)
              .map((port) => port.family)
              .filter((family) => !!family)
          )
        ]
      })
      .catch(() => {
        if (active) setLoadFailed(true)
        if (active)
          toast({
            title: 'FATAL: cfg_load_err',
            description: translateRef.current('settings.load.failed', 'Failed to load settings'),
            variant: 'destructive'
          })
      })
      .finally(() => {
        if (active) setIsLoadingSettings(false)
      })
    api
      .getDoomVersions()
      .then((versions) => {
        if (!active) return
        setInitialVersions(JSON.stringify(versions))
        setDoomVersions(versions)
      })
      .catch(() => {
        if (active) setLoadFailed(true)
        if (active)
          toast({
            title: 'FATAL: version_load_err',
            description: translateRef.current(
              'settings.versions.failed',
              'Failed to load doom versions'
            ),
            variant: 'destructive'
          })
      })
      .finally(() => {
        if (active) setIsLoadingVersions(false)
      })
    return () => {
      active = false
    }
  }, [isOpen, toast])

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

  const handleSetDefaultDoomVersion = (id: string): void => {
    setSettings((prev) => ({ ...prev, defaultDoomVersionId: id }))
  }

  const handleIconBrowse = async (index: number): Promise<void> => {
    const version = doomVersions[index]
    const result = await api.showOpenDialog({
      properties: ['openFile'],
      filters: [
        {
          name: t('settings.dialog.images', 'Images'),
          extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp']
        }
      ],
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
          toast({
            title: 'SYSTEM: icon_relocated',
            description: t('settings.icon.moved', 'Icon moved to {path}', { path: destPath })
          })
        } catch {
          // If move fails, just use the selected path
          handleVersionChange(index, 'icon', selectedIconPath)
        }
      } else {
        handleVersionChange(index, 'icon', selectedIconPath)
      }
    }
  }

  const handleDownloadFreedoom = async (bundle: 'phase12' | 'freedm'): Promise<void> => {
    setFreedoomDownloading(bundle)
    setFreedoomError('')
    try {
      const result = await api.downloadFreedoom(bundle)
      setInitialVersions(JSON.stringify(result.doomVersions))
      setDoomVersions((draft) =>
        result.doomVersions.map(
          (version) => draft.find((item) => item.id === version.id) ?? version
        )
      )
      // The WAD watcher usually fires for new files too, but refresh
      // deterministically so the versions cache never goes stale
      // (queryCacheContracts: downloadFreedoom → /api/versions).
      queryClient.invalidateQueries({ queryKey: ['/api/versions'] })
      toast({
        title: 'SYSTEM: freedoom_installed',
        description: t('settings.freedoom.installed', 'Installed: {names}', {
          names: result.installed.join(', ')
        })
      })
    } catch (e: unknown) {
      setFreedoomError(
        e instanceof Error ? e.message : t('settings.wads.downloadFailed', 'Download failed')
      )
    } finally {
      setFreedoomDownloading(null)
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

  // Live-preview UI scale is applied on slider release via onValueCommit,
  // not on every drag tick — Electron zoom moves the viewport which shifts
  // the slider under the cursor, causing a feedback loop if applied live.

  // Restore saved theme/scale when closing without saving
  const handleClose = useCallback((): void => {
    if (isSaving) return
    if (!fetchedRef.current) {
      onClose()
      return
    }
    fetchedRef.current = false
    document.documentElement.classList.remove('dark', 'light', 'terminal', 'custom')
    document.documentElement.classList.add(savedRef.current.theme)
    api.setZoomFactor(savedRef.current.uiScale / 100)

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
  }, [onClose, isSaving])

  const hasChanges =
    !!initialSettings &&
    (JSON.stringify(settings) !== initialSettings ||
      JSON.stringify(doomVersions) !== initialVersions)
  const invalidPort = settings.sourcePorts.some(
    (port) => !port.name.trim() || !port.executablePath.trim()
  )
  const invalidPath = [
    settings.wadFilesDirectory,
    settings.modsDirectory,
    settings.savegamesPath,
    settings.screenshotsPath
  ].some((value) => !value?.trim())
  const ready = !isLoadingSettings && !isLoadingVersions && !!initialSettings && !!initialVersions
  const canSave =
    ready && hasChanges && !invalidPort && !invalidPath && !isSaving && !freedoomDownloading

  // Persist drafts only through the dialog's Apply action.
  const handleSave = async (): Promise<void> => {
    if (!canSave) return
    setIsSaving(true)
    setSaveError('')
    try {
      const payload = {
        language: settings.language ?? 'system',
        sourcePorts: settings.sourcePorts,
        defaultSourcePortId: settings.defaultSourcePortId,
        defaultDoomVersionId: settings.defaultDoomVersionId,
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
        defaultView: settings.defaultView,
        uiScale: settings.uiScale
      }
      // Dispatch SOURCE_PORT_ADDED achievements for each newly seen family.
      // Gated on family novelty alone, not net port count — a port count
      // that stayed flat (e.g. editing an existing port's family, or
      // removing one port while adding another) can still introduce a
      // genuinely new family and must still fire.
      const newPorts = (settings.sourcePorts || []).filter((p) => !p.ignored)
      const oldFamilies = new Set(initialPortFamiliesRef.current)
      for (const port of newPorts) {
        if (port.family && !oldFamilies.has(port.family)) {
          const srcResult = await dispatchAchievementEvent({
            type: 'SOURCE_PORT_ADDED',
            count: 1,
            family: port.family
          })
          const unlockToasts = buildUnlockToasts(srcResult)
          for (const t of unlockToasts) {
            toast({
              title: t.title,
              description: t.description,
              duration: t.duration as 6000 | 8000
            })
          }
          oldFamilies.add(port.family)
        }
      }

      const savedSettings = await api.updateSettings(payload)
      savedRef.current = {
        theme: savedSettings.theme,
        customThemeCss: savedSettings.customThemeCss,
        uiScale: savedSettings.uiScale ?? 100
      }

      // Settings can persist even if the metadata request fails. Synchronise
      // successful writes immediately so a retry/Cancel cannot leave stale UI.
      await applyLanguage(savedSettings.language)
      await queryClient.invalidateQueries({ queryKey: ['/api/settings'] })
      try {
        if (initialWadDirRef.current !== payload.wadFilesDirectory) {
          // The settings endpoint has rescanned the new folder. Old-folder
          // metadata must not replace that new inventory.
          const freshVersions = await api.getDoomVersions()
          setDoomVersions(freshVersions)
        } else {
          await api.updateDoomVersions(doomVersions)
        }
      } finally {
        await queryClient.invalidateQueries({ queryKey: ['/api/versions'] })
      }

      // Update savedRef so close-restore is a no-op (theme is already persisted)
      savedRef.current = {
        theme: settings.theme,
        customThemeCss: settings.customThemeCss,
        uiScale: settings.uiScale ?? 100
      }

      toast({
        title: 'SYSTEM: core_settings',
        description: t('settings.save.success', 'Your changes have been approved.')
      })
      onClose()
    } catch {
      setSaveError(t('settings.save.incomplete', 'Could not save all changes. Please try again.'))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) handleClose()
      }}
    >
      <DialogContent
        className="settings-shell settings-surface shadow-2xl"
        data-testid="settings-dialog"
        aria-describedby="settings-description"
        aria-busy={isSaving}
        onEscapeKeyDown={(event) => {
          // Radix handles Escape during capture, before the path input can
          // cancel its own inline edit. Let that edit consume the first Escape.
          if (document.activeElement?.matches('.settings-path-input input')) event.preventDefault()
        }}
      >
        <header className="settings-header">
          <img src={uacLogo} alt="" aria-hidden="true" />
          <div>
            <DialogTitle className="settings-title">
              {t('settings.title', 'core_settings')}
            </DialogTitle>
            <p id="settings-description" className="settings-subtitle">
              {t('settings.subtitle', 'UAC Launch Control // System Configuration')}
            </p>
          </div>
        </header>
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="settings-tabs"
          inert={isSaving || isLoadingSettings}
        >
          <TabsList
            className="settings-tabs-list"
            aria-label={t('settings.navigation', 'Settings sections')}
          >
            <TabsTrigger value="general" className="settings-tab">
              <SlidersHorizontal aria-hidden="true" />
              {t('settings.tabs.general', 'General')}
            </TabsTrigger>
            <TabsTrigger value="paths" className="settings-tab">
              <FolderOpen aria-hidden="true" />
              {t('settings.tabs.paths', 'Paths')}
            </TabsTrigger>
            <TabsTrigger value="source-ports" className="settings-tab">
              <Cpu aria-hidden="true" />
              {t('settings.tabs.sourcePorts', 'Source Ports')}
            </TabsTrigger>
            <TabsTrigger value="wad-config" className="settings-tab">
              <Gamepad2 aria-hidden="true" />
              {t('settings.wads.workbench.title', 'Base games')}
            </TabsTrigger>
            <TabsTrigger value="advanced" className="settings-tab">
              <Palette aria-hidden="true" />
              {t('settings.themeLab.title', 'Theme lab')}
            </TabsTrigger>
          </TabsList>
          <TabsContent forceMount value="general" className="settings-panel settings-scroll">
            <SettingsGeneralTab
              settings={settings}
              setSettings={setSettings}
              appVersion={appVersion}
              onEditTheme={() => setActiveTab('advanced')}
            />
          </TabsContent>
          <TabsContent forceMount value="paths" className="settings-panel settings-scroll">
            <SettingsPathsTab settings={settings} setSettings={setSettings} />
          </TabsContent>
          <TabsContent
            forceMount
            value="source-ports"
            className="settings-panel settings-panel-inventory"
          >
            <SourcePortsTab settings={settings} setSettings={setSettings} layout="workbench" />
          </TabsContent>
          <TabsContent
            forceMount
            value="wad-config"
            className="settings-panel settings-panel-inventory"
          >
            <SettingsWadsTab
              settings={settings}
              doomVersions={doomVersions}
              isLoadingVersions={isLoadingVersions}
              selectedWadIndex={selectedWadIndex}
              setSelectedWadIndex={setSelectedWadIndex}
              freedoomDownloading={freedoomDownloading}
              freedoomError={freedoomError}
              onVersionChange={handleVersionChange}
              onSetDefault={handleSetDefaultDoomVersion}
              onIconBrowse={handleIconBrowse}
              onDownloadFreedoom={handleDownloadFreedoom}
            />
          </TabsContent>
          <TabsContent forceMount value="advanced" className="settings-panel settings-scroll">
            <SettingsThemeTab settings={settings} setSettings={setSettings} />
          </TabsContent>
        </Tabs>
        <footer className="settings-footer">
          <span
            className="settings-footer-status"
            data-dirty={hasChanges}
            role={saveError ? 'alert' : 'status'}
          >
            {saveError
              ? saveError
              : freedoomDownloading
                ? t('settings.state.installing', 'Installing free games…')
                : isSaving
                  ? t('settings.state.saving', 'Applying changes…')
                  : loadFailed
                    ? t(
                        'settings.state.loadFailed',
                        'Configuration could not be loaded. Close settings and try again.'
                      )
                    : !ready
                      ? t('settings.state.loading', 'Loading configuration…')
                      : invalidPort
                        ? t(
                            'settings.state.portIncomplete',
                            'Each source port needs a name and executable path.'
                          )
                        : invalidPath
                          ? t(
                              'settings.state.pathIncomplete',
                              'Choose a folder or use its default location.'
                            )
                          : hasChanges
                            ? t('settings.state.unsaved', 'Unsaved changes')
                            : t('settings.state.saved', 'Configuration up to date')}
          </span>
          <div className="settings-footer-actions">
            <Button
              type="button"
              variant="outline"
              data-settings-cancel
              onClick={handleClose}
              disabled={isSaving}
            >
              {t('sourcePorts.form.cancel', 'Cancel')}
            </Button>
            <Button
              type="button"
              className="settings-apply"
              data-settings-apply
              onClick={() => void handleSave()}
              disabled={!canSave}
            >
              {t('settings.apply', 'Apply Changes')}
            </Button>
          </div>
        </footer>
      </DialogContent>
    </Dialog>
  )
}

export default SettingsDialog
