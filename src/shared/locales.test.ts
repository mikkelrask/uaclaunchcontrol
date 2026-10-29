import { describe, expect, it } from 'vitest'
import { isLanguagePreference, resolveLanguage } from './locales'

describe('language selection', () => {
  it('prefers the saved choice to the system language', () => {
    expect(resolveLanguage('da-DK', ['es-ES'])).toBe('da-DK')
    expect(resolveLanguage('es-ES', ['da-DK'])).toBe('es-ES')
  })

  it('negotiates supported regional tags in browser preference order', () => {
    expect(resolveLanguage(undefined, ['fr-FR', 'DA-dk', 'es-ES'])).toBe('da-DK')
    expect(resolveLanguage('system', ['es_MX', 'en'])).toBe('es-ES')
    expect(resolveLanguage('system', ['en-GB', 'da-DK'])).toBe('en')
  })

  it('falls back for old/invalid preferences and unsupported systems', () => {
    expect(resolveLanguage(null, ['de-DE'])).toBe('en')
    expect(resolveLanguage('broken', ['da-DK'])).toBe('da-DK')
    expect(resolveLanguage(undefined, [])).toBe('en')
  })

  it('accepts only canonical persisted preferences', () => {
    for (const value of ['system', 'en', 'da-DK', 'es-ES'])
      expect(isLanguagePreference(value)).toBe(true)
    for (const value of [null, 42, {}, 'DA', 'da', 'fr', '']) {
      expect(isLanguagePreference(value)).toBe(false)
    }
  })
})
