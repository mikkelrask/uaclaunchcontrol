export const APP_LANGUAGES = ['en', 'da-DK', 'es-ES'] as const
export type AppLanguage = (typeof APP_LANGUAGES)[number]
export type LanguagePreference = AppLanguage | 'system'

export function isLanguagePreference(value: unknown): value is LanguagePreference {
  return value === 'system' || APP_LANGUAGES.some((language) => language === value)
}

/** Saved tags are canonical; browser regional tags are negotiated separately. */
export function resolveLanguage(
  preference: unknown,
  browserLanguages: readonly string[]
): AppLanguage {
  if (isLanguagePreference(preference) && preference !== 'system') return preference
  for (const tag of browserLanguages) {
    const base = tag.toLowerCase().split(/[-_]/)[0]
    const language = APP_LANGUAGES.find(
      (supported) => supported.toLowerCase().split('-')[0] === base
    )
    if (language) return language
  }
  return 'en'
}
