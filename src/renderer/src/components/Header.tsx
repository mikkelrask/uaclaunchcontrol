import React, { useState } from 'react'
import { useLocation, Link } from 'wouter'
import { Settings, Menu } from 'lucide-react'
import SettingsDialog from './SettingsDialog'

interface HeaderProps {
  onSearch: (query: string, includeAllMods?: boolean) => void // Add a flag to include all mods
}

export const Header: React.FC<HeaderProps> = ({ onSearch }) => {
  const [location] = useLocation()
  const [searchQuery, setSearchQuery] = useState('')
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  const handleSearch = (e: React.FormEvent): void => {
    e.preventDefault()
    onSearch(searchQuery, true)
  }

  const openSettings = (): void => {
    setIsSettingsOpen(true)
  }

  const closeSettings = (): void => {
    setIsSettingsOpen(false)
  }

  return (
    <header className="bg-app-secondary p-4 flex items-center justify-between border-b border-app shrink-0">
      {/* Search Bar */}
      <div className="relative w-96">
        <form onSubmit={handleSearch}>
          <input
            type="text"
            placeholder="QUERY DATABASE"
            className="w-full bg-app-primary text-app-primary px-4 py-2 rounded focus:outline-none focus:ring-2 focus:ring-accent-highlight"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </form>
      </div>

      {/* Navigation */}
      <nav className="flex space-x-12 text-xl font-bold font-sans">
        <Link href="/">
          <span className={`nav-tab ${location === '/' ? 'active' : ''} cursor-pointer`}>
            GAMES
          </span>
        </Link>
        <a
          href="https://www.moddb.com/games/doom-ii"
          target="_blank"
          rel="noopener noreferrer"
          className="nav-tab cursor-pointer"
        >
          MODDB
        </a>
        <Link href="/install">
          <span className={`nav-tab ${location === '/install' ? 'active' : ''} cursor-pointer`}>
            INSTALL
          </span>
        </Link>
      </nav>

      {/* User Profile */}
      <div className="flex items-center space-x-2">
        <div className="flex items-center bg-app-primary rounded-md p-1">
          <div className="w-8 h-8 rounded bg-accent-highlight flex items-center justify-center text-white">
            R
          </div>
          <span className="text-base font-sans ml-2 mr-1">ROBOTEARS</span>
          <span className="text-xs text-app-secondary">LVL 71</span>
        </div>
        <button
          className="w-8 h-8 bg-app-primary rounded flex items-center justify-center hover:bg-app-hover"
          onClick={openSettings}
        >
          <Settings className="h-5 w-5" />
        </button>
        <button className="w-8 h-8 bg-app-primary rounded flex items-center justify-center hover:bg-app-hover">
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {/* Settings Dialog */}
      <SettingsDialog isOpen={isSettingsOpen} onClose={closeSettings} />
    </header>
  )
}

export default Header
