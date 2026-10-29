import { T, useTranslate } from '@tolgee/react'
import React from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { ChevronLeft, ChevronRight, Database } from 'lucide-react'
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
        'onboarding.registry.description',
        'A community database of mod metadata — names, versions, categories and load orders — maintained by players like you.'
      )}
      footer={
        <>
          {' '}
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
      <div className="onboarding-registry-panel space-y-4">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-accent-highlight/10 rounded-md shrink-0">
            <Database className="w-4 h-4 text-accent-highlight" />
          </div>
          <div className="space-y-1.5">
            <div>
              <Label className="text-xs text-app-muted font-bold uppercase tracking-wider">
                {t('onboarding.registry.whatEnablingDoes', 'What enabling does')}
              </Label>
            </div>
            <ul className="text-xs text-app-secondary space-y-1.5 leading-relaxed">
              <li>
                <T
                  ns="desktop"
                  keyName="onboarding.registry.lookupDescription"
                  defaultValue="{lookUp} — mods you add or download get their name, version, category and load order filled in automatically."
                  params={{
                    lookUp: (
                      <span className="text-app-primary font-semibold">
                        {t('onboarding.registry.lookup', 'Look up')}
                      </span>
                    )
                  }}
                />
              </li>
              <li>
                <T
                  ns="desktop"
                  keyName="onboarding.registry.contributeDescription"
                  defaultValue="{contribute} — files the registry doesn't recognize yet have their metadata (hashes and names only) offered to the shared database for others."
                  params={{
                    contribute: (
                      <span className="text-app-primary font-semibold">
                        {t('onboarding.registry.contribute', 'Contribute')}
                      </span>
                    )
                  }}
                />
              </li>
            </ul>
            <p className="text-[0.625rem] text-app-muted italic leading-tight">
              {t(
                'onboarding.registry.privacy',
                'Your mod files, folders and game data are never uploaded — only metadata. You can change this anytime in Settings.'
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-app/50 pt-3">
          <div className="space-y-0.5">
            <Label className="text-xs text-app-primary font-medium">
              {t('onboarding.registry.enable', 'Enable registry')}
            </Label>
            <p className="text-[0.625rem] text-app-muted leading-tight">
              {t(
                'onboarding.registry.connection',
                'Off by default — requires an active connection to the UAC Registry.'
              )}
            </p>
          </div>
          <Switch
            aria-label={t('onboarding.registry.enable', 'Enable registry')}
            checked={enabled}
            onCheckedChange={handleToggle}
          />
        </div>
      </div>
    </OnboardingStepLayout>
  )
}

export default RegistryStep
