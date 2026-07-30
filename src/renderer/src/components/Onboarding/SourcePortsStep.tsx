import React from 'react'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { IAppSettings } from '@shared/schema'
import { SourcePortsTab } from '@/components/SourcePortsTab'

interface SourcePortsStepProps {
  settings: IAppSettings
  setSettings: React.Dispatch<React.SetStateAction<IAppSettings>>
  onNext: () => void
  onBack: () => void
}

export const SourcePortsStep: React.FC<SourcePortsStepProps> = ({
  settings,
  setSettings,
  onNext,
  onBack
}) => {
  const hasPort = settings.sourcePorts.length > 0

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <span className="font-mono text-xs uppercase tracking-[0.3em] text-accent-highlight/70">
          UAC-7 // Runtime Engine
        </span>
        <h2 className="text-2xl font-bold tracking-tight text-app-primary">Source Ports</h2>
        <p className="text-sm text-app-secondary max-w-lg mx-auto">
          Scan your system for an installed source port (GZDoom, UZDoom, Zandronum, and others), add
          one manually, or download one directly — no need to leave the app.
        </p>
      </div>

      <SourcePortsTab settings={settings} setSettings={setSettings} autoScan />

      {hasPort ? (
        <p className="text-xs text-app-muted italic text-center opacity-70">
          Click the dot next to a port to make it your default — it&apos;ll be pre-selected when you
          create a new protocol.
        </p>
      ) : (
        <p className="text-sm text-app-muted italic text-center">
          You can also do this later in Settings — this step isn&apos;t required to continue.
        </p>
      )}

      <div className="flex items-center justify-between pt-2">
        <Button
          variant="ghost"
          onClick={onBack}
          className="text-app-muted hover:text-app-primary gap-1"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </Button>
        <Button
          onClick={onNext}
          className="bg-accent-highlight text-white hover:bg-accent-highlight/90 gap-1 px-6"
        >
          Next
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}
