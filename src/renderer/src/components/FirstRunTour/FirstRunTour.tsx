/**
 * FirstRunTour — top-level tour orchestrator.
 *
 * Mounted in App.tsx. Handles:
 * - Fetching first-run status on mount
 * - Listening for manual replay via custom DOM event ('uac:replay-tour')
 * - Showing/hiding the tour overlay
 * - Dismiss/complete lifecycle
 */

import React, { useEffect, useRef, useCallback } from 'react'
import { api } from '@/api'
import { useTourMachine } from './tourReducer'
import { TourStep } from './TourStep'
import { TOUR_STEPS } from './tourSteps'

export const FirstRunTour: React.FC = () => {
  const machine = useTourMachine()
  const hasAutoStartedRef = useRef(false)

  // ── Auto-start on first run ─────────────────────────────────────
  useEffect(() => {
    if (hasAutoStartedRef.current) return

    api
      .getFirstRun()
      .then(({ isFirstRun }) => {
        if (isFirstRun) {
          hasAutoStartedRef.current = true
          machine.start()
        }
      })
      .catch(() => {
        // Silently fail — tour is non-essential
      })
  }, [machine])

  // ── Listen for manual replay ─────────────────────────────────────
  useEffect(() => {
    const handler = (): void => {
      hasAutoStartedRef.current = true
      machine.reset() // reset to WELCOME
    }

    window.addEventListener('uac:replay-tour', handler)
    return () => window.removeEventListener('uac:replay-tour', handler)
  }, [machine])

  // ── beforeEnter / beforeExit side‑effects ───────────────────────
  const prevStepIndexRef = useRef<number>(-1)

  useEffect(() => {
    const stepIdx = machine.currentStep
    if (stepIdx < 0 || stepIdx >= TOUR_STEPS.length) return

    const prevIdx = prevStepIndexRef.current

    // Run beforeExit for the previous step
    if (prevIdx >= 0 && prevIdx < TOUR_STEPS.length && prevIdx !== stepIdx) {
      const prevStep = TOUR_STEPS[prevIdx]
      if (prevStep.beforeExit) {
        prevStep.beforeExit()
      }
    }

    // Run beforeEnter for the new step
    const step = TOUR_STEPS[stepIdx]
    if (step.beforeEnter) {
      step.beforeEnter()
    }

    prevStepIndexRef.current = stepIdx
  }, [machine.currentStep, machine])

  // ── Dismiss / complete ───────────────────────────────────────────
  const dismiss = useCallback(() => {
    api.dismissFirstRun().catch(() => {})
    machine.skip()
  }, [machine])

  const complete = useCallback(() => {
    api.dismissFirstRun().catch(() => {})
    machine.finish()
  }, [machine])

  const goToStep = useCallback(
    (stepIdx: number) => {
      if (stepIdx < 0 || stepIdx >= TOUR_STEPS.length) return
      machine.go(stepIdx)
    },
    [machine]
  )

  // ── keyboard shortcuts ──────────────────────────────────────────
  useEffect(() => {
    if (!machine.isActive) return

    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault()
        dismiss()
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        if (machine.currentStep === TOUR_STEPS.length - 1) {
          complete()
        } else {
          goToStep(machine.currentStep + 1)
        }
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [machine.isActive, machine.currentStep, dismiss, complete, goToStep])

  // ── render ──────────────────────────────────────────────────────
  if (!machine.isActive) {
    return null
  }

  const step = TOUR_STEPS[machine.currentStep]
  if (!step) {
    return null
  }

  return (
    <TourStep
      key={step.id}
      step={step}
      stepIndex={machine.currentStep}
      totalSteps={machine.totalSteps}
      onNext={() => {
        if (machine.currentStep >= TOUR_STEPS.length - 1) {
          complete()
        } else {
          goToStep(machine.currentStep + 1)
        }
      }}
      onPrev={() => {
        goToStep(machine.currentStep - 1)
      }}
      onSkip={dismiss}
    />
  )
}
