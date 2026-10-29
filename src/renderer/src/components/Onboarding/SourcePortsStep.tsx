import { useTranslate } from '@tolgee/react'
import React, { useEffect, useState } from 'react'
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
  // Keep incomplete editor drafts out of the wizard's automatic persistence.
  // The parent retains the last valid configuration if this step is skipped.
  const [portSettings, setPortSettings] = useState(settings)
  const ports = portSettings.sourcePorts
  const defaultPortId = portSettings.defaultSourcePortId
  const hasIncompletePort = ports.some((port) => !port.name.trim() || !port.executablePath.trim())

  useEffect(() => {
    if (hasIncompletePort) return
    setSettings((previous) => {
      if (previous.sourcePorts === ports && previous.defaultSourcePortId === defaultPortId)
        return previous
      return { ...previous, sourcePorts: ports, defaultSourcePortId: defaultPortId }
    })
  }, [ports, defaultPortId, hasIncompletePort, setSettings])

  const next = (): void => {
    if (hasIncompletePort) return
    // Flush the latest complete edit before moving to the next step.
    setSettings((previous) => ({
      ...previous,
      sourcePorts: ports,
      defaultSourcePortId: defaultPortId
    }))
    onNext()
  }

  return (
    <OnboardingStepLayout
      id="ports"
      title={t('sourcePorts.title', 'Source Ports')}
      kicker={t('onboarding.sourcePorts.terminal', 'UAC-7 // Runtime Engine')}
      description={t(
        'onboarding.sourcePorts.workbenchDescription',
        'Choose an engine to run your games. Review the detected ports, download one, or add an executable.'
      )}
      scroll={false}
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
          <Button
            type="button"
            onClick={next}
            disabled={hasIncompletePort}
            data-onboarding-next
            className="bg-accent-highlight text-white hover:bg-accent-highlight/90 gap-1 px-6"
          >
            {t('onboarding.next', 'Next')}
            <ChevronRight className="w-4 h-4" aria-hidden="true" />
          </Button>
        </>
      }
    >
      <SourcePortsTab
        settings={portSettings}
        setSettings={setPortSettings}
        autoScan
        layout="workbench"
        showHeading={false}
        footerHint={
          hasIncompletePort
            ? t(
                'settings.state.portIncomplete',
                'Each source port needs a name and executable path.'
              )
            : ports.length > 0
              ? t(
                  'onboarding.sourcePorts.autosaveHint',
                  'Complete entries are saved automatically. Set a default to preselect it for new protocols.'
                )
              : t(
                  'onboarding.optional',
                  "You can also do this later in Settings — this step isn't required to continue."
                )
        }
      />
    </OnboardingStepLayout>
  )
}
