import { useEffect } from 'react'
import { Switch, Route, Router } from 'wouter'
import { useHashLocation } from 'wouter/use-hash-location'
import { queryClient } from './lib/queryClient'
import { Toaster } from '@/components/ui/toaster'
import { useToast } from '@/hooks/use-toast'
import { TooltipProvider } from '@/components/ui/tooltip'

import GamesPage from '@/pages/GamesPage'
import ModDBPage from '@/pages/ModDBPage'
import InstallPage from '@/pages/InstallPage'
import NotFound from '@/pages/not-found'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/api'
import { IAppSettings } from '@shared/schema'

function AppRouter() {
  return (
    <Router hook={useHashLocation}>
      <Switch>
        <Route path="/" component={GamesPage} />
        <Route path="/moddb" component={ModDBPage} />
        <Route path="/install" component={InstallPage} />
        <Route component={NotFound} />
      </Switch>
    </Router>
  )
}

function App() {
  const { toast } = useToast()

  // Global settings query for theme sync
  const { data: settings } = useQuery<IAppSettings>({
    queryKey: ['/api/settings'],
    queryFn: api.getSettings
  })

  // Apply theme globally whenever settings change
  useEffect(() => {
    if (settings?.theme) {
      document.documentElement.classList.remove('dark', 'light')
      document.documentElement.classList.add(settings.theme)
    }
  }, [settings?.theme])

  useEffect(() => {
    // Listen for version updates from the main process
    if (window.api?.onVersionsUpdated) {
      window.api.onVersionsUpdated((data) => {
        console.log('[DEBUG] Versions updated, invalidating query...')
        queryClient.invalidateQueries({ queryKey: ['/api/versions'] })

        // Show toasts if wads were added or removed
        if (data?.added && data.added.length > 0) {
          data.added.forEach((wad: any) => {
            toast({
              title: 'New WAD Found',
              description: `Added "${wad.name}" to your library.`
            })
          })
        }

        if (data?.removed && data.removed.length > 0) {
          data.removed.forEach((wad: any) => {
            toast({
              title: 'WAD Removed',
              description: `Removed "${wad.name}" from your library.`
            })
          })
        }
      })
    }
  }, [toast])

  return (
    <TooltipProvider>
      <Toaster />
      <AppRouter />
    </TooltipProvider>
  )
}

export default App
