import { useTranslate } from '@tolgee/react'
import React from 'react'
import { Button } from '@/components/ui/button'
import uacLogo from '@/assets/UAC Logo.svg'

interface WelcomeStepProps {
  onNext: () => void
}

export const WelcomeStep: React.FC<WelcomeStepProps> = ({ onNext }) => {
  const { t } = useTranslate('desktop')
  return (
    <section className="onboarding-step" data-onboarding-step="welcome">
      <div className="onboarding-step-body settings-scroll onboarding-intro">
        <div className="relative flex items-center justify-center w-24 h-24">
          <div className="absolute inset-0 rounded-full animate-pulse" />
          <img
            src={uacLogo}
            alt=""
            className="w-11 h-11 drop-shadow-[0_0_10px_hsl(var(--accent-highlight))]"
          />
        </div>

        <div className="space-y-2">
          <div>
            <span className="font-mono text-xs uppercase tracking-[0.3em] text-accent-highlight/70">
              {t('onboarding.welcome.terminal', 'UAC-7 // Personnel Terminal')}
            </span>
          </div>
          <h1 tabIndex={-1} className="text-3xl font-bold tracking-tight text-app-primary">
            {t('onboarding.welcome.title', 'Welcome to Mars, Cadet')}
          </h1>
        </div>

        <p className="text-app-secondary max-w-md mx-auto leading-relaxed">
          {t(
            'onboarding.welcome.simpleDescription',
            "We'll look for a Doom engine and your game files, then get you ready to play. You can skip any step and change your choices later in Settings."
          )}
        </p>

        <p className="text-xs text-app-muted italic uppercase tracking-widest opacity-40 mt-6">
          {t('onboarding.footer', 'Union Aerospace Corporation — Phobos Facility Systems Division')}
        </p>
      </div>
      <footer className="onboarding-step-footer onboarding-step-footer-end">
        <Button
          data-onboarding-next
          size="lg"
          onClick={onNext}
          className="bg-accent-highlight text-white hover:bg-accent-highlight/90 mt-2 px-8 uppercase tracking-wider font-bold"
        >
          {t('onboarding.welcome.initialize', 'Initialize Setup')}
        </Button>
      </footer>
    </section>
  )
}
