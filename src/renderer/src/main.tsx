import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import { API_BASE } from './api'

async function applyThemeFromSettings() {
  try {
    const response = await fetch(`${API_BASE}/api/settings`)
    const settings = await response.json()
    if (settings?.theme) {
      document.documentElement.classList.remove('dark', 'light')
      document.documentElement.classList.add(settings.theme)
    }
  } catch (error) {
    console.error('Failed to load theme from settings:', error)
  }
}

applyThemeFromSettings().then(() => {
  createRoot(document.getElementById('root')!).render(<App />)
})
