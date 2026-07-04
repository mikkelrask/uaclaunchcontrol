import React from 'react'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { FilePlus } from 'lucide-react'

interface ProtocolConfigControlProps {
  /** Whether this protocol currently has (or, on InstallPage, will get) an isolated config. */
  hasConfig: boolean
  /** Short status line — current state, or a preview of what submitting will do. */
  statusText: string
  onCreateFresh: () => void
  isCreating?: boolean
}

/**
 * Shows whether a protocol has an isolated config, and lets the user
 * create (or replace with) a fresh blank one. Used on both InstallPage
 * (before a protocol exists) and GameSettingsModal (editing an existing one).
 */
export function ProtocolConfigControl({
  hasConfig,
  statusText,
  onCreateFresh,
  isCreating = false
}: ProtocolConfigControlProps): React.ReactElement {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <Label className="text-xs uppercase tracking-widest text-app-muted font-mono font-bold">
          Protocol Config
        </Label>
        <p className="text-xs text-app-muted mt-0.5 leading-relaxed">{statusText}</p>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onCreateFresh}
        disabled={isCreating}
        className="shrink-0 bg-app-primary hover:bg-app-hover text-app-primary border-app"
      >
        <FilePlus className="w-3.5 h-3.5 mr-1.5" />
        {isCreating ? 'Creating…' : hasConfig ? 'Replace with Fresh' : 'Create Unique Config'}
      </Button>
    </div>
  )
}

export default ProtocolConfigControl
