import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { T, TolgeeProvider } from '@tolgee/react'
import { parse, TYPE, type MessageFormatElement } from '@formatjs/icu-messageformat-parser'
import { createI18n } from './index'
import en from './locales/desktop/en.json'
import da from './locales/desktop/da-DK.json'
import es from './locales/desktop/es-ES.json'

function parameters(elements: MessageFormatElement[], result = new Set<string>()): string[] {
  for (const element of elements) {
    if (element.type !== TYPE.literal && element.type !== TYPE.pound) result.add(element.value)
    if (element.type === TYPE.plural || element.type === TYPE.select) {
      for (const option of Object.values(element.options)) parameters(option.value, result)
    } else if (element.type === TYPE.tag) parameters(element.children, result)
  }
  return [...result].sort()
}

afterEach(() => vi.unstubAllGlobals())

describe('bundled desktop translations', () => {
  it('switches offline, interpolates paths as data, and uses English for missing Spanish', async () => {
    const fetch = vi.fn(() => {
      throw new Error('No network available')
    })
    vi.stubGlobal('fetch', fetch)
    const tolgee = createI18n('da-DK')
    await tolgee.run()
    expect(tolgee.t('settings.language.label')).toBe('Sprog')
    const path = '<script>file</script>/{literal}/save.wad'
    expect(tolgee.t('settings.icon.moved', { path })).toBe(`Ikon flyttet til ${path}`)
    await tolgee.changeLanguage('es-ES')
    expect(tolgee.t('settings.language.label')).toBe('Language')
    await tolgee.changeLanguage('en')
    expect(tolgee.t('navigation.launch')).toBe('LAUNCH')
    expect(fetch).not.toHaveBeenCalled()
    tolgee.stop()
  })

  it('formats real plural messages without dynamic code generation', async () => {
    const tolgee = createI18n('en')
    vi.stubGlobal('eval', () => {
      throw new Error('CSP blocked eval')
    })
    vi.stubGlobal('Function', () => {
      throw new Error('CSP blocked Function')
    })
    await tolgee.run()
    expect(tolgee.t('settings.wads.detected', { count: 0 })).toBe('No WADs detected')
    expect(tolgee.t('settings.wads.detected', { count: 1 })).toBe('1 WAD detected')
    expect(tolgee.t('settings.wads.detected', { count: 2 })).toBe('2 WADs detected')
    await tolgee.changeLanguage('da-DK')
    expect(tolgee.t('settings.wads.detected', { count: 2 })).toBe('2 WAD-filer fundet')
    tolgee.stop()
  })

  it('renders React rich text with safe line break placeholders', async () => {
    const tolgee = createI18n('da-DK')
    await tolgee.run()
    const html = renderToStaticMarkup(
      createElement(
        TolgeeProvider,
        { tolgee },
        createElement(T, {
          keyName: 'settings.registry.description',
          ns: 'desktop',
          params: { br: createElement('br') }
        })
      )
    )
    expect(html).toContain('<br/>')
    expect(html).toContain('Kræver en aktiv forbindelse')
    expect(html).not.toContain('{br}')
    tolgee.stop()
  })

  it('validates every ICU catalog and preserves source placeholders in translations', () => {
    const source: Record<string, string> = en
    const catalogs: Record<string, string>[] = [en, da, es]
    for (const catalog of catalogs) {
      for (const [key, message] of Object.entries(catalog)) {
        expect(source, `Unknown key ${key}`).toHaveProperty(key)
        expect(message.trim(), `Empty translation ${key}`).not.toBe('')
        expect(parameters(parse(message)), key).toEqual(parameters(parse(source[key])))
      }
    }
  })
})
