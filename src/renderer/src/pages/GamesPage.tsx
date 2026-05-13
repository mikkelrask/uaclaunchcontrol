import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'wouter'
// import { useLocation } from 'wouter';
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import ViewToggle from '@/components/ViewToggle'
import GameCard from '@/components/GameCard'
import GameSettingsModal from '@/components/GameSettingsModal'
import { gameService } from '@/lib/gameService'
import { IProtocol, IDoomVersion } from '@shared/schema'
import { api } from '@/api'

type ViewMode = 'grid' | 'list' | 'detail'

export const GamesPage: React.FC = () => {
  // State
  const [activeVersion, setActiveVersion] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get('version')
  })
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [searchQuery, setSearchQuery] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get('search') || ''
  })
  const [selectedProtocolId, setSelectedProtocolId] = useState<string | null>(null)
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false)

  // Fetch data
  const { data: versions = [] } = useQuery<IDoomVersion[]>({
    queryKey: ['/api/versions'],
    queryFn: api.getDoomVersions
  })

  const { data: protocols = [], isLoading: isModsLoading } = useQuery<IProtocol[]>({
    queryKey: ['/api/protocols', activeVersion, searchQuery],
    queryFn: () => gameService.getProtocols(activeVersion || undefined, searchQuery || undefined),
    enabled: true
  })

  // Event handlers
  const handleVersionSelect = (version: string): void => {
    setActiveVersion(version === activeVersion ? null : version)
    setSearchQuery('') // Clear search query when switching versions
  }

  const handleSearch = (query: string): void => {
    setSearchQuery(query)
    // Don't clear activeVersion - search within current base game filter
  }

  const handleViewModeChange = (mode: ViewMode): void => {
    setViewMode(mode)
  }

  const handleManageGames = (): void => {
    alert('Blue keycard required')
  }

  const handleSettingsClick = (id: string): void => {
    setSelectedProtocolId(id)
    setIsSettingsModalOpen(true)
  }

  const handleCloseSettingsModal = (): void => {
    setIsSettingsModalOpen(false)
    setSelectedProtocolId(null)
  }

  // Filter protocols based on search query
  const filteredProtocols = protocols.filter((p) =>
    searchQuery
      ? (p.title || p.name || '').toLowerCase().includes(searchQuery.toLowerCase())
      : true
  )

  // Find version object for each protocol
  const getVersionForProtocol = (p: IProtocol): IDoomVersion | undefined => {
    return versions.find((v: IDoomVersion) => v.id === p.doomVersionId)
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar activeVersion={activeVersion} onVersionSelect={handleVersionSelect} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header onSearch={handleSearch} enableLiveSearch={true} />

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
                  ? versions.find((v) => v.id === activeVersion)?.name.toUpperCase() ||
                    'Unknown Version'
                  : '// PROTOCOLS'}
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
            ) : filteredProtocols?.length === 0 ? (
              <div className="text-center py-10">
                <h3 className="text-2xl mb-2">
                  <span className="animate-pulse text-accent-highlight font-bold">FAILURE:</span>{' '}
                  Configuration incomplete
                </h3>
                <p className="text-app-secondary">
                  {activeVersion ? (
                    `No mods installed for this base game.`
                  ) : (
                    <>
                      Create launch protocol to start. Click{' '}
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
                {filteredProtocols?.map((p): React.ReactNode => {
                  const version = getVersionForProtocol(p)
                  if (!version) return null

                  return (
                    <GameCard
                      key={p.id}
                      protocol={p}
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
          key={selectedProtocolId || 'new'}
          protocolId={selectedProtocolId}
          isOpen={isSettingsModalOpen}
          onClose={handleCloseSettingsModal}
          doomVersions={versions.filter((v) => !v.ignored)}
        />
      </div>
    </div>
  )
}

export default GamesPage
