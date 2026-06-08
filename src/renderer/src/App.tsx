import { useEffect, useState } from 'react'
import { Switch, Route, Router } from 'wouter'
import { useHashLocation } from 'wouter/use-hash-location'
import { queryClient } from './lib/queryClient'
import { Toaster } from '@/components/ui/toaster'
import { useToast } from '@/hooks/use-toast'
import { ToastAction } from '@/components/ui/toast'
import { TooltipProvider } from '@/components/ui/tooltip'

import GamesPage from '@/pages/GamesPage'
import InstallPage from '@/pages/InstallPage'
import NotFound from '@/pages/not-found'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/api'
import { dispatchAchievementEvent, buildUnlockToasts } from '@/lib/achievements'
import { IAppSettings, IInstallType } from '@shared/schema'
import { useAutoUpdater } from '@/hooks/useAutoUpdater'
import UpdateModal from '@/components/UpdateModal'
import { ErrorBoundary } from '@/components/ErrorBoundary'

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

  useEffect(() => {
    // Listen for version updates from the main process
    if (window.api?.onVersionsUpdated) {
      window.api.onVersionsUpdated((data) => {
        console.log('[DEBUG] Versions updated, invalidating query...')
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
          // Refresh protocol data so playtime/lastLaunchedAt update in UI
          queryClient.invalidateQueries({ queryKey: ['/api/protocols'] })

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

        // Show crash toast for non-clean exits
        if (!data.clean) {
          const codeStr = data.exitCode === null ? 'a signal' : `exit code ${data.exitCode}`
          toast({
            title: 'Game Crashed',
            description: `The game process terminated with ${codeStr} after ${data.sessionSeconds}s of playtime. Check your mods and configuration for compatibility issues.`,
            variant: 'destructive'
          })
        }
      })
    }
  }, [toast])

  // Migration check on startup
  useEffect(() => {
    const checkAndPromptMigration = async (): Promise<void> => {
      try {
        const info = await api.checkMigration()
        if (info.found && info.path) {
          toast({
            title: 'SYSTEM: legacy_check',
            description: `Legacy configuration directory located in ${info.path}. Would you like to import it to the new config-directory?`,
            duration: 10000,
            action: (
              <ToastAction
                altText="Import Data"
                onClick={async () => {
                  try {
                    const result = await api.executeMigration(info.path!)
                    if (result.success) {
                      toast({
                        title: 'SYSTEM: migration_success',
                        description: 'Your settings has been migrated and moved to ~/.config/uac/.'
                      })
                      queryClient.invalidateQueries()
                    } else {
                      toast({
                        title: 'Import Failed',
                        description: 'Something went wrong during migration.',
                        variant: 'destructive'
                      })
                    }
                  } catch {
                    toast({
                      title: 'Warning - System failure',
                      description: 'Failed to execute migration.',
                      variant: 'destructive'
                    })
                  }
                }}
              >
                Import
              </ToastAction>
            )
          })
        }
      } catch (err) {
        console.error('Migration check failed:', err)
      }
    }

    checkAndPromptMigration()
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
    </TooltipProvider>
  )
}

export default App
