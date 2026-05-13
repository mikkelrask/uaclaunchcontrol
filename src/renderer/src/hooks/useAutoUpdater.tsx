import { useEffect, useState } from 'react'
import { useToast } from '@/hooks/use-toast'
import { api } from '@/api'
import { ToastAction } from '@/components/ui/toast'
import { IUpdateInfo } from '@shared/schema'

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
      setUpdateInfo(data)

      switch (data.status) {
        case 'available':
          toast({
            title: 'SYSTEM: Update Pending',
            description: `Version ${data.version} is now available. Click to view release notes.`,
            action: (
              <ToastAction
                altText="View Update"
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('show-update-modal', { detail: data }))
                }}
              >
                View
              </ToastAction>
            )
          })
          break
        case 'not-available':
          if (data.isManual) {
            toast({
              title: 'SYSTEM: Up-to-Date',
              description: `Latest version (${data.version || 'unknown'}) is installed.`
            })
          }
          break
        case 'downloading':
          break
        case 'downloaded':
          toast({
            title: 'SYSTEM: Update Ready',
            description: `Version ${data.version} has been downloaded. Click Restart to apply.`,
            action: (
              <ToastAction altText="Restart Now" onClick={() => api.installUpdate()}>
                Restart
              </ToastAction>
            )
          })
          break
        case 'error':
          toast({
            title: 'SYSTEM: Update failure',
            description:
              data.error ||
              'Could not reach UAC data centers. Contact Sam Grimm at UAC, Phobos facility if the issue persists.',
            variant: 'destructive'
          })
          break
      }
    })
  }, [toast])

  const checkForUpdates = (): void => {
    api.checkForUpdates()
  }

  const downloadUpdate = (): void => {
    api.downloadUpdate()
  }

  const installUpdate = (): void => {
    api.installUpdate()
  }

  return {
    updateInfo,
    checkForUpdates,
    downloadUpdate,
    installUpdate
  }
}
