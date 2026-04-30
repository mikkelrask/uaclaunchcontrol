import React from 'react'
import { IMod, IDoomVersion } from '@shared/schema'
import { DoomVersionIcon } from '@/icons/DoomIcons'
import { useMutation } from '@tanstack/react-query'
import { gameService } from '@/lib/gameService'
import { useToast } from '@/hooks/use-toast'
import placeholder from '@renderer/assets/placeholder.png'

interface GameCardProps {
  mod: IMod
  doomVersion: IDoomVersion
  onSettingsClick: (id: string) => void
}

export const GameCard: React.FC<GameCardProps> = ({ mod, doomVersion, onSettingsClick }) => {
  const { toast } = useToast()
  // const queryClient = useQueryClient();

  const launchMutation = useMutation({
    mutationFn: gameService.launchMod,
    onSuccess: () => {
      toast({
        title: 'SYSTEM: launch_protocol',
        description: `${mod.title} is now running.`
      })
    },
    onError: (error) => {
      toast({
        title: 'FATAL: launch_failed',
        description: `Could not launch ${mod.title}: ${error}`,
        variant: 'destructive'
      })
    }
  })

  const handleLaunch = (): void => {
    launchMutation.mutate(mod.id)
  }

  const handleSettings = (): void => {
    onSettingsClick(mod.id)
  }

  // Image fallback path if screenshot not available
  const imagePlaceholder = placeholder

  // Truncate description to a reasonable length for hover display
  const truncatedDescription = mod.description
    ? mod.description.length > 120
      ? mod.description.substring(0, 120) + '...'
      : mod.description
    : 'No description available'

  const displayImagePath = mod.screenshotPath
    ? mod.screenshotPath.startsWith('http') ||
      mod.screenshotPath.includes('/') ||
      mod.screenshotPath.includes('\\')
      ? mod.screenshotPath
      : `http://localhost:7666/images/${mod.screenshotPath}`
    : imagePlaceholder

  return (
    <div className="game-card group cursor-pointer relative border shadow-accent-hightlight/20">
      {/* Using aspect-ratio to enforce 16:9 ratio for screenshots */}
      <div className="aspect-w-16 aspect-h-9 overflow-hidden relative">
        <img
          src={displayImagePath}
          alt={mod.title}
          className="w-full h-full object-cover group-hover:hue-rotate-90"
          onError={(e) => {
            e.currentTarget.src = imagePlaceholder
          }}
        />
        {/* Dark gradient overlay - always visible */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent pointer-events-none"></div>

        {/* Game title and icon container - starts at the bottom */}
        <div
          className="absolute inset-x-0 bottom-0 px-4 py-4 flex justify-between items-end
                      transform transition-transform duration-300 group-hover:translate-y-[-130px] z-10"
        >
          {/* Game title */}
          <h3 className="text-white lg:text-lg font-bold ">{mod.title}</h3>

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
        <button
          type="button"
          className="px-2 py-1 text-white rounded bg-accent-highlight hover:opacity-90 transition-colors"
          onClick={handleLaunch}
          disabled={launchMutation.isPending}
        >
          {launchMutation.isPending ? 'LAUNCHING...' : ' LAUNCH'}
        </button>
        <button
          type="button"
          className="px-4 py-1 text-app-primary rounded bg-app-primary hover:bg-app-hover transition-colors"
          onClick={handleSettings}
        >
          ADJUST
        </button>
      </div>
    </div>
  )
}

export default GameCard
