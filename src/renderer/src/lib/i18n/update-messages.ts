import { getTranslate } from './index'
import type { IUpdateInfo } from '@shared/schema'
import type { NotificationAction, NotificationKind } from '@/lib/notifications'

type UpdateAction = Extract<NotificationAction, { kind: 'view-update' | 'restart-update' }>
export interface UpdateNotice {
  title: string
  description: string
  historyKind?: NotificationKind
  variant?: 'destructive'
  historyAction?: UpdateAction
  actionLabel?: string
  actionAltText?: string
}

/** Resolve at event time so the long-lived IPC subscription always uses the active language. */
export function getUpdateNotice(data: IUpdateInfo): UpdateNotice | null {
  const { t } = getTranslate('desktop')
  const version = data.version || t('updates.versionUnknown', 'unknown')
  switch (data.status) {
    case 'available':
      return {
        historyKind: 'update',
        title: t('updates.notice.availableTitle', 'SYSTEM: Update Pending'),
        description: t(
          'updates.notice.available',
          'Version {version} is now available. Click to view release notes.',
          { version }
        ),
        historyAction: { kind: 'view-update' },
        actionLabel: t('updates.action.view', 'View'),
        actionAltText: t('common.actions.viewUpdate', 'View Update')
      }
    case 'not-available':
      return data.isManual
        ? {
            title: t('updates.notice.currentTitle', 'SYSTEM: Up-to-Date'),
            description: t('updates.notice.current', 'Latest version ({version}) is installed.', {
              version
            })
          }
        : null
    case 'downloaded':
      return {
        historyKind: 'update',
        title: t('updates.notice.readyTitle', 'SYSTEM: Update Ready'),
        description: t(
          'updates.notice.ready',
          'Version {version} has been downloaded. Click Restart to apply.',
          { version }
        ),
        historyAction: { kind: 'restart-update' },
        actionLabel: t('updates.action.restart', 'Restart'),
        actionAltText: t('common.actions.restartNow', 'Restart Now')
      }
    case 'error':
      return {
        historyKind: 'update',
        title: t('updates.notice.errorTitle', 'SYSTEM: Update failure'),
        variant: 'destructive',
        description: data.error
          ? t('updates.notice.errorDetails', 'Could not update the application: {error}', {
              error: data.error
            })
          : t(
              'updates.notice.errorFallback',
              'Could not reach UAC data centers. Contact Sam Grimm at UAC, Phobos facility if the issue persists.'
            )
      }
    default:
      return null
  }
}
