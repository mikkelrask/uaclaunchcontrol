import { useTranslate } from '@tolgee/react'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '@/api'
import { queryClient } from '@/lib/queryClient'
import { useToast } from '@/hooks/use-toast'
import { dispatchAchievementEvent, buildUnlockToasts } from '@/lib/achievements'
import type { IAppSettings } from '@shared/schema'
import uacLogo from '@/assets/UAC Logo.svg'
import { WelcomeStep } from './WelcomeStep'
import { SourcePortsStep } from './SourcePortsStep'
import { WadFilesStep } from './WadFilesStep'
import { RegistryStep } from './RegistryStep'
import { CompleteStep } from './CompleteStep'
import { OnboardingChrome } from './OnboardingChrome'
import { BootSequence } from './BootSequence'
import '../settings/settings.css'
import './onboarding.css'

import { createLogger } from '@shared/logger'

const log = createLogger('onboarding/OnboardingWizardx')
const STEP_COUNT = 5

interface OnboardingWizardProps {
  /** Start immediately without the getFirstRun round trip — used when the
   *  App shell is gated on the first-run flag (first launch). */
  autoActivate?: boolean
  /** Called when the wizard finishes/skips — lets App switch to the shell. */
  onFinished?: () => void
}

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ autoActivate, onFinished }) => {
  const { t } = useTranslate('desktop')
  const { toast } = useToast()
  const [isActive, setIsActive] = useState(false)
  const wizardRef = useRef<HTMLDivElement>(null)
  const [showBoot, setShowBoot] = useState(false)
  const [step, setStep] = useState(0)
  const [draft, setDraft] = useState<IAppSettings | null>(null)
  const hasAutoStartedRef = useRef(false)
  const knownFamiliesRef = useRef<Set<string>>(new Set())
  const isSeedingRef = useRef(false)
  const saveQueueRef = useRef<Promise<unknown>>(Promise.resolve())
  const finishingRef = useRef(false)
  const [isFinishing, setIsFinishing] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [directoryBusy, setDirectoryBusy] = useState(false)

  // Folder changes, autosaves and Finish share one queue so no older
  // read/merge/write can overwrite a newer setup choice.
  const persistSettings = useCallback((patch: Partial<IAppSettings>): Promise<IAppSettings> => {
    const next = saveQueueRef.current
      .catch(() => {})
      .then(async () => {
        const saved = await api.updateSettings(patch)
        await queryClient.invalidateQueries({ queryKey: ['/api/settings'] })
        return saved
      })
    saveQueueRef.current = next
    return next
  }, [])
  const persistDraft = useCallback(
    (snapshot: IAppSettings): Promise<void> => {
      return persistSettings({
        sourcePorts: snapshot.sourcePorts,
        // Empty IDs mean no preferred entry. Explicit strings survive JSON;
        // undefined would silently leave a removed default on the server.
        defaultSourcePortId: snapshot.defaultSourcePortId ?? '',
        defaultDoomVersionId: snapshot.defaultDoomVersionId ?? '',
        registryLookupEnabled: snapshot.registryLookupEnabled,
        registryUuid: snapshot.registryUuid
      }).then(() => {})
    },
    [persistSettings]
  )

  const activate = useCallback(async () => {
    isSeedingRef.current = true
    setSaveError('')
    // Activate + boot sequence FIRST so the settings fetch below is covered
    // by themed UI — never a blank frame or a flash of the app behind it.
    setIsActive(true)
    setShowBoot(true)
    try {
      const settings = await api.getSettings()
      knownFamiliesRef.current = new Set(
        (settings.sourcePorts || []).filter((p) => !p.ignored).map((p) => p.family)
      )
      setDraft(settings)
      setStep(0)
    } catch {
      // Onboarding is non-essential — fail silently, user can still use Settings directly.
      setIsActive(false)
    } finally {
      isSeedingRef.current = false
    }
  }, [])

  // Auto-start on first run
  useEffect(() => {
    if (hasAutoStartedRef.current) return
    if (autoActivate) {
      hasAutoStartedRef.current = true
      void activate()
      return
    }
    api
      .getFirstRun()
      .then(({ isFirstRun }) => {
        if (isFirstRun) {
          hasAutoStartedRef.current = true
          activate()
        }
      })
      .catch((err: unknown) => log.error(err))
  }, [activate, autoActivate])

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
  // default-game controls only mutate local state, they never call the API
  // themselves (same contract as when they're used in Settings).
  useEffect(() => {
    if (!isActive || !draft || isSeedingRef.current) return

    const timer = setTimeout(() => {
      persistDraft(draft).catch((err: unknown) => log.error(err))

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
          .catch((err: unknown) => log.error(err))
      }
    }, 400)

    return () => clearTimeout(timer)
  }, [draft, isActive, toast, persistDraft])

  const finish = useCallback(async (): Promise<void> => {
    if (finishingRef.current || directoryBusy) return
    finishingRef.current = true
    setIsFinishing(true)
    setSaveError('')
    try {
      // Queue the final snapshot after any in-flight autosave, then dismiss.
      if (draft) await persistDraft(draft)
      await api.dismissFirstRun()
      setIsActive(false)
      setDraft(null)
      onFinished?.()
    } catch (error: unknown) {
      log.error(error)
      setSaveError(
        t(
          'onboarding.saveFailed',
          'Could not save setup. Your choices are still here; please try again.'
        )
      )
    } finally {
      finishingRef.current = false
      setIsFinishing(false)
    }
  }, [draft, onFinished, persistDraft, directoryBusy, t])

  useEffect(() => {
    if (!isActive) return
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && !e.defaultPrevented && !e.isComposing) {
        // Nested dialogs and selects are portalled outside the tour. Their
        // Escape closes that control, not the whole setup flow.
        if (!(e.target instanceof Node) || !wizardRef.current?.contains(e.target)) return
        e.preventDefault()
        finish()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isActive, finish])

  const hasDraft = draft !== null
  useEffect(() => {
    if (!isActive || showBoot || !hasDraft) return
    const frame = requestAnimationFrame(() => {
      wizardRef.current
        ?.querySelector<HTMLElement>('[data-onboarding-step] h1, [data-onboarding-step] h2')
        ?.focus({ preventScroll: true })
    })
    return () => cancelAnimationFrame(frame)
  }, [isActive, showBoot, step, hasDraft])

  if (!isActive) return null

  const setDraftSettings: React.Dispatch<React.SetStateAction<IAppSettings>> = (action) => {
    setDraft((prev) => {
      if (!prev) return prev
      return typeof action === 'function'
        ? (action as (p: IAppSettings) => IAppSettings)(prev)
        : action
    })
  }

  return (
    <div
      ref={wizardRef}
      data-testid="onboarding-wizard"
      aria-busy={isFinishing}
      className="onboarding-shell settings-surface fixed inset-0 z-40 bg-app-primary flex flex-col"
    >
      <OnboardingChrome />
      {showBoot && <BootSequence onComplete={() => setShowBoot(false)} />}
      <div className="onboarding-header">
        <div className="flex items-center gap-3">
          <img src={uacLogo} className="h-8 w-8" alt="" />
          <span className="font-mono text-xs uppercase tracking-widest text-app-muted">
            {t('onboarding.setup', 'UAC Launch Control // Setup')}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div
            className="onboarding-progress"
            role="progressbar"
            aria-label={t('onboarding.setup', 'UAC Launch Control // Setup')}
            aria-valuemin={1}
            aria-valuemax={STEP_COUNT}
            aria-valuenow={step + 1}
          >
            {Array.from({ length: STEP_COUNT }).map((_, i) => (
              <div
                key={i}
                aria-hidden="true"
                className={`h-1.5 w-8 rounded-full transition-colors ${
                  i <= step ? 'bg-accent-highlight' : 'bg-app-muted/20'
                }`}
              />
            ))}
          </div>
          <button
            onClick={() => void finish()}
            disabled={isFinishing || directoryBusy}
            className="text-xs text-app-muted hover:text-app-primary uppercase tracking-wider transition-colors"
          >
            {t('onboarding.skip', 'Skip setup')}
          </button>
        </div>
      </div>

      {saveError && (
        <p className="onboarding-save-error" role="alert">
          {saveError}
        </p>
      )}
      {draft && (
        <div className="onboarding-stage" inert={isFinishing}>
          <div key={step} className="onboarding-stage-inner uac-step-enter">
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
                persistSettings={persistSettings}
                onDirectoryBusyChange={setDirectoryBusy}
                onNext={() => setStep(3)}
                onBack={() => setStep(1)}
              />
            )}
            {step === 3 && (
              <RegistryStep
                settings={draft}
                setSettings={setDraftSettings}
                onNext={() => setStep(4)}
                onBack={() => setStep(2)}
              />
            )}
            {step === 4 && (
              <CompleteStep
                portCount={draft.sourcePorts.length}
                onFinish={finish}
                onBack={() => setStep(3)}
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
