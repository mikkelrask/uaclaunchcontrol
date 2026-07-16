/**
 * Advancement rank definitions for the UAC operator ladder.
 *
 * Ranks are now primarily granted through the achievements system
 * (see src/renderer/src/lib/achievements/), but this module is kept
 * as a shared utility for rank title lookups used throughout the UI
 * until the achievement popover is built.
 */

export interface AdvancementRank {
  id: string
  title: string
  description: string
}

export const ADVANCEMENT_RANKS: AdvancementRank[] = [
  { id: 'cadet', title: 'Cadet', description: 'Fresh recruit to the UAC forces' },
  { id: 'marine', title: 'Marine', description: 'Fully fledged UAC operator' },
  { id: 'sergeant', title: 'Sergeant', description: 'Like The Rock is' },
  { id: 'slayer', title: 'Doom Slayer', description: 'The pinnacle of UAC operators' }
]

/**
 * Look up the display title for a given rank id.
 */
export function getRankTitle(rankId?: string): string {
  const rank = ADVANCEMENT_RANKS.find((r) => r.id === rankId)
  return rank?.title ?? 'Cadet'
}
