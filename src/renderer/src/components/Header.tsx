import React, { useState, useRef, useEffect } from 'react'
import { useLocation, Link } from 'wouter'
import { useQuery } from '@tanstack/react-query'
import { Settings, Menu } from 'lucide-react'
import { Input } from '@/components/ui/input'
import SettingsDialog from './SettingsDialog'
import KeyboardShortcutsModal from './KeyboardShortcutsModal'
import AchievementsPopover from './AchievementsPopover'
import { api } from '@/api'
import { getRankTitle } from '@/lib/advancement'
import type { IPlayerData } from '@shared/schema'
import doomGuy from '@/assets/guy,doom.webp'

interface HeaderProps {
  onSearch: (query: string, includeAllMods?: boolean) => void // Add a flag to include all mods
  enableLiveSearch?: boolean // Enable live search (filter as you type)
}

export const Header: React.FC<HeaderProps> = ({ onSearch, enableLiveSearch }) => {
  const [location, setLocation] = useLocation()
  const [searchQuery, setSearchQuery] = useState('')
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const isTypingOnInput = (): boolean => {
    const el = document.activeElement
    return !!(
      el &&
      (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || (el as HTMLElement).isContentEditable)
    )
  }

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === '/' && !isTypingOnInput() && searchInputRef.current) {
        event.preventDefault()
        searchInputRef.current.focus()
      }

      if (
        event.key === 'i' &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        !isTypingOnInput()
      ) {
        setLocation('/install?tab=install')
        window.dispatchEvent(new CustomEvent('uac:switch-tab'))
      }

      if (
        event.key === 'm' &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        !isTypingOnInput()
      ) {
        setLocation('/install?tab=files')
        window.dispatchEvent(new CustomEvent('uac:switch-tab'))
      }

      if (
        event.key === 'w' &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        !isTypingOnInput()
      ) {
        setLocation('/install?tab=wads')
        window.dispatchEvent(new CustomEvent('uac:switch-tab'))
      }

      if (
        event.key === 'l' &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        !isTypingOnInput()
      ) {
        setLocation('/')
      }

      if (event.key === '.' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault()
        setIsSettingsOpen(true)
      }

      if (
        event.key === '?' &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        !isTypingOnInput()
      ) {
        event.preventDefault()
        setIsShortcutsOpen(true)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [setLocation])

  const { data: settings } = useQuery({
    queryKey: ['/api/settings'],
    queryFn: api.getSettings
  })

  const { data: playerData } = useQuery<IPlayerData>({
    queryKey: ['/api/player-data'],
    queryFn: api.getPlayerData,
    staleTime: 30_000
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
            ref={searchInputRef}
            type="text"
            placeholder="DATABASE QUERY /"
            className="bg-app-primary text-app-primary"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              if (enableLiveSearch) {
                onSearch(e.target.value, false)
              }
            }}
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
          <span
            data-tour="install-tab"
            className={`nav-tab ${location === '/install' ? 'active' : ''} cursor-pointer`}
          >
            INSTALL
          </span>
        </Link>
      </nav>

      {/* User Profile */}
      <div className="flex items-center space-x-2">
        <AchievementsPopover>
          <button className="flex items-center bg-app-hover rounded-md p-1 hover:bg-app-hover/80 transition-colors cursor-pointer">
            <div className="w-8 h-8 rounded bg-accent-highlight flex items-center justify-center text-white">
              <img src={doomGuy} alt="Guy, Doom - Space Marine" className="w-8 h-8 rounded" />
            </div>
            <div className="flex-col text-left">
              <div className="text-xs ml-2 mr-1">Guy, Doom</div>
              <div className="ml-2 text-xs italic text-app-secondary">
                {getRankTitle(playerData?.rank ?? settings?.rank)}
              </div>
            </div>
          </button>
        </AchievementsPopover>
        <button
          data-tour="settings-button"
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

      {/* Keyboard Shortcuts Dialog */}
      <KeyboardShortcutsModal isOpen={isShortcutsOpen} onClose={() => setIsShortcutsOpen(false)} />
    </header>
  )
}

export default Header
