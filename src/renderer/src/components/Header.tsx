import React, { useState } from 'react'
import { useLocation, Link } from 'wouter'
import { useQuery } from '@tanstack/react-query'
import { Settings, Menu } from 'lucide-react'
import { Input } from '@/components/ui/input'
import SettingsDialog from './SettingsDialog'
import { api } from '@/api'
import doomGuy from '@/assets/guy,doom.webp'

interface HeaderProps {
  onSearch: (query: string, includeAllMods?: boolean) => void // Add a flag to include all mods
}

export const Header: React.FC<HeaderProps> = ({ onSearch }) => {
  const [location] = useLocation()
  const [searchQuery, setSearchQuery] = useState('')
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  const { data: settings } = useQuery({
    queryKey: ['/api/settings'],
    queryFn: api.getSettings
  })

  const databaseLink = settings?.databaseLinkPresets?.[settings?.selectedPresetIndex ?? 0]

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
          <Input
            type="text"
            placeholder="DATABASE QUERY"
            className="bg-app-primary text-app-primary"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </form>
      </div>

      {/* Navigation */}
      <nav className="flex space-x-12 text-xl font-bold">
        <Link href="/">
          <span className={`nav-tab ${location === '/' ? 'active' : ''} cursor-pointer`}>
            LAUNCH
          </span>
        </Link>
        <a
          href={databaseLink?.url ?? 'https://www.moddb.com/games/doom-ii'}
          target="_blank"
          rel="noopener noreferrer"
          className="nav-tab cursor-pointer"
        >
          {databaseLink?.name ?? 'MODDB'}
        </a>
        <Link href="/install">
          <span className={`nav-tab ${location === '/install' ? 'active' : ''} cursor-pointer`}>
            INSTALL
          </span>
        </Link>
      </nav>

      {/* User Profile */}
      <div className="flex items-center space-x-2">
        <div className="flex items-center bg-app-hover rounded-md p-1">
          <div className="w-8 h-8 rounded bg-accent-highlight flex items-center justify-center text-white">
            <img src={doomGuy} alt="Guy, Doom - Space Marine" className="w-8 h-8 rounded"/>
          </div>
          <div className="flex-col">
            <div className="text-xs ml-2 mr-1">Guy, Doom</div>
            <div className="ml-2 text-xs italic text-app-secondary">Marine</div>
          </div>
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
