/**
 * TourStep — renders a highlight ring around a DOM element + a tooltip card.
 *
 * Features:
 * - Portal-based overlay (z-[9999])
 * - ResizeObserver-based re-measurement for elements inside scrollable areas
 * - Completion polling — if the step defines isComplete(), the UI shows a
 *   hint or a done label and the Next button glows when the action is done.
 */

import React, { useLayoutEffect, useState, useRef, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { pollComplete } from './tourSteps'
import type { TourStepDef, StepPlacement } from './tourSteps'

/**
 * Prevent clicks inside the tour tooltip from closing Radix dialogs.
 * Because the tour renders via portal to document.body, Radix sees every
 * click inside it as an "outside click" on the dialog. A capture-phase
 * native listener stops the event before Radix's handler fires.
 */
function usePreventRadixClose(ref: React.RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const handler = (e: PointerEvent): void => {
      e.stopPropagation()
    }
    el.addEventListener('pointerdown', handler, true)
    return () => el.removeEventListener('pointerdown', handler, true)
  }, [ref])
}

/* ─── helpers ─────────────────────────────────────────────────────── */

interface Rect {
  top: number
  left: number
  width: number
  height: number
  bottom: number
  right: number
}

function getTargetRect(selector: string | null): Rect | null {
  if (!selector) return null
  const el = document.querySelector(selector)
  if (!el) return null
  const r = el.getBoundingClientRect()
  return {
    top: r.top,
    left: r.left,
    bottom: r.bottom,
    right: r.right,
    width: r.width,
    height: r.height
  }
}

function computeTooltipPosition(
  targetRect: Rect | null,
  placement: StepPlacement,
  tooltipWidth: number,
  tooltipHeight: number,
  gap = 12
): { top: number; left: number } {
  const vw = window.innerWidth
  const vh = window.innerHeight

  if (!targetRect) {
    return {
      top: Math.max(24, (vh - tooltipHeight) / 2),
      left: Math.max(24, (vw - tooltipWidth) / 2)
    }
  }

  let top = 0
  let left = 0

  switch (placement) {
    case 'top':
      top = targetRect.top - tooltipHeight - gap
      left = targetRect.left + targetRect.width / 2 - tooltipWidth / 2
      break
    case 'bottom':
      top = targetRect.bottom + gap
      left = targetRect.left + targetRect.width / 2 - tooltipWidth / 2
      break
    case 'left':
      top = targetRect.top + targetRect.height / 2 - tooltipHeight / 2
      left = targetRect.left - tooltipWidth - gap
      break
    case 'right':
      top = targetRect.top + targetRect.height / 2 - tooltipHeight / 2
      left = targetRect.right + gap
      break
    case 'top-right':
      top = targetRect.top + gap
      left = targetRect.right - tooltipWidth - gap
      break
    case 'left-top':
      top = targetRect.top + gap
      left = targetRect.left - tooltipWidth - gap
      break
    case 'bottom-right':
      top = targetRect.bottom + gap
      left = targetRect.right - tooltipWidth - gap
      break
  }

  top = Math.max(8, Math.min(top, vh - tooltipHeight - 8))
  left = Math.max(8, Math.min(left, vw - tooltipWidth - 8))

  return { top, left }
}

/* ─── component ───────────────────────────────────────────────────── */

interface TourStepProps {
  step: TourStepDef
  stepIndex: number
  totalSteps: number
  onNext: () => void
  onPrev: () => void
  onSkip: () => void
}

const TOOLTIP_WIDTH = 400
const TOOLTIP_HEIGHT = 280

export const TourStep: React.FC<TourStepProps> = ({
  step,
  stepIndex,
  totalSteps,
  onNext,
  onPrev,
  onSkip
}) => {
  const [targetRect, setTargetRect] = useState<Rect | null>(null)
  const [completed, setCompleted] = useState(false)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const roRef = useRef<ResizeObserver | null>(null)
  const moRef = useRef<MutationObserver | null>(null)

  // Re-read element rect when it or the DOM changes
  const measure = useCallback(() => {
    setTargetRect(getTargetRect(step.target))
  }, [step.target])

  useLayoutEffect(() => {
    setTargetRect(null)

    const observeTarget = (): boolean => {
      if (!step.target) return false

      const el = document.querySelector(step.target)
      if (!el) return false

      roRef.current?.disconnect()
      const ro = new ResizeObserver(measure)
      ro.observe(el)
      roRef.current = ro
      return true
    }

    const timer = setTimeout(() => {
      measure()
      if (observeTarget()) {
        moRef.current?.disconnect()
      }
    }, 100)

    if (step.target) {
      moRef.current?.disconnect()
      const mo = new MutationObserver(() => {
        measure()
        if (observeTarget()) {
          mo.disconnect()
        }
      })
      mo.observe(document.body, { childList: true, subtree: true })
      moRef.current = mo
    }

    window.addEventListener('scroll', measure, { passive: true })
    window.addEventListener('resize', measure, { passive: true })

    return () => {
      clearTimeout(timer)
      window.removeEventListener('scroll', measure)
      window.removeEventListener('resize', measure)
      roRef.current?.disconnect()
      moRef.current?.disconnect()
    }
  }, [measure, step.target])

  // ── Completion polling ──────────────────────────────────────────
  useEffect(() => {
    setCompleted(false) // reset when step changes

    if (!step.isComplete) {
      // No completion detector — mark as always-complete so button is active
      setCompleted(true)
      return
    }

    const unsub = pollComplete(
      () => step.isComplete!(),
      () => setCompleted(true)
    )

    return unsub
  }, [step.id, step.isComplete])

  // Prevent clicks on the tooltip from closing underlying Radix dialogs
  usePreventRadixClose(tooltipRef)

  // Tooltip position
  const tooltipPos = computeTooltipPosition(
    targetRect,
    step.placement,
    TOOLTIP_WIDTH,
    TOOLTIP_HEIGHT
  )

  const isFirst = stepIndex === 0
  const isLast = stepIndex === totalSteps - 1

  return createPortal(
    <div className="fixed inset-0 z-[9999]" style={{ pointerEvents: 'none' }}>
      {/* Dimmed backdrop — only for full-screen welcome step */}
      {!step.target && <div className="absolute inset-0 bg-black/60 transition-opacity" />}

      {/* Highlight ring */}
      {targetRect && (
        <div
          className={cn(
            'absolute rounded-lg pointer-events-none transition-all duration-200',
            completed && !isLast
              ? 'ring-2 ring-green-500 shadow-[0_0_20px_rgba(34,197,94,0.6)]'
              : 'ring-2 ring-accent-highlight shadow-[0_0_20px_hsl(var(--accent-highlight)/0.5)] animate-pulse'
          )}
          style={{
            left: targetRect.left - 4,
            top: targetRect.top - 4,
            width: targetRect.width + 8,
            height: targetRect.height + 8
          }}
        />
      )}

      {/* Tooltip card — stopPropagation prevents Radix dialogs from
          seeing clicks here as "outside clicks" and closing. */}
      <div
        ref={tooltipRef}
        className="absolute pointer-events-auto z-10"
        style={{ top: tooltipPos.top, left: tooltipPos.left, width: TOOLTIP_WIDTH }}
        role="dialog"
        aria-labelledby="tour-title"
        aria-describedby="tour-desc"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <Card className="p-5 shadow-xl border-accent-highlight/30">
          {/* ── Progress dots ─────────────────────────────── */}
          <div className="flex items-center gap-2 mb-4">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <span
                key={i}
                className={cn(
                  'h-2 rounded-full transition-all duration-300',
                  i === stepIndex
                    ? 'w-8 bg-accent-highlight shadow-[0_0_6px_hsl(var(--accent-highlight)/0.7)]'
                    : i < stepIndex
                      ? 'w-2 bg-green-500/60'
                      : 'w-2 bg-white/20'
                )}
              />
            ))}
            <span className="ml-auto text-[10px] uppercase tracking-wider text-white/40">
              {stepIndex + 1} / {totalSteps}
            </span>
          </div>

          {/* ── Title ──────────────────────────────────────── */}
          <h3 id="tour-title" className="text-base font-bold text-white mb-1">
            {step.title}
          </h3>

          {/* ── Status label (hint / done) ─────────────────── */}
          {step.isComplete && (
            <p className="text-xs mb-3">
              {completed ? (
                <span className="text-green-400 font-semibold">{step.doneLabel || 'Done ✓'}</span>
              ) : (
                <span className="text-yellow-400/70 italic">{step.hint || 'Waiting…'}</span>
              )}
            </p>
          )}

          {/* ── Description ────────────────────────────────── */}
          <div
            id="tour-desc"
            className="text-sm text-white/70 leading-relaxed mb-4 [&_code]:bg-white/10 [&_code]:px-1 [&_code]:rounded"
            dangerouslySetInnerHTML={{ __html: step.description }}
          />

          {/* ── Actions ────────────────────────────────────── */}
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={onSkip}
              className="text-xs text-white/30 hover:text-white/60 transition-colors underline underline-offset-2"
            >
              Skip tour
            </button>

            <div className="flex items-center gap-2">
              {!isFirst && (
                <Button variant="outline" size="sm" onClick={onPrev}>
                  Back
                </Button>
              )}

              {isLast ? (
                <Button size="sm" onClick={onNext}>
                  Finish
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={onNext}
                  className={cn(
                    completed
                      ? 'bg-accent-highlight text-white shadow-[0_0_20px_hsl(var(--accent-highlight)/0.8)] animate-pulse scale-105'
                      : 'bg-accent-highlight/60 text-white/80'
                  )}
                >
                  {isFirst ? 'Start Tour' : 'Next'}
                </Button>
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>,
    document.body
  )
}
