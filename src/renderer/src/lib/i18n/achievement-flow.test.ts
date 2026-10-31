import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { TolgeeProvider } from '@tolgee/react'
import { i18n } from './index'
import {
  ACHIEVEMENT_REGISTRY,
  getAchievementDef,
  checkAllAchievements,
  buildUnlockToasts
} from '@/lib/achievements'
import {
  getAchievementText,
  getAchievementCategoryLabel,
  formatAchievementStat
} from '@/lib/achievements/messages'
import { getRankTitle } from '@/lib/advancement'
import { formatNotificationTime } from './notification-formatters'
import AchievementCard from '@/components/AchievementCard'
import { toast, useToast } from '@/hooks/use-toast'
import type { IPlayerStats } from '@shared/schema'
import da from './locales/desktop/da-DK.json'

const stats: IPlayerStats = {
  totalProtocolsCreated: 1,
  totalProtocolsLaunched: 1,
  totalModFilesAdded: 0,
  totalWadsImported: 0,
  totalPlaytimeSeconds: 0,
  totalCatalogFilesManaged: 0,
  protocolsLaunchedThisSession: 0,
  distinctProtocolsLaunched: [],
  maxModFilesInSingleProtocol: 0,
  totalSourcePortsAdded: 0,
  distinctSourcePortFamilies: [],
  reachedIconOfSin: 0
}
afterEach(async () => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  await i18n.changeLanguage('en')
  i18n.stop()
})

describe('achievement localisation boundaries', () => {
  it('resolves display text at call time without changing registry data or unlock decisions', async () => {
    await i18n.run()
    const original = JSON.stringify(ACHIEVEMENT_REGISTRY)
    const decisions = checkAllAchievements(stats, {})
    const def = getAchievementDef('first-protocol')!
    expect(getAchievementText(def).title).toBe('Welcome to Mars, Marine')
    expect(getRankTitle('cadet')).toBe('Cadet')
    await i18n.changeLanguage('da-DK')
    expect(getAchievementText(def).title).toBe(da['achievements.items.first-protocol.title'])
    expect(getRankTitle('marine')).toBe(da['ranks.marine.title'])
    expect(getRankTitle('unknown')).toBe(da['ranks.cadet.title'])
    expect(getAchievementCategoryLabel('progression')).toBe(da['achievements.category.progression'])
    expect(checkAllAchievements(stats, {})).toEqual(decisions)
    expect(JSON.stringify(ACHIEVEMENT_REGISTRY)).toBe(original)
    await i18n.changeLanguage('es-ES')
    expect(getAchievementText(def).title).toBe('Welcome to Mars, Marine')
  })

  it('preserves hidden achievements and secret compound conditions in translated cards', async () => {
    await i18n.run()
    await i18n.changeLanguage('da-DK')
    const render = (id: string, unlocked: boolean) =>
      renderToStaticMarkup(
        createElement(
          TolgeeProvider,
          { tolgee: i18n },
          createElement(AchievementCard, {
            definition: getAchievementDef(id)!,
            state: { unlocked, progress: 0, target: 1 },
            stats
          })
        )
      )
    const hidden = render('icon-of-sin', false)
    expect(hidden).toContain(da['achievements.card.secretHint'])
    expect(hidden).not.toContain(da['achievements.items.icon-of-sin.title'])
    const compound = render('the-slayer', false)
    expect(compound).toContain('????')
    expect(compound).not.toContain(da['achievements.stats.reachedIconOfSin'])
    expect(render('icon-of-sin', true)).toContain(da['achievements.items.icon-of-sin.title'])
  })

  it('records translated unlock/rank toasts through the toast adapter without leaking metadata to UI props', async () => {
    await i18n.run()
    await i18n.changeLanguage('da-DK')
    const values = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value)
    })
    const unlocks = buildUnlockToasts({
      newUnlocks: [
        { id: 'first-protocol', unlocked: true, progress: 1, target: 1 },
        { id: 'first-blood', unlocked: true, progress: 1, target: 1 }
      ],
      newRank: 'marine',
      updatedStats: stats
    })
    expect(unlocks.map((t) => t.historyKind)).toEqual(['rank', 'achievement'])
    expect(unlocks[0].title).toBe(da['achievements.toast.rankTitle'])
    expect(unlocks[1].title).toContain(da['achievements.items.first-blood.title'])
    for (const item of unlocks) toast(item)
    const saved = JSON.parse(values.get('uac:notifications')!)
    expect(saved.map((item: { kind: string }) => item.kind)).toEqual(['achievement', 'rank'])
    expect(saved[0].title).toBe(unlocks[1].title)
    // Render the actual UI state after the adapter has dispatched the toast.
    function Probe() {
      return createElement('pre', null, JSON.stringify(useToast().toasts))
    }
    const html = renderToStaticMarkup(createElement(Probe))
    expect(html).toContain(unlocks[1].description)
    expect(html).not.toContain('historyKind')
    expect(html).not.toContain('historyAction')
  })

  it('formats progress and notification timestamps in the active locale', async () => {
    await i18n.run()
    await i18n.changeLanguage('da-DK')
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-29T12:00:00Z'))
    expect(formatAchievementStat('totalPlaytimeSeconds', 7200)).toBe('2 t.')
    expect(formatAchievementStat('totalModFilesAdded', 1234)).toBe('1.234')
    expect(formatNotificationTime('2026-10-29T11:59:59Z', 'da-DK')).toBe(
      da['notifications.time.justNow']
    )
    expect(formatNotificationTime('2026-10-29T11:58:00Z', 'da-DK')).toBe(
      new Intl.RelativeTimeFormat('da-DK', { numeric: 'auto', style: 'short' }).format(-2, 'minute')
    )
    expect(formatNotificationTime('invalid', 'da-DK')).toBe('—')
  })
})
