import { useTranslate } from '@tolgee/react'
import React, { useId } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { OnboardingStepLayout } from './OnboardingStepLayout'
import type { IAppSettings } from '@shared/schema'

interface RegistryStepProps {
  settings: IAppSettings
  setSettings: React.Dispatch<React.SetStateAction<IAppSettings>>
  onNext: () => void
  onBack: () => void
}

/**
 * Opt-in step for the UAC Registry. Enabling turns on automatic metadata
 * lookups (names, versions, categories, load orders) when adding/downloading
 * mods AND lets the app contribute metadata for unrecognized files to the
 * shared registry. Off by default — privacy-first, but visible in onboarding
 * since it's a core feature.
 */
export const RegistryStep: React.FC<RegistryStepProps> = ({
  settings,
  setSettings,
  onNext,
  onBack
}) => {
  const { t } = useTranslate('desktop')
  const toggleId = useId()
  const handleToggle = (checked: boolean): void => {
    setSettings((prev) => {
      if (checked && !prev.registryUuid) {
        // A UUID is the app's identity when contributing metadata — mint one
        // the same way Settings does.
        return { ...prev, registryLookupEnabled: checked, registryUuid: crypto.randomUUID() }
      }
      return { ...prev, registryLookupEnabled: checked }
    })
  }

  const enabled = settings.registryLookupEnabled ?? false

  return (
    <OnboardingStepLayout
      id="registry"
      title={t('onboarding.registry.title', 'UAC Registry')}
      kicker={t('onboarding.registry.terminal', 'UAC-7 // Data Uplink')}
      description={t(
        'onboarding.registry.simpleDescription',
        'Let the community database help identify the mods you add.'
      )}
      footer={
        <>
          <Button
            data-onboarding-back
            variant="ghost"
            onClick={onBack}
            className="text-app-muted hover:text-app-primary gap-1"
          >
            <ChevronLeft className="w-4 h-4" />
            {t('onboarding.back', 'Back')}
          </Button>
          <Button
            data-onboarding-next
            onClick={onNext}
            className="bg-accent-highlight text-white hover:bg-accent-highlight/90 gap-1 px-6"
          >
            {t('onboarding.next', 'Next')}
            <ChevronRight className="w-4 h-4" />
          </Button>
        </>
      }
    >
      <div className="onboarding-registry-choice">
        <div>
          <Label htmlFor={toggleId}>{t('onboarding.registry.enable', 'Enable registry')}</Label>
          <p>
            {t(
              'onboarding.registry.simpleBenefit',
              'Fill in mod names, versions, categories and load order automatically.'
            )}
          </p>
        </div>
        <Switch
          id={toggleId}
          aria-label={t('onboarding.registry.enable', 'Enable registry')}
          checked={enabled}
          onCheckedChange={handleToggle}
        />
      </div>
      <div className="onboarding-registry-details">
        <p>
          {t(
            'onboarding.registry.simpleContribution',
            'Enabling this also shares the names and file hashes of unrecognized mods to help other players. Your files, folders and game data are never uploaded.'
          )}
        </p>
        <p>
          {t(
            'onboarding.registry.simpleOptional',
            'Optional and off by default. Requires an internet connection. You can change this in Settings anytime.'
          )}
        </p>
      </div>
    </OnboardingStepLayout>
  )
}

export default RegistryStep
