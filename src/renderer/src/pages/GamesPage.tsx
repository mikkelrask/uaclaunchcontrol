import React, { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'wouter'
// import { useLocation } from 'wouter';
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import ViewToggle from '@/components/ViewToggle'
import GameCard from '@/components/GameCard'
import GameSettingsModal from '@/components/GameSettingsModal'
import { gameService } from '@/lib/gameService'
import { IMod, IDoomVersion } from '../../../shared/schema'
import { api } from '@/api'

type ViewMode = 'grid' | 'list' | 'detail'

export const GamesPage: React.FC = () => {
  // State
  const [activeVersion, setActiveVersion] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedModId, setSelectedModId] = useState<string | null>(null)
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false)

  useEffect(() => {
    // Extract query parameters from the window location
    const params = new URLSearchParams(window.location.search)

    // Handle search query
    const search = params.get('search')
    if (search) {
      setSearchQuery(search)
    } else {
      setSearchQuery('')
    }

    // Handle version filter
    const version = params.get('version')
    if (version) {
      setActiveVersion(version)
    } else {
      setActiveVersion(null)
    }
  }, []) // Only run on initial load

  // Fetch data
  const { data: versions = [] } = useQuery<IDoomVersion[]>({
    queryKey: ['/api/versions'],
    queryFn: api.getDoomVersions
  })

  const { data: mods = [], isLoading: isModsLoading } = useQuery<IMod[]>({
    queryKey: ['/api/mods', activeVersion, searchQuery],
    queryFn: () => gameService.getMods(activeVersion || undefined, searchQuery || undefined),
    enabled: true
  })

  // Event handlers
  const handleVersionSelect = (version: string): void => {
    setActiveVersion(version === activeVersion ? null : version)
    setSearchQuery('') // Clear search query when switching versions
  }

  const handleSearch = (query: string): void => {
    setSearchQuery(query)
    setActiveVersion(null) // Clear active version when searching
  }

  const handleViewModeChange = (mode: ViewMode): void => {
    setViewMode(mode)
  }

  const handleManageGames = (): void => {
    alert('Blue keycard required')
  }

  const handleSettingsClick = (id: string): void => {
    setSelectedModId(id)
    setIsSettingsModalOpen(true)
  }

  const handleCloseSettingsModal = (): void => {
    setIsSettingsModalOpen(false)
    setSelectedModId(null)
  }

  // Filter mods based on search query
  const filteredMods = mods.filter((mod) =>
    searchQuery
      ? (mod.title || mod.name || '').toLowerCase().includes(searchQuery.toLowerCase())
      : true
  )

  // Find version object for each mod
  const getVersionForMod = (mod: IMod): IDoomVersion | undefined => {
    return versions.find((v: IDoomVersion) => v.id === mod.doomVersionId)
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar activeVersion={activeVersion} onVersionSelect={handleVersionSelect} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header onSearch={handleSearch} />

        <div className="flex-1 flex flex-col overflow-hidden min-h-0">
          <ViewToggle
            viewMode={viewMode}
            onViewModeChange={handleViewModeChange}
            onManageGames={handleManageGames}
          />

          <div className="flex-1 overflow-y-auto p-6">
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-app-primary tracking-tight">
                {activeVersion
                  ? versions.find((v) => v.id === activeVersion)?.name || 'Unknown Version'
                  : 'Configurations:'}
              </h1>
              <div className="h-1 w-20 bg-accent-highlight mt-2 rounded-full shadow-[0_0_10px_hsl(var(--accent-highlight)/0.5)]"></div>
            </div>
            {isModsLoading ? (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-6">
                {Array(8)
                  .fill(0)
                  .map((_, i) => (
                    <div key={i} className="h-40 bg-app-card rounded-lg animate-pulse" />
                  ))}
              </div>
            ) : filteredMods?.length === 0 ? (
              <div className="text-center py-10">
                <h3 className="text-2xl mb-2">FAILURE: Configuration incomplete</h3>
                <p className="text-app-secondary">
                  {activeVersion ? (
                    `No mods installed for this version.`
                  ) : (
                    <>
                      Create deployment configuration to start. Click{' '}
                      <Link
                        href="/install"
                        className="text-accent-highlight font-bold hover:underline"
                      >
                        INSTALL
                      </Link>{' '}
                      to get started.
                    </>
                  )}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(350px,1fr))] gap-6">
                {filteredMods?.map((mod) => {
                  const version = getVersionForMod(mod)
                  if (!version) return null

                  return (
                    <GameCard
                      key={mod.id}
                      mod={mod}
                      doomVersion={version}
                      onSettingsClick={handleSettingsClick}
                    />
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <GameSettingsModal
          modId={selectedModId}
          isOpen={isSettingsModalOpen}
          onClose={handleCloseSettingsModal}
          doomVersions={versions.filter((v) => !v.ignored)}
        />
      </div>
    </div>
  )
}

export default GamesPage
