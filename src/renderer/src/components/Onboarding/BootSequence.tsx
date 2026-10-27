import { useTranslate } from '@tolgee/react'
import React, { useEffect, useState } from 'react'

interface BootSequenceProps {
  onComplete: () => void
}

const BOOT_LINE_COUNT = 4

const LINE_DELAY_MS = 260
const HOLD_AFTER_LAST_MS = 500

/**
 * One-time terminal-boot flourish shown before the wizard's Welcome step.
 * Skips straight to onComplete under prefers-reduced-motion.
 */
export const BootSequence: React.FC<BootSequenceProps> = ({ onComplete }) => {
  const { t } = useTranslate('desktop')
  const bootLines = [
    t('onboarding.boot.terminal', 'UAC-7 TERMINAL BOOT…'),
    t('onboarding.boot.interface', 'INITIALIZING PERSONNEL INTERFACE…'),
    t('onboarding.boot.registry', 'LOADING SOURCE PORT REGISTRY…'),
    t('onboarding.boot.access', 'ACCESS GRANTED')
  ]

  const [visibleCount, setVisibleCount] = useState(0)
  const [reducedMotion] = useState(
    () =>
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )

  useEffect(() => {
    if (reducedMotion) {
      onComplete()
      return
    }

    const timers: ReturnType<typeof setTimeout>[] = []
    Array.from({ length: BOOT_LINE_COUNT }).forEach((_, i) => {
      timers.push(setTimeout(() => setVisibleCount(i + 1), i * LINE_DELAY_MS))
    })
    timers.push(setTimeout(onComplete, BOOT_LINE_COUNT * LINE_DELAY_MS + HOLD_AFTER_LAST_MS))

    return () => timers.forEach(clearTimeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion])

  if (reducedMotion) return null

  return (
    <div className="fixed inset-0 z-50 bg-app-primary flex items-center justify-center">
      <div className="font-mono text-sm space-y-1.5 w-full max-w-md px-8">
        {bootLines.slice(0, visibleCount).map((line, i) => (
          <p
            key={i}
            className={
              i === BOOT_LINE_COUNT - 1
                ? 'text-green-500 tracking-widest'
                : 'text-app-muted tracking-wide'
            }
          >
            {line}
            {i === visibleCount - 1 && i !== BOOT_LINE_COUNT - 1 && (
              <span className="animate-pulse">_</span>
            )}
          </p>
        ))}
      </div>
    </div>
  )
}
