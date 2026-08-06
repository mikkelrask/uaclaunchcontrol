import React, { useState, useRef, useEffect } from 'react'
import { useLocation, Link } from 'wouter'
import { useQuery } from '@tanstack/react-query'
import { Settings, Menu, Keyboard, FileText, Info, GraduationCap, Bell } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetClose } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import SettingsDialog from './SettingsDialog'
import KeyboardShortcutsModal from './KeyboardShortcutsModal'
import AchievementsPopover from './AchievementsPopover'
import NotificationsPopover from './NotificationsPopover'
import { api } from '@/api'
import { getRankTitle } from '@/lib/advancement'
import { useNotifications } from '@/lib/notifications'
import type { IPlayerData } from '@shared/schema'
import marine from '@/assets/marine.webp'
import sergeant from '@/assets/sergeant.webp'
import doomSlayer from '@/assets/DoomSlayer.webp'

import { createLogger } from '@shared/logger'

const log = createLogger('Headerx')
const RANK_IMAGES: Record<string, string> = {
  marine,
  sergeant,
  slayer: doomSlayer
}

const rankImage = (rank?: string): string => RANK_IMAGES[rank ?? ''] ?? marine

interface HeaderProps {
  onSearch: (query: string, includeAllMods?: boolean) => void // Add a flag to include all mods
  enableLiveSearch?: boolean // Enable live search (filter as you type)
}

export const Header: React.FC<HeaderProps> = ({ onSearch, enableLiveSearch }) => {
  const [location, setLocation] = useLocation()
  const [searchQuery, setSearchQuery] = useState('')
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
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

  const { data: appVersion } = useQuery({
    queryKey: ['/api/version'],
    queryFn: api.getVersion
  })

  const { data: playerData } = useQuery<IPlayerData>({
    queryKey: ['/api/player-data'],
    queryFn: api.getPlayerData,
    staleTime: 30_000
  })

  const { unreadCount } = useNotifications()

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
          <span className={`nav-tab ${location === '/install' ? 'active' : ''} cursor-pointer`}>
            INSTALL
          </span>
        </Link>
      </nav>

      {/* User Profile */}
      <div className="flex items-center space-x-2">
        <AchievementsPopover>
          <button className="flex items-center bg-app-hover rounded-md p-1 hover:bg-app-hover/80 transition-colors cursor-pointer">
            <div className="w-8 h-8 rounded bg-accent-highlight flex items-center justify-center text-white">
              <img
                src={rankImage(playerData?.rank ?? settings?.rank)}
                alt="Guy, Doom - Space Marine"
                className="w-8 h-8 rounded"
              />
            </div>
            <div className="flex-col text-left">
              <div className="text-xs ml-2 mr-1">Guy, Doom</div>
              <div className="ml-2 text-xs italic text-app-secondary">
                {getRankTitle(playerData?.rank ?? settings?.rank)}
              </div>
            </div>
          </button>
        </AchievementsPopover>
        <NotificationsPopover>
          <button className="relative w-8 h-8 bg-app-primary rounded flex items-center justify-center hover:bg-app-hover">
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-destructive rounded-full border-2 border-app-primary" />
            )}
          </button>
        </NotificationsPopover>
        <button
          className="w-8 h-8 bg-app-primary rounded flex items-center justify-center hover:bg-app-hover"
          onClick={openSettings}
        >
          <Settings className="h-5 w-5" />
        </button>
        <button
          className="w-8 h-8 bg-app-primary rounded flex items-center justify-center hover:bg-app-hover cursor-pointer"
          onClick={() => setIsDrawerOpen(true)}
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {/* Settings Dialog */}
      <SettingsDialog isOpen={isSettingsOpen} onClose={closeSettings} />

      {/* Keyboard Shortcuts Dialog */}
      <KeyboardShortcutsModal isOpen={isShortcutsOpen} onClose={() => setIsShortcutsOpen(false)} />

      {/* Hamburger Drawer */}
      <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
        <SheetContent side="left" className="bg-app-secondary border-app text-app-primary w-80">
          <SheetHeader className="mb-6">
            <SheetTitle className="text-app-primary tracking-widest text-sm lowercase">
              command_center
            </SheetTitle>
          </SheetHeader>

          <nav className="flex flex-col gap-2">
            <SheetClose asChild>
              <Button
                variant="ghost"
                className="justify-start gap-3 text-app-primary hover:bg-app-hover h-12 px-4"
                onClick={() => {
                  setIsDrawerOpen(false)
                  setTimeout(() => setIsShortcutsOpen(true), 150)
                }}
              >
                <Keyboard className="h-5 w-5 text-app-muted" />
                <span>Keyboard Shortcuts</span>
              </Button>
            </SheetClose>

            <SheetClose asChild>
              <Button
                variant="ghost"
                className="justify-start gap-3 text-app-primary hover:bg-app-hover h-12 px-4"
                onClick={() => {
                  setIsDrawerOpen(false)
                  setTimeout(() => window.dispatchEvent(new Event('show-update-modal')), 150)
                }}
              >
                <FileText className="h-5 w-5 text-app-muted" />
                <span>Release Notes</span>
              </Button>
            </SheetClose>

            <SheetClose asChild>
              <Button
                variant="ghost"
                className="justify-start gap-3 text-app-primary hover:bg-app-hover h-12 px-4"
                onClick={() => {
                  setIsDrawerOpen(false)
                  api.reenableFirstRun().catch((err: unknown) => log.error(err))
                  setTimeout(
                    () => window.dispatchEvent(new CustomEvent('uac:replay-onboarding')),
                    150
                  )
                }}
              >
                <GraduationCap className="h-5 w-5 text-app-muted" />
                <span>Guided Tour</span>
              </Button>
            </SheetClose>

            <hr className="border-app my-2" />

            <div className="px-4 py-3">
              <div className="flex items-center gap-3 mb-3">
                <Info className="h-5 w-5 text-app-muted" />
                <span className="text-sm font-semibold text-app-primary">About</span>
              </div>
              <div className="space-y-2 text-xs text-app-muted ml-8">
                <p>UAC Launch Control</p>
                <p className="font-mono">v{appVersion}</p>
                <p>Source port manager and mod launcher for Doom-engine games.</p>
                <div className="pt-2 flex flex-col gap-1">
                  <a
                    href="https://github.com/mikkelrask/uaclaunchcontrol"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent-highlight hover:underline"
                  >
                    GitHub Repository
                  </a>
                  <a
                    href="https://uac-soft.online"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent-highlight hover:underline"
                  >
                    uac-soft.online
                  </a>
                </div>
              </div>
            </div>
          </nav>
        </SheetContent>
      </Sheet>
    </header>
  )
}

export default Header
