import React, { useState } from 'react'
import { Bell } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useNotifications, markAllRead, type NotificationAction } from '@/lib/notifications'
import { formatRelativeTime } from '@/lib/utils'
import { api } from '@/api'

const ACTION_LABELS: Record<NotificationAction['kind'], string> = {
  'view-crash-log': 'View Log',
  'view-update': 'View Update',
  'restart-update': 'Restart Now'
}

function runNotificationAction(action: NotificationAction): void {
  switch (action.kind) {
    case 'view-crash-log':
      window.dispatchEvent(new CustomEvent('show-crash-log-modal', { detail: action.payload }))
      break
    case 'view-update':
      window.dispatchEvent(new CustomEvent('show-update-modal'))
      break
    case 'restart-update':
      api.installUpdate()
      break
  }
}

interface NotificationsPopoverProps {
  /** The child element that triggers the popover (e.g. the bell button) */
  children: React.ReactNode
}

/**
 * Popover listing the app's recent notification history - title,
 * description, timestamp - mirroring AchievementsPopover's structure.
 * Opening the tray marks everything currently listed as read.
 */
export const NotificationsPopover: React.FC<NotificationsPopoverProps> = ({ children }) => {
  const [open, setOpen] = useState(false)
  const { notifications, unreadCount } = useNotifications()

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next && unreadCount > 0) markAllRead()
      }}
    >
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        className="w-[380px] p-0 overflow-hidden bg-app-primary shadow-2xl border-app"
        align="end"
        sideOffset={8}
      >
        {/* ── Header ── */}
        <div className="flex items-center gap-3 p-4 border-b border-app bg-app-secondary">
          <div className="p-2 bg-accent-highlight/10 rounded-md">
            <Bell className="w-5 h-5 text-accent-highlight" />
          </div>
          <div>
            <h4 className="text-lg font-bold tracking-tight text-app-primary lowercase">
              Notifications
            </h4>
            <p className="text-[0.625rem] font-semibold font-mono text-app-muted uppercase tracking-widest opacity-80">
              UAC Launch Control // Notifications
            </p>
          </div>
        </div>

        <ScrollArea className="h-[360px]">
          <div className="p-2 space-y-1">
            {notifications.length === 0 && (
              <p className="text-xs text-app-muted text-center py-8">No notifications yet.</p>
            )}
            {notifications.map((n) => (
              <div
                key={n.id}
                className={`p-2 rounded-md ${
                  n.read ? '' : 'bg-accent-highlight/5 border-l-2 border-accent-highlight'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-app-primary truncate">{n.title}</span>
                  <span className="text-[10px] text-app-muted shrink-0">
                    {formatRelativeTime(n.createdAt)}
                  </span>
                </div>
                {n.description && (
                  <p className="text-xs text-app-muted mt-0.5 leading-relaxed">{n.description}</p>
                )}
                {n.action && (
                  <button
                    className="text-[10px] font-semibold text-accent-highlight hover:underline mt-1"
                    onClick={(e) => {
                      e.stopPropagation()
                      runNotificationAction(n.action!)
                    }}
                  >
                    {ACTION_LABELS[n.action.kind]}
                  </button>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}

export default NotificationsPopover
