import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api'
import { useToast } from '@/hooks/use-toast'
import { dispatchAchievementEvent, buildUnlockToasts } from '@/lib/achievements'
import type { IProtocol } from '@shared/schema'

/**
 * Shared launch flow for every protocol card view (grid/GameCard,
 * detail/GameDetailCard, list/GameListCard): fire the launch, invalidate the
 * protocol list, toast success/failure, and dispatch the PROTOCOL_LAUNCHED
 * achievement event. Previously GameListCard's launch skipped the
 * achievement dispatch entirely — an inconsistency from copy-pasted
 * mutations drifting apart, not an intentional per-view difference.
 */
export function useLaunchProtocol(protocol: IProtocol): {
  handleLaunch: () => void
  isPending: boolean
} {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const launchMutation = useMutation({
    mutationFn: api.launchProtocol,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/protocols'] })
      toast({
        title: 'SYSTEM: launch_protocol',
        description: `${protocol.title} launched.`
      })
      dispatchAchievementEvent({
        type: 'PROTOCOL_LAUNCHED',
        protocolId: protocol.id
      })
        .then((result) => {
          const unlockToasts = buildUnlockToasts(result)
          for (const t of unlockToasts) {
            toast({
              title: t.title,
              description: t.description,
              duration: t.duration as 6000 | 8000
            })
          }
        })
        .catch((err: unknown) => {
          console.error('Achievement dispatch failed:', err)
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

  return {
    handleLaunch: () => launchMutation.mutate(protocol.id),
    isPending: launchMutation.isPending
  }
}
