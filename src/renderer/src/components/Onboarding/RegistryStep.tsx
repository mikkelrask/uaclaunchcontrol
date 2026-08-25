import React from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { ChevronLeft, ChevronRight, Database } from 'lucide-react'
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
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <span className="font-mono text-xs uppercase tracking-[0.3em] text-accent-highlight/70">
          UAC-7 // Data Uplink
        </span>
        <h2 className="text-2xl font-bold tracking-tight text-app-primary">UAC Registry</h2>
        <p className="text-sm text-app-secondary max-w-lg mx-auto">
          A community database of mod metadata — names, versions, categories and load orders —
          maintained by players like you.
        </p>
      </div>

      <div className="bg-app-secondary p-4 rounded-xl border border-app shadow-sm space-y-3">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-accent-highlight/10 rounded-md shrink-0">
            <Database className="w-4 h-4 text-accent-highlight" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-app-muted font-bold uppercase tracking-wider">
              What enabling does
            </Label>
            <ul className="text-xs text-app-secondary space-y-1.5 leading-relaxed">
              <li>
                <span className="text-app-primary font-semibold">Look up</span> — mods you add or
                download get their name, version, category and load order filled in automatically.
              </li>
              <li>
                <span className="text-app-primary font-semibold">Contribute</span> — files the
                registry doesn&apos;t recognize yet have their metadata (hashes and names only)
                offered to the shared database for others.
              </li>
            </ul>
            <p className="text-[0.625rem] text-app-muted italic leading-tight">
              Your mod files, folders and game data are never uploaded — only metadata. You can
              change this anytime in Settings.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-app/50 pt-3">
          <div className="space-y-0.5">
            <Label className="text-xs text-app-primary font-medium">Enable registry</Label>
            <p className="text-[0.625rem] text-app-muted leading-tight">
              Off by default — requires an active connection to the UAC Registry.
            </p>
          </div>
          <Switch checked={enabled} onCheckedChange={handleToggle} />
        </div>
      </div>

      <div className="flex items-center justify-between pt-2">
        <Button
          variant="ghost"
          onClick={onBack}
          className="text-app-muted hover:text-app-primary gap-1"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </Button>
        <Button
          onClick={onNext}
          className="bg-accent-highlight text-white hover:bg-accent-highlight/90 gap-1 px-6"
        >
          Next
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}

export default RegistryStep
