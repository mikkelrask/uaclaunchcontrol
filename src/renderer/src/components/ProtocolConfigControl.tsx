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
  /**
   * 'field' (default) matches a single form-field label, for placement next
   * to other small labels (e.g. GameSettingsModal, beside Launch Parameters).
   * 'section' matches a section heading like "Mod Files"/"Base Configuration",
   * for placement next to those (e.g. InstallPage).
   */
  variant?: 'field' | 'section'
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
  isCreating = false,
  variant = 'field'
}: ProtocolConfigControlProps): React.ReactElement {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        {variant === 'section' ? (
          <>
            <h3 className="text-lg mb-2">Protocol Config</h3>
            <p className="text-sm text-app-secondary mb-4">{statusText}</p>
          </>
        ) : (
          <>
            <Label className="text-xs uppercase tracking-widest text-app-muted font-mono font-bold">
              Protocol Config
            </Label>
            <p className="text-xs text-app-muted mt-0.5 leading-relaxed">{statusText}</p>
          </>
        )}
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
