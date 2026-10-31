import { describe, expect, it } from 'vitest'
import {
  INTERFACE_LANGUAGE_OPTIONS,
  isLanguagePreference,
  resolveLanguage,
  selectableLanguagePreference
} from './locales'

describe('language selection', () => {
  it('keeps English until a user explicitly chooses a preference', () => {
    for (const unset of [undefined, null, '', 'broken']) {
      expect(resolveLanguage(unset, ['da-DK'])).toBe('en')
      expect(isLanguagePreference(unset)).toBe(false)
    }
  })

  it('prefers the saved choice to the system language', () => {
    expect(resolveLanguage('da-DK', ['en-GB'])).toBe('da-DK')
    expect(resolveLanguage('en', ['da-DK'])).toBe('en')
  })

  it('negotiates published regional tags only after System is explicitly chosen', () => {
    expect(resolveLanguage('system', ['fr-FR', 'DA-dk', 'es-ES'])).toBe('da-DK')
    expect(resolveLanguage('system', ['es_MX', 'en'])).toBe('en')
    expect(resolveLanguage('system', ['en-GB', 'da-DK'])).toBe('en')
    expect(resolveLanguage('system', ['es-ES', 'da-DK'])).toBe('da-DK')
    expect(resolveLanguage('system', ['de-DE'])).toBe('en')
    expect(resolveLanguage('system', [])).toBe('en')
  })

  it('keeps Spanish catalog and persisted data valid while hiding it from the UI', () => {
    expect(INTERFACE_LANGUAGE_OPTIONS.map(({ value }) => value)).toEqual(['en', 'da-DK'])
    expect(isLanguagePreference('es-ES')).toBe(true)
    expect(resolveLanguage('es-ES', ['da-DK'])).toBe('en')
    expect(selectableLanguagePreference('es-ES')).toBe('en')
    expect(selectableLanguagePreference('system')).toBe('system')
    expect(selectableLanguagePreference('da-DK')).toBe('da-DK')
  })

  it('accepts only canonical persisted preferences', () => {
    for (const value of ['system', 'en', 'da-DK', 'es-ES'])
      expect(isLanguagePreference(value)).toBe(true)
    for (const value of [null, 42, {}, 'DA', 'da', 'fr', ''])
      expect(isLanguagePreference(value)).toBe(false)
  })
})
