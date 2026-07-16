import React from 'react'
import { IProtocol, IDoomVersion } from '@shared/schema'
import { DoomVersionIcon } from '@/icons/DoomIcons'
import { Button } from '@/components/ui/button'
import { useLaunchProtocol } from '@/hooks/useLaunchProtocol'
import { formatPlaytime, formatDate } from '@/lib/utils'
import placeholder from '@renderer/assets/placeholder.png'
import { Play, Settings, Clock, Hourglass, ExternalLink, FileCode } from 'lucide-react'

interface GameListCardProps {
  protocol: IProtocol
  doomVersion: IDoomVersion
  onSettingsClick: (id: string) => void
}

export const GameListCard: React.FC<GameListCardProps> = ({
  protocol,
  doomVersion,
  onSettingsClick
}) => {
  const { handleLaunch, isPending } = useLaunchProtocol(protocol)

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

  const truncatedDescription = protocol.description
    ? protocol.description.length > 100
      ? protocol.description.substring(0, 100) + '...'
      : protocol.description
    : ''

  const files = protocol.files || []
  const fileCount = files.length
  const linkedFiles = files.filter((f) => f.url).length

  return (
    <div
      className="group relative flex items-stretch gap-0 rounded-lg border border-app/60 bg-app-card
                 transition-all duration-200 ease-in-out
                 hover:border-accent-highlight/50 hover:shadow-[0_0_16px_hsl(var(--accent-highlight)/0.12)]"
    >
      {/* ── Thumbnail ── */}
      <div className="relative w-40 shrink-0 overflow-hidden rounded-l-lg max-sm:hidden">
        <img
          src={displayImagePath}
          alt={protocol.title}
          className="absolute inset-0 w-full h-full object-cover"
          onError={(e) => {
            e.currentTarget.src = placeholder
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/30 to-transparent" />
      </div>

      {/* ── Content ── */}
      <div className="flex flex-1 items-center gap-4 px-5 py-4 min-w-0">
        {/* Icon + text */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <DoomVersionIcon
            version={doomVersion.slug}
            customIcon={doomVersion.icon}
            className="w-10 h-10 shrink-0 rounded-md bg-black/20 p-0.5"
          />

          <div className="min-w-0">
            <h3 className="text-base font-bold text-app-primary truncate">{protocol.title}</h3>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className="text-xs text-app-secondary">{doomVersion.name}</span>
              {protocol.lastLaunchedAt && (
                <span className="text-xs text-app-muted flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatDate(protocol.lastLaunchedAt)}
                </span>
              )}
              {formatPlaytime(protocol.playtimeSeconds) && (
                <span className="text-xs text-app-muted flex items-center gap-1">
                  <Hourglass className="w-3 h-3" />
                  {formatPlaytime(protocol.playtimeSeconds)}
                </span>
              )}
              {fileCount > 0 && (
                <span className="text-xs text-app-muted flex items-center gap-1">
                  <FileCode className="w-3 h-3" />
                  {fileCount} file{fileCount !== 1 ? 's' : ''}
                  {linkedFiles > 0 && (
                    <>
                      {' · '}
                      <ExternalLink className="w-3 h-3 text-accent-highlight/70" />
                      {linkedFiles}
                    </>
                  )}
                </span>
              )}
            </div>
            {truncatedDescription && (
              <p className="text-xs text-app-secondary/80 mt-1 truncate max-w-lg">
                {truncatedDescription}
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            onClick={handleLaunch}
            disabled={isPending}
            className="bg-accent-highlight hover:opacity-90 text-white px-3"
          >
            {isPending ? (
              '...'
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
              </>
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSettings}
            className="bg-app-secondary/60 hover:bg-app-hover text-app-primary border border-app/50 px-2"
          >
            <Settings className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}

export default GameListCard
