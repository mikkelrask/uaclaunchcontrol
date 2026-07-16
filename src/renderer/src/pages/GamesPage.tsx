import React, { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'wouter'
import { ExternalLink, Download, Loader2 } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ZipImportModal } from '@/components/ZipImportModal'
import type { ZipScanResult } from '@/types/zipImport'
// import { useLocation } from 'wouter';
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import ViewToggle, { type SortField } from '@/components/ViewToggle'
import GameCard from '@/components/GameCard'
import GameDetailCard from '@/components/GameDetailCard'
import GameListCard from '@/components/GameListCard'
import GameSettingsModal from '@/components/GameSettingsModal'
import { IProtocol, IDoomVersion, IModFile, IAppSettings } from '@shared/schema'
import { api } from '@/api'
import { useToast } from '@/hooks/use-toast'
import type { IRegistryMod, IIdgamesMod } from '@/api'
import { REGISTRY_API_URL } from '@shared/registry-config'

type ViewMode = 'grid' | 'list' | 'detail'

export const GamesPage: React.FC = () => {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  // State
  const [activeVersion, setActiveVersion] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get('version')
  })
  // Read default view from settings
  const { data: settingsData } = useQuery<IAppSettings>({
    queryKey: ['/api/settings'],
    queryFn: api.getSettings
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

  // idgames download state
  const [isZipModalOpen, setIsZipModalOpen] = useState(false)
  const [zipScanResult, setZipScanResult] = useState<ZipScanResult | null>(null)
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [importFile, setImportFile] = useState<{
    downloadPath: string
    fileName: string
    name: string
    hash: string
  } | null>(null)
  const [importing, setImporting] = useState(false)

  // Fetch data
  const { data: versions = [] } = useQuery<IDoomVersion[]>({
    queryKey: ['/api/versions'],
    queryFn: api.getDoomVersions
  })

  const { data: protocols = [], isLoading: isModsLoading } = useQuery<IProtocol[]>({
    queryKey: ['/api/protocols', activeVersion, searchQuery],
    queryFn: () => api.getProtocols(activeVersion || undefined, searchQuery || undefined),
    enabled: true
  })

  const { data: catalogueHits = [] } = useQuery<IModFile[]>({
    queryKey: ['/api/mod-files/catalog/search', searchQuery],
    queryFn: () => api.searchModFileCatalog(searchQuery),
    enabled: searchQuery.length > 0
  })

  const { data: registryHits = [] } = useQuery<IRegistryMod[]>({
    queryKey: ['/api/search/registry', searchQuery],
    queryFn: () => api.searchRegistry(searchQuery),
    enabled: searchQuery.length > 0
  })

  const { data: idgamesHits = [] } = useQuery<IIdgamesMod[]>({
    queryKey: ['/api/search/idgames', searchQuery],
    queryFn: () => api.searchIdgames(searchQuery),
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

  const handleIdgamesDownload = async (url: string, mod: IIdgamesMod): Promise<void> => {
    const link = mod.urls.find((u) => u.url === url)
    if (!link) return

    if (link.type === 'info') {
      window.open(url, '_blank')
      return
    }

    toast({
      title: 'SYSTEM: transfer_started',
      description: `${mod.title} — downloading from ${link.domain}`
    })

    try {
      const result = await api.downloadIdgamesFile(url, mod.title)
      toast({
        title: 'SYSTEM: transfer_complete',
        description: `${result.fileName} — processing…`
      })

      const ext = result.fileName.split('.').pop()?.toLowerCase()

      if (ext === 'zip') {
        const scan = (await api.unzipScan(result.downloadPath)) as ZipScanResult
        setZipScanResult(scan)
        setIsZipModalOpen(true)
      } else if (ext === 'rar') {
        const scan = (await api.unrarScan(result.downloadPath)) as ZipScanResult
        setZipScanResult(scan)
        setIsZipModalOpen(true)
      } else {
        setImportFile(result)
        setIsImportModalOpen(true)
        // Try registry lookup for auto-fill
        if (result.hash) {
          try {
            const settings = await api.getSettings()
            if (settings.registryLookupEnabled) {
              const registryData = await api.lookupMod(result.hash, REGISTRY_API_URL)
              if (registryData && registryData.family_name) {
                setImportFile((prev) => (prev ? { ...prev, name: registryData.family_name } : prev))
              }
            }
          } catch {
            // registry offline, keep idgames name
          }
        }
      }
    } catch {
      toast({
        title: 'FATAL: transfer_failed',
        description: 'Could not download from idgames',
        variant: 'destructive'
      })
    }
  }

  const handleImportSingleFile = async (): Promise<void> => {
    if (!importFile) return
    setImporting(true)
    try {
      await api.importIdgamesSingleFile({
        tempPath: importFile.downloadPath,
        fileName: importFile.fileName,
        name: importFile.name,
        hashValue: importFile.hash
      })
      toast({
        title: 'SYSTEM: import_success',
        description: `${importFile.fileName} added to mods folder`
      })
      setIsImportModalOpen(false)
      setImportFile(null)
      queryClient.invalidateQueries()
    } catch {
      toast({
        title: 'FATAL: import_failed',
        description: 'Could not import the file',
        variant: 'destructive'
      })
    } finally {
      setImporting(false)
    }
  }

  const handleViewModeChange = (mode: ViewMode): void => {
    setViewMode(mode)
  }

  const handleManageGames = (): void => {
    toast({
      title: 'SYSTEM: access_denied',
      description: 'Blue keycard required. Report to your commanding officer.'
    })
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
        const createdCmp = (a.createdAt || a.id || '').localeCompare(b.createdAt || b.id || '')
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
                    Protocols ({filteredProtocols.length} match
                    {filteredProtocols.length !== 1 ? 'es' : ''})
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
                      UAC Registry ({registryHits.length} match
                      {registryHits.length !== 1 ? 'es' : ''})
                    </h2>
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(350px,1fr))] gap-4">
                      {registryHits.map((mod, i) => (
                        <div key={i} className="bg-app-card border border-app rounded-lg p-4">
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

                {/* idgames Archive section */}
                {idgamesHits.length > 0 && (
                  <section>
                    <h2 className="text-lg font-semibold text-app-primary mb-4">
                      idgames Archive ({idgamesHits.length} match
                      {idgamesHits.length !== 1 ? 'es' : ''})
                    </h2>
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(350px,1fr))] gap-4">
                      {idgamesHits.map((mod) => (
                        <div key={mod.id} className="bg-app-card border border-app rounded-lg p-4">
                          <p className="text-sm font-medium text-app-primary truncate">
                            {mod.title}
                          </p>
                          <p className="text-xs text-app-muted mt-1">
                            {mod.author && <span>by {mod.author}</span>}
                            {mod.size > 0 && (
                              <span className="ml-2 text-app-muted">
                                {(mod.size / 1024).toFixed(0)} KB
                              </span>
                            )}
                            {mod.rating > 0 && (
                              <span className="ml-2 px-1.5 py-0.5 bg-app-primary rounded text-xs">
                                {'\u2605'} {mod.rating.toFixed(1)} ({mod.votes})
                              </span>
                            )}
                          </p>
                          {mod.description && (
                            <p className="text-xs text-app-muted mt-2 line-clamp-2">
                              {mod.description}
                            </p>
                          )}
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
                              <Select onValueChange={(url) => handleIdgamesDownload(url, mod)}>
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
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Catalogue section */}
                {catalogueHits.length > 0 && (
                  <section>
                    <h2 className="text-lg font-semibold text-app-primary mb-4">
                      Mod Files in Catalogue ({catalogueHits.length} match
                      {catalogueHits.length !== 1 ? 'es' : ''})
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
                      <span className="animate-pulse text-accent-highlight font-bold">
                        NO MATCHES
                      </span>
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

        {/* idgames Zip import modal */}
        <ZipImportModal
          open={isZipModalOpen}
          onOpenChange={setIsZipModalOpen}
          scanResult={zipScanResult}
          onImportComplete={() => {
            setIsZipModalOpen(false)
            setZipScanResult(null)
            queryClient.invalidateQueries()
          }}
        />

        {/* Single file import modal */}
        <Dialog open={isImportModalOpen} onOpenChange={setIsImportModalOpen}>
          <DialogContent className="bg-app-primary shadow-2xl border-app max-w-md">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-accent-highlight/10 rounded-md">
                <Download className="w-5 h-5 text-accent-highlight" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold tracking-tight text-app-primary lowercase">
                  import_mod_file
                </DialogTitle>
                <DialogDescription className="text-xs font-semibold font-mono text-app-muted uppercase tracking-widest opacity-80">
                  idgames Archive
                </DialogDescription>
              </div>
            </div>

            {importFile && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>File Name</Label>
                  <Input
                    value={importFile.fileName}
                    readOnly
                    className="bg-app-secondary border-app text-xs"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    value={importFile.name}
                    onChange={(e) =>
                      setImportFile((prev) => (prev ? { ...prev, name: e.target.value } : prev))
                    }
                    placeholder="Pretty name for the mod"
                    className="bg-app-secondary border-app"
                  />
                </div>
                {importFile.hash && (
                  <div className="space-y-2">
                    <Label>MD5 Hash</Label>
                    <Input
                      value={importFile.hash}
                      readOnly
                      className="bg-app-secondary border-app text-xs font-mono"
                    />
                  </div>
                )}
              </div>
            )}

            <DialogFooter className="pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setIsImportModalOpen(false)
                  setImportFile(null)
                }}
                className="bg-app-secondary"
              >
                Cancel
              </Button>
              <Button
                onClick={handleImportSingleFile}
                disabled={importing}
                className="bg-accent-highlight"
              >
                {importing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    Importing…
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-1" />
                    Import to Mods
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}

export default GamesPage
