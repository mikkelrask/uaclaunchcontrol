import React, { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'wouter'
import { ExternalLink } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
// import { useLocation } from 'wouter';
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import ViewToggle, { type SortField } from '@/components/ViewToggle'
import GameCard from '@/components/GameCard'
import GameDetailCard from '@/components/GameDetailCard'
import GameListCard from '@/components/GameListCard'
import GameSettingsModal from '@/components/GameSettingsModal'
import { gameService } from '@/lib/gameService'
import { IProtocol, IDoomVersion, IModFile, IAppSettings } from '@shared/schema'
import { api } from '@/api'
import type { IRegistryMod } from '@/api'

type ViewMode = 'grid' | 'list' | 'detail'

export const GamesPage: React.FC = () => {
  // State
  const [activeVersion, setActiveVersion] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get('version')
  })
  // Read default view from settings
  const { data: settingsData } = useQuery<IAppSettings>({
    queryKey: ['/api/settings'],
    queryFn: gameService.getSettings
  })

  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const settingsDefaultView = settingsData?.defaultView

  // Sync viewMode from settings once they load
  useEffect(() => {
    if (settingsDefaultView) {
      const id = requestAnimationFrame(() => setViewMode(settingsDefaultView))
      return () => cancelAnimationFrame(id)
    }
    return
  }, [settingsDefaultView])
  // Sort state — persisted to localStorage
  const [sortField, setSortField] = useState<SortField>(() => {
    return (localStorage.getItem('protocolSortField') as SortField) || 'lastPlayed'
  })
  const [sortDesc, setSortDesc] = useState(() => {
    const stored = localStorage.getItem('protocolSortDesc')
    return stored !== null ? stored === 'true' : true
  })

  const handleSortChange = (field: SortField, desc: boolean): void => {
    setSortField(field)
    setSortDesc(desc)
    localStorage.setItem('protocolSortField', field)
    localStorage.setItem('protocolSortDesc', String(desc))
  }

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

  const { data: catalogueHits = [] } = useQuery<IModFile[]>({
    queryKey: ['/api/mod-files/catalog/search', searchQuery],
    queryFn: () => gameService.searchModFileCatalog(searchQuery),
    enabled: searchQuery.length > 0
  })

  const { data: registryHits = [] } = useQuery<IRegistryMod[]>({
    queryKey: ['/api/search/registry', searchQuery],
    queryFn: () => gameService.searchRegistry(searchQuery),
    enabled: searchQuery.length > 0
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

  // Server-side search handles the heavy lifting (title, description, mod file names)
  // This just keeps the protocols passthrough for the sort step below
  let filteredProtocols = protocols

  // Sort based on selected field and direction
  filteredProtocols = filteredProtocols.sort((a, b) => {
    // Secondary sort: alphabetical — used as tiebreaker within groups
    const alphaCmp = (a.title || a.name || '').localeCompare(b.title || b.name || '')

    switch (sortField) {
      case 'lastPlayed': {
        // Build the descending order comparator (most recent first, A→Z):
        //   launched before never-launched,
        //   most recently launched first,
        //   never-launched sorted A→Z.
        const aLaunched = !!a.lastLaunchedAt
        const bLaunched = !!b.lastLaunchedAt
        let cmp: number
        if (aLaunched !== bLaunched) {
          cmp = aLaunched ? -1 : 1
        } else if (aLaunched) {
          cmp = -a.lastLaunchedAt!.localeCompare(b.lastLaunchedAt!)
        } else {
          cmp = alphaCmp
        }
        // sortDesc=true keeps descending; sortDesc=false flips the whole list
        return sortDesc ? cmp : -cmp
      }
      case 'playtime': {
        const playtimeCmp = (a.playtimeSeconds || 0) - (b.playtimeSeconds || 0)
        if (playtimeCmp !== 0) return sortDesc ? -playtimeCmp : playtimeCmp
        // Equal playtime — alphabetical tiebreaker
        return alphaCmp
      }
      case 'alphabetical':
        return sortDesc ? -alphaCmp : alphaCmp
      case 'created': {
        const createdCmp = (a.createdAt || a.id || '').localeCompare(
          b.createdAt || b.id || ''
        )
        if (createdCmp !== 0) return sortDesc ? -createdCmp : createdCmp
        // Same creation time — alphabetical tiebreaker
        return alphaCmp
      }
    }

    return 0
  })

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
            sortField={sortField}
            sortDesc={sortDesc}
            onSortChange={handleSortChange}
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
            ) : searchQuery ? (
              <div className="space-y-10">
                {/* Protocols section */}
                <section>
                  <h2 className="text-lg font-semibold text-app-primary mb-4">
                    Protocols ({filteredProtocols.length} match{filteredProtocols.length !== 1 ? 'es' : ''})
                  </h2>
                  {filteredProtocols.length > 0 ? (
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
                  ) : (
                    <p className="text-app-muted text-sm">No matching protocols</p>
                  )}
                </section>

                {/* UAC Registry section */}
                {registryHits.length > 0 && (
                  <section>
                    <h2 className="text-lg font-semibold text-app-primary mb-4">
                      UAC Registry ({registryHits.length} match{registryHits.length !== 1 ? 'es' : ''})
                    </h2>
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(350px,1fr))] gap-4">
                      {registryHits.map((mod, i) => (
                        <div
                          key={i}
                          className="bg-app-card border border-app rounded-lg p-4"
                        >
                          <p className="text-sm font-medium text-app-primary truncate">
                            {mod.display_name && mod.display_name !== mod.family_name
                              ? `${mod.family_name} — ${mod.display_name}`
                              : mod.family_name}
                          </p>
                          <p className="text-xs text-app-muted mt-1">
                            {mod.version && `v${mod.version}`}
                            {mod.category && (
                              <span className="ml-2 px-1.5 py-0.5 bg-app-primary rounded">
                                {mod.category.replace(/_/g, ' ')}
                              </span>
                            )}
                          </p>
                          {mod.urls?.length > 0 && (
                            <div className="mt-2">
                              {mod.urls.length === 1 ? (
                                <a
                                  href={mod.urls[0].url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 text-xs text-accent-highlight hover:underline"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                  {mod.urls[0].domain || 'Download'}
                                </a>
                              ) : (
                                <Select onValueChange={(url) => window.open(url, '_blank')}>
                                  <SelectTrigger className="h-7 bg-app-secondary border-app text-xs gap-1">
                                    <ExternalLink className="w-3 h-3 text-accent-highlight shrink-0" />
                                    <SelectValue placeholder="Downloads" />
                                  </SelectTrigger>
                                  <SelectContent className="bg-app-secondary border-app text-app-primary">
                                    {mod.urls.map((u, j) => (
                                      <SelectItem key={j} value={u.url} className="text-xs">
                                        {u.domain || 'Download'}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Catalogue section */}
                {catalogueHits.length > 0 && (
                  <section>
                    <h2 className="text-lg font-semibold text-app-primary mb-4">
                      Mod Files in Catalogue ({catalogueHits.length} match{catalogueHits.length !== 1 ? 'es' : ''})
                    </h2>
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(350px,1fr))] gap-4">
                      {catalogueHits.map((file) => (
                        <div
                          key={file.id}
                          className="bg-app-card border border-app rounded-lg p-4 flex items-center justify-between"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-app-primary truncate">
                              {file.name || file.fileName || 'Unnamed'}
                            </p>
                            <p className="text-xs text-app-muted mt-0.5">
                              {file.fileType && (
                                <span className="px-1.5 py-0.5 bg-app-primary rounded text-xs mr-2">
                                  {file.fileType}
                                </span>
                              )}
                              {file.version && `v${file.version}`}
                            </p>
                          </div>
                          <span className="text-xs text-app-muted shrink-0 ml-4">
                            {file.hashValue?.slice(0, 8) || '—'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {filteredProtocols.length === 0 && catalogueHits.length === 0 && (
                  <div className="text-center py-10">
                    <h3 className="text-2xl mb-2">
                      <span className="animate-pulse text-accent-highlight font-bold">NO MATCHES</span>
                    </h3>
                    <p className="text-app-muted">
                      No protocols or mod files found for &quot;{searchQuery}&quot;
                    </p>
                  </div>
                )}
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
            ) : viewMode === 'list' ? (
              <div className="flex flex-col gap-3">
                {filteredProtocols?.map((p): React.ReactNode => {
                  const version = getVersionForProtocol(p)
                  if (!version) return null

                  return (
                    <GameListCard
                      key={p.id}
                      protocol={p}
                      doomVersion={version}
                      onSettingsClick={handleSettingsClick}
                    />
                  )
                })}
              </div>
            ) : viewMode === 'detail' ? (
              <div className="flex flex-col gap-8">
                {filteredProtocols?.map((p): React.ReactNode => {
                  const version = getVersionForProtocol(p)
                  if (!version) return null

                  return (
                    <GameDetailCard
                      key={p.id}
                      protocol={p}
                      doomVersion={version}
                      onSettingsClick={handleSettingsClick}
                    />
                  )
                })}
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
