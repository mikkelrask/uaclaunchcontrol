import { useTranslate } from '@tolgee/react'
import React, { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  FolderOpen,
  Loader2,
  Pencil,
  RefreshCw
} from 'lucide-react'
import { api } from '@/api'
import { queryClient } from '@/lib/queryClient'
import type { IAppSettings, IDoomVersion } from '@shared/schema'
import { DoomVersionIcon } from '@/icons/DoomIcons'
import { FreeDoomDownloads, type FreeDoomBundle } from '@/components/FreeDoomDownloads'
import { OnboardingStepLayout } from './OnboardingStepLayout'

interface WadFilesStepProps {
  settings: IAppSettings
  setSettings: React.Dispatch<React.SetStateAction<IAppSettings>>
  persistSettings: (patch: Partial<IAppSettings>) => Promise<IAppSettings>
  onDirectoryBusyChange: (busy: boolean) => void
  onNext: () => void
  onBack: () => void
}

export const WadFilesStep: React.FC<WadFilesStepProps> = ({
  settings,
  setSettings,
  persistSettings,
  onDirectoryBusyChange,
  onNext,
  onBack
}) => {
  const { t } = useTranslate('desktop')
  const id = useId()
  const [doomVersions, setDoomVersions] = useState<IDoomVersion[]>([])
  const [isLoadingVersions, setIsLoadingVersions] = useState(true)
  const [versionsError, setVersionsError] = useState('')
  const [freedoomDownloading, setFreedoomDownloading] = useState<FreeDoomBundle | null>(null)
  const [lastDownload, setLastDownload] = useState<FreeDoomBundle | null>(null)
  const [freedoomError, setFreedoomError] = useState('')
  const [isEditingPath, setIsEditingPath] = useState(false)
  const [pathDraft, setPathDraft] = useState(settings.wadFilesDirectory ?? '')
  const [directoryPending, setDirectoryPending] = useState(false)
  const [directoryError, setDirectoryError] = useState('')
  const editButtonRef = useRef<HTMLButtonElement>(null)
  const pathInputRef = useRef<HTMLInputElement>(null)
  const freeGamesRef = useRef<HTMLDetailsElement>(null)
  const freeGamesSummaryRef = useRef<HTMLElement>(null)
  const operationPending = useRef(true)
  const mounted = useRef(false)
  const setSettingsRef = useRef(setSettings)

  useEffect(() => {
    setSettingsRef.current = setSettings
  }, [setSettings])
  useEffect(() => {
    onDirectoryBusyChange(directoryPending)
    return () => onDirectoryBusyChange(false)
  }, [directoryPending, onDirectoryBusyChange])

  const applyVersions = useCallback((versions: IDoomVersion[]): void => {
    setDoomVersions(versions)
    setSettingsRef.current((previous) =>
      previous.defaultDoomVersionId &&
      !versions.some((version) => version.id === previous.defaultDoomVersionId)
        ? { ...previous, defaultDoomVersionId: undefined }
        : previous
    )
  }, [])

  useEffect(() => {
    let cancelled = false
    mounted.current = true
    api
      .getDoomVersions()
      .then((versions) => {
        if (!cancelled) applyVersions(versions)
      })
      .catch(() => {
        if (!cancelled)
          setVersionsError(
            t('onboarding.wads.loadFailed', 'Could not load base games. Try scanning again.')
          )
      })
      .finally(() => {
        if (!cancelled) {
          operationPending.current = false
          setIsLoadingVersions(false)
        }
      })
    return () => {
      cancelled = true
      mounted.current = false
    }
  }, [t, applyVersions])

  const restoreEditFocus = (): void => {
    requestAnimationFrame(() => editButtonRef.current?.focus({ preventScroll: true }))
  }
  const cancelPathEdit = (): void => {
    setPathDraft(settings.wadFilesDirectory ?? '')
    setIsEditingPath(false)
    setDirectoryError('')
    restoreEditFocus()
  }
  const refreshVersions = async (): Promise<void> => {
    if (operationPending.current) return
    operationPending.current = true
    setIsLoadingVersions(true)
    setVersionsError('')
    try {
      const versions = await api.getDoomVersions()
      if (mounted.current) applyVersions(versions)
    } catch {
      if (mounted.current)
        setVersionsError(
          t('onboarding.wads.loadFailed', 'Could not load base games. Try scanning again.')
        )
    } finally {
      operationPending.current = false
      if (mounted.current) setIsLoadingVersions(false)
    }
  }

  // A folder is displayed as selected only once the server accepts it. The
  // subsequent inventory refresh can be retried independently if it fails.
  const persistDirectory = async (directory: string): Promise<void> => {
    setDirectoryError('')
    setIsLoadingVersions(true)
    let saved: IAppSettings
    try {
      saved = await persistSettings({ wadFilesDirectory: directory })
    } catch {
      if (mounted.current) {
        setDirectoryError(
          t(
            'onboarding.wads.folderSaveFailed',
            'Could not change the WAD folder. Your previous folder is still selected.'
          )
        )
        setIsLoadingVersions(false)
        requestAnimationFrame(() => pathInputRef.current?.focus())
      }
      return
    }
    const committedDirectory = saved.wadFilesDirectory ?? directory
    if (mounted.current) {
      setSettings((previous) => ({ ...previous, wadFilesDirectory: committedDirectory }))
      setPathDraft(committedDirectory)
      setIsEditingPath(false)
      setVersionsError('')
      setDoomVersions([])
      restoreEditFocus()
    }
    void queryClient.invalidateQueries({ queryKey: ['/api/settings'] })
    void queryClient.invalidateQueries({ queryKey: ['/api/versions'] })
    try {
      const versions = await api.getDoomVersions()
      if (mounted.current) applyVersions(versions)
    } catch {
      if (mounted.current)
        setVersionsError(
          t('onboarding.wads.loadFailed', 'Could not load base games. Try scanning again.')
        )
    } finally {
      if (mounted.current) setIsLoadingVersions(false)
    }
  }
  const applyPathEdit = async (): Promise<void> => {
    if (operationPending.current || !pathDraft.trim()) return
    if (pathDraft === settings.wadFilesDirectory) {
      setIsEditingPath(false)
      restoreEditFocus()
      return
    }
    operationPending.current = true
    setDirectoryPending(true)
    try {
      await persistDirectory(pathDraft)
    } finally {
      operationPending.current = false
      if (mounted.current) setDirectoryPending(false)
    }
  }
  const handleBrowse = async (): Promise<void> => {
    if (operationPending.current) return
    operationPending.current = true
    setDirectoryPending(true)
    setDirectoryError('')
    try {
      const result = await api.showOpenDialog({
        properties: ['openDirectory'],
        defaultPath: settings.wadFilesDirectory
      })
      if (!result.canceled && result.filePaths[0]) await persistDirectory(result.filePaths[0])
    } catch {
      if (mounted.current)
        setDirectoryError(
          t(
            'settings.paths.pickerFailed',
            'Could not open the folder chooser. You can still edit the path manually.'
          )
        )
    } finally {
      operationPending.current = false
      if (mounted.current) setDirectoryPending(false)
    }
  }
  const handleDownloadFreedoom = async (bundle: FreeDoomBundle): Promise<void> => {
    if (operationPending.current || isEditingPath) return
    operationPending.current = true
    setFreedoomDownloading(bundle)
    setLastDownload(bundle)
    setFreedoomError('')
    try {
      const result = await api.downloadFreedoom(bundle)
      if (mounted.current) {
        applyVersions(result.doomVersions)
        setVersionsError('')
      }
      void queryClient.invalidateQueries({ queryKey: ['/api/versions'] })
    } catch (error: unknown) {
      if (mounted.current)
        setFreedoomError(
          error instanceof Error
            ? error.message
            : t('settings.wads.downloadFailed', 'Download failed')
        )
    } finally {
      operationPending.current = false
      if (mounted.current) setFreedoomDownloading(null)
    }
  }
  const busy = directoryPending || isLoadingVersions || freedoomDownloading !== null
  const freeDoomInstalled = ['freedoom1', 'freedoom2'].every((slug) =>
    doomVersions.some((version) => version.slug === slug)
  )

  return (
    <OnboardingStepLayout
      id="wads"
      title={t('onboarding.wads.setupTitle', 'Base games')}
      kicker={t('onboarding.wads.terminal', 'UAC-7 // Data Repositories')}
      description={t(
        'onboarding.wads.setupDescription',
        'Use your Doom game files, or get FreeDoom to start playing for free.'
      )}
      footer={
        <>
          <Button
            type="button"
            variant="ghost"
            data-onboarding-back
            onClick={onBack}
            disabled={busy}
            className="gap-1"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            {t('onboarding.back', 'Back')}
          </Button>
          <Button
            type="button"
            data-onboarding-next
            onClick={onNext}
            disabled={busy || isEditingPath}
            className="settings-apply gap-1 px-6"
          >
            {t('onboarding.next', 'Next')}
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </>
      }
    >
      <section
        className="onboarding-folder"
        data-settings-path="wadFilesDirectory"
        aria-labelledby={`${id}-directory`}
      >
        {isEditingPath ? (
          <>
            <h3 id={`${id}-directory`} className="mb-2 text-sm font-medium">
              {t('onboarding.wads.gameFolder', 'Game folder')}
            </h3>
            <div className="settings-path-input">
              <Input
                ref={pathInputRef}
                autoFocus
                name="wadFilesDirectory"
                value={pathDraft}
                aria-label={t('onboarding.wads.directory', 'WAD Files Directory')}
                aria-invalid={!pathDraft.trim()}
                disabled={directoryPending}
                className="settings-control font-mono"
                onChange={(event) => setPathDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    void applyPathEdit()
                  }
                  if (event.key === 'Escape') {
                    event.preventDefault()
                    event.stopPropagation()
                    cancelPathEdit()
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                data-onboarding-path-done
                disabled={directoryPending || !pathDraft.trim()}
                onClick={() => void applyPathEdit()}
              >
                {t('settings.paths.done', 'Done')}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                data-onboarding-path-cancel
                disabled={directoryPending}
                onClick={cancelPathEdit}
              >
                {t('sourcePorts.form.cancel', 'Cancel')}
              </Button>
            </div>
          </>
        ) : (
          <div className="onboarding-folder-row flex flex-wrap items-center gap-3">
            <div className="onboarding-folder-copy min-w-0 flex-1">
              <h3 id={`${id}-directory`} className="text-sm font-medium">
                {t('onboarding.wads.gameFolder', 'Game folder')}
              </h3>
              <code
                className="mt-1 block truncate text-xs text-app-muted"
                title={settings.wadFilesDirectory}
              >
                {settings.wadFilesDirectory || t('settings.paths.notSet', 'No folder selected')}
              </code>
            </div>
            <div className="onboarding-folder-actions flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                ref={editButtonRef}
                data-settings-path-edit="wadFilesDirectory"
                disabled={busy}
                aria-label={t('settings.paths.edit', 'Edit path')}
                title={t('settings.paths.edit', 'Edit path')}
                onClick={() => {
                  setPathDraft(settings.wadFilesDirectory ?? '')
                  setDirectoryError('')
                  setIsEditingPath(true)
                }}
              >
                <Pencil className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                data-settings-path-browse="wadFilesDirectory"
                disabled={busy}
                aria-label={t('onboarding.wads.browse', 'Browse for WAD files directory')}
                onClick={() => void handleBrowse()}
              >
                {directoryPending ? (
                  <Loader2
                    className="h-4 w-4 animate-spin motion-reduce:animate-none"
                    aria-hidden="true"
                  />
                ) : (
                  <FolderOpen aria-hidden="true" />
                )}
                {t('settings.paths.browseAction', 'Browse…')}
              </Button>
            </div>
          </div>
        )}
        {directoryError && (
          <p className="mt-2 text-xs text-destructive" data-onboarding-path-error role="alert">
            {directoryError}
          </p>
        )}
      </section>

      <details
        ref={freeGamesRef}
        className="onboarding-freegames"
        data-onboarding-freegames
        onKeyDown={(event) => {
          if (event.key !== 'Escape' || !freeGamesRef.current?.open) return
          event.preventDefault()
          event.stopPropagation()
          freeGamesRef.current.open = false
          freeGamesSummaryRef.current?.focus({ preventScroll: true })
        }}
      >
        <summary
          ref={freeGamesSummaryRef}
          className="onboarding-freegames-summary"
          data-onboarding-freegames-trigger
          data-freedoom-installed={freeDoomInstalled}
        >
          <span className="flex min-w-0 items-center gap-2">
            {freedoomDownloading ? (
              <Loader2
                className="h-4 w-4 shrink-0 animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
            ) : freeDoomInstalled ? (
              <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
            ) : (
              <Download className="h-4 w-4 shrink-0" aria-hidden="true" />
            )}
            {freedoomDownloading
              ? t('settings.wads.downloading', 'Downloading…')
              : freeDoomInstalled
                ? t('onboarding.wads.freeDoomReady', 'FreeDoom is installed')
                : t('onboarding.wads.freeDoomOffer', 'No Doom files? Get FreeDoom')}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0" aria-hidden="true" />
        </summary>
        <div className="onboarding-freegames-content">
          <FreeDoomDownloads
            versions={doomVersions}
            downloading={freedoomDownloading}
            error={freedoomError}
            lastDownload={lastDownload}
            onDownload={handleDownloadFreedoom}
            disabled={directoryPending || isLoadingVersions || isEditingPath}
            compact
            showError={false}
          />
          <a
            href="https://uac-soft.online/guides/acquiring-doom/"
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-block text-xs text-app-muted underline underline-offset-2"
          >
            {t('onboarding.wads.acquireDoom', 'Where to get the original Doom games')}
          </a>
        </div>
      </details>
      {freedoomError && (
        <p className="mt-2 text-xs text-destructive" role="alert">
          {freedoomError}
        </p>
      )}

      <section className="onboarding-games" aria-labelledby={`${id}-detected`}>
        <h3 id={`${id}-detected`} className="text-sm font-medium">
          {doomVersions.length > 0
            ? t(
                'onboarding.wads.foundGames',
                '{count, plural, one {We found # base game} other {We found # base games}}',
                { count: doomVersions.length }
              )
            : t('onboarding.wads.yourGames', 'Your base games')}
        </h3>
        {doomVersions.length > 0 && (
          <p className="mt-1 text-xs text-app-muted">
            {t('onboarding.wads.chooseDefault', 'Choose a default game, or leave this for later.')}
          </p>
        )}
        {isLoadingVersions ? (
          <p className="mt-4 flex items-center gap-2 text-xs text-app-muted" role="status">
            <Loader2
              className="h-4 w-4 animate-spin motion-reduce:animate-none"
              aria-hidden="true"
            />
            {t('onboarding.wads.scanning', 'Scanning…')}
          </p>
        ) : versionsError ? (
          <div className="mt-4 space-y-3">
            <p className="text-xs text-destructive" role="alert">
              {versionsError}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-onboarding-wads-retry
              onClick={() => void refreshVersions()}
              disabled={busy}
            >
              <RefreshCw aria-hidden="true" />
              {t('onboarding.wads.scanAgain', 'Scan again')}
            </Button>
          </div>
        ) : doomVersions.length === 0 ? (
          <p className="mt-4 text-xs text-app-muted">
            {t(
              'onboarding.wads.setupEmpty',
              'No games found yet. Choose their folder above, or get FreeDoom.'
            )}
          </p>
        ) : (
          <div className="onboarding-wad-list mt-3" data-settings-resource-list>
            {doomVersions.map((version) => (
              <button
                type="button"
                key={version.id}
                className="settings-resource-row"
                data-settings-resource-id={version.id}
                aria-pressed={settings.defaultDoomVersionId === version.id}
                disabled={busy}
                onClick={() =>
                  setSettings((previous) => ({ ...previous, defaultDoomVersionId: version.id }))
                }
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
          </div>
        )}
      </section>
      {doomVersions.length === 0 && !busy && (
        <p className="settings-info">
          {t(
            'onboarding.optional',
            "You can also do this later in Settings — this step isn't required to continue."
          )}
        </p>
      )}
    </OnboardingStepLayout>
  )
}
