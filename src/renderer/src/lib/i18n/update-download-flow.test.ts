import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { TolgeeProvider } from '@tolgee/react'
import { i18n } from './index'
import { getUpdateNotice } from './update-messages'
import { getDownloadText } from './download-messages'
import { DownloadCard } from '@/components/ModDownloadManager'
import { getAchievementText } from '@/lib/achievements/messages'
import { getAchievementDef } from '@/lib/achievements'
import { toast } from '@/hooks/use-toast'
import type { ModDownloadEvent } from '@shared/modDownload'
import da from './locales/desktop/da-DK.json'

afterEach(async () => {
  vi.unstubAllGlobals()
  await i18n.changeLanguage('en')
  i18n.stop()
})

describe('update/download localisation boundaries', () => {
  it('resolves update events in the active language and keeps version/action identifiers intact', async () => {
    await i18n.run()
    const data = { status: 'available' as const, version: '2.3.4-beta.1' }
    expect(getUpdateNotice(data)?.description).toContain('Version 2.3.4-beta.1 is now available.')
    await i18n.changeLanguage('da-DK')
    const notice = getUpdateNotice(data)!
    expect(notice.title).toBe(da['updates.notice.availableTitle'])
    expect(notice.description).toContain(data.version)
    expect(notice.historyKind).toBe('update')
    expect(notice.historyAction).toEqual({ kind: 'view-update' })
    const ready = getUpdateNotice({ ...data, status: 'downloaded' })!
    expect(ready.historyAction).toEqual({ kind: 'restart-update' })
    expect(ready.actionLabel).toBe(da['updates.action.restart'])
    await i18n.changeLanguage('es-ES')
    expect(getUpdateNotice(data)?.title).toBe('SYSTEM: Update Pending')
  })

  it('retains quiet/manual check behavior and readable diagnostic details', async () => {
    await i18n.run()
    await i18n.changeLanguage('da-DK')
    for (const status of ['idle', 'checking', 'downloading', 'not-available'] as const)
      expect(getUpdateNotice({ status, version: '1.0' })).toBeNull()
    const manual = getUpdateNotice({ status: 'not-available', version: '1.0', isManual: true })!
    expect(manual.historyKind).toBeUndefined()
    expect(manual.historyAction).toBeUndefined()
    const error = 'ECONNRESET /fixture/{raw}'
    expect(getUpdateNotice({ status: 'error', version: '', error })?.description).toContain(error)
    expect(getUpdateNotice({ status: 'error', version: '' })?.description).toContain('Sam Grimm')
    expect(getUpdateNotice({ status: 'error', version: '' })?.description).toContain('Phobos')
  })

  it('records translated update notifications and their replay actions through the toast adapter', async () => {
    await i18n.run()
    await i18n.changeLanguage('da-DK')
    const values = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value)
    })
    const notice = getUpdateNotice({ status: 'available', version: '9.9' })!
    toast(notice)
    const stored = JSON.parse(values.get('uac:notifications')!)
    expect(stored[0]).toMatchObject({
      title: da['updates.notice.availableTitle'],
      kind: 'update',
      action: { kind: 'view-update' }
    })
    const count = stored.length
    toast(getUpdateNotice({ status: 'not-available', version: '9.9', isManual: true })!)
    expect(JSON.parse(values.get('uac:notifications')!)).toHaveLength(count)
  })

  it('uses download status metadata instead of matching backend English, retaining original payloads', async () => {
    await i18n.run()
    await i18n.changeLanguage('da-DK')
    const preparing: ModDownloadEvent = {
      state: 'preparing',
      id: 'x',
      message: 'opaque backend text',
      phase: 'waiting-for-moddb'
    }
    const before = JSON.stringify(preparing)
    expect(getDownloadText(preparing).title).toBe(da['downloads.waitingForModdb'])
    expect(JSON.stringify(preparing)).toBe(before)
    expect(
      getDownloadText({ state: 'preparing', id: 'legacy', message: 'Legacy phase text' }).title
    ).toBe('Legacy phase text')
    expect(
      getDownloadText({
        state: 'error',
        id: 'x',
        message: 'opaque backend text',
        reason: { code: 'browser-fallback' }
      }).error
    ).toBe(da['downloads.browserFallback'])
    expect(
      getDownloadText({
        state: 'error',
        id: 'x',
        message: 'opaque backend text',
        reason: { code: 'interrupted', state: 'interrupted' }
      }).error
    ).toContain('(interrupted)')
    const name = 'Knee Deep {release}.pk3'
    expect(
      getDownloadText({ state: 'started', id: 'x', fileName: name, source: 'github' }, name).title
    ).toBe(name)
    expect(
      getDownloadText({ state: 'completed', id: 'x', filePath: '/fixture/archive.zip' }).title
    ).toBe(da['downloads.complete'])
    expect(
      getDownloadText({ state: 'completed', id: 'x', filePath: '', alreadyInCatalog: true }).title
    ).toBe(da['downloads.alreadyCataloged'])
    expect(getDownloadText({ state: 'completed', id: 'x', filePath: '' }).title).toBe(
      da['downloads.addedToCatalog']
    )
    expect(getDownloadText({ state: 'cancelled', id: 'x' }).title).toBe(da['downloads.cancelled'])
  })

  it('renders download percentages in the selected locale and escapes raw error details', async () => {
    await i18n.run()
    await i18n.changeLanguage('da-DK')
    const render = (event: ModDownloadEvent) =>
      renderToStaticMarkup(
        createElement(
          TolgeeProvider,
          { tolgee: i18n },
          createElement(DownloadCard, {
            event,
            fileName: 'IDKFA.pk3',
            onCancel: () => {},
            onDismiss: () => {}
          })
        )
      )
    const progress = render({
      state: 'progress',
      id: 'x',
      percent: 42.5,
      receivedBytes: 425,
      totalBytes: 1000
    })
    expect(progress).toContain(
      new Intl.NumberFormat('da-DK', { style: 'percent', maximumFractionDigits: 0 }).format(0.425)
    )
    expect(progress).toContain(da['common.actions.cancel'])
    expect(progress).toContain('IDKFA.pk3')
    const error = render({ state: 'error', id: 'x', message: '<script>raw diagnostic</script>' })
    expect(error).toContain('&lt;script&gt;raw diagnostic&lt;/script&gt;')
    expect(error).not.toContain('<script>')
  })

  it('preserves the Knee Deep reference, Doom Slayer and IDKFA in Danish titles', async () => {
    await i18n.run()
    await i18n.changeLanguage('da-DK')
    expect(getAchievementText(getAchievementDef('knee-deep')!).title).toBe('Knee Deep')
    expect(getAchievementText(getAchievementDef('the-slayer')!).title).toBe('Doom Slayer')
    expect(getAchievementText(getAchievementDef('idkfa')!).title).toBe('IDKFA')
  })
})
