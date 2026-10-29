import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import { API_BASE } from './api'
import { queryClient } from './lib/queryClient'
import { QueryClientProvider } from '@tanstack/react-query'
import { createLogger } from '@shared/logger'
import { TolgeeProvider } from '@tolgee/react'
import { applyLanguage, i18n } from './lib/i18n'
const log = createLogger('main')

async function applyThemeFromSettings(): Promise<void> {
  try {
    const response = await fetch(`${API_BASE}/api/settings`)
    const settings = await response.json()
    await applyLanguage(settings?.language)
    if (settings?.theme) {
      document.documentElement.classList.remove('dark', 'light')
      document.documentElement.classList.add(settings.theme)
    }
  } catch (error: unknown) {
    log.error('Failed to load theme from settings:', error)
    await applyLanguage('system')
  }
}

applyThemeFromSettings().then(() => {
  createRoot(document.getElementById('root')!).render(
    <QueryClientProvider client={queryClient}>
      <TolgeeProvider tolgee={i18n}>
        <App />
      </TolgeeProvider>
    </QueryClientProvider>
  )
})
