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
  const { toast } = useToast()

  const handleBrowse = async (): Promise<void> => {
    const result = await api.showOpenDialog({
      title: 'Select Screenshot',
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] }]
    })
    if (!result.canceled && result.filePaths.length > 0) {
      try {
        const { fileName } = await api.uploadScreenshot(result.filePaths[0])
        onScreenshotChange(fileName)
        toast({
          title: 'SYSTEM: screenshot_saved',
          description: 'New screenshot saved. Click Save to apply.'
        })
      } catch (error) {
        toast({
          title: 'FATAL: upload_failed',
          description: `Failed to upload screenshot: ${error}`,
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
        Screenshot
      </Label>
      <button
        type="button"
        className="w-full rounded overflow-hidden relative group"
        onClick={handleBrowse}
      >
        <img src={displayImagePath} alt={title} className="w-full aspect-video object-cover" />
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded">
          <span className="text-white text-sm font-medium flex items-center gap-2">
            <FolderOpen className="h-5 w-5" />
            Change Screenshot
          </span>
        </div>
      </button>
    </div>
  )
}

export default ProtocolScreenshotPicker
