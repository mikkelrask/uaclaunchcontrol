import { useTranslate } from '@tolgee/react'
import React, { useEffect, useState } from 'react'

function formatClock(date: Date): string {
  return date.toTimeString().slice(0, 8)
}

function useClock(): string {
  const [time, setTime] = useState(() => formatClock(new Date()))
  useEffect(() => {
    const id = setInterval(() => setTime(formatClock(new Date())), 1000)
    return () => clearInterval(id)
  }, [])
  return time
}

const LogColumn: React.FC<{ lines: string[]; align: 'left' | 'right' }> = ({ lines, align }) => (
  <div
    className={`hidden 2xl:block fixed top-28 bottom-20 w-44 overflow-hidden uac-log-fade-mask pointer-events-none z-40 ${
      align === 'left' ? 'left-6 text-left' : 'right-6 text-right'
    }`}
  >
    <div className="uac-log-track">
      {[...lines, ...lines].map((line, i) => (
        <p
          key={i}
          className="font-mono text-[10px] uppercase tracking-widest text-app-muted/40 leading-8 whitespace-nowrap"
        >
          {line}
        </p>
      ))}
    </div>
  </div>
)

const HudCorner: React.FC<{ position: 'tl' | 'tr' | 'bl' | 'br' }> = ({ position }) => {
  const placement = {
    tl: 'top-3 left-3 border-t-2 border-l-2',
    tr: 'top-3 right-3 border-t-2 border-r-2',
    bl: 'bottom-3 left-3 border-b-2 border-l-2',
    br: 'bottom-3 right-3 border-b-2 border-r-2'
  }[position]
  return (
    <div
      className={`fixed w-5 h-5 border-accent-highlight/25 pointer-events-none z-40 ${placement}`}
    />
  )
}

/**
 * Purely decorative HUD/terminal texture layer for the onboarding wizard —
 * scanlines, corner brackets, ambient log feed, wall clock, REC indicator.
 * Entirely pointer-events-none, colors derive from theme CSS vars so it
 * stays correct across Default/Light/Terminal Green/Custom.
 */
export const OnboardingChrome: React.FC = () => {
  const { t } = useTranslate('desktop')
  const LEFT_LOG_LINES = [
    t('onboarding.chrome.uplink', 'PHOBOS UPLINK — NOMINAL'),
    t('onboarding.chrome.auth', 'AUTH TOKEN … VERIFIED'),
    t('onboarding.chrome.scanning', 'SCANNING FOR SOURCE PORTS'),
    t('onboarding.chrome.wads', 'WAD REGISTRY SYNC OK'),
    t('onboarding.chrome.containment', 'CONTAINMENT FIELD — HOLDING'),
    t('onboarding.chrome.personnel', 'PERSONNEL FILE LOADED')
  ]

  const RIGHT_LOG_LINES = [
    t('onboarding.chrome.anomaly', 'ANOMALY LEVEL — NONE DETECTED'),
    'SIGNAL://UAC-7.PHOBOS.NET',
    t('onboarding.chrome.clearance', 'ACCESS LEVEL — CLEARANCE 4'),
    t('onboarding.chrome.catalog', 'MOD CATALOGUE INDEXED'),
    t('onboarding.chrome.power', 'AUX POWER — STABLE'),
    t('onboarding.chrome.awaiting', 'AWAITING OPERATOR INPUT')
  ]

  const time = useClock()

  return (
    <>
      <div className="fixed inset-0 pointer-events-none z-40 uac-scanlines mix-blend-overlay" />
      <HudCorner position="tl" />
      <HudCorner position="tr" />
      <HudCorner position="bl" />
      <HudCorner position="br" />
      <LogColumn lines={LEFT_LOG_LINES} align="left" />
      <LogColumn lines={RIGHT_LOG_LINES} align="right" />
      <div className="fixed bottom-4 left-6 font-mono text-[10px] tracking-widest text-app-muted/40 pointer-events-none z-40">
        {time}
      </div>
      <div className="fixed bottom-4 right-6 flex items-center gap-1.5 font-mono text-[10px] tracking-widest text-app-muted/40 pointer-events-none z-40">
        <span className="w-1.5 h-1.5 rounded-full bg-accent-highlight/60 animate-pulse" />
        {t('onboarding.chrome.recording', 'REC')}
      </div>
    </>
  )
}
