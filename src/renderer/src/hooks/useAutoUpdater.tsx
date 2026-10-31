import { useEffect, useState } from 'react'
import { useToast } from '@/hooks/use-toast'
import { api } from '@/api'
import { ToastAction } from '@/components/ui/toast'
import { IUpdateInfo } from '@shared/schema'
import { getUpdateNotice } from '@/lib/i18n/update-messages'

export function useAutoUpdater(): {
  updateInfo: IUpdateInfo | null
  checkForUpdates: () => void
  downloadUpdate: () => void
  installUpdate: () => void
} {
  const { toast } = useToast()
  const [updateInfo, setUpdateInfo] = useState<IUpdateInfo | null>(null)
  useEffect(() => {
    api.onUpdateStatus((data: IUpdateInfo) => {
      // Progress events carry only status/percent; retain the release identity and notes.
      setUpdateInfo((previous) => ({ ...previous, ...data }))
      const notice = getUpdateNotice(data)
      if (!notice) return
      const { actionLabel, actionAltText, ...props } = notice
      toast({
        ...props,
        ...(notice.historyAction
          ? {
              action: (
                <ToastAction
                  altText={actionAltText!}
                  onClick={() => {
                    if (notice.historyAction?.kind === 'restart-update') api.installUpdate()
                    else
                      window.dispatchEvent(new CustomEvent('show-update-modal', { detail: data }))
                  }}
                >
                  {actionLabel}
                </ToastAction>
              )
            }
          : {})
      })
    })
  }, [toast])
  return {
    updateInfo,
    checkForUpdates: () => api.checkForUpdates(),
    downloadUpdate: () => api.downloadUpdate(),
    installUpdate: () => api.installUpdate()
  }
}
