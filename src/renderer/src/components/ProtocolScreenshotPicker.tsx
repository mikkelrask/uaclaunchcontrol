import { getDiagnosticTitle } from '@/lib/i18n/diagnostic-messages'
import { useTranslate } from '@tolgee/react'
import { getTranslate } from '@/lib/i18n'
import { Label } from '@/components/ui/label'
import { FolderOpen } from 'lucide-react'
import { api } from '@/api'
import { useToast } from '@/hooks/use-toast'
import placeholder from '@renderer/assets/placeholder.png'

interface ProtocolScreenshotPickerProps {
  title: string
  screenshotPath?: string
  onScreenshotChange: (fileName: string) => void
}

export function ProtocolScreenshotPicker({
  title,
  screenshotPath,
  onScreenshotChange
}: ProtocolScreenshotPickerProps): React.ReactElement {
  const { t } = useTranslate('desktop')

  const { toast } = useToast()

  const handleBrowse = async (): Promise<void> => {
    const { t } = getTranslate('desktop')

    const result = await api.showOpenDialog({
      title: t('library.screenshot.selectScreenshot', 'Select Screenshot'),
      properties: ['openFile'],
      filters: [
        {
          name: t('library.screenshot.images', 'Images'),
          extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp']
        }
      ]
    })
    if (!result.canceled && result.filePaths.length > 0) {
      try {
        const { fileName } = await api.uploadScreenshot(result.filePaths[0])
        onScreenshotChange(fileName)
        toast({
          title: getDiagnosticTitle('system', 'screenshot_saved'),
          description: t(
            'library.screenshot.newScreenshotSavedClickSaveToApply',
            'New screenshot saved. Click Save to apply.'
          )
        })
      } catch (error: unknown) {
        toast({
          title: getDiagnosticTitle('fatal', 'upload_failed'),
          description: t(
            'library.screenshot.failedToUploadScreenshot',
            'Failed to upload screenshot: {error}',
            { error: String(error) }
          ),
          variant: 'destructive'
        })
      }
    }
  }

  const displayImagePath =
    screenshotPath &&
    (screenshotPath.startsWith('http') ||
      screenshotPath.includes('/') ||
      screenshotPath.includes('\\'))
      ? screenshotPath
      : screenshotPath
        ? `http://localhost:7666/images/${screenshotPath}`
        : placeholder

  return (
    <div className="w-1/3">
      <Label className="text-xs uppercase tracking-widest text-app-muted font-mono font-bold">
        {t('library.screenshot.screenshot', 'Screenshot')}
      </Label>
      <button
        type="button"
        className="w-full rounded overflow-hidden relative group"
        aria-label={t('library.screenshot.changeScreenshot', 'Change Screenshot')}
        onClick={handleBrowse}
      >
        <img src={displayImagePath} alt={title} className="w-full aspect-video object-cover" />
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded">
          <span className="text-white text-sm font-medium flex items-center gap-2">
            <FolderOpen className="h-5 w-5" />
            {t('library.screenshot.changeScreenshot', 'Change Screenshot')}
          </span>
        </div>
      </button>
    </div>
  )
}

export default ProtocolScreenshotPicker
