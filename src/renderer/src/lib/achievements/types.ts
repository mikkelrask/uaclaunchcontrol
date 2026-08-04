import type { IPlayerStats } from '@shared/schema'

// ── Categories ──────────────────────────────────────────

export type AchievementCategory =
  | 'progression' // Core progression (ranks)
  | 'collection' // Mod files, WADs, catalog management
  | 'combat' // Playtime, launches, sessions
  | 'exploration' // Source ports used, unique protocols launched
  | 'secret' // Hidden / easter-egg achievements

// ── Conditions ──────────────────────────────────────────

/**
 * A condition maps a stat key to a minimum threshold.
 * The condition is met when the stat value >= min.
 */
export type IAchievementCondition = {
  stat: keyof IPlayerStats
  min: number
  /**
   * When true, this condition's label and progress are shown as "????" in
   * a compound achievement's breakdown until the condition itself is met —
   * a surprise sub-goal, revealed only once satisfied.
   */
  secret?: boolean
}

// ── Events ──────────────────────────────────────────────

/**
 * Semantic events dispatched from the app when tracked actions occur.
 * Each event carries the data needed to update stats and check
 * event-qualifier achievements.
 */
export type AchievementEvent =
  | { type: 'PROTOCOL_CREATED'; count: number; fileCount: number }
  | { type: 'PROTOCOL_UPDATED'; fileCount: number }
  | { type: 'PROTOCOL_LAUNCHED'; protocolId: string }
  | { type: 'PROTOCOL_EXITED'; protocolId: string; sessionSeconds: number }
  | { type: 'PROTOCOL_CRASHED'; protocolId: string }
  | { type: 'MOD_FILE_ADDED'; count: number }
  | { type: 'WAD_IMPORTED'; count: number }
  | { type: 'CATALOG_FILE_MANAGED'; count: number }
  | { type: 'SOURCE_PORT_ADDED'; count: number; family?: string }
  | { type: 'MAP_REACHED'; protocolId: string; mapName: string }
  | { type: 'CHEAT_ACTIVATED'; protocolId: string; cheat: string }

// ── Definitions ─────────────────────────────────────────

export interface IAchievementDefinition {
  /** Unique identifier (kebab-case) */
  id: string
  /** Display title */
  title: string
  /** Short description shown in the UI */
  description: string
  /** Category grouping */
  category: AchievementCategory
  /** Lucide icon name */
  icon: string
  /**
   * How progress is evaluated:
   * - `incremental`: progress accumulates toward a threshold (e.g. 7/10)
   * - `threshold`: unlocked when the stat passes the threshold; shows simple locked/unlocked
   * - `compound`: multiple conditions must all be met; progress = % of conditions satisfied
   * - `event-qualifier`: single-use contextual check against the event payload.
   *   No progress bar; binary locked/unlocked. Cannot re-trigger once unlocked.
   */
  type: 'incremental' | 'threshold' | 'compound' | 'event-qualifier'
  /** Target value(s) needed. For compound, every condition must be met. */
  conditions: IAchievementCondition[]
  /**
   * Optional: single-use qualifier checked against the event payload rather than
   * against accumulated stats. Used for achievements like "create a protocol
   * with >10 mod files" — the event itself carries the data to evaluate.
   * eventQualifier achievements do not show a progress bar; they are binary
   * (locked or unlocked) and can only trigger once.
   */
  eventQualifier?: (event: AchievementEvent, currentStats: IPlayerStats) => boolean
  /** Optional: rank awarded on unlock */
  grantsRank?: string
  /** Whether this achievement is hidden until unlocked */
  hidden?: boolean
}

// ── Check Results ───────────────────────────────────────

export interface AchievementCheckResult {
  id: string
  unlocked: boolean
  progress: number
  target: number
}
