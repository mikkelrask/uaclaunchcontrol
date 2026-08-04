import { describe, it, expect } from 'vitest'
import { checkEventQualifiers } from './conditions'
import type { IPlayerStats, IAchievementState } from '@shared/schema'
import type { AchievementEvent } from './types'

const baseStats: IPlayerStats = {
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

const noUnlocks: Record<string, IAchievementState> = {}

describe('checkEventQualifiers — first-crash achievement', () => {
  it('unlocks on PROTOCOL_CRASHED', () => {
    const event: AchievementEvent = { type: 'PROTOCOL_CRASHED', protocolId: 'p1' }
    const results = checkEventQualifiers(event, baseStats, noUnlocks)
    expect(results.some((r) => r.id === 'first-crash')).toBe(true)
  })

  it('does not unlock on a clean exit', () => {
    const event: AchievementEvent = {
      type: 'PROTOCOL_EXITED',
      protocolId: 'p1',
      sessionSeconds: 10
    }
    const results = checkEventQualifiers(event, baseStats, noUnlocks)
    expect(results.some((r) => r.id === 'first-crash')).toBe(false)
  })

  it('does not re-unlock once already unlocked', () => {
    const event: AchievementEvent = { type: 'PROTOCOL_CRASHED', protocolId: 'p1' }
    const alreadyUnlocked: Record<string, IAchievementState> = {
      'first-crash': {
        unlocked: true,
        unlockedAt: '2026-01-01T00:00:00.000Z',
        progress: 1,
        target: 1
      }
    }
    const results = checkEventQualifiers(event, baseStats, alreadyUnlocked)
    expect(results.some((r) => r.id === 'first-crash')).toBe(false)
  })
})
