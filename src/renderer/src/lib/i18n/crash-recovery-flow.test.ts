import { afterEach, describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { TolgeeProvider } from '@tolgee/react'
import { i18n } from './index'
import { getCrashText } from './crash-messages'
import { inferCrashHint } from '@/lib/crashHints'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import NotFound from '@/pages/not-found'
import { Pagination, PaginationPrevious, PaginationNext } from '@/components/ui/pagination'
import da from './locales/desktop/da-DK.json'

afterEach(async () => {
  await i18n.changeLanguage('en')
  i18n.stop()
})

describe('crash and recovery localisation boundaries', () => {
  it('matches unchanged engine output and resolves hints at display time', async () => {
    await i18n.run()
    const log = ['GZDoom 4.14', 'Cannot find a game IWAD.']
    const original = [...log]
    expect(inferCrashHint(log)).toContain("Couldn't find the IWAD")
    await i18n.changeLanguage('da-DK')
    expect(inferCrashHint(log)).toBe(da['crash.hint.iwad'])
    expect(log).toEqual(original)
    await i18n.changeLanguage('es-ES')
    expect(inferCrashHint(log)).toContain("Couldn't find the IWAD")
  })

  it.each([
    ["Unable to open file 'Knee Deep.pk3'", 'crash.hint.modFile'],
    ['Script error, DECORATE line 12', 'crash.hint.script'],
    ['VM execution aborted: tried to read from address zero.', 'crash.hint.runtime'],
    ['Checksum mismatch, cannot continue.', 'crash.hint.version']
  ] as const)('recognizes the engine diagnostic %s under Danish', async (line, key) => {
    await i18n.run()
    await i18n.changeLanguage('da-DK')
    expect(inferCrashHint([line])).toBe(da[key])
  })

  it('keeps exit values, protocol names and raw console snapshots intact', async () => {
    await i18n.run()
    await i18n.changeLanguage('da-DK')
    const data = {
      protocolId: 'fixture-id',
      protocolName: 'Knee Deep <test>',
      exitCode: 7,
      sessionSeconds: 1234,
      logTail: ['raw {engine} <script> text']
    }
    const original = JSON.stringify(data)
    const text = getCrashText(data)
    expect(text.title).toContain(data.protocolName)
    expect(text.termination).toContain('7')
    expect(text.termination).toContain('1.234')
    expect(text.hint).toBeNull()
    expect(text.toastDescription).toContain('7')
    expect(JSON.stringify(data)).toBe(original)
    const signal = getCrashText({ ...data, exitCode: null, logTail: ['Script error: fixture'] })
    expect(signal.toastDescription).toContain(da['crash.hint.script'])
    expect(signal.toastDescription).not.toContain('null')
    const noHintSignal = getCrashText({ ...data, exitCode: null })
    expect(noHintSignal.toastDescription).toContain('signal')
  })

  it('renders the critical fallback in the active language without requiring a React translation context', async () => {
    await i18n.run()
    await i18n.changeLanguage('da-DK')
    const boundary = new ErrorBoundary({ children: null })
    boundary.state = { hasError: true, error: new Error('<script>raw error</script>') }
    const html = renderToStaticMarkup(createElement('div', null, boundary.render()))
    expect(html).toContain(da['recovery.title'])
    expect(html).toContain(da['recovery.reload'])
    expect(html).toContain('&lt;script&gt;raw error&lt;/script&gt;')
    expect(html).not.toContain('<script>')
  })

  it('renders missing-page and pagination labels while preserving caller accessibility overrides', async () => {
    await i18n.run()
    await i18n.changeLanguage('da-DK')
    const html = renderToStaticMarkup(
      createElement(
        TolgeeProvider,
        { tolgee: i18n },
        createElement(
          'div',
          null,
          createElement(NotFound),
          createElement(
            Pagination,
            { 'aria-label': 'Fixture page controls' },
            createElement(PaginationPrevious),
            createElement(PaginationNext)
          )
        )
      )
    )
    expect(html).toContain(da['notFound.title'])
    expect(html).toContain(da['pagination.previous'])
    expect(html).toContain(da['common.pagination.nextLabel'])
    expect(html).toContain('Fixture page controls')
  })
})
