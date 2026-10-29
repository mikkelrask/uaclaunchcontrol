import { useEffect, useId, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { useTranslate } from '@tolgee/react'
import { FolderOpen, Pencil, Info } from 'lucide-react'
import { api } from '@/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { IAppSettings, SettingsDirectoryPaths } from '@shared/schema'

type DirectoryKey = keyof SettingsDirectoryPaths
interface SettingsPathsTabProps {
  settings: IAppSettings
  setSettings: Dispatch<SetStateAction<IAppSettings>>
}
export function SettingsPathsTab({
  settings,
  setSettings
}: SettingsPathsTabProps): React.JSX.Element {
  const { t } = useTranslate('desktop')
  const id = useId()
  const [defaults, setDefaults] = useState<SettingsDirectoryPaths | null>(null)
  const [editing, setEditing] = useState<{ key: DirectoryKey; original: string } | null>(null)
  const [error, setError] = useState('')
  const editButtons = useRef<Partial<Record<DirectoryKey, HTMLButtonElement | null>>>({})
  const restoreFocus = (key: DirectoryKey): void => {
    requestAnimationFrame(() => editButtons.current[key]?.focus({ preventScroll: true }))
  }
  useEffect(() => {
    let active = true
    api
      .getDefaultSettingsPaths()
      .then((paths) => {
        if (active) setDefaults(paths)
      })
      .catch(() => {
        /* Browsing/manual editing still work if defaults cannot be loaded. */
      })
    return () => {
      active = false
    }
  }, [])
  const change = (key: DirectoryKey, value: string): void => {
    setSettings((previous) => ({ ...previous, [key]: value }))
  }
  const browse = async (key: DirectoryKey): Promise<void> => {
    setError('')
    try {
      const result = await api.showOpenDialog({
        properties: ['openDirectory'],
        defaultPath: settings[key]
      })
      if (!result.canceled && result.filePaths[0]) {
        change(key, result.filePaths[0])
        setEditing(null)
      }
    } catch {
      setError(
        t(
          'settings.paths.pickerFailed',
          'Could not open the folder chooser. You can still edit the path manually.'
        )
      )
    }
  }
  const finish = (): void => {
    if (editing && settings[editing.key]?.trim()) {
      restoreFocus(editing.key)
      setEditing(null)
    }
  }
  const cancel = (): void => {
    if (editing) {
      change(editing.key, editing.original)
      restoreFocus(editing.key)
    }
    setEditing(null)
  }
  const directories: { key: DirectoryKey; label: string; description: string }[] = [
    {
      key: 'wadFilesDirectory',
      label: t('settings.paths.wads', 'WAD Assets'),
      description: t(
        'settings.paths.wadsDescription',
        'Central repository for .WAD and .PK3 data structures.'
      )
    },
    {
      key: 'modsDirectory',
      label: t('settings.paths.modConfigurations', 'Mod configurations'),
      description: t(
        'settings.paths.modsDescription',
        'Localized storage for external mod modifications.'
      )
    },
    {
      key: 'savegamesPath',
      label: t('settings.paths.saveFiles', 'Save files'),
      description: t(
        'settings.paths.savesDescription',
        'Secure sector for game state and progress backups.'
      )
    },
    {
      key: 'screenshotsPath',
      label: t('settings.paths.screenshotFiles', 'Screenshots'),
      description: t(
        'settings.paths.screenshotsDescription',
        'Visual capture repository for mission debriefings.'
      )
    }
  ]
  return (
    <>
      <div className="settings-section-heading">
        <div>
          <h2>{t('settings.tabs.paths', 'Paths')}</h2>
          <p>
            {t(
              'settings.paths.workbenchDescription',
              'Choose where your assets and mission records live.'
            )}
          </p>
        </div>
      </div>
      {directories.map(({ key, label, description }) => (
        <section key={key} className="settings-path" data-settings-path={key} aria-label={label}>
          <div className="settings-path-heading">
            <h3>{label}</h3>
            {defaults?.[key] && (
              <span>
                {settings[key] === defaults[key]
                  ? t('settings.paths.defaultLocation', 'Default location')
                  : t('settings.paths.customLocation', 'Custom location')}
              </span>
            )}
          </div>
          {editing?.key === key ? (
            <div className="settings-path-input">
              <Input
                autoFocus
                id={`${id}-${key}`}
                name={key}
                value={settings[key] || ''}
                aria-label={label}
                aria-invalid={!settings[key]?.trim()}
                className="settings-control font-mono"
                onChange={(event) => change(key, event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    finish()
                  }
                  if (event.key === 'Escape') {
                    event.preventDefault()
                    event.stopPropagation()
                    cancel()
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={finish}
                disabled={!settings[key]?.trim()}
              >
                {t('settings.paths.done', 'Done')}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={cancel}>
                {t('sourcePorts.form.cancel', 'Cancel')}
              </Button>
            </div>
          ) : (
            <div className="settings-path-value">
              <code>{settings[key] || t('settings.paths.notSet', 'No folder selected')}</code>
              <div className="settings-path-actions">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  data-settings-path-edit={key}
                  ref={(element) => {
                    editButtons.current[key] = element
                  }}
                  onClick={() => setEditing({ key, original: settings[key] || '' })}
                >
                  <Pencil aria-hidden="true" />
                  {t('settings.paths.edit', 'Edit path')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  data-settings-path-browse={key}
                  aria-label={t('settings.paths.browse', 'Browse for {directory}', {
                    directory: label
                  })}
                  onClick={() => void browse(key)}
                >
                  <FolderOpen aria-hidden="true" />
                  {t('settings.paths.browseAction', 'Browse…')}
                </Button>
              </div>
            </div>
          )}
          <div className="settings-path-help">
            <p>{description}</p>
            {defaults?.[key] && settings[key] !== defaults[key] && (
              <button
                type="button"
                data-settings-path-reset={key}
                onClick={() => {
                  change(key, defaults[key])
                  setEditing(null)
                }}
              >
                {t('settings.paths.useDefault', 'Use default')}
              </button>
            )}
          </div>
        </section>
      ))}
      <p className="settings-info">
        <Info className="size-4 shrink-0" aria-hidden="true" />
        {t(
          'settings.paths.rescanWarning',
          'Changing WAD assets rescans that folder on Apply. Finish any base-game edits first.'
        )}
      </p>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      <div className="settings-strip">
        <div>
          <h3>{t('settings.config.label', 'Application Ini')}</h3>
          <span className="settings-path-text">{settings.configPath}</span>
          <p>
            {t(
              'settings.config.description',
              'Internal master directory for settings, telemetry catalogues, and system state.'
            )}
          </p>
        </div>
      </div>
    </>
  )
}
