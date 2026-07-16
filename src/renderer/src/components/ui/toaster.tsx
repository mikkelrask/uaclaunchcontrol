import React from 'react'
import { createPortal } from 'react-dom'
import { useToast } from '@/hooks/use-toast'
import { markRead } from '@/lib/notifications'
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastTitle,
  ToastProvider,
  ToastViewport
} from '@/components/ui/toast'

export const Toaster = (): React.ReactElement => {
  const { toasts } = useToast()

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
      <ToastViewport />
    </ToastProvider>,
    document.body
  )
}
