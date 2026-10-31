import { getTranslate, i18n } from '@/lib/i18n'
import type { IAchievementDefinition, AchievementCategory } from './types'

/** Resolve only display text at call time; the canonical registry stays language-independent. */
export function getAchievementText(
  def: IAchievementDefinition
): Pick<IAchievementDefinition, 'title' | 'description'> {
  const { t } = getTranslate('desktop')
  switch (def.id) {
    case 'first-protocol':
      return {
        title: t('achievements.items.first-protocol.title', 'Welcome to Mars, Marine'),
        description: t(
          'achievements.items.first-protocol.description',
          'Create your first launch protocol.'
        )
      }
    case 'knee-deep':
      return {
        title: t('achievements.items.knee-deep.title', 'Knee Deep'),
        description: t('achievements.items.knee-deep.description', 'Create 10 launch protocols.')
      }
    case 'protocol-archivist':
      return {
        title: t('achievements.items.protocol-archivist.title', 'Protocol Archivist'),
        description: t(
          'achievements.items.protocol-archivist.description',
          'Create 50 launch protocols.'
        )
      }
    case 'the-slayer':
      return {
        title: t('achievements.items.the-slayer.title', 'Doom Slayer'),
        description: t(
          'achievements.items.the-slayer.description',
          'Prove your worth. Create 25 protocols, log 100 hours, and manage 100 mod files.'
        )
      }
    case 'mod-collector':
      return {
        title: t('achievements.items.mod-collector.title', 'Mod Collector'),
        description: t(
          'achievements.items.mod-collector.description',
          'Add 10 mod files to the catalog.'
        )
      }
    case 'wad-warrior':
      return {
        title: t('achievements.items.wad-warrior.title', 'WAD Warrior'),
        description: t(
          'achievements.items.wad-warrior.description',
          'Import 5 unique WAD files into your library.'
        )
      }
    case 'uac-engineer':
      return {
        title: t('achievements.items.uac-engineer.title', 'UAC Engineer'),
        description: t(
          'achievements.items.uac-engineer.description',
          'Configure more than 3 different source ports for launch operations.'
        )
      }
    case 'source-port-collector':
      return {
        title: t('achievements.items.source-port-collector.title', 'Source Port Collector'),
        description: t(
          'achievements.items.source-port-collector.description',
          'Configure 5 different source ports. Variety is the spice of Hell.'
        )
      }
    case 'mod-hoarder':
      return {
        title: t('achievements.items.mod-hoarder.title', 'Mod Hoarder'),
        description: t(
          'achievements.items.mod-hoarder.description',
          'Add 50 mod files to the catalog.'
        )
      }
    case 'catalog-architect':
      return {
        title: t('achievements.items.catalog-architect.title', 'Catalog Architect'),
        description: t(
          'achievements.items.catalog-architect.description',
          'Add 100 mod files to the catalog. A true collection.'
        )
      }
    case 'wad-connoisseur':
      return {
        title: t('achievements.items.wad-connoisseur.title', 'WAD Connoisseur'),
        description: t(
          'achievements.items.wad-connoisseur.description',
          'Import 15 unique WAD files.'
        )
      }
    case 'first-blood':
      return {
        title: t('achievements.items.first-blood.title', 'First Blood'),
        description: t('achievements.items.first-blood.description', 'Launch your first protocol.')
      }
    case 'veteran':
      return {
        title: t('achievements.items.veteran.title', 'Veteran'),
        description: t(
          'achievements.items.veteran.description',
          'Launch 50 protocols. The UAC keeps you busy.'
        )
      }
    case 'endless-war':
      return {
        title: t('achievements.items.endless-war.title', 'The war never ends'),
        description: t(
          'achievements.items.endless-war.description',
          'Accumulate 10 hours of total playtime.'
        )
      }
    case 'tour-of-duty':
      return {
        title: t('achievements.items.tour-of-duty.title', 'Tour of Duty'),
        description: t(
          'achievements.items.tour-of-duty.description',
          'Accumulate 50 hours of total playtime.'
        )
      }
    case 'world-traveler':
      return {
        title: t('achievements.items.world-traveler.title', 'World Traveler'),
        description: t(
          'achievements.items.world-traveler.description',
          'Launch at least 10 different protocols.'
        )
      }
    case 'seasoned-operator':
      return {
        title: t('achievements.items.seasoned-operator.title', 'Seasoned Operator'),
        description: t(
          'achievements.items.seasoned-operator.description',
          'Launch 25 unique protocols. Jack of all trades.'
        )
      }
    case 'heretic':
      return {
        title: t('achievements.items.heretic.title', 'Heretic!'),
        description: t(
          'achievements.items.heretic.description',
          'Add a source port that isnt UZDoom or GZDoom. Living dangerously.'
        )
      }
    case 'what-could-possibly-go-wrong':
      return {
        title: t(
          'achievements.items.what-could-possibly-go-wrong.title',
          'What Could Possibly Go Wrong?'
        ),
        description: t(
          'achievements.items.what-could-possibly-go-wrong.description',
          'Create a single protocol with more than 10 mod files. Good luck, hero.'
        )
      }
    case 'uac-safety-violation':
      return {
        title: t('achievements.items.uac-safety-violation.title', 'UAC SAFETY VIOLATION'),
        description: t(
          'achievements.items.uac-safety-violation.description',
          'What is this nonsense, soldier? Its a goddamn abomination. Carry on.'
        )
      }
    case 'icon-of-sin':
      return {
        title: t('achievements.items.icon-of-sin.title', "Romero's Head on a Stick"),
        description: t(
          'achievements.items.icon-of-sin.description',
          'Reach MAP30 - Icon of Sin. Fantastic work soldier.'
        )
      }
    case 'idkfa':
      return {
        title: t('achievements.items.idkfa.title', 'IDKFA'),
        description: t(
          'achievements.items.idkfa.description',
          'Activate a cheat code. No judgement, marine — we have all been there.'
        )
      }
    case 'first-crash':
      return {
        title: t('achievements.items.first-crash.title', 'DEAD: Marine KIA'),
        description: t(
          'achievements.items.first-crash.description',
          'Your first source port crash. The UAC extends its condolences — and its standard replacement policy.'
        )
      }
    default:
      return { title: def.title, description: def.description }
  }
}

export function getAchievementCategoryLabel(category: AchievementCategory): string {
  const { t } = getTranslate('desktop')
  const labels: Record<AchievementCategory, string> = {
    progression: t('achievements.category.progression', 'Progression'),
    collection: t('achievements.category.collection', 'Collection'),
    combat: t('achievements.category.combat', 'Combat'),
    exploration: t('achievements.category.exploration', 'Exploration'),
    secret: t('achievements.category.secret', 'Secret')
  }
  return labels[category]
}

export function getAchievementStatLabel(stat: string): string {
  const { t } = getTranslate('desktop')
  const labels: Record<string, string> = {
    totalProtocolsCreated: t('achievements.stats.totalProtocolsCreated', 'Protocols Created'),
    totalProtocolsLaunched: t('achievements.stats.totalProtocolsLaunched', 'Protocols Launched'),
    totalModFilesAdded: t('achievements.stats.totalModFilesAdded', 'Mod Files Added'),
    totalWadsImported: t('achievements.stats.totalWadsImported', 'WADs Imported'),
    totalPlaytimeSeconds: t('common.labels.playtime', 'Playtime'),
    totalCatalogFilesManaged: t('achievements.stats.totalCatalogFilesManaged', 'Files Cataloged'),
    protocolsLaunchedThisSession: t(
      'achievements.stats.protocolsLaunchedThisSession',
      'This Session'
    ),
    distinctProtocolsLaunched: t(
      'achievements.stats.distinctProtocolsLaunched',
      'Unique Protocols'
    ),
    maxModFilesInSingleProtocol: t(
      'achievements.stats.maxModFilesInSingleProtocol',
      'Max Files/Protocol'
    ),
    reachedIconOfSin: t('achievements.stats.reachedIconOfSin', "Romero's head on a stick"),
    totalSourcePortsAdded: t('achievements.stats.totalSourcePortsAdded', 'Source Ports Added'),
    distinctSourcePortFamilies: t(
      'achievements.stats.distinctSourcePortFamilies',
      'Source Port Families'
    )
  }
  return labels[stat] ?? stat
}

export function formatAchievementStat(stat: string, value: number): string {
  const { t } = getTranslate('desktop')
  if (stat === 'totalPlaytimeSeconds')
    return t('achievements.time.hours', '{count, number}h', { count: Math.floor(value / 3600) })
  return new Intl.NumberFormat(i18n.getLanguage()).format(Math.floor(value))
}
