import { useTranslate, useTolgee } from '@tolgee/react'
import React from 'react'
import { ReleaseNotes } from './ReleaseNotes'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { IUpdateInfo } from '@shared/schema'
import { api } from '@/api'
import { Progress } from '@/components/ui/progress'
import { Download, ExternalLink, RefreshCw } from 'lucide-react'
import type { IInstallType } from '@shared/schema'

interface UpdateModalProps {
  isOpen: boolean
  onClose: () => void
  updateInfo: IUpdateInfo | null
  installType: IInstallType | null
}

export const UpdateModal: React.FC<UpdateModalProps> = ({
  isOpen,
  onClose,
  updateInfo,
  installType
}) => {
  const { t } = useTranslate('desktop')
  const tolgee = useTolgee(['language'])
  const isSystemInstalled = installType?.isSystemInstalled ?? false
  const isDownloading = updateInfo?.status === 'downloading'
  const downloadProgress = updateInfo?.percent || 0

  const handleDownload = (): void => {
    api.downloadUpdate()
  }

  const handleViewOnGitHub = (): void => {
    const version = updateInfo?.version
    if (version) {
      window.open(`https://github.com/mikkelrask/uaclaunchcontrol/releases/v${version}`, '_blank')
    }
  }

  const handleInstall = (): void => {
    api.installUpdate()
  }

  if (!updateInfo) return null

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-app-primary shadow-2xl border-app max-w-4xl max-h-[80vh] p-0 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-app bg-app-secondary">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-accent-highlight/10 rounded-md">
              <RefreshCw className="w-5 h-5 text-accent-highlight" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold tracking-tight text-app-primary lowercase">
                {t('updates.dialog.title', 'update_available')}
              </DialogTitle>
              <DialogDescription className="text-xs font-semibold font-mono text-app-muted uppercase tracking-widest opacity-80">
                {t('updates.dialog.subtitle', 'UAC Launch Control // Software Update')}
              </DialogDescription>
            </div>
          </div>
        </div>

        <div className="space-y-4 p-4">
          <div className="flex items-center justify-between p-3 bg-app-primary rounded-lg border border-app">
            <Label className="text-sm text-app-muted">
              {t('updates.dialog.newVersion', 'New Version')}
            </Label>
            <span className="text-sm font-mono text-accent-highlight font-bold">
              v{updateInfo.version}
            </span>
          </div>

          {updateInfo.releaseNotes && (
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-widest text-app-muted font-mono font-bold">
                {t('common.labels.releaseNotes', 'Release Notes')}
              </Label>
              <ScrollArea className="h-96 rounded-md border border-app bg-app-primary p-4">
                <ReleaseNotes markdown={updateInfo.releaseNotes} />
              </ScrollArea>
            </div>
          )}

          {isDownloading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-app-muted">
                  {t('updates.dialog.downloading', 'Downloading...')}
                </Label>
                <span className="text-xs font-mono text-app-muted">
                  {new Intl.NumberFormat(tolgee.getLanguage(), {
                    style: 'percent',
                    maximumFractionDigits: 0
                  }).format(downloadProgress / 100)}
                </span>
              </div>
              <Progress
                aria-label={t('updates.dialog.progress', 'Update download progress')}
                value={downloadProgress}
                className="h-2 bg-app-primary"
              />
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0 bg-app-secondary border-t border-app p-4 shrink-0">
          <Button
            variant="outline"
            onClick={handleViewOnGitHub}
            className="bg-app-primary hover:bg-app-hover text-app-primary border-app"
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            {t('updates.dialog.github', 'View on GitHub')}
          </Button>

          {updateInfo.status === 'available' && !isDownloading && !isSystemInstalled && (
            <Button
              onClick={handleDownload}
              className="bg-accent-highlight hover:opacity-90 text-white"
            >
              <Download className="w-4 h-4 mr-2" />
              {t('updates.dialog.download', 'Download Update')}
            </Button>
          )}

          {updateInfo.status === 'downloaded' && !isSystemInstalled && (
            <Button
              onClick={handleInstall}
              className="bg-accent-highlight hover:opacity-90 text-white"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              {t('updates.dialog.install', 'Restart & Install')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default UpdateModal
