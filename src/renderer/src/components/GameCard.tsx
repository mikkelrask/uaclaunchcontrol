import React from 'react'
import { IProtocol, IDoomVersion } from '@shared/schema'
import { DoomVersionIcon } from '@/icons/DoomIcons'
import { Button } from '@/components/ui/button'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { gameService } from '@/lib/gameService'
import { useToast } from '@/hooks/use-toast'
import { Play, Settings } from 'lucide-react'
import placeholder from '@renderer/assets/placeholder.png'

interface GameCardProps {
  protocol: IProtocol
  doomVersion: IDoomVersion
  onSettingsClick: (id: string) => void
}

export const GameCard: React.FC<GameCardProps> = ({ protocol, doomVersion, onSettingsClick }) => {
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

  // Image fallback path if screenshot not available
  const imagePlaceholder = placeholder

  const truncatedDescription = protocol.description
    ? protocol.description.length > 120
      ? protocol.description.substring(0, 120) + '...'
      : protocol.description
    : 'No description available'

  const displayImagePath = protocol.screenshotPath
    ? protocol.screenshotPath.startsWith('http') ||
      protocol.screenshotPath.includes('/') ||
      protocol.screenshotPath.includes('\\')
      ? protocol.screenshotPath
      : `http://localhost:7666/images/${protocol.screenshotPath}`
    : imagePlaceholder

  return (
    <div className="game-card group cursor-pointer relative border shadow-accent-hightlight/20">
      <div className="aspect-w-16 aspect-h-9 overflow-hidden relative">
        <img
          src={displayImagePath}
          alt={protocol.title}
          className="w-full h-full object-cover  group-hover:zoom-125 group-hover:blur-sm ease-in duration-250"
          onError={(e) => {
            e.currentTarget.src = imagePlaceholder
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent pointer-events-none"></div>

        <div
          className="absolute inset-x-0 bottom-0 px-4 py-4 flex justify-between items-end
                      transform transition-transform duration-300 group-hover:translate-y-[-130px] z-10"
        >
          <h3 className="text-white lg:text-lg font-bold ">{protocol.title}</h3>

          {/* Version icon */}
          <DoomVersionIcon
            version={doomVersion.slug}
            customIcon={doomVersion.icon}
            className="w-7 h-7"
          />
        </div>

        {/* Description panel that appears on hover */}
        <div
          className="absolute inset-0 px-4 py-4 flex items-end justify-center
                      bg-black/60 opacity-0 group-hover:opacity-100
                      transition-opacity duration-300 pt-24 pb-16"
        >
          <p className="text-white text-sm">{truncatedDescription}</p>
        </div>
      </div>

      {/* Action buttons that appear on hover at the bottom */}
      <div
        className="absolute bottom-0 left-0 w-full opacity-0 group-hover:opacity-100
                    transition-opacity duration-300 bg-app-popover/85
                    flex items-center justify-between p-2"
      >
        <Button
          size="sm"
          onClick={handleLaunch}
          disabled={launchMutation.isPending}
          className="bg-accent-highlight hover:opacity-90 text-white"
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
          className="bg-app-primary hover:bg-app-hover text-app-primary"
        >
          <>
            <Settings className="w-4 h-4 mr-1.5" />
            ADJUST
          </>
        </Button>
      </div>
    </div>
  )
}

export default GameCard
