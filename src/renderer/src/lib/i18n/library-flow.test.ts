import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { TolgeeProvider } from '@tolgee/react'
import { getTranslate, i18n } from './index'
import { getCategoryLabel, getCatalogColumnLabel } from './catalog-labels'
import { useLibraryFormatters } from './library-formatters'
import { formSchema } from '@/lib/install/schema'
import { buildLaunchCommand } from '@/lib/utils'
import { CATEGORIES } from '@shared/categories'
import da from './locales/desktop/da-DK.json'

afterEach(async () => {
  vi.useRealTimers()
  await i18n.changeLanguage('en')
  i18n.addStaticData({ 'da-DK:desktop': da })
  i18n.stop()
})

describe('library/install localisation boundaries', () => {
  it('resolves validation and imperative helpers in the current language', async () => {
    const { t } = getTranslate('desktop')
    await i18n.run()
    const empty = { title: '', doomVersionId: '', sourcePortId: '' }
    const initial = formSchema.safeParse(empty)
    expect(initial.success).toBe(false)
    if (!initial.success) expect(initial.error.issues[0].message).toBe('Title is required')
    i18n.addStaticData({
      'da-DK:desktop': { ...da, 'install.validation.title': 'fixture title error' }
    })
    await i18n.changeLanguage('da-DK')
    expect(t('install.validation.title', 'Title is required')).toBe('fixture title error')
    const next = formSchema.safeParse(empty)
    expect(next.success).toBe(false)
    if (!next.success) expect(next.error.issues[0].message).toBe('fixture title error')
  })

  it('translates category/column labels while preserving canonical and user-defined values', async () => {
    await i18n.run()
    const before = JSON.stringify(CATEGORIES)
    i18n.addStaticData({
      'da-DK:desktop': {
        ...da,
        'catalog.category.weapon': 'fixture category',
        'catalog.columnLabel.fileType': 'fixture column'
      }
    })
    await i18n.changeLanguage('da-DK')
    expect(getCategoryLabel('weapon')).toBe('fixture category')
    expect(getCatalogColumnLabel('fileType')).toBe('fixture column')
    expect(getCatalogColumnLabel('config')).toBe('Config')
    expect(getCatalogColumnLabel('dependencies')).toBe('Load Order')
    expect(getCategoryLabel('My_Custom_Tag')).toBe('My_Custom_Tag')
    expect(getCatalogColumnLabel('customField')).toBe('customField')
    expect(JSON.stringify(CATEGORIES)).toBe(before)
  })

  it('keeps launch commands and schema payloads independent of the UI language', async () => {
    await i18n.run()
    const options = {
      sourcePort: '/fixture/gzdoom',
      iwad: '/fixture/DOOM2.WAD',
      files: [
        {
          id: 7,
          filePath: '/fixture/Brutal Doom.pk3',
          name: 'Brutal Doom',
          hashValue: 'a'.repeat(32),
          fileType: 'PK3'
        }
      ],
      launchParameters: '-skill 4 -warp 01',
      saveDirectory: '/fixture/saves'
    }
    const form = {
      title: 'My protocol',
      doomVersionId: 'doom2',
      sourcePortId: 'engine-id',
      launchParameters: '-skill 4 -warp 01'
    }
    const command = buildLaunchCommand(options)
    const payload = formSchema.parse(form)
    await i18n.changeLanguage('da-DK')
    expect(buildLaunchCommand(options)).toBe(command)
    expect(formSchema.parse(form)).toEqual(payload)
  })

  it('formats library dates and playtime with the selected locale', async () => {
    await i18n.run()
    await i18n.changeLanguage('da-DK')
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-27T12:00:00Z'))
    function Probe() {
      const { formatDate, formatPlaytime } = useLibraryFormatters()
      return createElement(
        'span',
        null,
        formatPlaytime(5400),
        '|',
        formatDate('2026-10-24T12:00:00Z')
      )
    }
    const html = renderToStaticMarkup(
      createElement(TolgeeProvider, { tolgee: i18n }, createElement(Probe))
    )
    expect(html).toContain('1,5')
    expect(html).toContain('3 days ago')
  })
})
