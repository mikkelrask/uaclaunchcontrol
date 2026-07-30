import React, { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '@/api'
import { useToast } from '@/hooks/use-toast'
import { dispatchAchievementEvent, buildUnlockToasts } from '@/lib/achievements'
import type { IAppSettings } from '@shared/schema'
import uacLogo from '@/assets/UAC Logo.svg'
import { WelcomeStep } from './WelcomeStep'
import { SourcePortsStep } from './SourcePortsStep'
import { WadFilesStep } from './WadFilesStep'
import { CompleteStep } from './CompleteStep'
import { OnboardingChrome } from './OnboardingChrome'
import { BootSequence } from './BootSequence'

const STEP_COUNT = 4

export const OnboardingWizard: React.FC = () => {
  const { toast } = useToast()
  const [isActive, setIsActive] = useState(false)
  const [showBoot, setShowBoot] = useState(false)
  const [step, setStep] = useState(0)
  const [draft, setDraft] = useState<IAppSettings | null>(null)
  const hasAutoStartedRef = useRef(false)
  const knownFamiliesRef = useRef<Set<string>>(new Set())
  const isSeedingRef = useRef(false)

  const activate = useCallback(async () => {
    isSeedingRef.current = true
    try {
      const settings = await api.getSettings()
      knownFamiliesRef.current = new Set(
        (settings.sourcePorts || []).filter((p) => !p.ignored).map((p) => p.family)
      )
      setDraft(settings)
      setStep(0)
      setIsActive(true)
      setShowBoot(true)
    } catch {
      // Onboarding is non-essential — fail silently, user can still use Settings directly.
    } finally {
      isSeedingRef.current = false
    }
  }, [])

  // Auto-start on first run
  useEffect(() => {
    if (hasAutoStartedRef.current) return
    api
      .getFirstRun()
      .then(({ isFirstRun }) => {
        if (isFirstRun) {
          hasAutoStartedRef.current = true
          activate()
        }
      })
      .catch(() => {})
  }, [activate])

  // Manual replay from the header's "Guided Tour" button
  useEffect(() => {
    const handler = (): void => {
      hasAutoStartedRef.current = true
      activate()
    }
    window.addEventListener('uac:replay-onboarding', handler)
    return () => window.removeEventListener('uac:replay-onboarding', handler)
  }, [activate])

  // Debounced persistence of source-port and default-WAD changes so nothing
  // is lost even if the wizard is closed mid-flow — SourcePortsTab and the
  // default-WAD dot only mutate local state, they never call the API
  // themselves (same contract as when they're used in Settings).
  useEffect(() => {
    if (!isActive || !draft || isSeedingRef.current) return

    const timer = setTimeout(() => {
      api
        .updateSettings({
          sourcePorts: draft.sourcePorts,
          defaultSourcePortId: draft.defaultSourcePortId,
          defaultDoomVersionId: draft.defaultDoomVersionId
        })
        .catch(() => {})

      const activeFamilies = (draft.sourcePorts || [])
        .filter((p) => !p.ignored)
        .map((p) => p.family)
      const newFamilies = activeFamilies.filter((f) => !knownFamiliesRef.current.has(f))
      for (const family of newFamilies) {
        knownFamiliesRef.current.add(family)
        dispatchAchievementEvent({ type: 'SOURCE_PORT_ADDED', count: 1, family })
          .then((result) => {
            for (const t of buildUnlockToasts(result)) {
              toast({
                title: t.title,
                description: t.description,
                duration: t.duration as 6000 | 8000
              })
            }
          })
          .catch(() => {})
      }
    }, 400)

    return () => clearTimeout(timer)
  }, [draft, isActive, toast])

  const finish = useCallback(() => {
    api.dismissFirstRun().catch(() => {})
    setIsActive(false)
    setDraft(null)
  }, [])

  useEffect(() => {
    if (!isActive) return
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault()
        finish()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isActive, finish])

  if (!isActive || !draft) return null

  const setDraftSettings: React.Dispatch<React.SetStateAction<IAppSettings>> = (action) => {
    setDraft((prev) => {
      if (!prev) return prev
      return typeof action === 'function'
        ? (action as (p: IAppSettings) => IAppSettings)(prev)
        : action
    })
  }

  return (
    <div className="fixed inset-0 z-40 bg-app-primary flex flex-col">
      <OnboardingChrome />
      {showBoot && <BootSequence onComplete={() => setShowBoot(false)} />}
      <div className="flex items-center justify-between px-8 py-6 shrink-0 border-b border-app">
        <div className="flex items-center gap-3">
          <img src={uacLogo} className="h-8 w-8" alt="" />
          <span className="font-mono text-xs uppercase tracking-widest text-app-muted">
            UAC Launch Control // Setup
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex gap-2">
            {Array.from({ length: STEP_COUNT }).map((_, i) => (
              <div
                key={i}
                className={`h-1.5 w-8 rounded-full transition-colors ${
                  i <= step ? 'bg-accent-highlight' : 'bg-app-muted/20'
                }`}
              />
            ))}
          </div>
          <button
            onClick={finish}
            className="text-xs text-app-muted hover:text-app-primary uppercase tracking-wider transition-colors"
          >
            Skip setup
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto flex items-start justify-center px-8 py-10 scrollbar-thin scrollbar-thumb-app-hover">
        <div key={step} className="w-full max-w-2xl uac-step-enter">
          {step === 0 && <WelcomeStep onNext={() => setStep(1)} />}
          {step === 1 && (
            <SourcePortsStep
              settings={draft}
              setSettings={setDraftSettings}
              onNext={() => setStep(2)}
              onBack={() => setStep(0)}
            />
          )}
          {step === 2 && (
            <WadFilesStep
              settings={draft}
              setSettings={setDraftSettings}
              onNext={() => setStep(3)}
              onBack={() => setStep(1)}
            />
          )}
          {step === 3 && <CompleteStep onFinish={finish} onBack={() => setStep(2)} />}
        </div>
      </div>
    </div>
  )
}
