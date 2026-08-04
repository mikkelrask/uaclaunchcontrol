import { useEffect, useState } from 'react'
import { Switch, Route, Router } from 'wouter'
import { useHashLocation } from 'wouter/use-hash-location'
import { queryClient } from './lib/queryClient'
import { Toaster } from '@/components/ui/toaster'
import { useToast } from '@/hooks/use-toast'
import { TooltipProvider } from '@/components/ui/tooltip'

import GamesPage from '@/pages/GamesPage'
import InstallPage from '@/pages/InstallPage'
import NotFound from '@/pages/not-found'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/api'
import { dispatchAchievementEvent, buildUnlockToasts } from '@/lib/achievements'
import type { AchievementEvent } from '@/lib/achievements'
import { IAppSettings, IInstallType, IProtocol } from '@shared/schema'
import { debug } from '@shared/debug'
import { useAutoUpdater } from '@/hooks/useAutoUpdater'
import UpdateModal from '@/components/UpdateModal'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { OnboardingWizard } from '@/components/Onboarding'
import { CrashLogDialog, type CrashLogData } from '@/components/CrashLogDialog'
import { ToastAction } from '@/components/ui/toast'
import { inferCrashHint } from '@/lib/crashHints'

const AppRouter: React.FC = () => {
  return (
    <Router hook={useHashLocation}>
      <Switch>
        <Route path="/" component={GamesPage} />
        <Route path="/install" component={InstallPage} />
        <Route component={NotFound} />
      </Switch>
    </Router>
  )
}

const App: React.FC = () => {
  const { toast } = useToast()
  const { updateInfo } = useAutoUpdater()
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false)
  const [installType, setInstallType] = useState<IInstallType | null>(null)
  const [crashLog, setCrashLog] = useState<CrashLogData | null>(null)

  // Best-effort protocol title lookup from whatever's already cached —
  // avoids an extra fetch just to label the crash log dialog.
  const findProtocolTitle = (protocolId: string): string | undefined => {
    const matches = queryClient.getQueriesData<IProtocol[]>({ queryKey: ['/api/protocols'] })
    for (const [, data] of matches) {
      const found = data?.find((p) => p.id === protocolId)
      if (found) return found.title || found.name
    }
    return undefined
  }

  // Fetch install type on mount
  useEffect(() => {
    api.getInstallType().then(setInstallType).catch(console.error)
  }, [])

  // Global settings query for theme sync
  const { data: settings } = useQuery<IAppSettings>({
    queryKey: ['/api/settings'],
    queryFn: api.getSettings
  })

  // Open modal when "View" is clicked on update toast
  useEffect(() => {
    const handleShowModal = (): void => {
      setIsUpdateModalOpen(true)
    }
    window.addEventListener('show-update-modal', handleShowModal)
    return () => window.removeEventListener('show-update-modal', handleShowModal)
  }, [])

  // Replay a crash log from notification history — dispatched by
  // NotificationsPopover with the payload captured at crash time, since
  // that's the only part of a historical crash notification guaranteed to
  // still be accurate (see the historyAction comment above).
  useEffect(() => {
    const handleShowCrashLog = (event: Event): void => {
      const { detail } = event as CustomEvent<CrashLogData>
      setCrashLog(detail)
    }
    window.addEventListener('show-crash-log-modal', handleShowCrashLog)
    return () => window.removeEventListener('show-crash-log-modal', handleShowCrashLog)
  }, [])

  // Apply theme globally whenever settings change
  useEffect(() => {
    if (settings?.theme) {
      document.documentElement.classList.remove('dark', 'light', 'terminal', 'custom')
      document.documentElement.classList.add(settings.theme)

      // Inject custom theme CSS when 'custom' theme is active
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
    }
  }, [settings?.theme, settings?.customThemeCss])

  // Apply UI scale via Electron's built-in zoom factor
  useEffect(() => {
    api.setZoomFactor((settings?.uiScale ?? 100) / 100)
  }, [settings?.uiScale])

  useEffect(() => {
    // Listen for version updates from the main process
    if (window.api?.onVersionsUpdated) {
      window.api.onVersionsUpdated((data) => {
        debug('[DEBUG] Versions updated, invalidating query...')
        queryClient.invalidateQueries({ queryKey: ['/api/versions'] })

        // Show toasts if wads were added or removed
        if (data?.added && data.added.length > 0) {
          data.added.forEach((wad) => {
            toast({
              title: 'SYSTEM: wad_watcher',
              description: `Found and added "${wad.name}" to your library. To update go to core_settings -> WAD Config`
            })
          })
        }

        if (data?.removed && data.removed.length > 0) {
          data.removed.forEach((wad) => {
            toast({
              title: 'SYSTEM: wad_watcher',
              description: `The system detected that "${wad.name}" was removed from your library. Launch protocols using this will no longer work`
            })
          })
        }
      })
    }
  }, [toast])

  // Listen for game exits (clean or crash) to record playtime and show crash toasts
  useEffect(() => {
    if (window.api?.onGameExited) {
      window.api.onGameExited((data) => {
        if (!data.protocolId) return

        // Record playtime (fire-and-forget)
        if (data.sessionSeconds > 0) {
          api.addPlaytime(data.protocolId, data.sessionSeconds)
          // Refresh protocol and player data so playtime updates in UI
          queryClient.invalidateQueries({ queryKey: ['/api/protocols'] })
          queryClient.invalidateQueries({ queryKey: ['/api/player-data'] })

          // Dispatch PROTOCOL_EXITED achievement event
          dispatchAchievementEvent({
            type: 'PROTOCOL_EXITED',
            protocolId: data.protocolId,
            sessionSeconds: data.sessionSeconds
          })
            .then((result) => {
              const unlockToasts = buildUnlockToasts(result)
              for (const t of unlockToasts) {
                toast({
                  title: t.title,
                  description: t.description,
                  duration: t.duration as 6000 | 8000
                })
              }
            })
            .catch((err) => {
              console.error('Achievement dispatch failed:', err)
            })
        }

        // Dispatch PROTOCOL_CRASHED achievement event — unlocks 'first-crash'
        // on the first non-clean exit. Repeat crashes are a no-op
        // (checkEventQualifiers skips already-unlocked achievements).
        if (!data.clean) {
          dispatchAchievementEvent({
            type: 'PROTOCOL_CRASHED',
            protocolId: data.protocolId
          })
            .then((result) => {
              for (const t of buildUnlockToasts(result)) {
                toast({
                  title: t.title,
                  description: t.description,
                  duration: t.duration as 6000 | 8000
                })
              }
            })
            .catch((err) => {
              console.error('Achievement dispatch failed:', err)
            })
        }

        // Show crash toast for non-clean exits
        if (!data.clean) {
          const codeStr = data.exitCode === null ? 'a signal' : `exit code ${data.exitCode}`
          const hint = inferCrashHint(data.logTail)
          const protocolId = data.protocolId
          const protocolName = findProtocolTitle(protocolId)
          toast({
            title: 'FATAL: process_died',
            description: hint
              ? `${hint} (${codeStr} after ${data.sessionSeconds}s)`
              : `The game process terminated with ${codeStr} after ${data.sessionSeconds}s of playtime.`,
            variant: 'destructive',
            action: (
              <ToastAction
                altText="View Log"
                onClick={() =>
                  setCrashLog({
                    protocolId,
                    protocolName,
                    exitCode: data.exitCode,
                    sessionSeconds: data.sessionSeconds,
                    logTail: data.logTail,
                    logFilePath: data.logFilePath
                  })
                }
              >
                View Log
              </ToastAction>
            ),
            // logFilePath deliberately omitted here — it's opened with
            // { flags: 'w' } and keyed by protocolId, so relaunching the same
            // protocol overwrites it. The historical replay below only ever
            // shows the logTail snapshot captured at crash time.
            historyAction: {
              kind: 'view-crash-log',
              payload: {
                protocolId,
                protocolName,
                exitCode: data.exitCode,
                sessionSeconds: data.sessionSeconds,
                logTail: data.logTail
              }
            }
          })
        }
      })
    }
  }, [toast])

  // Listen for gameplay events detected in the live console stream
  // (reaching a map, activating a cheat) and feed them into the achievement
  // system — pure flavor, no reward attached.
  useEffect(() => {
    if (!window.api?.onGameEventDetected) return
    window.api.onGameEventDetected((data) => {
      if (!data.protocolId) return

      const event: AchievementEvent =
        data.type === 'MAP_REACHED'
          ? { type: 'MAP_REACHED', protocolId: data.protocolId, mapName: data.mapName }
          : { type: 'CHEAT_ACTIVATED', protocolId: data.protocolId, cheat: data.cheat }

      dispatchAchievementEvent(event)
        .then((result) => {
          for (const t of buildUnlockToasts(result)) {
            toast({
              title: t.title,
              description: t.description,
              duration: t.duration as 6000 | 8000
            })
          }
        })
        .catch((err) => {
          console.error('Achievement dispatch failed:', err)
        })
    })
  }, [toast])

  return (
    <TooltipProvider>
      <Toaster />
      <UpdateModal
        isOpen={isUpdateModalOpen}
        onClose={() => setIsUpdateModalOpen(false)}
        updateInfo={updateInfo}
        installType={installType}
      />
      <ErrorBoundary>
        <AppRouter />
      </ErrorBoundary>
      <OnboardingWizard />
      <CrashLogDialog data={crashLog} onClose={() => setCrashLog(null)} />
    </TooltipProvider>
  )
}

export default App
