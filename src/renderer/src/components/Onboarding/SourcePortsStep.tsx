import { useTranslate } from '@tolgee/react'
import React from 'react'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { IAppSettings } from '@shared/schema'
import { SourcePortsTab } from '@/components/SourcePortsTab'
import { OnboardingStepLayout } from './OnboardingStepLayout'

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

  return (
    <OnboardingStepLayout
      id="ports"
      title={t('sourcePorts.title', 'Source Ports')}
      kicker={t('onboarding.sourcePorts.terminal', 'UAC-7 // Runtime Engine')}
      description={t(
        'onboarding.sourcePorts.discoveryDescription',
        'Source ports are the engines that run your games. We’ve checked your computer for you — add the ones you want to use.'
      )}
      footer={
        <>
          <Button
            type="button"
            variant="ghost"
            onClick={onBack}
            data-onboarding-back
            className="text-app-muted hover:text-app-primary gap-1"
          >
            <ChevronLeft className="w-4 h-4" aria-hidden="true" />
            {t('onboarding.back', 'Back')}
          </Button>
          <Button type="button" onClick={onNext} data-onboarding-next className="gap-1 px-6">
            {t('onboarding.next', 'Next')}
            <ChevronRight className="w-4 h-4" aria-hidden="true" />
          </Button>
        </>
      }
    >
      <SourcePortsTab
        settings={settings}
        setSettings={setSettings}
        autoScan
        layout="setup"
        showHeading={false}
        footerHint={t(
          'onboarding.optional',
          "You can also do this later in Settings — this step isn't required to continue."
        )}
      />
    </OnboardingStepLayout>
  )
}
