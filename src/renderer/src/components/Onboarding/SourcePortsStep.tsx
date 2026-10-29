import { T, useTranslate } from '@tolgee/react'
import React from 'react'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { IAppSettings } from '@shared/schema'
import { SourcePortsTab } from '@/components/SourcePortsTab'

interface SourcePortsStepProps {
  settings: IAppSettings
  setSettings: React.Dispatch<React.SetStateAction<IAppSettings>>
  onNext: () => void
  onBack: () => void
}

export const SourcePortsStep: React.FC<SourcePortsStepProps> = ({
  settings,
  setSettings,
  onNext,
  onBack
}) => {
  const { t } = useTranslate('desktop')
  const hasPort = settings.sourcePorts.length > 0

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <div>
          <span className="font-mono text-xs uppercase tracking-[0.3em] text-accent-highlight/70">
            {t('onboarding.sourcePorts.terminal', 'UAC-7 // Runtime Engine')}
          </span>
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-app-primary">
          {t('sourcePorts.title', 'Source Ports')}
        </h2>
        <p className="text-sm text-app-secondary max-w-lg mx-auto">
          <T
            ns="desktop"
            keyName="onboarding.sourcePorts.description"
            defaultValue="Your terminal has been scanned for already installed source ports {engines} — if any are found, you can add all, some, or add one at a specific location manually. {br}{br}You can also download one of your choosing directly with the {getPort} button — no need to leave the app."
            params={{
              engines: (
                <em>
                  {t('onboarding.sourcePorts.engineExamples', '({engines} and others)', {
                    engines: 'GZDoom, UZDoom, Zandronum, Helion'
                  })}
                </em>
              ),
              getPort: <strong>{t('sourcePorts.get', 'Get Port')}</strong>,
              br: <br />
            }}
          />
        </p>
      </div>

      <SourcePortsTab settings={settings} setSettings={setSettings} autoScan />

      {hasPort ? (
        <p className="text-xs text-app-muted italic text-center opacity-70">
          {t(
            'onboarding.sourcePorts.defaultHint',
            "Click the dot next to a port to make it your default — it'll be pre-selected when you create a new protocol."
          )}
        </p>
      ) : (
        <p className="text-sm text-app-muted italic text-center">
          {t(
            'onboarding.optional',
            "You can also do this later in Settings — this step isn't required to continue."
          )}
        </p>
      )}

      <div className="flex items-center justify-between pt-2">
        <Button
          variant="ghost"
          onClick={onBack}
          className="text-app-muted hover:text-app-primary gap-1"
        >
          <ChevronLeft className="w-4 h-4" />
          {t('onboarding.back', 'Back')}
        </Button>
        <Button
          onClick={onNext}
          className="bg-accent-highlight text-white hover:bg-accent-highlight/90 gap-1 px-6"
        >
          {t('onboarding.next', 'Next')}
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}
