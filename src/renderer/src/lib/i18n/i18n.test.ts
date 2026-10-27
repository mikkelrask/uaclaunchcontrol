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
    expect(tolgee.t('settings.language.label')).toBe(da['settings.language.label'])
    const path = '<script>file</script>/{literal}/save.wad'
    expect(tolgee.t('settings.icon.moved', { path })).toBe(
      da['settings.icon.moved'].replace('{path}', path)
    )
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
    expect(tolgee.t('settings.wads.detected', { count: 2 })).toContain('2')
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
    const expected = da['settings.registry.description']
      .split('{br}')
      .map((line) => renderToStaticMarkup(createElement('span', null, line)).slice(6, -7))
      .join('<br/>')
    expect(html).toBe(expected)
    expect(html).not.toContain('{br}')
    tolgee.stop()
  })

  it('uses English fallback without changing technical parameters', async () => {
    const tolgee = createI18n('es-ES')
    await tolgee.run()
    expect(tolgee.t('sourcePorts.title')).toBe('Source Ports')
    expect(tolgee.t('sourcePorts.scan.found', { count: 0 })).toBe('Found 0 ports')
    expect(tolgee.t('sourcePorts.scan.found', { count: 1 })).toBe('Found 1 port')
    expect(tolgee.t('sourcePorts.scan.found', { count: 2 })).toBe('Found 2 ports')
    expect(tolgee.t('settings.customTheme.wrap', { selector: '.custom { }' })).toBe(
      'Wrap in .custom { }'
    )
    expect(tolgee.t('settings.wads.parametersExample', { arguments: '-nomonsters -warp 01' })).toBe(
      'e.g. -nomonsters -warp 01'
    )
    const format = '--variable-name: hue saturation lightness;'
    const example = '--bg-primary: 220 18% 5%;'
    const html = renderToStaticMarkup(
      createElement(
        TolgeeProvider,
        { tolgee },
        createElement(T, {
          keyName: 'settings.customTheme.instructions',
          ns: 'desktop',
          params: {
            format: createElement('code', null, format),
            example: createElement('code', null, example),
            wrapper: createElement('code', null, '.custom { ... }')
          }
        })
      )
    )
    expect(html).toContain(`<code>${format}</code>`)
    expect(html).toContain(`<code>${example}</code>`)
    expect(html).toContain('<code>.custom { ... }</code>')
    expect(html).not.toContain('{wrapper}')
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
