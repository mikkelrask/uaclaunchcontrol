import { useId } from 'react'
import { useTranslate } from '@tolgee/react'
import { Check, Download, Loader2 } from 'lucide-react'
import type { IDoomVersion } from '@shared/schema'
import { Button } from '@/components/ui/button'

export type FreeDoomBundle = 'phase12' | 'freedm'
const BUNDLES: { id: FreeDoomBundle; slugs: string[] }[] = [
  { id: 'phase12', slugs: ['freedoom1', 'freedoom2'] },
  { id: 'freedm', slugs: ['freedm'] }
]

export function allFreeGamesInstalled(versions: IDoomVersion[]): boolean {
  return BUNDLES.every(({ slugs }) =>
    slugs.every((slug) => versions.some((version) => version.slug === slug))
  )
}

interface FreeDoomDownloadsProps {
  versions: IDoomVersion[]
  downloading: FreeDoomBundle | null
  error: string
  lastDownload: FreeDoomBundle | null
  onDownload: (bundle: FreeDoomBundle) => Promise<void>
  disabled?: boolean
  showError?: boolean
  titleId?: string
}

/** Shared acquisition rows: inline during setup, inside the settings popover later. */
export function FreeDoomDownloads({
  versions,
  downloading,
  error,
  lastDownload,
  onDownload,
  disabled = false,
  showError = true,
  titleId
}: FreeDoomDownloadsProps): React.JSX.Element {
  const { t } = useTranslate('desktop')
  const id = useId()
  const headingId = titleId ?? `${id}-title`
  const labels = {
    available: t('settings.wads.download', 'Download'),
    downloading: t('settings.wads.downloading', 'Downloading…'),
    installed: t('settings.wads.installed', 'Installed'),
    failed: t('settings.wads.workbench.retryDownload', 'Retry download')
  }

  return (
    <section aria-labelledby={headingId} aria-busy={downloading !== null}>
      <h3 id={headingId} className="text-sm font-medium">
        {t('settings.wads.workbench.freeGames', 'FreeDoom / FreeDM')}
      </h3>
      <p className="mt-2 text-xs leading-relaxed text-app-muted">
        {t(
          'settings.wads.freedoomDescription',
          'Free, legally redistributable IWADs — no commercial Doom purchase required.'
        )}
      </p>
      <div className="mt-3">
        {BUNDLES.map(({ id: bundle, slugs }) => {
          const installed = slugs.every((slug) => versions.some((version) => version.slug === slug))
          const state = installed
            ? 'installed'
            : downloading === bundle
              ? 'downloading'
              : error && lastDownload === bundle
                ? 'failed'
                : 'available'
          return (
            <div
              key={bundle}
              data-freedoom-bundle={bundle}
              data-freedoom-state={state}
              className="flex flex-wrap items-center justify-between gap-3 border-b border-app py-3 last:border-b-0"
            >
              <span className="text-sm">
                {bundle === 'phase12'
                  ? t('settings.wads.freedoomBundle', 'FreeDoom (Phase 1 + 2)')
                  : 'FreeDM'}
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                data-freedoom-download={bundle}
                disabled={disabled || downloading !== null || installed}
                onClick={() => void onDownload(bundle)}
                className={`h-9 shrink-0 gap-2 border-app ${installed ? 'text-app-muted disabled:opacity-100' : ''}`}
              >
                {installed ? (
                  <Check className="h-4 w-4" aria-hidden="true" />
                ) : downloading === bundle ? (
                  <Loader2
                    className="h-4 w-4 animate-spin motion-reduce:animate-none"
                    aria-hidden="true"
                  />
                ) : (
                  <Download className="h-4 w-4" aria-hidden="true" />
                )}
                <span className="grid">
                  {Object.entries(labels).map(([key, label]) => (
                    <span
                      key={key}
                      className={`col-start-1 row-start-1 ${key === state ? '' : 'invisible'}`}
                      aria-hidden={key !== state}
                    >
                      {label}
                    </span>
                  ))}
                </span>
              </Button>
            </div>
          )
        })}
      </div>
      {showError && error && (
        <p className="mt-3 text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
      <p className="mt-3 text-xs leading-relaxed text-app-muted">
        {t('settings.wads.workbench.downloadsImmediate', 'Downloads are installed immediately.')}
      </p>
    </section>
  )
}
