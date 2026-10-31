import { getDiagnosticTitle } from '@/lib/i18n/diagnostic-messages'
import { useTranslate } from '@tolgee/react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api'
import { useToast } from '@/hooks/use-toast'
import { dispatchAchievementEvent, buildUnlockToasts } from '@/lib/achievements'
import type { IProtocol } from '@shared/schema'

import { createLogger } from '@shared/logger'

const log = createLogger('useLaunchProtocol')
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
  const { t } = useTranslate('desktop')

  const { toast } = useToast()
  const queryClient = useQueryClient()

  const launchMutation = useMutation({
    mutationFn: api.launchProtocol,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/protocols'] })
      toast({
        title: getDiagnosticTitle('system', 'launch_protocol'),
        description: t('library.launch.launched', '{title} launched.', {
          title: String(protocol.title)
        })
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
              duration: t.duration as 6000 | 8000,
              historyKind: t.historyKind
            })
          }
        })
        .catch((err: unknown) => {
          log.error('Achievement dispatch failed:', err)
        })
    },
    onError: (error) => {
      toast({
        title: getDiagnosticTitle('fatal', 'launch_failed'),
        description: t('library.launch.couldNotLaunch', 'Could not launch {title}: {error}', {
          title: String(protocol.title),
          error: String(error)
        }),
        variant: 'destructive'
      })
    }
  })

  return {
    handleLaunch: () => launchMutation.mutate(protocol.id),
    isPending: launchMutation.isPending
  }
}
