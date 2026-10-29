import { useId, type Dispatch, type SetStateAction } from 'react'
import { T, useTranslate } from '@tolgee/react'
import { BookOpen, LayoutGrid, List } from 'lucide-react'
import type { IAppSettings } from '@shared/schema'
import { isLanguagePreference } from '@shared/locales'
import { api } from '@/api'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'

export interface SettingsGeneralTabProps {
  settings: IAppSettings
  setSettings: Dispatch<SetStateAction<IAppSettings>>
  appVersion: string
  onEditTheme: () => void
}

export function SettingsGeneralTab({
  settings,
  setSettings,
  appVersion,
  onEditTheme
}: SettingsGeneralTabProps): React.ReactElement {
  const { t } = useTranslate('desktop')
  const id = useId()

  return (
    <section aria-labelledby={`${id}-title`}>
      <div className="settings-section-heading">
        <div>
          <h2 id={`${id}-title`}>{t('settings.tabs.general', 'General')}</h2>
          <p>{t('settings.general.intro', 'Set up your working environment.')}</p>
        </div>
      </div>

      <section className="settings-group" aria-labelledby={`${id}-appearance`}>
        <h3 id={`${id}-appearance`}>{t('settings.general.appearance', 'Appearance')}</h3>
        <div className="settings-row">
          <div>
            <Label htmlFor={`${id}-language`}>{t('settings.language.label', 'Language')}</Label>
            <p id={`${id}-language-description`}>
              {t(
                'settings.language.description',
                'Choose the interface language. Untranslated text is shown in English.'
              )}
            </p>
          </div>
          <Select
            value={settings.language ?? 'system'}
            onValueChange={(language) => {
              if (isLanguagePreference(language)) setSettings((s) => ({ ...s, language }))
            }}
          >
            <SelectTrigger
              id={`${id}-language`}
              aria-describedby={`${id}-language-description`}
              className="settings-control"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-app-secondary border-app text-app-primary">
              <SelectItem value="system">
                {t('settings.language.system', 'System language')}
              </SelectItem>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="da-DK">Dansk</SelectItem>
              <SelectItem value="es-ES">Español</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="settings-row">
          <div>
            <Label htmlFor={`${id}-theme`}>{t('settings.theme.label', 'App Theme')}</Label>
            <p id={`${id}-theme-description`}>
              {t('settings.theme.description', 'Visual colour profile for the terminal.')}
            </p>
          </div>
          <div className="settings-control-stack">
            <Select
              value={settings.theme}
              onValueChange={(value) =>
                setSettings((s) => ({ ...s, theme: value as IAppSettings['theme'] }))
              }
            >
              <SelectTrigger
                id={`${id}-theme`}
                aria-describedby={`${id}-theme-description`}
                className="settings-control"
              >
                <SelectValue placeholder={t('settings.theme.placeholder', 'Select theme')} />
              </SelectTrigger>
              <SelectContent className="bg-app-secondary border-app text-app-primary">
                {[
                  {
                    value: 'dark',
                    label: t('settings.theme.dark', 'UAC PHOBOS — Default, dark/red')
                  },
                  {
                    value: 'light',
                    label: t('settings.theme.light', 'MAYKR — Bright argent energy')
                  },
                  {
                    value: 'terminal',
                    label: t('settings.theme.terminal', 'PLUTONIA TERMINAL — Green phosphor')
                  },
                  {
                    value: 'custom',
                    label: t('settings.theme.custom', 'CUSTOM — User-defined palette')
                  }
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
            <button type="button" className="settings-text-button" onClick={onEditTheme}>
              {t('settings.customTheme.title', 'CUSTOM THEME EDITOR')}
            </button>
          </div>
        </div>

        <div className="settings-row">
          <div>
            <Label htmlFor={`${id}-scale`} id={`${id}-scale-label`}>
              {t('settings.scale.label', 'UI Scale')}
            </Label>
            <p id={`${id}-scale-description`}>
              {t(
                'settings.scale.description',
                'Text and spacing size, independent of window zoom (Ctrl +/-).'
              )}
            </p>
          </div>
          <div className="settings-scale">
            <Slider
              id={`${id}-scale`}
              aria-label={t('settings.scale.label', 'UI Scale')}
              aria-labelledby={`${id}-scale-label`}
              aria-describedby={`${id}-scale-description`}
              value={[settings.uiScale ?? 100]}
              onValueChange={([value]) => setSettings((s) => ({ ...s, uiScale: value }))}
              onValueCommit={([value]) => api.setZoomFactor(value / 100)}
              min={80}
              max={150}
              step={5}
              className="flex-1"
            />
            <output htmlFor={`${id}-scale`}>{settings.uiScale ?? 100}%</output>
          </div>
        </div>
      </section>

      <section className="settings-group" aria-labelledby={`${id}-launch`}>
        <h3 id={`${id}-launch`}>{t('settings.general.launchBehaviour', 'Launch behaviour')}</h3>
        <div className="settings-row">
          <div>
            <Label id={`${id}-view-label`}>{t('settings.view.label', 'Default View')}</Label>
            <p id={`${id}-view-description`}>
              {t('settings.view.description', 'Starting view mode when opening the games page.')}
            </p>
          </div>
          <div
            className="settings-view-options"
            role="group"
            aria-labelledby={`${id}-view-label`}
            aria-describedby={`${id}-view-description`}
          >
            {[
              { value: 'grid' as const, icon: LayoutGrid, label: t('settings.view.grid', 'Grid') },
              { value: 'list' as const, icon: List, label: t('settings.view.list', 'List') },
              {
                value: 'detail' as const,
                icon: BookOpen,
                label: t('settings.view.detail', 'Detail')
              }
            ].map(({ value, icon: Icon, label }) => (
              <button
                key={value}
                type="button"
                aria-pressed={settings.defaultView === value}
                onClick={() => setSettings((s) => ({ ...s, defaultView: value }))}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="settings-row">
          <div>
            <Label htmlFor={`${id}-preview`}>{t('settings.preview.label', 'Launch Preview')}</Label>
            <p id={`${id}-preview-description`}>
              {t(
                'settings.preview.description',
                'Show the generated launch command in settings and install page.'
              )}
            </p>
          </div>
          <Switch
            id={`${id}-preview`}
            aria-describedby={`${id}-preview-description`}
            checked={settings.showLaunchPreview ?? true}
            onCheckedChange={(checked) =>
              setSettings((s) => ({ ...s, showLaunchPreview: checked }))
            }
          />
        </div>
      </section>

      <section className="settings-group" aria-labelledby={`${id}-connections`}>
        <h3 id={`${id}-connections`}>{t('settings.general.connections', 'Connections')}</h3>
        <div className="settings-row">
          <div>
            <Label htmlFor={`${id}-database`}>
              {t('settings.database.label', 'Database Link')}
            </Label>
            <p id={`${id}-database-description`}>
              {t(
                'settings.database.description',
                'Changes the shortcut link shown in the header next to LAUNCH/INSTALL.'
              )}
            </p>
          </div>
          <div className="settings-control-stack">
            <Select
              value={settings.selectedPresetIndex.toString()}
              onValueChange={(value) =>
                setSettings((s) => ({ ...s, selectedPresetIndex: parseInt(value, 10) }))
              }
            >
              <SelectTrigger
                id={`${id}-database`}
                aria-describedby={`${id}-database-description`}
                className="settings-control"
              >
                <SelectValue
                  placeholder={t('settings.database.placeholder', 'Select a database')}
                />
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
            <p className="break-all text-right text-xs font-mono">
              {settings.databaseLinkPresets[settings.selectedPresetIndex]?.url || ''}
            </p>
          </div>
        </div>

        <div className="settings-row">
          <div>
            <Label htmlFor={`${id}-registry`}>
              {t('settings.registry.label', 'Registry Lookup')}
            </Label>
            <p id={`${id}-registry-description`}>
              <T
                keyName="settings.registry.description"
                ns="desktop"
                defaultValue="Look up mod file metadata in the UAC Registry when adding to catalog.{br}Requires an active internet connection."
                params={{ br: <br /> }}
              />
            </p>
          </div>
          <Switch
            id={`${id}-registry`}
            aria-describedby={`${id}-registry-description`}
            checked={settings.registryLookupEnabled ?? false}
            onCheckedChange={(checked) => {
              if (checked && !settings.registryUuid) {
                const uuid = crypto.randomUUID()
                setSettings((s) => ({ ...s, registryLookupEnabled: checked, registryUuid: uuid }))
              } else {
                setSettings((s) => ({ ...s, registryLookupEnabled: checked }))
              }
            }}
          />
        </div>

        <div className="settings-row">
          <div>
            <Label htmlFor={`${id}-updates`}>
              {t('settings.updates.label', 'Check for updates on Startup')}
            </Label>
            <p id={`${id}-updates-description`}>
              <T
                keyName="settings.updates.description"
                ns="desktop"
                defaultValue="Automatically notify about application updates. {br}Updating is always optional - new updates will never be downloaded/applied without interaction."
                params={{ br: <br /> }}
              />
            </p>
          </div>
          <Switch
            id={`${id}-updates`}
            aria-describedby={`${id}-updates-description`}
            checked={settings.autoUpdateEnabled ?? true}
            onCheckedChange={(checked) =>
              setSettings((s) => ({ ...s, autoUpdateEnabled: checked }))
            }
          />
        </div>
      </section>

      <div className="settings-strip">
        <div>
          <span className="text-sm">
            {t('settings.updates.manual', 'Manually check for app updates')}
          </span>
          {appVersion && <p className="font-mono">E1M{appVersion}</p>}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => api.checkForUpdates()}>
          {t('settings.updates.check', 'Check')}
        </Button>
      </div>
    </section>
  )
}
