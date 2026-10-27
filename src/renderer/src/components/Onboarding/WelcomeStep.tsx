import { T, useTranslate } from '@tolgee/react'
import React from 'react'
import { Button } from '@/components/ui/button'
import uacLogo from '@/assets/UAC Logo.svg'

interface WelcomeStepProps {
  onNext: () => void
}

export const WelcomeStep: React.FC<WelcomeStepProps> = ({ onNext }) => {
  const { t } = useTranslate('desktop')
  return (
    <div className="flex flex-col items-center text-center gap-6 pt-12">
      <div className="relative flex items-center justify-center w-24 h-24">
        <div className="absolute inset-0 rounded-full animate-pulse" />
        <img
          src={uacLogo}
          alt=""
          className="w-11 h-11 drop-shadow-[0_0_10px_hsl(var(--accent-highlight))]"
        />
      </div>

      <div className="space-y-2">
        <span className="font-mono text-xs uppercase tracking-[0.3em] text-accent-highlight/70">
          {t('onboarding.welcome.terminal', 'UAC-7 // Personnel Terminal')}
        </span>
        <h1 className="text-3xl font-bold tracking-tight text-app-primary">
          {t('onboarding.welcome.title', 'Welcome to Mars, Cadet')}
        </h1>
      </div>

      <p className="text-app-secondary max-w-md mx-auto leading-relaxed">
        <T
          ns="desktop"
          keyName="onboarding.welcome.description"
          defaultValue="This is the {app} - your command centre for managing and launching Doom source ports, IWADs, and mods. {br}{br}Let's get the essentials in place — a source port and some WAD files — so you can start playing."
          params={{ app: <strong>UAC Launch Control</strong>, br: <br /> }}
        />
      </p>

      <Button
        size="lg"
        onClick={onNext}
        className="bg-accent-highlight text-white hover:bg-accent-highlight/90 mt-2 px-8 uppercase tracking-wider font-bold"
      >
        {t('onboarding.welcome.initialize', 'Initialize Setup')}
      </Button>

      <p className="text-xs text-app-muted italic uppercase tracking-widest opacity-40 mt-6">
        {t('onboarding.footer', 'Union Aerospace Corporation — Phobos Facility Systems Division')}
      </p>
    </div>
  )
}
