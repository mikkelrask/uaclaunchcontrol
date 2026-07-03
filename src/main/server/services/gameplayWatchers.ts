// Watches a source port's own console output for lines it already prints,
// to detect gameplay events (reaching a map, activating a cheat) for
// achievement flavor. Confirmed output strings are hardcoded — see
// docs/crash-log-visibility-plan.md for the "Extension" section.

export type GameplayEventMatch =
  | { type: 'MAP_REACHED'; mapName: string }
  | { type: 'CHEAT_ACTIVATED'; cheat: string }

interface Watcher {
  pattern: RegExp
  build: (match: RegExpMatchArray) => GameplayEventMatch
}

const WATCHERS: Watcher[] = [
  {
    pattern: /^(MAP\d{2})\s*-\s*.+$/i,
    build: (m) => ({ type: 'MAP_REACHED', mapName: m[1].toUpperCase() })
  },
  {
    pattern: /degreelessness mode on/i,
    build: () => ({ type: 'CHEAT_ACTIVATED', cheat: 'god-mode' })
  },
  {
    pattern: /very happy ammo added/i,
    build: () => ({ type: 'CHEAT_ACTIVATED', cheat: 'give-all' })
  },
  {
    pattern: /no clipping mode on/i,
    build: () => ({ type: 'CHEAT_ACTIVATED', cheat: 'noclip' })
  },
  {
    pattern: /power-up toggled/i,
    build: () => ({ type: 'CHEAT_ACTIVATED', cheat: 'beholdl' })
  },
  {
    pattern: /you feel lighter/i,
    build: () => ({ type: 'CHEAT_ACTIVATED', cheat: 'fly' })
  }
]

export function matchGameplayEvent(line: string): GameplayEventMatch | null {
  for (const watcher of WATCHERS) {
    const match = line.match(watcher.pattern)
    if (match) return watcher.build(match)
  }
  return null
}
