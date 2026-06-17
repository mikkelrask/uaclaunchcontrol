import React from 'react'
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
                update_available
              </DialogTitle>
              <DialogDescription className="text-xs font-semibold font-mono text-app-muted uppercase tracking-widest opacity-80">
                UAC Launch Control // Software Update
              </DialogDescription>
            </div>
          </div>
        </div>

        <div className="space-y-4 p-4">
          <div className="flex items-center justify-between p-3 bg-app-primary rounded-lg border border-app">
            <Label className="text-sm text-app-muted">New Version</Label>
            <span className="text-sm font-mono text-accent-highlight font-bold">
              v{updateInfo.version}
            </span>
          </div>

          {updateInfo.releaseNotes && (
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-widest text-app-muted font-mono font-bold">
                Release Notes
              </Label>
              <ScrollArea className="h-96 rounded-md border border-app bg-app-primary p-4">
                <div
                  className="text-sm text-app-muted prose prose-invert max-w-none"
                  dangerouslySetInnerHTML={{
                    __html: updateInfo.releaseNotes
                      .replace(
                        /^### (.+)$/gm,
                        '<h4 class="font-bold text-app-primary mt-4 mb-2">$1</h4>'
                      )
                      .replace(
                        /^## (.+)$/gm,
                        '<h3 class="font-bold text-app-primary mt-4 mb-2">$1</h3>'
                      )
                      .replace(
                        /^# (.+)$/gm,
                        '<h2 class="font-bold text-app-primary mt-4 mb-2">$1</h2>'
                      )
                      .replace(/^- (.+)$/gm, '<li class="ml-4 mb-1">$1</li>')
                      .replace(/^\* (.+)$/gm, '<li class="ml-4 mb-1">$1</li>')
                      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                      .replace(/\*(.+?)\*/g, '<em>$1</em>')
                      .replace(/`([^`]+)`/g, '<code class="bg-black/30 px-1 rounded">$1</code>')
                      .replace(/\n/g, '<br/>')
                  }}
                />
              </ScrollArea>
            </div>
          )}

          {isDownloading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-app-muted">Downloading...</Label>
                <span className="text-xs font-mono text-app-muted">
                  {Math.round(downloadProgress)}%
                </span>
              </div>
              <Progress value={downloadProgress} className="h-2 bg-app-primary" />
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
            View on GitHub
          </Button>

          {updateInfo.status === 'available' && !isDownloading && !isSystemInstalled && (
            <Button
              onClick={handleDownload}
              className="bg-accent-highlight hover:opacity-90 text-white"
            >
              <Download className="w-4 h-4 mr-2" />
              Download Update
            </Button>
          )}

          {updateInfo.status === 'downloaded' && !isSystemInstalled && (
            <Button
              onClick={handleInstall}
              className="bg-accent-highlight hover:opacity-90 text-white"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Restart & Install
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default UpdateModal
