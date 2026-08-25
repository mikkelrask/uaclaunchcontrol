import React from 'react'
import { createPortal } from 'react-dom'
import { useToast } from '@/hooks/use-toast'
import { markRead } from '@/lib/notifications'
import type { UseModDownloadsReturn } from '@/hooks/useModDownloads'
import { DownloadCard } from '@/components/ModDownloadManager'
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastTitle,
  ToastProvider,
  ToastViewport
} from '@/components/ui/toast'

interface ToasterProps {
  /** Shared in-app download state — cards render stacked with the toasts. */
  modDownloads: UseModDownloadsReturn
}

export const Toaster = ({ modDownloads }: ToasterProps): React.ReactElement => {
  const { toasts } = useToast()
  const { downloads, fileNames, cancel, dismiss } = modDownloads
  const events = Object.values(downloads)

  return createPortal(
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        return (
          <Toast key={id} {...props}>
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && <ToastDescription>{description}</ToastDescription>}
            </div>
            {action}
            <ToastClose onClick={() => markRead(id)} />
          </Toast>
        )
      })}
      <ToastViewport className="gap-2">
        {/* Download cards live inside the toast column (toasts portal in
            after them, so cards stack above the current toast). The Radix
            wrapper disables pointer events when no toast is showing — the
            cards opt back in so their buttons stay clickable. */}
        {events.length > 0 && (
          <div className="pointer-events-auto flex w-full flex-col gap-2">
            {events.map((event) => (
              <DownloadCard
                key={event.id}
                event={event}
                fileName={fileNames[event.id]}
                onCancel={() => cancel(event.id)}
                onDismiss={() => dismiss(event.id)}
              />
            ))}
          </div>
        )}
      </ToastViewport>
    </ToastProvider>,
    document.body
  )
}
