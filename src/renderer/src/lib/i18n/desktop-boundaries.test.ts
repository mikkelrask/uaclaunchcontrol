import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { TolgeeProvider } from '@tolgee/react'
import { api } from '@/api'
import { toast } from '@/hooks/use-toast'
import { DoomIcon, DefaultWadIcon, DoomVersionIcon } from '@/icons/DoomIcons'
import { ToastProvider, ToastViewport } from '@/components/ui/toast'
import { getDiagnosticTitle } from './diagnostic-messages'
import { i18n } from './index'
import da from './locales/desktop/da-DK.json'

const render = (children: React.ReactNode): string =>
  renderToStaticMarkup(createElement(TolgeeProvider, { tolgee: i18n }, children))

afterEach(async () => {
  vi.unstubAllGlobals()
  await i18n.changeLanguage('en')
  i18n.stop()
})

describe('remaining desktop localisation boundaries', () => {
  it('resolves diagnostic headings at event time and preserves opaque codes', async () => {
    await i18n.run()
    expect(getDiagnosticTitle('fatal', 'settings.save()')).toBe('FATAL: settings.save()')
    await i18n.changeLanguage('da-DK')
    expect(getDiagnosticTitle('fatal', 'settings.save()')).toBe('KRITISK: settings.save()')
    expect(getDiagnosticTitle('warning', 'invalid_file')).toBe('ADVARSEL: invalid_file')
    expect(getDiagnosticTitle('system', 'archive_extracted')).toBe('SYSTEM: archive_extracted')
    await i18n.changeLanguage('es-ES')
    expect(getDiagnosticTitle('warning', 'invalid_file')).toBe('WARNING: invalid_file')
  })

  it('records translated warnings through the toast adapter while routine messages remain transient', async () => {
    await i18n.run()
    await i18n.changeLanguage('da-DK')
    const values = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value)
    })
    toast({ title: getDiagnosticTitle('warning', 'invalid_file'), historyKind: 'warning' })
    const history = JSON.parse(values.get('uac:notifications')!)
    expect(history[0]).toMatchObject({
      title: 'ADVARSEL: invalid_file',
      kind: 'warning',
      variant: 'default'
    })
    toast({ title: getDiagnosticTitle('system', 'hashing') })
    expect(JSON.parse(values.get('uac:notifications')!)).toHaveLength(history.length)
  })

  it('localises renderer-owned API fallbacks without rewriting server diagnostics', async () => {
    await i18n.run()
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    await i18n.changeLanguage('da-DK')
    fetch.mockResolvedValueOnce(new Response('', { status: 503 }))
    await expect(api.getSettings()).rejects.toThrow('API-fejl: 503')
    const raw = 'ENOENT /tmp/Knee Deep.pk3 {engine diagnostic}'
    fetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: raw }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    )
    await expect(api.getSettings()).rejects.toThrow(raw)
    fetch.mockResolvedValueOnce(new Response('', { status: 409 }))
    await expect(api.deleteDoomVersion('canonical-id')).rejects.toThrow(
      'Kunne ikke slette versionen: 409'
    )
    expect(fetch).toHaveBeenLastCalledWith('http://localhost:7666/api/versions/canonical-id', {
      method: 'DELETE'
    })
    await i18n.changeLanguage('es-ES')
    fetch.mockResolvedValueOnce(new Response('', { status: 503 }))
    await expect(api.getSettings()).rejects.toThrow('API error: 503')
  })

  it('translates icon descriptions while retaining game names, titles and custom paths', async () => {
    await i18n.run()
    await i18n.changeLanguage('da-DK')
    const html = render(
      createElement(
        'div',
        null,
        createElement(DoomIcon),
        createElement(DefaultWadIcon),
        createElement(DoomVersionIcon, { version: 'custom', customIcon: '/fixture/Knee Deep.png' })
      )
    )
    expect(html).toContain('alt="Doom-ikon"')
    expect(html).toContain('title="DOOM"')
    expect(html).toContain(da['icons.defaultWad'])
    expect(html).toContain(da['icons.customWad'])
    expect(html).toContain('http://localhost:7666/api/media?path=%2Ffixture%2FKnee%20Deep.png')
  })

  it('localises the notification region and retains Radix hotkey substitution and caller overrides', async () => {
    await i18n.run()
    await i18n.changeLanguage('da-DK')
    const html = render(createElement(ToastProvider, null, createElement(ToastViewport)))
    expect(html).toContain('aria-label="Meddelelser (F8)"')
    const custom = render(
      createElement(
        ToastProvider,
        null,
        createElement(ToastViewport, { label: 'Custom region', hotkey: ['F9'] })
      )
    )
    expect(custom).toContain('aria-label="Custom region"')
    expect(custom).not.toContain('Meddelelser')
  })
})
