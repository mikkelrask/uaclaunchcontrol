import React from 'react'
import { IProtocol, IDoomVersion } from '@shared/schema'
import { DoomVersionIcon } from '@/icons/DoomIcons'
import { Button } from '@/components/ui/button'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { gameService } from '@/lib/gameService'
import { useToast } from '@/hooks/use-toast'
import placeholder from '@renderer/assets/placeholder.png'
import { ExternalLink, Clock, Play, Settings, FileCode, User, Tag, Calendar, Terminal } from 'lucide-react'

interface GameDetailCardProps {
  protocol: IProtocol
  doomVersion: IDoomVersion
  onSettingsClick: (id: string) => void
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`

  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

function getFileTypeLabel(type?: string): string {
  const map: Record<string, string> = {
    wad: 'WAD',
    pk3: 'PK3',
    pk7: 'PK7',
    zip: 'ZIP',
    deh: 'DEH',
    bex: 'BEX',
    lmp: 'LMP'
  }
  return type ? map[type.toLowerCase()] || type.toUpperCase() : 'MOD'
}

export const GameDetailCard: React.FC<GameDetailCardProps> = ({
  protocol,
  doomVersion,
  onSettingsClick
}) => {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const launchMutation = useMutation({
    mutationFn: gameService.launchProtocol,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/protocols'] })
      toast({
        title: 'SYSTEM: launch_protocol',
        description: `${protocol.title} launched.`
      })
    },
    onError: (error) => {
      toast({
        title: 'FATAL: launch_failed',
        description: `Could not launch ${protocol.title}: ${error}`,
        variant: 'destructive'
      })
    }
  })

  const handleLaunch = (): void => {
    launchMutation.mutate(protocol.id)
  }

  const handleSettings = (): void => {
    onSettingsClick(protocol.id)
  }

  const displayImagePath = protocol.screenshotPath
    ? protocol.screenshotPath.startsWith('http') ||
      protocol.screenshotPath.includes('/') ||
      protocol.screenshotPath.includes('\\')
      ? protocol.screenshotPath
      : `http://localhost:7666/images/${protocol.screenshotPath}`
    : placeholder

  const files = protocol.files || []

  return (
    <div className="game-detail-card group relative overflow-hidden rounded-lg border border-app/60 transition-all duration-200 ease-in-out hover:border-accent-highlight/50 hover:shadow-[0_0_20px_hsl(var(--accent-highlight)/0.15)]">
      {/* ── Hero / Screenshot ── */}
      <div className="relative aspect-video overflow-hidden">
        <img
          src={displayImagePath}
          alt={protocol.title}
          className="absolute inset-0 w-full h-full object-cover"
          onError={(e) => {
            e.currentTarget.src = placeholder
          }}
        />

        {/* Gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-[hsl(var(--bg-card))] via-[hsl(var(--bg-card)/0.3)] to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/50 to-transparent" />

        {/* Title + badge overlay at bottom */}
        <div className="absolute bottom-0 left-0 right-0 p-6 flex items-end justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <DoomVersionIcon
              version={doomVersion.slug}
              customIcon={doomVersion.icon}
              className="w-12 h-12 shrink-0 rounded-md bg-black/30 p-0.5"
            />
            <div className="min-w-0">
              <h2 className="text-2xl font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] truncate">
                {protocol.title}
              </h2>
              {protocol.lastLaunchedAt && (
                <div className="flex items-center gap-1 mt-1">
                  <Clock className="w-3.5 h-3.5 text-app-muted" />
                  <span className="text-xs text-app-muted">
                    Last played {formatDate(protocol.lastLaunchedAt)}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-2 shrink-0">
            <Button
              size="sm"
              onClick={handleLaunch}
              disabled={launchMutation.isPending}
              className="bg-accent-highlight hover:opacity-90 text-white shadow-lg shadow-accent-highlight/25"
            >
              {launchMutation.isPending ? (
                'LAUNCHING...'
              ) : (
                <>
                  <Play className="w-4 h-4 mr-1.5 fill-current" />
                  LAUNCH
                </>
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSettings}
              className="bg-app-secondary/80 hover:bg-app-hover text-app-primary border border-app"
            >
              <Settings className="w-4 h-4 mr-1.5" />
              ADJUST
            </Button>
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-8">
          {/* ── Left column ── */}
          <div>
            {/* Description */}
            <div className="mb-6">
              <h3 className="text-sm font-bold text-app-muted tracking-widest mb-2">
                // ABOUT
              </h3>
              <p className="text-app-primary leading-relaxed text-sm">
                {protocol.description || 'No description available.'}
              </p>
            </div>

            {/* Files list */}
            {files.length > 0 ? (
              <div>
                <h3 className="text-sm font-bold text-app-muted tracking-widest mb-2">
                  // MOD FILES ({files.length})
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {files.map((f, i) => {
                    const fileName = f.name || f.fileName || 'Unknown file'
                    const hasUrl = !!f.url
                    const tile = (
                      <>
                        <FileCode className="w-3.5 h-3.5 shrink-0 text-accent-highlight" />
                        <span className="truncate text-sm text-app-primary min-w-0">
                          {fileName}
                        </span>
                        <span className="text-xs px-1.5 py-0.5 rounded bg-app-muted/20 text-app-muted uppercase shrink-0">
                          {getFileTypeLabel(f.fileType || f.type)}
                        </span>
                        {f.version && (
                          <span className="text-xs text-app-muted shrink-0">
                            v{f.version}
                          </span>
                        )}
                        {hasUrl && (
                          <ExternalLink className="w-3 h-3 shrink-0 text-accent-highlight/60 ml-auto" />
                        )}
                      </>
                    )

                    return hasUrl ? (
                      <a
                        key={f.id ?? i}
                        href={f.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-3 py-2 rounded border border-app/40 bg-app-secondary/40
                                   hover:border-accent-highlight/40 hover:bg-app-hover transition-colors duration-150"
                      >
                        {tile}
                      </a>
                    ) : (
                      <div
                        key={f.id ?? i}
                        className="flex items-center gap-2 px-3 py-2 rounded border border-app/40 bg-app-secondary/40"
                      >
                        {tile}
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : (
              <div className="text-sm text-app-muted italic">
                No files configured for this protocol.
              </div>
            )}
          </div>

          {/* ── Right column: Metadata panel ── */}
          <div className="space-y-4">
            <div className="bg-app-secondary/50 rounded-lg border border-app/40 p-4 space-y-3">
              <h3 className="text-sm font-bold text-app-muted tracking-widest mb-1">
                // DETAILS
              </h3>

              {protocol.author && (
                <InfoRow label="Author" value={protocol.author} icon={<User className="w-3.5 h-3.5 text-accent-highlight" />} />
              )}
              {protocol.version && (
                <InfoRow label="Version" value={`v${protocol.version}`} icon={<Tag className="w-3.5 h-3.5 text-accent-highlight" />} />
              )}
              {protocol.releaseDate && (
                <InfoRow
                  label="Released"
                  value={new Date(protocol.releaseDate).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                  })}
                  icon={<Calendar className="w-3.5 h-3.5 text-accent-highlight" />}
                />
              )}
              <InfoRow label="Base Game" value={doomVersion.name} icon={<Tag className="w-3.5 h-3.5 text-accent-highlight" />} />
            {protocol.lastLaunchedAt && (
                <InfoRow
                  label="Last Played"
                  value={formatDate(protocol.lastLaunchedAt)}
                  icon={<Clock className="w-3.5 h-3.5 text-accent-highlight" />}
                />
              )}
              {protocol.launchParameters && (
                <InfoRow label="Parameters" value={protocol.launchParameters} icon={<Terminal className="w-3.5 h-3.5 text-accent-highlight" />} mono />
              )}
            </div>

            {protocol.website && (
              <a
                href={protocol.website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-accent-highlight hover:underline
                           bg-app-secondary/50 rounded-lg border border-app/40 p-3"
              >
                <ExternalLink className="w-4 h-4" />
                Visit Website
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Small helper row ── */
function InfoRow({
  label,
  value,
  icon,
  mono
}: {
  label: string
  value: string
  icon?: React.ReactNode
  mono?: boolean
}): React.ReactElement {
  return (
    <div className="flex items-start gap-2">
      {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
      <div className="min-w-0">
        <span className="text-xs text-app-muted block">{label}</span>
        <span
          className={`text-sm text-app-primary block truncate ${mono ? 'font-mono text-xs' : ''}`}
        >
          {value}
        </span>
      </div>
    </div>
  )
}

export default GameDetailCard
