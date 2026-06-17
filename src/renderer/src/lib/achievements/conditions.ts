import type { IPlayerStats, IAchievementState } from '@shared/schema'
import type { IAchievementDefinition, AchievementCheckResult } from './types'
import { ACHIEVEMENT_REGISTRY } from './registry'

// ── Individual Check ────────────────────────────────────

/**
 * Evaluate a single achievement against the current player stats.
 * Returns the current progress and whether it's unlocked.
 *
 * Handles all achievement types:
 * - `threshold` / `incremental`: progress = stat value (capped at min).
 *   Unlocked when progress >= min.
 * - `compound`: returns the percentage of conditions met (0-100).
 *   Unlocked when ALL conditions are met (progress === 100).
 * - `event-qualifier`: does NOT evaluate here — returns (unlocked=false, progress=1, target=1)
 *   and is instead checked inline against the event payload via `checkEventQualifiers()`.
 */
export function checkAchievement(
  def: IAchievementDefinition,
  stats: IPlayerStats
): AchievementCheckResult {
  switch (def.type) {
    case 'event-qualifier': {
      // Event-qualifier achievements are checked separately against the event payload.
      // Return a stub result — the caller must use checkEventQualifiers().
      return {
        id: def.id,
        unlocked: false,
        progress: 0,
        target: 1
      }
    }

    case 'compound': {
      const total = def.conditions.length
      const met = def.conditions.filter((c) => {
        let value: number
        const rawValue = stats[c.stat]
        if (Array.isArray(rawValue)) {
          value = rawValue.length
        } else {
          value = (rawValue as number) ?? 0
        }
        return value >= c.min
      }).length
      const progress = Math.round((met / total) * 100)
      return {
        id: def.id,
        unlocked: met === total,
        progress,
        target: 100
      }
    }

    // threshold and incremental behave identically
    default: {
      // Single condition — use the first one
      const condition = def.conditions[0]
      if (!condition) {
        return { id: def.id, unlocked: false, progress: 0, target: 1 }
      }

      let value: number
      const rawValue = stats[condition.stat]
      // Arrays (e.g. distinctProtocolsLaunched, distinctSourcePortFamilies)
      // must be compared by length — JS will coerce ["uuid"] >= N via toString()
      // which yields the numeric UUID value, not the count.
      if (Array.isArray(rawValue)) {
        value = rawValue.length
      } else {
        value = (rawValue as number) ?? 0
      }

      const progress = Math.min(value, condition.min)
      return {
        id: def.id,
        unlocked: value >= condition.min,
        progress,
        target: condition.min
      }
    }
  }
}

// ── Batch Check ─────────────────────────────────────────

/**
 * Check ALL stat-based achievements (incremental, threshold, compound)
 * against current stats and the player's existing achievement states.
 *
 * Returns only the achievements whose unlock status changed (newly unlocked).
 */
export function checkAllAchievements(
  stats: IPlayerStats,
  currentAchievements: Record<string, IAchievementState>
): AchievementCheckResult[] {
  const newUnlocks: AchievementCheckResult[] = []

  for (const def of ACHIEVEMENT_REGISTRY) {
    // Skip event-qualifier — those are checked separately via dispatch
    if (def.type === 'event-qualifier') continue

    const existing = currentAchievements[def.id]
    // Skip if already unlocked
    if (existing?.unlocked) continue

    const result = checkAchievement(def, stats)

    if (result.unlocked) {
      newUnlocks.push(result)
    }
  }

  return newUnlocks
}

// ── Event-Qualifier Check ───────────────────────────────

export type { AchievementEvent } from './types'

/**
 * Check all event-qualifier achievements against the event payload + current stats.
 * These are binary, single-shot checks — no progress, just unlocked or not.
 *
 * Returns results for achievements that qualify (whether or not already unlocked —
 * the caller is responsible for filtering).
 */
export function checkEventQualifiers(
  event: { type: string; [key: string]: unknown },
  stats: IPlayerStats,
  currentAchievements: Record<string, IAchievementState>
): AchievementCheckResult[] {
  const results: AchievementCheckResult[] = []

  for (const def of ACHIEVEMENT_REGISTRY) {
    if (def.type !== 'event-qualifier') continue

    // Skip if already unlocked
    if (currentAchievements[def.id]?.unlocked) continue

    let qualifies = false

    // If the definition has an eventQualifier callback, use it
    if (def.eventQualifier) {
      qualifies = def.eventQualifier(event as Parameters<typeof def.eventQualifier>[0], stats)
    } else if (def.conditions.length > 0) {
      // Fallback: treat conditions as stat thresholds against current stats
      qualifies = def.conditions.every((c) => {
        const rawValue = stats[c.stat]
        let value: number
        if (Array.isArray(rawValue)) {
          value = rawValue.length
        } else {
          value = (rawValue as number) ?? 0
        }
        return value >= c.min
      })
    }

    if (qualifies) {
      results.push({
        id: def.id,
        unlocked: true,
        progress: 1,
        target: 1
      })
    }
  }

  return results
}

// ── Utility ─────────────────────────────────────────────

/**
 * Calculate the progress percentage for display in the UI.
 */
export function getProgressPercentage(state: IAchievementState): number {
  if (state.target <= 0) return 0
  return Math.min(100, Math.round((state.progress / state.target) * 100))
}

/**
 * Check whether the given stat qualifies for any event-qualifier achievements
 * that use that stat as a threshold. Used as an alternative check path.
 *
 * Note: this is a simplified check used when the event type doesn't match
 * any event-qualifier condition and we fall back to stat thresholds.
 */
export function getEventQualifierDefs(): IAchievementDefinition[] {
  return ACHIEVEMENT_REGISTRY.filter((a) => a.type === 'event-qualifier')
}
