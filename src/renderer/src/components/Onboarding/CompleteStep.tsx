import React, { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ChevronLeft, CheckCircle2 } from 'lucide-react'
import { api } from '@/api'

interface CompleteStepProps {
  onFinish: () => void
  onBack: () => void
}

export const CompleteStep: React.FC<CompleteStepProps> = ({ onFinish, onBack }) => {
  const [portCount, setPortCount] = useState<number | null>(null)
  const [wadCount, setWadCount] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([api.getSettings(), api.getDoomVersions()])
      .then(([settings, versions]) => {
        if (cancelled) return
        setPortCount(settings.sourcePorts.length)
        setWadCount(versions.length)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="flex flex-col items-center text-center gap-6 pt-12">
      <div className="relative flex items-center justify-center w-24 h-24 rounded-full border border-green-500/30 bg-green-500/5">
        <CheckCircle2 className="w-11 h-11 text-green-500 drop-shadow-[0_0_10px_rgba(34,197,94,0.6)]" />
      </div>

      <div className="space-y-2">
        <span className="font-mono text-xs uppercase tracking-[0.3em] text-green-500/70">
          UAC-7 // Systems Nominal
        </span>
        <h1 className="text-3xl font-bold tracking-tight text-app-primary">You&apos;re all set</h1>
      </div>

      <p className="text-app-secondary max-w-md mx-auto leading-relaxed">
        {portCount !== null && wadCount !== null
          ? `${portCount} source port${portCount === 1 ? '' : 's'} and ${wadCount} WAD file${
              wadCount === 1 ? '' : 's'
            } configured. Head to Install whenever you're ready to create your first protocol.`
          : "Head to Install whenever you're ready to create your first protocol."}
      </p>

      <Button
        size="lg"
        onClick={onFinish}
        className="bg-accent-highlight text-white hover:bg-accent-highlight/90 mt-2 px-8 uppercase tracking-wider font-bold"
      >
        Finish
      </Button>
      <Button
        variant="ghost"
        onClick={onBack}
        className="text-app-muted hover:text-app-primary gap-1"
      >
        <ChevronLeft className="w-4 h-4" />
        Back
      </Button>

      <p className="text-xs text-app-muted italic uppercase tracking-widest opacity-40 mt-2">
        Union Aerospace Corporation — Phobos Facility Systems Division
      </p>
    </div>
  )
}
