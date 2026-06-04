// Pure utility module — no React hooks here

/**
 * Advancement rank definitions for the UAC operator ladder.
 * Each rank has an id (stored in settings), a display title, and a description.
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
  { id: 'slayer', title: 'Doom Slayer', description: 'yeah, the 2016 kind' },
  { id: 'archivist', title: 'Protocol Expert', description: 'A collector of all things' }
]

/**
 * Look up the display title for a given rank id.
 */
export function getRankTitle(rankId?: string): string {
  const rank = ADVANCEMENT_RANKS.find((r) => r.id === rankId)
  return rank?.title ?? 'Cadet'
}

/**
 * Check whether the operator should advance to a new rank based on
 * their current rank and the total number of protocols they have created.
 * Returns the new rank id if an advancement should occur, or null.
 */
export function checkAdvancement(currentRank: string, protocolCount: number): string | null {
  if (currentRank === 'cadet' && protocolCount >= 1) {
    return 'marine'
  }

  // Future advancement thresholds could be added here:
  if (currentRank === 'marine' && protocolCount >= 10) {
    return 'sergeant'
  }
  if (currentRank === 'sergeant' && protocolCount >= 20) {
    return 'slayer'
  }

  return null
}
