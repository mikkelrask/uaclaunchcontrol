import { useTranslate } from '@tolgee/react'
import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ScrollText, Copy, FileText } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { api } from '@/api'
import { getCrashText } from '@/lib/i18n/crash-messages'

export interface CrashLogData {
  protocolId?: string
  protocolName?: string
  exitCode: number | null
  sessionSeconds: number
  logTail: string[]
  logFilePath?: string
}

interface CrashLogDialogProps {
  data: CrashLogData | null
  onClose: () => void
}

export const CrashLogDialog: React.FC<CrashLogDialogProps> = ({ data, onClose }) => {
  const { t } = useTranslate('desktop')
  const { toast } = useToast()

  const presentation = data ? getCrashText(data) : null

  const handleCopy = async (): Promise<void> => {
    if (!data) return
    await navigator.clipboard.writeText(data.logTail.join('\n'))
    toast({
      title: t('crash.copyTitle', 'SYSTEM: log_copied'),
      description: t('crash.copied', 'Log copied to clipboard.')
    })
  }

  const handleOpenFile = async (): Promise<void> => {
    if (!data?.logFilePath) return
    await api.openLogFile(data.logFilePath)
  }

  return (
    <Dialog open={!!data} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-app-primary shadow-2xl border-app max-w-2xl p-0 overflow-hidden">
        <div className="flex items-center gap-3 p-4 border-b border-app bg-app-secondary">
          <div className="p-2 bg-destructive/10 rounded-md">
            <ScrollText className="w-5 h-5 text-destructive" />
          </div>
          <div>
            <DialogTitle className="text-xl font-bold tracking-tight text-app-primary lowercase">
              {presentation?.title}
            </DialogTitle>
            <DialogDescription className="text-xs font-semibold font-mono text-app-muted uppercase tracking-widest opacity-80">
              {presentation?.termination}
            </DialogDescription>
          </div>
        </div>

        <div className="p-4 space-y-3">
          {presentation?.hint && (
            <div className="text-sm text-app-primary bg-accent-highlight/10 border border-accent-highlight/30 rounded-lg p-3">
              {presentation.hint}
            </div>
          )}

          <pre className="text-xs font-mono text-app-primary bg-app-secondary border border-app rounded-lg p-3 max-h-80 overflow-y-auto overflow-x-auto whitespace-pre-wrap">
            {data?.logTail.length
              ? data.logTail.join('\n')
              : t('crash.noOutput', 'No console output captured.')}
          </pre>
        </div>

        <DialogFooter className="sm:justify-between items-center bg-app-secondary border-t border-app p-4 shrink-0">
          {data?.logFilePath ? (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-accent-highlight hover:bg-accent-highlight/10 gap-1"
              onClick={handleOpenFile}
            >
              <FileText className="w-3 h-3" />
              {t('crash.openFile', 'Open Log File')}
            </Button>
          ) : (
            <span />
          )}
          <Button
            variant="outline"
            size="sm"
            className="text-xs bg-app-primary border-app gap-1"
            onClick={handleCopy}
          >
            <Copy className="w-3 h-3" />
            {t('crash.copy', 'Copy to Clipboard')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default CrashLogDialog
