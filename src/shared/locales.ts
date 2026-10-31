export const APP_LANGUAGES = ['en', 'da-DK', 'es-ES'] as const
export type AppLanguage = (typeof APP_LANGUAGES)[number]
export type LanguagePreference = AppLanguage | 'system'

export function isLanguagePreference(value: unknown): value is LanguagePreference {
  return value === 'system' || APP_LANGUAGES.some((language) => language === value)
}

/** Languages offered in the desktop UI; Spanish remains valid for stored/catalog data. */
export const INTERFACE_LANGUAGE_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'da-DK', label: 'Dansk' }
] as const

export function selectableLanguagePreference(value: unknown): LanguagePreference {
  if (value === 'system') return value
  return INTERFACE_LANGUAGE_OPTIONS.find((option) => option.value === value)?.value ?? 'en'
}

/** English stays active until a user explicitly chooses a language or System. */
export function resolveLanguage(
  preference: unknown,
  browserLanguages: readonly string[]
): AppLanguage {
  const selected = selectableLanguagePreference(preference)
  if (selected !== 'system') return selected
  for (const tag of browserLanguages) {
    const base = tag.toLowerCase().split(/[-_]/)[0]
    const language = INTERFACE_LANGUAGE_OPTIONS.find(
      ({ value }) => value.toLowerCase().split('-')[0] === base
    )
    if (language) return language.value
  }
  return 'en'
}
