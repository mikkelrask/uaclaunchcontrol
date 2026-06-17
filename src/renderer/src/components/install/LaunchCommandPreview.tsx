import React from 'react'

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
    <div className="bg-app-primary border border-app rounded p-3">
      <p className="text-[10px] uppercase tracking-widest text-app-muted font-mono font-bold mb-0.5 opacity-60">
        Launch Preview
      </p>
      <code className="text-xs text-app-muted font-mono break-all opacity-70">
        {launchCommand}
      </code>
    </div>
  )
}
