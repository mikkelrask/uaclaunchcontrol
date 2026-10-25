import { Tolgee } from '@tolgee/react'
import { FormatIcu } from '@tolgee/format-icu'
import { APP_LANGUAGES, resolveLanguage } from '@shared/locales'
import en from './locales/desktop/en.json'
import da from './locales/desktop/da-DK.json'
import es from './locales/desktop/es-ES.json'

/** Eager data works under packaged file:// without credentials or network. */
export function createI18n(language = 'en') {
  return Tolgee()
    .use(FormatIcu())
    .init({
      language,
      availableLanguages: [...APP_LANGUAGES],
      fallbackLanguage: 'en',
      defaultNs: 'desktop',
      ns: ['desktop'],
      staticData: { 'en:desktop': en, 'da-DK:desktop': da, 'es-ES:desktop': es }
    })
}

export const i18n = createI18n()

export async function applyLanguage(preference: unknown): Promise<void> {
  const language = resolveLanguage(preference, navigator.languages)
  await i18n.changeLanguage(language)
  document.documentElement.lang = language
}
