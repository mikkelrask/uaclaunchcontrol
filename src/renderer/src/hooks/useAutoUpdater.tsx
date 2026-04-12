import { useEffect, useState } from 'react'
import { useToast } from '@/hooks/use-toast'
import { api } from '@/api'
import { ToastAction } from '@/components/ui/toast'

export interface UpdateInfo {
  status: 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'
  version?: string
  releaseNotes?: string
  percent?: number
  error?: string
}

export function useAutoUpdater() {
  const { toast } = useToast()
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)

  useEffect(() => {
    api.onUpdateStatus((data: UpdateInfo) => {
      setUpdateInfo(data)

      switch (data.status) {
        case 'available':
          toast({
            title: 'Update Available',
            description: `Version ${data.version} is available. Click to view release notes.`,
            action: (
              <ToastAction altText="View Update" onClick={() => {
                // This will be handled by a modal in App.tsx
                window.dispatchEvent(new CustomEvent('show-update-modal', { detail: data }))
              }}>
                View
              </ToastAction>
            )
          })
          break
        case 'not-available':
          break
        case 'downloading':
          break
        case 'downloaded':
          toast({
            title: 'Update Ready',
            description: `Version ${data.version} has been downloaded. Restart to install.`,
            action: (
              <ToastAction altText="Restart Now" onClick={() => api.installUpdate()}>
                Restart
              </ToastAction>
            )
          })
          break
        case 'error':
          toast({
            title: 'Update Error',
            description: data.error || 'An error occurred while checking for updates.',
            variant: 'destructive'
          })
          break
      }
    })
  }, [toast])

  const checkForUpdates = () => {
    api.checkForUpdates()
  }

  const downloadUpdate = () => {
    api.downloadUpdate()
  }

  const installUpdate = () => {
    api.installUpdate()
  }

  return {
    updateInfo,
    checkForUpdates,
    downloadUpdate,
    installUpdate
  }
}
