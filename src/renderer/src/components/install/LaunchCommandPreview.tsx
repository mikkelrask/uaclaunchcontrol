import React from 'react'
import { CopyButton } from '@/components/ui/copy-button'

interface LaunchCommandPreviewProps {
  launchCommand: string
  showPreview?: boolean
}

/**
 * A small preview box showing the computed launch command string.
 */
export const LaunchCommandPreview: React.FC<LaunchCommandPreviewProps> = ({
  launchCommand,
  showPreview = true
}) => {
  if (showPreview === false || !launchCommand) return null

  return (
    <div className="bg-app-primary border border-app rounded p-3 group">
      <p className="text-[0.625rem] uppercase tracking-widest text-app-muted font-mono font-bold mb-0.5 opacity-60">
        Launch Preview
      </p>
      <div className="flex items-start gap-2">
        <code className="text-xs text-app-muted font-mono break-all opacity-70 flex-1 min-w-0">
          {launchCommand}
        </code>
        <CopyButton text={launchCommand} className="mt-0.5" />
      </div>
    </div>
  )
}
