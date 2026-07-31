import React from 'react'
import { Button } from '@/components/ui/button'
import uacLogo from '@/assets/UAC Logo.svg'

interface WelcomeStepProps {
  onNext: () => void
}

export const WelcomeStep: React.FC<WelcomeStepProps> = ({ onNext }) => {
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
          UAC-7 // Personnel Terminal
        </span>
        <h1 className="text-3xl font-bold tracking-tight text-app-primary">
          Welcome to Mars, Cadet
        </h1>
      </div>

      <p className="text-app-secondary max-w-md mx-auto leading-relaxed">
        This is the <strong>UAC Launch Control</strong> - your command centre for managing and
        launching Doom source ports, IWADs, and mods. <br />
        <br />
        Let&apos;s get the essentials in place — a source port and some WAD files — so you can start
        playing.
      </p>

      <Button
        size="lg"
        onClick={onNext}
        className="bg-accent-highlight text-white hover:bg-accent-highlight/90 mt-2 px-8 uppercase tracking-wider font-bold"
      >
        Initialize Setup
      </Button>

      <p className="text-xs text-app-muted italic uppercase tracking-widest opacity-40 mt-6">
        Union Aerospace Corporation — Phobos Facility Systems Division
      </p>
    </div>
  )
}
