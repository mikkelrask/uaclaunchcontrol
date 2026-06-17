import type { IAchievementDefinition } from './types'

/**
 * Complete catalog of all achievements.
 */
export const ACHIEVEMENT_REGISTRY: IAchievementDefinition[] = [
  // ── Progression ──
  {
    id: 'first-protocol',
    title: 'Welcome to Mars, Marine',
    description: 'Create your first launch protocol.',
    category: 'progression',
    icon: 'Rocket',
    type: 'threshold',
    conditions: [{ stat: 'totalProtocolsCreated', min: 1 }],
    grantsRank: 'marine'
  },
  {
    id: 'knee-deep',
    title: 'Knee Deep',
    description: 'Create 10 launch protocols.',
    category: 'progression',
    icon: 'Layers',
    type: 'incremental',
    conditions: [{ stat: 'totalProtocolsCreated', min: 10 }],
    grantsRank: 'sergeant'
  },
  {
    id: 'protocol-archivist',
    title: 'Protocol Archivist',
    description: 'Create 50 launch protocols.',
    category: 'progression',
    icon: 'Archive',
    type: 'incremental',
    conditions: [{ stat: 'totalProtocolsCreated', min: 50 }]
  },
  {
    id: 'the-slayer',
    title: 'Doom Slayer',
    description: 'Prove your worth. Create 25 protocols, log 100 hours, and manage 100 mod files.',
    category: 'progression',
    icon: 'Swords',
    type: 'compound',
    conditions: [
      { stat: 'totalProtocolsCreated', min: 25 },
      { stat: 'totalPlaytimeSeconds', min: 360000 }, // 100 hours
      { stat: 'totalModFilesAdded', min: 100 }
    ],
    grantsRank: 'slayer'
  },

  // ── Collection ──
  {
    id: 'mod-collector',
    title: 'Mod Collector',
    description: 'Add 10 mod files to the catalog.',
    category: 'collection',
    icon: 'Package',
    type: 'incremental',
    conditions: [{ stat: 'totalModFilesAdded', min: 10 }]
  },
  {
    id: 'wad-warrior',
    title: 'WAD Warrior',
    description: 'Import 5 unique WAD files into your library.',
    category: 'collection',
    icon: 'Swords',
    type: 'incremental',
    conditions: [{ stat: 'totalWadsImported', min: 5 }]
  },
  {
    id: 'uac-engineer',
    title: 'UAC Engineer',
    description: 'Configure more than 3 different source ports for launch operations.',
    category: 'collection',
    icon: 'Wrench',
    type: 'incremental',
    conditions: [{ stat: 'totalSourcePortsAdded', min: 4 }]
  },
  {
    id: 'source-port-collector',
    title: 'Source Port Collector',
    description: 'Configure 5 different source ports. Variety is the spice of Hell.',
    category: 'collection',
    icon: 'Container',
    type: 'incremental',
    conditions: [{ stat: 'totalSourcePortsAdded', min: 5 }]
  },
  {
    id: 'mod-hoarder',
    title: 'Mod Hoarder',
    description: 'Add 50 mod files to the catalog.',
    category: 'collection',
    icon: 'PackagePlus',
    type: 'incremental',
    conditions: [{ stat: 'totalModFilesAdded', min: 50 }]
  },
  {
    id: 'catalog-architect',
    title: 'Catalog Architect',
    description: 'Add 100 mod files to the catalog. A true collection.',
    category: 'collection',
    icon: 'Library',
    type: 'incremental',
    conditions: [{ stat: 'totalModFilesAdded', min: 100 }]
  },
  {
    id: 'wad-connoisseur',
    title: 'WAD Connoisseur',
    description: 'Import 15 unique WAD files.',
    category: 'collection',
    icon: 'FileArchive',
    type: 'incremental',
    conditions: [{ stat: 'totalWadsImported', min: 15 }]
  },

  // ── Combat (Playtime) ──
  {
    id: 'first-blood',
    title: 'First Blood',
    description: 'Launch your first protocol.',
    category: 'combat',
    icon: 'Crosshair',
    type: 'threshold',
    conditions: [{ stat: 'totalProtocolsLaunched', min: 1 }]
  },
  {
    id: 'veteran',
    title: 'Veteran',
    description: 'Launch 50 protocols. The UAC keeps you busy.',
    category: 'combat',
    icon: 'Shield',
    type: 'incremental',
    conditions: [{ stat: 'totalProtocolsLaunched', min: 50 }]
  },
  {
    id: 'endless-war',
    title: 'The war never ends',
    description: 'Accumulate 10 hours of total playtime.',
    category: 'combat',
    icon: 'Clock',
    type: 'incremental',
    conditions: [{ stat: 'totalPlaytimeSeconds', min: 36000 }] // 10 hours
  },
  {
    id: 'tour-of-duty',
    title: 'Tour of Duty',
    description: 'Accumulate 50 hours of total playtime.',
    category: 'combat',
    icon: 'ClockAlert',
    type: 'incremental',
    conditions: [{ stat: 'totalPlaytimeSeconds', min: 180000 }] // 50 hours
  },

  // ── Exploration ──
  {
    id: 'world-traveler',
    title: 'World Traveler',
    description: 'Launch at least 10 different protocols.',
    category: 'exploration',
    icon: 'Globe',
    type: 'incremental',
    conditions: [{ stat: 'distinctProtocolsLaunched', min: 10 }]
  },
  {
    id: 'seasoned-operator',
    title: 'Seasoned Operator',
    description: 'Launch 25 unique protocols. Jack of all trades.',
    category: 'exploration',
    icon: 'Compass',
    type: 'incremental',
    conditions: [{ stat: 'distinctProtocolsLaunched', min: 25 }]
  },
  {
    id: 'heretic',
    title: 'Heretic!',
    description: 'Add a source port that isnt UZDoom or GZDoom. Living dangerously.',
    category: 'exploration',
    icon: 'FlaskConical',
    type: 'event-qualifier',
    conditions: [{ stat: 'totalSourcePortsAdded', min: 1 }],
    eventQualifier: (event) => {
      if (event.type !== 'SOURCE_PORT_ADDED') return false
      const fam = (event as { family?: string }).family
      return !!fam && fam !== 'uzdoom' && fam !== 'gzdoom'
    },
    hidden: false
  },

  // ── Secret ──
  {
    id: 'what-could-possibly-go-wrong',
    title: 'What Could Possibly Go Wrong?',
    description: 'Create a single protocol with more than 10 mod files. Good luck, hero.',
    category: 'secret',
    icon: 'AlertTriangle',
    type: 'event-qualifier',
    conditions: [{ stat: 'maxModFilesInSingleProtocol', min: 11 }],
    hidden: true
  },
  {
    id: 'uac-safety-violation',
    title: 'UAC SAFETY VIOLATION',
    description: 'What is this nonsense, soldier? Its a goddamn abomination. Carry on.',
    category: 'secret',
    icon: 'AlertTriangle',
    type: 'event-qualifier',
    conditions: [{ stat: 'maxModFilesInSingleProtocol', min: 31 }],
    hidden: true
  }
]

// ── Lookup Helpers ──────────────────────────────────────

/**
 * Get an achievement definition by its id.
 */
export function getAchievementDef(id: string): IAchievementDefinition | undefined {
  return ACHIEVEMENT_REGISTRY.find((a) => a.id === id)
}

/**
 * Get all achievements for a given category.
 */
export function getAchievementsByCategory(category: string): IAchievementDefinition[] {
  return ACHIEVEMENT_REGISTRY.filter((a) => a.category === category)
}
