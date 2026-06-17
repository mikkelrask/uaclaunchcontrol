import fs from 'fs-extra'
import path from 'path'
import os from 'os'
import {
  IPlayerData,
  IPlayerStats,
  IAchievementState,
  IAppSettings,
  IProtocol
} from '../../../shared/schema'
import { debug } from '../../../shared/debug'

// ── Paths ───────────────────────────────────────────────
const CONFIG_DIR = path.join(os.homedir(), '.config', 'uac')
const PLAYER_DATA_FILE = path.join(CONFIG_DIR, 'playerData.json')
const SETTINGS_FILE = path.join(CONFIG_DIR, 'settings.json')
const MODS_DIR = path.join(CONFIG_DIR, 'mods')
const MOD_FILE_CATALOG = path.join(CONFIG_DIR, 'modFileCatalogue.json')
const DOOM_VERSIONS_FILE = path.join(CONFIG_DIR, 'doomVersions.json')

// In-memory flag to track first-ever read (used for session reset).
// Once the file is loaded once, subsequent calls won't reset session stats.
let hasLoadedOnce = false

// ── Defaults ────────────────────────────────────────────
const DEFAULT_PLAYER_DATA: IPlayerData = {
  rank: 'cadet',
  achievements: {},
  stats: {
    totalProtocolsCreated: 0,
    totalProtocolsLaunched: 0,
    totalModFilesAdded: 0,
    totalWadsImported: 0,
    totalPlaytimeSeconds: 0,
    totalCatalogFilesManaged: 0,
    protocolsLaunchedThisSession: 0,
    distinctProtocolsLaunched: [],
    maxModFilesInSingleProtocol: 0,
    totalSourcePortsAdded: 0,
    distinctSourcePortFamilies: []
  }
}

// ── Internal helpers ────────────────────────────────────

/** Scan mods directory and count existing protocols + compute aggregate stats. */
async function computeInitialStatsFromDisk(): Promise<IPlayerStats> {
  const stats: IPlayerStats = { ...DEFAULT_PLAYER_DATA.stats }

  // Count protocols
  try {
    if (fs.existsSync(MODS_DIR)) {
      const entries = await fs.readdir(MODS_DIR)
      const modFiles = entries.filter((f) => f.endsWith('.json'))
      stats.totalProtocolsCreated = modFiles.length

      // Scan each protocol for playtime, lastLaunched, and max file count
      const launchedIds = new Set<string>()
      let maxFiles = 0

      for (const filename of modFiles) {
        const filePath = path.join(MODS_DIR, filename)
        try {
          const data = (await fs.readJSON(filePath)) as Partial<IProtocol>
          // Accumulate playtime
          stats.totalPlaytimeSeconds += data.playtimeSeconds || 0
          // Track launched protocols
          if (data.lastLaunchedAt) {
            // Use the filename without .json as the protocol ID
            const protoId = filename.replace(/\.json$/, '')
            launchedIds.add(protoId)
          }
          // Track max file count
          if (Array.isArray(data.files) && data.files.length > maxFiles) {
            maxFiles = data.files.length
          }
        } catch {
          // Skip corrupt files
        }
      }

      stats.distinctProtocolsLaunched = Array.from(launchedIds)
      stats.totalProtocolsLaunched = launchedIds.size
      stats.maxModFilesInSingleProtocol = maxFiles
    }
  } catch (err) {
    console.error('[playerService] Error scanning protocols for stats:', err)
  }

  // Count catalog entries
  try {
    if (fs.existsSync(MOD_FILE_CATALOG)) {
      const catalog = await fs.readJSON(MOD_FILE_CATALOG)
      if (Array.isArray(catalog)) {
        stats.totalModFilesAdded = catalog.length
        stats.totalCatalogFilesManaged = catalog.length
      }
    }
  } catch (err) {
    console.error('[playerService] Error scanning catalog for stats:', err)
  }

  // Count WAD files from doom versions (non-default ones)
  try {
    if (fs.existsSync(DOOM_VERSIONS_FILE)) {
      const versions = await fs.readJSON(DOOM_VERSIONS_FILE)
      if (Array.isArray(versions)) {
        // Default IDs are 1-9 — anything beyond that is a user-imported WAD
        const defaultIds = new Set(['1', '2', '3', '4', '5', '6', '7', '8', '9'])
        const importedWads = versions.filter(
          (v: { id: string; ignored?: boolean }) => !defaultIds.has(v.id)
        )
        stats.totalWadsImported = importedWads.length
      }
    }
  } catch (err) {
    console.error('[playerService] Error scanning WADs for stats:', err)
  }

  // Count source ports from settings
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const settings: IAppSettings = await fs.readJSON(SETTINGS_FILE)
      const activePorts = (settings.sourcePorts || []).filter((p) => !p.ignored)
      stats.totalSourcePortsAdded = activePorts.length
      stats.distinctSourcePortFamilies = [
        ...new Set(activePorts.map((p) => p.family).filter(Boolean))
      ]
    }
  } catch (err) {
    console.error('[playerService] Error scanning source ports for stats:', err)
  }

  return stats
}

// ── Public API ──────────────────────────────────────────

/**
 * Read player data from disk. Creates default + seeds from existing
 * data on first call, including migration of legacy `settings.rank`.
 *
 * On the first ever load (including fresh app start), resets
 * `protocolsLaunchedThisSession` to 0 so the session counter
 * starts fresh for the new session.
 */
export async function getPlayerData(): Promise<IPlayerData> {
  const exists = fs.existsSync(PLAYER_DATA_FILE)

  if (!exists) {
    debug('[playerService] No playerData.json found — creating with defaults')

    // 1. Start with defaults
    const data: IPlayerData = {
      ...DEFAULT_PLAYER_DATA,
      stats: { ...DEFAULT_PLAYER_DATA.stats }
    }

    // 2. Migrate rank from settings.json if present
    try {
      if (fs.existsSync(SETTINGS_FILE)) {
        const settings: IAppSettings = await fs.readJSON(SETTINGS_FILE)
        if (settings.rank && settings.rank !== 'cadet') {
          data.rank = settings.rank
          debug(`[playerService] Migrated rank "${settings.rank}" from settings.json`)

          // Remove rank from settings to avoid stale data
          delete (settings as unknown as Record<string, unknown>).rank
          await fs.writeJSON(SETTINGS_FILE, settings, { spaces: 2 })
          debug('[playerService] Removed rank from settings.json')
        }
      }
    } catch (err) {
      console.error('[playerService] Error migrating rank from settings:', err)
    }

    // 3. Seed initial stats from existing data
    data.stats = await computeInitialStatsFromDisk()
    debug('[playerService] Seeded initial stats:', data.stats)

    // 4. Persist
    await fs.writeJSON(PLAYER_DATA_FILE, data, { spaces: 2 })
    return data
  }

  // Read existing
  try {
    const data: IPlayerData = await fs.readJSON(PLAYER_DATA_FILE)
    // Ensure all fields exist (in case the file is from an older version)
    const merged: IPlayerData = {
      ...DEFAULT_PLAYER_DATA,
      ...data,
      stats: { ...DEFAULT_PLAYER_DATA.stats, ...(data.stats || {}) },
      achievements: data.achievements ?? {}
    }

    // Reset session stats on first load after app start
    if (!hasLoadedOnce && merged.stats.protocolsLaunchedThisSession !== 0) {
      merged.stats.protocolsLaunchedThisSession = 0
      await fs.writeJSON(PLAYER_DATA_FILE, merged, { spaces: 2 })
      debug('[playerService] Reset protocolsLaunchedThisSession for new session')
    }
    hasLoadedOnce = true

    return merged
  } catch (err) {
    console.error('[playerService] Error reading playerData.json:', err)
    return { ...DEFAULT_PLAYER_DATA }
  }
}

/**
 * Merge partial data into playerData and persist.
 */
export async function savePlayerData(partial: Partial<IPlayerData>): Promise<IPlayerData> {
  const current = await getPlayerData()
  const merged: IPlayerData = {
    ...current,
    ...partial,
    // Deep merge nested objects
    stats: partial.stats ? { ...current.stats, ...partial.stats } : current.stats,
    achievements: partial.achievements
      ? { ...current.achievements, ...partial.achievements }
      : current.achievements
  }
  await fs.writeJSON(PLAYER_DATA_FILE, merged, { spaces: 2 })
  return merged
}

/**
 * Apply a delta to player stats (increment/decrement values).
 * Only keys present in `delta` are updated; all others remain unchanged.
 * Also handles `distinctProtocolsLaunched` (append) and
 * `maxModFilesInSingleProtocol` (max comparison).
 */
export async function updatePlayerStats(delta: Partial<IPlayerStats>): Promise<IPlayerStats> {
  const current = await getPlayerData()
  const newStats: IPlayerStats = { ...current.stats }

  for (const [key, value] of Object.entries(delta)) {
    switch (key) {
      case 'distinctProtocolsLaunched': {
        // Append protocol ID if not already present
        const id = value as unknown as string
        if (id && !newStats.distinctProtocolsLaunched.includes(id)) {
          newStats.distinctProtocolsLaunched = [...newStats.distinctProtocolsLaunched, id]
        }
        break
      }
      case 'distinctSourcePortFamilies': {
        // Append source port family if not already present
        const family = value as unknown as string
        if (family && !newStats.distinctSourcePortFamilies.includes(family)) {
          newStats.distinctSourcePortFamilies = [...newStats.distinctSourcePortFamilies, family]
        }
        break
      }
      case 'maxModFilesInSingleProtocol': {
        // Take the max of current and new value
        const candidate = value as number
        if (candidate > newStats.maxModFilesInSingleProtocol) {
          newStats.maxModFilesInSingleProtocol = candidate
        }
        break
      }
      default: {
        // Numeric increment
        const curVal = (newStats as unknown as Record<string, unknown>)[key]
        const deltaVal = value as number
        if (typeof curVal === 'number' && typeof deltaVal === 'number') {
          const typedStats = newStats as unknown as Record<string, unknown>
          typedStats[key] = curVal + deltaVal
        }
        break
      }
    }
  }

  await fs.writeJSON(PLAYER_DATA_FILE, { ...current, stats: newStats }, { spaces: 2 })
  return newStats
}

/**
 * Mark an achievement as unlocked with a timestamp.
 */
export async function unlockAchievement(
  id: string,
  state: IAchievementState
): Promise<IAchievementState> {
  const current = await getPlayerData()
  const updated: IAchievementState = {
    ...state,
    unlocked: true,
    unlockedAt: new Date().toISOString()
  }
  current.achievements[id] = updated
  await fs.writeJSON(PLAYER_DATA_FILE, current, { spaces: 2 })
  return updated
}

