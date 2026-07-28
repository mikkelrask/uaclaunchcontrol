import { api } from '@/api'
import type { IPlayerStats } from '@shared/schema'
import type { AchievementEvent, AchievementCheckResult } from './types'
import { checkAllAchievements, checkEventQualifiers } from './conditions'
import { getAchievementDef } from './registry'
import { getRankTitle } from '@/lib/advancement'

// ── Dispatch Result ─────────────────────────────────────

export interface DispatchResult {
  /** Achievements that were newly unlocked — show these as toasts */
  newUnlocks: AchievementCheckResult[]
  /** If a rank advancement occurred, the new rank id */
  newRank?: string
  /** Updated player stats after the event was processed */
  updatedStats: IPlayerStats
}

// ── Event → Stats Delta ─────────────────────────────────

/**
 * Maps an event type to the stat deltas that should be accumulated.
 * Each event type increments one or more stats.
 */
function eventToStatsDelta(event: AchievementEvent): Partial<IPlayerStats> {
  switch (event.type) {
    case 'PROTOCOL_CREATED':
      return {
        totalProtocolsCreated: 1,
        maxModFilesInSingleProtocol: event.fileCount
      }
    case 'PROTOCOL_UPDATED':
      return {
        maxModFilesInSingleProtocol: event.fileCount
      }
    case 'PROTOCOL_LAUNCHED':
      return {
        totalProtocolsLaunched: 1,
        protocolsLaunchedThisSession: 1,
        // Pass as string — playerService.updatePlayerStats handles appending
        distinctProtocolsLaunched: event.protocolId as unknown as string[]
      }
    case 'PROTOCOL_EXITED':
      return {
        totalPlaytimeSeconds: event.sessionSeconds
      }
    case 'MOD_FILE_ADDED':
      return {
        totalModFilesAdded: event.count
      }
    case 'WAD_IMPORTED':
      return {
        totalWadsImported: event.count
      }
    case 'CATALOG_FILE_MANAGED':
      return {
        totalCatalogFilesManaged: event.count
      }
    case 'SOURCE_PORT_ADDED':
      return {
        totalSourcePortsAdded: event.count,
        // Pass as string — updatePlayerStats handles appending
        distinctSourcePortFamilies: (event.family ?? 'other') as unknown as string[]
      }
    case 'MAP_REACHED':
      // reachedIconOfSin doubles as a secret sub-goal inside the compound
      // 'the-slayer' achievement, in addition to icon-of-sin's own
      // event-qualifier check above.
      return event.mapName === 'MAP30' ? { reachedIconOfSin: 1 } : {}
    case 'CHEAT_ACTIVATED':
      // No stat to accumulate — a pure event-qualifier achievement, checked
      // against the event payload itself in checkEventQualifiers().
      return {}
  }
}

// ── Main Dispatch ───────────────────────────────────────

// Each dispatch spans several separate HTTP calls (update stats, refetch,
// check, unlock) that are only individually atomic on the server. Gameplay
// events (map transitions, cheat codes) can fire in a rapid burst, and
// without this queue, overlapping dispatches could interleave — one call's
// stale in-memory `updatedStats`/`playerData` snapshot getting used to decide
// unlocks after another call has already moved the state forward. Chaining
// every dispatch onto this promise serializes them the same way
// `withPlayerDataLock` serializes writes on the server.
let dispatchChain: Promise<unknown> = Promise.resolve()

/**
 * Central dispatch for all achievement events.
 *
 * 1. Maps event to stat deltas and sends to backend
 * 2. Fetches updated player data
 * 3. Checks all stat-based achievements for new unlocks
 * 4. Checks event-qualifier achievements (contextual)
 * 5. Persists newly unlocked achievements and rank changes
 * 6. Returns results for toast display
 */
export async function dispatchAchievementEvent(event: AchievementEvent): Promise<DispatchResult> {
  const run = dispatchChain.then(
    () => dispatchAchievementEventUnqueued(event),
    () => dispatchAchievementEventUnqueued(event)
  )
  dispatchChain = run.then(
    () => undefined,
    () => undefined
  )
  return run
}

async function dispatchAchievementEventUnqueued(event: AchievementEvent): Promise<DispatchResult> {
  // 1. Compute stat delta and send to backend
  const statsDelta = eventToStatsDelta(event)
  const updatedStats = await api.updatePlayerStats(statsDelta)

  // 2. Fetch current player data (to get existing achievement states and rank)
  const playerData = await api.getPlayerData()

  // 3. Check stat-based achievements (incremental, threshold, compound)
  const statUnlocks = checkAllAchievements(updatedStats, playerData.achievements)

  // 4. Check event-qualifier achievements against both event payload and stats
  const eventQualifierUnlocks = checkEventQualifiers(event, updatedStats, playerData.achievements)

  // 5. Combine new unlocks
  const allNewUnlocks: AchievementCheckResult[] = [...statUnlocks, ...eventQualifierUnlocks]

  // 6. Determine if any rank advancement is granted
  let newRank: string | undefined
  for (const unlock of allNewUnlocks) {
    const def = getAchievementDef(unlock.id)
    if (def?.grantsRank) {
      newRank = def.grantsRank
    }
  }

  // 7. Persist: unlock achievements + update rank if changed
  if (allNewUnlocks.length > 0) {
    // Save each new unlock
    for (const unlock of allNewUnlocks) {
      await api.unlockAchievement(unlock.id, {
        progress: unlock.progress,
        target: unlock.target
      })
    }

    // Update rank if advancement occurred
    if (newRank) {
      await api.updatePlayerData({ rank: newRank } as never)
      // Also update settings for backward compat until Header migration
      await api.updateSettings({ rank: newRank } as never)
    }
  }

  return {
    newUnlocks: allNewUnlocks,
    newRank,
    updatedStats
  }
}

// ── Toast Helper ────────────────────────────────────────

/**
 * Build a toast config object from a dispatch result.
 * Used by components that fire events to show unified unlock notifications.
 */
export function buildUnlockToasts(
  result: DispatchResult
): Array<{ id: string; title: string; description: string; duration: number }> {
  const toasts: Array<{
    id: string
    title: string
    description: string
    duration: number
  }> = []

  for (const unlock of result.newUnlocks) {
    const def = getAchievementDef(unlock.id)
    if (!def) continue

    if (def.grantsRank && result.newRank) {
      const rankTitle = getRankTitle(result.newRank)
      toasts.push({
        id: `rank-${result.newRank}`,
        title: 'RANK ADVANCEMENT',
        description: `Promoted to ${rankTitle}!`,
        duration: 8000
      })
    } else {
      toasts.push({
        id: `achiev-${def.id}`,
        title: 'ACHIEVEMENT UNLOCKED',
        description: `${def.title} — ${def.description}`,
        duration: 6000
      })
    }
  }

  return toasts
}
