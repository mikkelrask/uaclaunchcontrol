import { useId, useState } from 'react'
import { useTranslate } from '@tolgee/react'
import { Check, Download, ImagePlus, Info, Loader2 } from 'lucide-react'
import type { IAppSettings, IDoomVersion } from '@shared/schema'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Switch } from '@/components/ui/switch'
import { DoomVersionIcon } from '@/icons/DoomIcons'
import { SettingsDefaultControl, SettingsResourceWorkbench } from './SettingsResourceWorkbench'

export interface SettingsWadsTabProps {
  settings: IAppSettings
  doomVersions: IDoomVersion[]
  isLoadingVersions: boolean
  selectedWadIndex: number
  setSelectedWadIndex: (index: number) => void
  freedoomDownloading: 'phase12' | 'freedm' | null
  freedoomError: string
  onVersionChange: (index: number, field: keyof IDoomVersion, value: string | boolean) => void
  onSetDefault: (id: string) => void
  onIconBrowse: (index: number) => Promise<void>
  onDownloadFreedoom: (bundle: 'phase12' | 'freedm') => Promise<void>
}

export function SettingsWadsTab({
  settings,
  doomVersions,
  isLoadingVersions,
  selectedWadIndex,
  setSelectedWadIndex,
  freedoomDownloading,
  freedoomError,
  onVersionChange,
  onSetDefault,
  onIconBrowse,
  onDownloadFreedoom
}: SettingsWadsTabProps): React.ReactElement {
  const { t } = useTranslate('desktop')
  const id = useId()
  const [detailOpen, setDetailOpen] = useState(false)
  const [lastDownload, setLastDownload] = useState<'phase12' | 'freedm' | null>(null)
  const activeIndex = doomVersions[selectedWadIndex] ? selectedWadIndex : 0
  const selected = doomVersions[activeIndex]
  const bundles = [
    {
      id: 'phase12' as const,
      label: t('settings.wads.freedoomBundle', 'FreeDoom (Phase 1 + 2)'),
      installed: ['freedoom1', 'freedoom2'].every((slug) =>
        doomVersions.some((version) => version.slug === slug)
      )
    },
    {
      id: 'freedm' as const,
      label: 'FreeDM',
      installed: doomVersions.some((version) => version.slug === 'freedm')
    }
  ]
  const allBundlesInstalled = bundles.every((bundle) => bundle.installed)

  return (
    <section className="settings-resource-section" aria-labelledby={`${id}-title`}>
      <div className="settings-section-heading">
        <div>
          <h2 id={`${id}-title`}>{t('settings.wads.workbench.title', 'Base games')}</h2>
          <p>
            {t(
              'settings.wads.workbench.description',
              'IWAD identities, defaults and launch options.'
            )}
          </p>
        </div>
      </div>

      <div className="settings-toolbar">
        <p className="text-xs text-app-muted">
          {t('settings.wads.workbench.select', 'Select a base game to edit')}
        </p>
        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" size="sm" className="gap-2">
              {freedoomDownloading ? (
                <Loader2
                  className="h-4 w-4 animate-spin motion-reduce:animate-none"
                  aria-hidden="true"
                />
              ) : allBundlesInstalled ? (
                <Check className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Download className="h-4 w-4" aria-hidden="true" />
              )}
              <span>
                {allBundlesInstalled
                  ? t('settings.wads.workbench.freeGamesInstalled', 'FreeDoom + FreeDM installed')
                  : t('settings.wads.workbench.freeGames', 'FreeDoom / FreeDM')}
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            className="w-[min(26rem,calc(100vw-2rem))] max-h-[min(28rem,70vh)] overflow-y-auto border-app bg-app-secondary text-app-primary"
            aria-labelledby={`${id}-freedoom-title`}
          >
            <h3 id={`${id}-freedoom-title`} className="text-sm font-medium">
              {t('settings.wads.workbench.freeGames', 'FreeDoom / FreeDM')}
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-app-muted">
              {t(
                'settings.wads.freedoomDescription',
                'Free, legally redistributable IWADs — no commercial Doom purchase required.'
              )}
            </p>
            <div className="mt-4">
              {bundles.map((bundle) => (
                <div
                  key={bundle.id}
                  className="flex flex-wrap items-center justify-between gap-3 border-b border-app py-3 last:border-b-0"
                >
                  <span className="text-sm">{bundle.label}</span>
                  {bundle.installed ? (
                    <span className="flex items-center gap-1 text-xs text-app-muted">
                      <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      {t('settings.wads.installed', 'Installed')}
                    </span>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={freedoomDownloading !== null}
                      onClick={() => {
                        setLastDownload(bundle.id)
                        void onDownloadFreedoom(bundle.id)
                      }}
                    >
                      <Download className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                      {freedoomDownloading === bundle.id
                        ? t('settings.wads.downloading', 'Downloading…')
                        : freedoomError && lastDownload === bundle.id
                          ? t('settings.wads.workbench.retryDownload', 'Retry download')
                          : t('settings.wads.download', 'Download')}
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs leading-relaxed text-app-muted">
              {t(
                'settings.wads.workbench.downloadsImmediate',
                'Downloads are installed immediately.'
              )}
            </p>
          </PopoverContent>
        </Popover>
      </div>

      {freedoomDownloading && (
        <p className="settings-info" role="status">
          {t('settings.wads.downloading', 'Downloading…')}
        </p>
      )}
      {freedoomError && (
        <p className="settings-info text-destructive" role="alert">
          {freedoomError}
        </p>
      )}

      {isLoadingVersions ? (
        <div
          className="flex min-h-40 flex-1 items-center justify-center gap-3 text-sm text-app-muted"
          role="status"
        >
          <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          {t('settings.wads.loading', 'CALIBRATING REPOSITORIES ...')}
        </div>
      ) : !selected ? (
        <div
          className="flex min-h-40 flex-1 items-center justify-center p-6 text-sm text-app-muted"
          role="status"
        >
          <p>{t('settings.wads.empty', 'No WAD files detected in the secure sector.')}</p>
        </div>
      ) : (
        <SettingsResourceWorkbench
          listLabel={t('settings.wads.workbench.installedGames', 'Installed base games')}
          count={doomVersions.length}
          detailOpen={detailOpen}
          onBack={() => setDetailOpen(false)}
          list={doomVersions.map((version, index) => (
            <button
              key={version.id}
              type="button"
              className="settings-resource-row"
              data-settings-resource-id={version.id}
              aria-pressed={activeIndex === index}
              onClick={() => {
                setSelectedWadIndex(index)
                setDetailOpen(true)
              }}
            >
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center"
                aria-hidden="true"
              >
                <DoomVersionIcon
                  version={version.slug}
                  customIcon={version.icon}
                  className="h-full w-full object-contain"
                />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{version.name}</span>
                <span className="block truncate text-xs text-app-muted">
                  {version.ignored
                    ? t('settings.resources.hidden', 'Hidden')
                    : version.defaultIwad.split(/[\\/]/).pop() || 'IWAD'}
                </span>
              </span>
              <span className="settings-resource-badge-slot">
                {settings.defaultDoomVersionId === version.id && (
                  <span className="settings-resource-badge">
                    {t('settings.resources.default', 'Default')}
                  </span>
                )}
              </span>
            </button>
          ))}
          editor={
            <>
              <div className="settings-editor-heading">
                <span
                  className="flex h-11 w-11 shrink-0 items-center justify-center"
                  aria-hidden="true"
                >
                  <DoomVersionIcon
                    version={selected.slug}
                    customIcon={selected.icon}
                    className="h-full w-full object-contain"
                  />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="break-words">{selected.name}</h3>
                  <p className="text-xs text-app-muted">
                    {t('settings.wads.identity', 'WAD Identity')}
                  </p>
                </div>
              </div>
              <SettingsDefaultControl
                isDefault={settings.defaultDoomVersionId === selected.id}
                onSelect={() => onSetDefault(selected.id)}
              />
              <div className="settings-field">
                <Label htmlFor={`${id}-name`}>
                  {t('settings.wads.workbench.displayName', 'Display name')}
                </Label>
                <Input
                  id={`${id}-name`}
                  name="name"
                  value={selected.name}
                  onChange={(event) => onVersionChange(activeIndex, 'name', event.target.value)}
                  className="settings-control"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-fit gap-2"
                  onClick={() => void onIconBrowse(activeIndex)}
                >
                  <ImagePlus className="h-3.5 w-3.5" aria-hidden="true" />
                  {t('settings.wads.workbench.changeIcon', 'Change icon')}
                </Button>
              </div>
              <div className="settings-field">
                <Label htmlFor={`${id}-arguments`}>
                  {t('settings.wads.arguments', 'Launch Arguments')}
                </Label>
                <Input
                  id={`${id}-arguments`}
                  name="args"
                  value={selected.args || ''}
                  onChange={(event) => onVersionChange(activeIndex, 'args', event.target.value)}
                  className="settings-control font-mono"
                />
              </div>
              <div className="settings-field">
                <Label htmlFor={`${id}-parameters`}>
                  {t('settings.wads.additionalParameters', 'Additional Parameters')}
                </Label>
                <Input
                  id={`${id}-parameters`}
                  name="parameters"
                  value={selected.parameters || ''}
                  onChange={(event) =>
                    onVersionChange(activeIndex, 'parameters', event.target.value)
                  }
                  placeholder={t('settings.wads.parametersExample', 'e.g. {arguments}', {
                    arguments: '-nomonsters -warp 01'
                  })}
                  className="settings-control font-mono"
                />
              </div>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 space-y-1">
                  <Label htmlFor={`${id}-hidden`}>
                    {t('settings.wads.hide', 'Hide from Interface')}
                  </Label>
                  <p
                    id={`${id}-hidden-description`}
                    className="text-xs leading-relaxed text-app-muted"
                  >
                    {t(
                      'settings.wads.hideDescription',
                      'Exclude this WAD from the sidebar and general WAD selectors.'
                    )}
                  </p>
                </div>
                <Switch
                  id={`${id}-hidden`}
                  aria-describedby={`${id}-hidden-description`}
                  checked={selected.ignored || false}
                  onCheckedChange={(checked) => onVersionChange(activeIndex, 'ignored', checked)}
                />
              </div>
              <div className="settings-field">
                <span className="text-sm font-medium">
                  {t('settings.wads.fileSource', 'File Source')}
                </span>
                <code className="break-all text-xs leading-relaxed text-app-muted">
                  {selected.defaultIwad}
                </code>
              </div>
            </>
          }
        />
      )}
      <p className="settings-info">
        <Info className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {t('settings.wads.workbench.defaultHint', 'The default is used for new protocols.')}
      </p>
    </section>
  )
}
