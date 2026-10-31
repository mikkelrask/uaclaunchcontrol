import { useState } from 'react'
import { useTranslate } from '@tolgee/react'
import { Languages, Monitor } from 'lucide-react'
import { api } from '@/api'
import { queryClient } from '@/lib/queryClient'
import { applyLanguage } from '@/lib/i18n'
import { INTERFACE_LANGUAGE_OPTIONS, resolveLanguage } from '@shared/locales'
import type { LanguagePreference } from '@shared/locales'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'

/** Resolve the language before mounting guided setup, so its draft includes the saved choice. */
export function StartupLanguageDialog(): React.ReactElement {
  const { t } = useTranslate('desktop')
  const [choice, setChoice] = useState<LanguagePreference>('en')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const systemLanguage = resolveLanguage('system', navigator.languages)
  const systemName = INTERFACE_LANGUAGE_OPTIONS.find(({ value }) => value === systemLanguage)!.label

  const save = async (): Promise<void> => {
    if (saving) return
    setSaving(true)
    setError(null)
    try {
      const saved = await api.updateSettings({ language: choice })
      await applyLanguage(saved.language)
      queryClient.setQueryData(['/api/settings'], saved)
      await queryClient.invalidateQueries({ queryKey: ['/api/settings'] })
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : String(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-app-primary">
      <Dialog open>
        <DialogContent
          showCloseButton={false}
          onEscapeKeyDown={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
          className="bg-app-primary text-app-primary border-app p-0 gap-0 sm:max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto"
        >
          <div className="p-6 pb-5 border-b border-app">
            <Languages className="h-6 w-6 text-accent-highlight mb-4" aria-hidden="true" />
            <DialogTitle className="text-xl">
              {t('languageStartup.title', 'Choose your language')}
            </DialogTitle>
            <DialogDescription className="text-app-muted text-sm leading-relaxed mt-2">
              {t(
                'languageStartup.description',
                'UAC Launch Control starts in English. Choose a language before continuing.'
              )}
            </DialogDescription>
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              void save()
            }}
          >
            <fieldset disabled={saving} className="p-6 space-y-3">
              <legend className="sr-only">{t('settings.language.label', 'Language')}</legend>
              <label className="flex items-center gap-3 p-4 rounded-lg border border-app bg-app-secondary cursor-pointer has-[:checked]:border-accent-highlight has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent-highlight">
                <input
                  className="accent-accent-highlight"
                  type="radio"
                  name="startup-language"
                  value="system"
                  checked={choice === 'system'}
                  onChange={() => setChoice('system')}
                />
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-sm">
                    {t('settings.language.system', 'System language')}
                  </span>
                  <p className="text-xs text-app-muted mt-1">
                    {t(
                      'languageStartup.systemDescription',
                      'Follow your device language. Currently: {languageName}.',
                      { languageName: systemName }
                    )}
                  </p>
                </div>
                <Monitor className="h-4 w-4 text-app-muted" aria-hidden="true" />
              </label>
              {INTERFACE_LANGUAGE_OPTIONS.map(({ value, label }) => (
                <label
                  key={value}
                  className="flex items-center gap-3 p-4 rounded-lg border border-app bg-app-secondary cursor-pointer has-[:checked]:border-accent-highlight has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent-highlight"
                >
                  <input
                    className="accent-accent-highlight"
                    type="radio"
                    name="startup-language"
                    value={value}
                    checked={choice === value}
                    onChange={() => setChoice(value)}
                  />
                  <span className="font-medium text-sm">{label}</span>
                </label>
              ))}
              <p className="text-xs text-app-muted leading-relaxed">
                {t(
                  'languageStartup.changeLater',
                  'You can change this later in Settings. Untranslated text is shown in English.'
                )}
              </p>
              {error !== null && (
                <p role="alert" className="text-sm text-destructive">
                  {t(
                    'languageStartup.saveFailed',
                    'Could not save your language preference. Please try again. {error}',
                    { error }
                  )}
                </p>
              )}
            </fieldset>
            <div className="flex justify-end p-4 border-t border-app bg-app-secondary">
              <Button
                type="submit"
                disabled={saving}
                className="bg-accent-highlight text-white hover:bg-accent-highlight/90"
              >
                {saving
                  ? t('languageStartup.saving', 'Saving…')
                  : t('languageStartup.continue', 'Continue')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
