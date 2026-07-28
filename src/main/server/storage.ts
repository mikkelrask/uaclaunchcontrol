import { createExtractorFromFile } from 'node-unrar-js'
import fs from 'fs-extra'
import path from 'path'
import os from 'os'
import chokidar from 'chokidar'
import crypto from 'crypto'
import { BrowserWindow } from 'electron'
import extractZip from 'extract-zip'
import {
  IAppSettings,
  IDatabaseLink,
  IDoomVersion,
  IProtocol,
  IModFile,
  ModProtocolConfig
} from '../../shared/schema'
import { debug } from '../../shared/debug'

// Debounce timer for WAD watcher events
let wadSyncTimer: ReturnType<typeof setTimeout> | null = null

// Define storage paths (Aligned with local-structure.txt)
const CONFIG_DIR = path.join(os.homedir(), '.config', 'uac')
const DATA_DIR = path.join(CONFIG_DIR, 'data') // For extra data
export const MODS_DIR = path.join(CONFIG_DIR, 'mods') // For mod {id}.json files
const SETTINGS_FILE = path.join(CONFIG_DIR, 'settings.json') // Directly in CONFIG_DIR per local-structure.txt
const DOOM_VERSIONS_FILE = path.join(CONFIG_DIR, 'doomVersions.json') // Directly in CONFIG_DIR per local-structure.txt
const MOD_FILE_CATALOG = path.join(CONFIG_DIR, 'modFileCatalogue.json')
export const IMAGES_DIR = path.join(CONFIG_DIR, 'data/images')
export const CFGS_DIR = path.join(CONFIG_DIR, 'data', 'cfgs')
export const LOGS_DIR = path.join(CONFIG_DIR, 'logs')
const FIRST_RUN_SENTINEL = path.join(CONFIG_DIR, '.first-run-complete')

/** Path to the console log file for a protocol's most recent launch — overwritten each launch. */
export function logFilePathFor(protocolId: string): string {
  return path.join(LOGS_DIR, `${protocolId}.log`)
}

const DEFAULT_DATABASE_LINKS: IDatabaseLink[] = [
  { name: 'MODDB', url: 'https://www.moddb.com/games/doom-ii' },
  { name: 'ZDOOM', url: 'https://forum.zdoom.org/' },
  { name: 'DOOMWORLD', url: 'https://www.doomworld.com/' },
  { name: 'ITCH', url: 'https://itch.io/game-mods/tag-doom' }
]

const DEFAULT_SETTINGS: IAppSettings = {
  sourcePorts: [],
  defaultSourcePortId: undefined,
  theme: 'dark',
  savegamesPath: '~/.config/uac/saves',
  modsDirectory: '~/.config/uac/mods',
  screenshotsPath: '~/Pictures/UAC Launch Control/screenshots',
  databaseLinkPresets: DEFAULT_DATABASE_LINKS,
  selectedPresetIndex: 0,
  wadFilesDirectory: '~/.config/uac/wads',
  autoUpdateEnabled: true,
  registryLookupEnabled: false,
  showLaunchPreview: true,
  uiScale: 100
}

// Default Doom Versions
const DEFAULT_DOOM_VERSIONS: IDoomVersion[] = [
  {
    id: '1',
    name: 'Doom',
    slug: 'doom',
    args: '-iwad doom.wad',
    icon: 'doom.png',
    parameters: '',
    defaultIwad: 'doom.wad'
  },
  {
    id: '2',
    name: 'Doom II',
    slug: 'doom2',
    args: '-iwad doom2.wad',
    icon: 'doom2.png',
    parameters: '',
    defaultIwad: 'doom2.wad'
  },
  {
    id: '3',
    name: 'Final Doom: TNT',
    slug: 'tnt',
    args: '-iwad tnt.wad',
    icon: 'tnt.png',
    parameters: '',
    defaultIwad: 'tnt.wad'
  },
  {
    id: '4',
    name: 'Final Doom: Plutonia',
    slug: 'plutonia',
    args: '-iwad plutonia.wad',
    icon: 'plutonia.png',
    parameters: '',
    defaultIwad: 'plutonia.wad'
  },
  {
    id: '5',
    name: 'FreeDoom Phase 1',
    slug: 'freedoom1',
    args: '-iwad freedoom1.wad',
    icon: 'freedoom1.png',
    parameters: '',
    defaultIwad: 'freedoom1.wad'
  },
  {
    id: '6',
    name: 'FreeDoom Phase 2',
    slug: 'freedoom2',
    args: '-iwad freedoom2.wad',
    icon: 'freedoom2.png',
    parameters: '',
    defaultIwad: 'freedoom2.wad'
  },
  {
    id: '10',
    name: 'FreeDM',
    slug: 'freedm',
    args: '-iwad freedm.wad',
    icon: 'freedm.png',
    parameters: '',
    defaultIwad: 'freedm.wad'
  },
  {
    id: '7',
    name: 'Heretic: Shadow of the Serpent',
    slug: 'heretic',
    args: '-iwad heretic.wad',
    icon: 'heretic.png',
    parameters: '',
    defaultIwad: 'heretic.wad'
  },
  {
    id: '8',
    name: 'Hexen: Beyond Heretic',
    slug: 'hexen',
    args: '-iwad hexen.wad',
    icon: 'hexen.png',
    parameters: '',
    defaultIwad: 'hexen.wad'
  },
  {
    id: '9',
    name: 'Hexen: Deathkings of the Dark Citadel',
    slug: 'hexen-deathkings',
    args: '-iwad hexdd.wad',
    icon: 'hexdd.png',
    parameters: '-iwad hexdd.wad',
    defaultIwad: 'hexdd.wad'
  }
]

let isInitialized = false
let _isFirstRun = false

/** Whether the current session is the very first run (fresh config). */
export function getIsFirstRun(): boolean {
  return _isFirstRun
}

/** Mark first-run as dismissed so the tour won't show on next launch. */
export function dismissFirstRun(): void {
  _isFirstRun = false
  try {
    fs.writeFileSync(FIRST_RUN_SENTINEL, '')
  } catch {
    console.error('[storage] Failed to write first-run sentinel')
    // best-effort
  }
}

/** Re-enable the tour by deleting the sentinel. */
export function reenableFirstRun(): void {
  _isFirstRun = true
  try {
    if (fs.existsSync(FIRST_RUN_SENTINEL)) {
      fs.unlinkSync(FIRST_RUN_SENTINEL)
    }
  } catch {
    console.error('[storage] Failed to remove first-run sentinel')
    // best-effort
  }
}

// Ensure config directories exist and create default files
export function initStorage(): boolean {
  if (isInitialized) return true
  isInitialized = true
  try {
    fs.ensureDirSync(CONFIG_DIR)
    fs.ensureDirSync(DATA_DIR) // Ensure data directory exists
    fs.ensureDirSync(MODS_DIR) // Ensure mods directory exists
    fs.ensureDirSync(CFGS_DIR) // Ensure config files directory exists
    fs.ensureDirSync(LOGS_DIR) // Ensure launch log directory exists

    // Create settings file with defaults if it doesn't exist
    if (!fs.existsSync(SETTINGS_FILE)) {
      fs.writeJSONSync(SETTINGS_FILE, DEFAULT_SETTINGS, { spaces: 2 })
      debug(`Created default settings file at ${SETTINGS_FILE}`)
    }

    // Create doomVersions file with defaults if it doesn't exist
    if (!fs.existsSync(DOOM_VERSIONS_FILE)) {
      fs.writeJSONSync(DOOM_VERSIONS_FILE, DEFAULT_DOOM_VERSIONS, { spaces: 2 })
      debug(`Created default doom versions file at ${DOOM_VERSIONS_FILE}`)
    }

    // Create modFileCatalog file with empty array if it doesn't exist
    if (!fs.existsSync(MOD_FILE_CATALOG)) {
      fs.writeJSONSync(MOD_FILE_CATALOG, [], { spaces: 2 }) // Default to empty array
      debug(`Created default mod file catalog at ${MOD_FILE_CATALOG}`)
    }

    // Detect first run: if settings.json was just created AND the sentinel doesn't exist
    if (!fs.existsSync(FIRST_RUN_SENTINEL)) {
      _isFirstRun = true
    }

    // Sync Doom versions on startup — skip hash to avoid startup delay
    syncDoomVersions({ skipHash: true }).then(() => {
      startWadWatcher()
    })

    console.log('Storage initialized successfully')
    return true
  } catch (error: unknown) {
    console.error('Failed to initialize storage:', error)
    isInitialized = false // Reset on failure so it can try again
    return false
  }
}

// Get application settings
export async function getSettings(): Promise<IAppSettings> {
  try {
    initStorage() // Ensure directories/files exist
    debug('Reading settings from', SETTINGS_FILE)
    const settingsData = await fs.readJSON(SETTINGS_FILE)

    const settings: IAppSettings = { ...DEFAULT_SETTINGS, ...settingsData }

    debug('Retrieved settings from file:', settings)

    // Resolve tildes for all known path fields before sending to UI
    const resolvedSettings: IAppSettings = {
      ...settings,
      configPath: CONFIG_DIR,
      sourcePorts: settings.sourcePorts.map((p) => ({
        ...p,
        executablePath: resolvePath(p.executablePath)
      })),
      savegamesPath: settings.savegamesPath
        ? resolvePath(settings.savegamesPath)
        : settings.savegamesPath,
      modsDirectory: settings.modsDirectory
        ? resolvePath(settings.modsDirectory)
        : settings.modsDirectory,
      screenshotsPath: settings.screenshotsPath
        ? resolvePath(settings.screenshotsPath)
        : settings.screenshotsPath,
      wadFilesDirectory: settings.wadFilesDirectory
        ? resolvePath(settings.wadFilesDirectory)
        : settings.wadFilesDirectory
    }

    debug('Returning resolved settings to UI:', resolvedSettings)
    return resolvedSettings
  } catch (error: unknown) {
    console.error('[DEBUG] Error getting settings:', error)
    return DEFAULT_SETTINGS
  }
}

// Save application settings
export async function saveSettings(settings: Partial<IAppSettings>): Promise<IAppSettings> {
  try {
    initStorage() // Ensure directories/files exist
    const currentSettings = await getSettings()
    const updatedSettings = { ...currentSettings, ...settings }
    debug('Saving settings to', SETTINGS_FILE, 'with data:', updatedSettings)
    await fs.writeJSON(SETTINGS_FILE, updatedSettings, { spaces: 2 })
    debug('Saved settings:', updatedSettings)

    // If wadFilesDirectory changed, restart watcher
    if (
      settings.wadFilesDirectory &&
      settings.wadFilesDirectory !== currentSettings.wadFilesDirectory
    ) {
      debug('wadFilesDirectory changed, restarting watcher...')
      stopWadWatcher()
      await syncDoomVersions()
      startWadWatcher()
    }

    return updatedSettings
  } catch (error: unknown) {
    console.error('[DEBUG] Error saving settings:', error)
    throw new Error(
      `Failure: Setting not saved: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

// Helper to escape spaces in path for command line
function escapePathForCmd(filePath: string): string {
  return filePath.replace(/ /g, '\\ ')
}

// Helper to generate a stable ID
function generateStableId(baseName: string): string {
  return `wad-${baseName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`
}

export function stripMd5Suffix(baseName: string): string {
  return baseName.replace(/(-[a-f0-9]{32})+$/i, '')
}

export function countMd5Suffixes(baseName: string): number {
  return baseName.match(/-[a-f0-9]{32}/gi)?.length ?? 0
}

export function wadNamePriority(fileName: string): number {
  const suffixCount = countMd5Suffixes(fileName.replace(/\.wad$/i, ''))
  if (suffixCount === 0) return 0
  if (suffixCount === 1) return 1
  return 2
}

// === Doom Versions ===
// Get all Doom versions
export async function getDoomVersions(): Promise<IDoomVersion[]> {
  try {
    initStorage() // Ensure file exists
    if (!fs.existsSync(DOOM_VERSIONS_FILE)) {
      await syncDoomVersions()
    }
    const versions: IDoomVersion[] = await fs.readJSON(DOOM_VERSIONS_FILE)
    // Resolve tildes before sending to renderer
    const resolved = versions.map((v) => ({
      ...v,
      icon: v.icon ? resolvePath(v.icon) : v.icon,
      defaultIwad: v.defaultIwad ? resolvePath(v.defaultIwad) : v.defaultIwad
    }))
    debug('getDoomVersions: Returning resolved versions:', resolved.length)
    return resolved
  } catch (error: unknown) {
    console.error('Error getting Doom versions:', error)
    return [] // Return empty array on error
  }
}

import type { FSWatcher } from 'chokidar'

let wadWatcher: FSWatcher | null = null

export function stopWadWatcher(): void {
  if (wadSyncTimer) {
    clearTimeout(wadSyncTimer)
    wadSyncTimer = null
  }
  if (wadWatcher) {
    wadWatcher.close()
    wadWatcher = null
  }
}

export async function startWadWatcher(): Promise<void> {
  debug('startWadWatcher called')
  if (wadWatcher) {
    debug('Watcher already exists, skipping')
    return
  }

  try {
    const settings = await getSettings()
    const rawDir = settings.wadFilesDirectory || path.join(CONFIG_DIR, 'wads')
    const wadDir = resolvePath(rawDir)
    debug(`Watcher starting for directory: ${wadDir} (from raw: ${rawDir})`)

    try {
      fs.ensureDirSync(wadDir)
    } catch (error: unknown) {
      console.error(`Failed to ensure directory ${wadDir}:`, error)
      return
    }

    wadWatcher = chokidar.watch(wadDir, {
      persistent: true,
      ignoreInitial: true,
      usePolling: true,
      interval: 100
    })

    wadWatcher.on('all', (event, filePath) => {
      if (filePath.toLowerCase().endsWith('.wad')) {
        // Debounce: coalesce rapid events (common with polling) into one sync
        if (wadSyncTimer) {
          clearTimeout(wadSyncTimer)
        }
        wadSyncTimer = setTimeout(() => {
          wadSyncTimer = null
          debug(`WAD change detected (${event}): ${filePath}. Syncing...`)
          syncDoomVersions({ notifyDelta: true })
        }, 500)
      }
    })

    wadWatcher.on('error', (error) => {
      console.error(`[DEBUG] Chokidar watcher error:`, error)
    })

    debug(`Started WAD watcher on ${wadDir}`)
  } catch (err) {
    console.error('[DEBUG] Error starting WAD watcher:', err)
  }
}

// Sync Doom versions by scanning the WAD directory
export async function syncDoomVersions(
  options: { notifyDelta?: boolean; skipHash?: boolean } = {}
): Promise<IDoomVersion[]> {
  try {
    initStorage()
    debug('syncDoomVersions starting...')
    const settings = await getSettings()
    const wadDir = resolvePath(settings.wadFilesDirectory || path.join(CONFIG_DIR, 'wads'))

    // Load existing versions to detect changes
    const oldVersions: IDoomVersion[] = await fs.readJSON(DOOM_VERSIONS_FILE).catch(() => [])

    await fs.ensureDir(wadDir)
    const files = await fs.readdir(wadDir)
    const wadFiles = files
      .filter((f) => f.toLowerCase().endsWith('.wad'))
      .sort((a, b) => {
        return wadNamePriority(a) - wadNamePriority(b) || a.localeCompare(b)
      })

    // Create a map of lowercase wad names to full paths
    const wadFileMap = new Map<string, string>()
    for (const wadFile of wadFiles) {
      wadFileMap.set(wadFile.toLowerCase(), path.join(wadDir, wadFile))
    }

    const updatedVersions: IDoomVersion[] = []
    const seenWadHashes = new Set<string>()

    // 1. Check default versions
    for (const def of DEFAULT_DOOM_VERSIONS) {
      const lowerWadName = def.defaultIwad.toLowerCase()
      if (wadFileMap.has(lowerWadName)) {
        const fullPath = wadFileMap.get(lowerWadName)!
        // Only hash on non-initial runs — dedup is a nice-to-have, not a startup blocker
        let hashValue = ''
        if (!options.skipHash) {
          hashValue = await computeFileHash(fullPath)
          if (hashValue) {
            seenWadHashes.add(hashValue)
          }
        }
        // Find existing to preserve custom settings like name/icon overrides if any
        // Note: traditionally defaults use their own defaults, but we should check
        const existing = oldVersions.find((v) => v.id === def.id)

        if (existing) {
          updatedVersions.push({
            ...existing,
            defaultIwad: fullPath, // Update actual path
            args: existing.args.includes('-iwad')
              ? existing.args.replace(
                  /-iwad\s+"[^"]+"|-iwad\s+[^\s]+/,
                  `-iwad ${escapePathForCmd(fullPath)}`
                )
              : `-iwad ${escapePathForCmd(fullPath)} ${existing.args}`.trim()
          })
        } else {
          updatedVersions.push({
            ...def,
            args: `-iwad ${escapePathForCmd(fullPath)}`,
            defaultIwad: fullPath
          })
        }
        wadFileMap.delete(lowerWadName) // Mark as handled
      }
    }

    // 2. Add remaining WADs from disk
    for (const [wadName, wadPath] of wadFileMap) {
      let hashValue = ''
      if (!options.skipHash) {
        hashValue = await computeFileHash(wadPath)
        if (hashValue && seenWadHashes.has(hashValue)) {
          debug(`syncDoomVersions: Skipping duplicate WAD content: ${wadPath}`)
          continue
        }
        if (hashValue) {
          seenWadHashes.add(hashValue)
        }
      }

      const baseName = wadName.replace(/\.wad$/i, '')
      const displayName = stripMd5Suffix(baseName)
      const id = generateStableId(baseName)

      // Check if this wad was already in the list
      const existing = oldVersions.find((v) => v.id === id || v.defaultIwad === wadPath)

      if (existing) {
        updatedVersions.push({
          ...existing,
          args: existing.args.includes('-iwad')
            ? existing.args.replace(
                /-iwad\s+"[^"]+"|-iwad\s+[^\s]+/,
                `-iwad ${escapePathForCmd(wadPath)}`
              )
            : `-iwad ${escapePathForCmd(wadPath)} ${existing.args}`.trim(),
          defaultIwad: wadPath
        })
      } else {
        updatedVersions.push({
          id,
          name: displayName,
          slug: id,
          args: `-iwad ${escapePathForCmd(wadPath)}`,
          icon: '',
          parameters: '',
          defaultIwad: wadPath
        })
      }
    }

    await fs.writeJSON(DOOM_VERSIONS_FILE, updatedVersions, { spaces: 2 })
    debug(`syncDoomVersions: Synced ${updatedVersions.length} versions to ${DOOM_VERSIONS_FILE}`)

    // Prepare resolved versions for the UI
    const resolvedVersions = updatedVersions.map((v) => ({
      ...v,
      icon: v.icon ? resolvePath(v.icon) : v.icon,
      defaultIwad: v.defaultIwad ? resolvePath(v.defaultIwad) : v.defaultIwad
    }))

    // Calculate changes if notification is requested
    let delta = {}
    if (options.notifyDelta) {
      const oldIds = new Set(oldVersions.map((v) => v.id))
      const newIds = new Set(resolvedVersions.map((v) => v.id))
      const added = resolvedVersions.filter((v) => !oldIds.has(v.id))
      const removed = oldVersions
        .map((v) => ({
          ...v,
          icon: v.icon ? resolvePath(v.icon) : v.icon,
          defaultIwad: v.defaultIwad ? resolvePath(v.defaultIwad) : v.defaultIwad
        }))
        .filter((v) => !newIds.has(v.id))
      delta = { added, removed }
    }

    // Notify all windows that versions have been updated
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send('doom-versions-updated', delta)
    })

    return resolvedVersions
  } catch (error: unknown) {
    console.error('Error syncing Doom versions:', error)
    return []
  }
}

// Get a specific Doom version by slug
export async function getDoomVersionBySlug(slug: string): Promise<IDoomVersion | undefined> {
  try {
    const versions = await getDoomVersions()
    return versions.find((v) => v.slug === slug)
  } catch (error: unknown) {
    console.error(`Error getting Doom version by slug ${slug}:`, error)
    return undefined
  }
}

// Save all Doom versions (overwrites the file with current state)
export async function saveDoomVersions(versions: IDoomVersion[]): Promise<void> {
  try {
    initStorage() // Ensure file exists
    await fs.writeJSON(DOOM_VERSIONS_FILE, versions, { spaces: 2 })
    debug('Saved doom versions to', DOOM_VERSIONS_FILE)

    // Notify all windows that versions have been updated
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send('doom-versions-updated')
    })
  } catch (error: unknown) {
    console.error('Error saving Doom versions:', error)
    throw new Error(
      `Failed to save Doom versions: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

// === Mod File Catalog ===
// Get the mod file catalog
export async function getModFileCatalog(): Promise<IModFile[]> {
  try {
    const filePath = path.join(CONFIG_DIR, 'modFileCatalogue.json')
    debug('Reading modFileCatalogue.json from:', filePath)
    if (!fs.existsSync(filePath)) {
      return []
    }
    const raw = await fs.promises.readFile(filePath, 'utf-8')
    debug('Raw modFileCatalogue.json contents:', raw)
    let data = []
    try {
      data = JSON.parse(raw)
    } catch (err) {
      console.error('storage.ts: Failed to parse modFileCatalogue.json:', err, 'Raw:', raw)
      data = []
    }
    if (!Array.isArray(data)) {
      console.warn('storage.ts: modFileCatalogue.json is not an array, got:', data)
      return []
    }

    // Migration: requires -> loadOrder
    let migrated = false
    const migratedData = data.map((file: IModFile & { requires?: Record<string, number> }) => {
      if (file.requires !== undefined || typeof file.loadOrder === 'number') {
        migrated = true
        const oldRequires = file.requires || {}
        const newLoadOrder: Record<string, number> = {}

        // Main file gets offset 1 if hash exists
        if (file.hashValue) {
          newLoadOrder[file.hashValue] = 1
        }

        // Shift others by 1
        for (const [hash, offset] of Object.entries(oldRequires)) {
          newLoadOrder[hash] = (offset as number) + 1
        }

        const newFile = { ...file, loadOrder: newLoadOrder }
        delete newFile.requires
        return newFile as IModFile
      }
      // Ensure loadOrder is a Record<string, number> if missing
      if (!file.loadOrder && file.hashValue) {
        migrated = true
        return {
          ...file,
          loadOrder: { [file.hashValue]: 1 }
        } as IModFile
      }
      return file as IModFile
    })

    if (migrated) {
      await fs.writeJSON(filePath, migratedData, { spaces: 2 })
      debug('storage.ts: Migrated modFileCatalogue.json requires to loadOrder')
    }

    return migratedData
  } catch (error) {
    console.error('storage.ts: Error reading modFileCatalogue.json:', error)
    return []
  }
}

// Helper to expand ~ to home directory
export function resolvePath(p: string): string {
  if (p.startsWith('~')) {
    return path.join(os.homedir(), p.slice(1))
  }
  return p
}

// Move a file to a new path
export async function moveFile(filePath: string, newPath: string): Promise<string> {
  try {
    const resolvedSource = resolvePath(filePath)
    const resolvedDest = resolvePath(newPath)

    debug('Moving file from', resolvedSource, 'to', resolvedDest)

    // Ensure destination directory exists
    await fs.ensureDir(path.dirname(resolvedDest))

    // Use copy then potentially delete (or just copy for now as per original code)
    await fs.copy(resolvedSource, resolvedDest)

    console.log('Moved file to', resolvedDest)
    return resolvedDest
  } catch (error: unknown) {
    console.error('Error moving file:', error)
    throw new Error(
      `Failed to move file: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

// Special helper to move a file into the mods/files folder and return the relative path
export async function moveToModFolder(
  sourcePath: string
): Promise<{ fullPath: string; relativePath: string; hashValue: string }> {
  try {
    const settings = await getSettings()
    const modsDir = resolvePath(settings.modsDirectory || path.join(CONFIG_DIR, 'mods'))
    const resolvedSource = resolvePath(sourcePath)
    const originalFileName = path.basename(resolvedSource)
    const hashValue = await computeFileHashOrThrow(resolvedSource)
    const ext = path.extname(originalFileName)
    const baseName = path.basename(originalFileName, ext)
    const newFileName = `${baseName}-${hashValue}${ext}`
    const relativePath = path.join('files', newFileName)
    const fullPath = path.join(modsDir, relativePath)

    await fs.ensureDir(path.join(modsDir, 'files'))
    await fs.copy(resolvedSource, fullPath, { overwrite: true })

    debug(`Moved file to mod folder: ${fullPath} (relative: ${relativePath}, hash: ${hashValue})`)
    return { fullPath, relativePath, hashValue }
  } catch (error: unknown) {
    console.error('Error moving file to mod folder:', error)
    throw new Error(
      `Failed to move file to mod folder: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

export async function importWadFile(
  sourcePath: string
): Promise<{ fileName: string; fullPath: string; hashValue: string; alreadyExists: boolean }> {
  try {
    const settings = await getSettings()
    const wadDir = resolvePath(settings.wadFilesDirectory || path.join(CONFIG_DIR, 'wads'))
    const resolvedSource = resolvePath(sourcePath)
    const originalFileName = path.basename(resolvedSource)
    const ext = path.extname(originalFileName)

    if (ext.toLowerCase() !== '.wad') {
      throw new Error('Only .wad files can be imported')
    }

    const hashValue = await computeFileHashOrThrow(resolvedSource)

    await fs.ensureDir(wadDir)

    const baseName = stripMd5Suffix(path.basename(originalFileName, ext))
    const fileName = `${baseName}-${hashValue}${ext}`
    const fullPath = path.join(wadDir, fileName)

    const existingWads = await fs.readdir(wadDir)
    const sortedExistingWads = existingWads
      .filter((existingFileName) => existingFileName.toLowerCase().endsWith('.wad'))
      .sort((a, b) => wadNamePriority(a) - wadNamePriority(b) || a.localeCompare(b))

    for (const existingFileName of sortedExistingWads) {
      if (!existingFileName.toLowerCase().endsWith('.wad')) continue

      const existingPath = path.join(wadDir, existingFileName)
      const existingHash = await computeFileHash(existingPath)
      if (existingHash === hashValue) {
        await syncDoomVersions({ notifyDelta: true })
        debug(`WAD already imported by hash: ${existingPath} (hash: ${hashValue})`)
        return {
          fileName: existingFileName,
          fullPath: existingPath,
          hashValue,
          alreadyExists: true
        }
      }
    }

    await fs.copy(resolvedSource, fullPath, { overwrite: false })

    await syncDoomVersions({ notifyDelta: true })

    debug(`Imported WAD file: ${fullPath} (hash: ${hashValue})`)
    return { fileName, fullPath, hashValue, alreadyExists: false }
  } catch (error: unknown) {
    console.error('Error importing WAD file:', error)
    throw new Error(
      `Failed to import WAD file: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

// Copy a local image file to the images directory
export async function copyImageToImages(sourcePath: string): Promise<string> {
  try {
    const fileName = sourcePath.split(/[\\/]/).pop() || `image_${Date.now()}`
    const timestamp = Date.now()
    const uniqueFileName = `${timestamp}_${fileName}`
    const destPath = path.join(IMAGES_DIR, uniqueFileName)

    await fs.ensureDir(IMAGES_DIR)
    await fs.copy(sourcePath, destPath)

    debug(`Image copied to: ${destPath}`)
    return uniqueFileName
  } catch (error: unknown) {
    console.error('Error copying image:', error)
    throw new Error(
      `Failed to copy image: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

// Download an image from a URL and save it to the images directory
export async function downloadImage(url: string, protocolId: string): Promise<string> {
  try {
    await fs.ensureDir(IMAGES_DIR)

    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching image`)

    // Better extension detection from Content-Type or URL
    const contentType = res.headers.get('content-type')
    let extension = ''
    if (contentType === 'image/jpeg') extension = '.jpg'
    else if (contentType === 'image/png') extension = '.png'
    else if (contentType === 'image/webp') extension = '.webp'
    else if (contentType === 'image/gif') extension = '.gif'
    else {
      extension = path.extname(new URL(url).pathname) || '.jpg'
    }

    if (extension.length > 5) extension = '.jpg'

    const fileName = `${protocolId}-poster${extension}`
    const filePath = path.join(IMAGES_DIR, fileName)

    await fs.writeFile(filePath, Buffer.from(await res.arrayBuffer()))

    debug(`Image downloaded via fetch and saved to: ${filePath}`)
    return fileName // Return just the filename
  } catch (error: unknown) {
    console.error('Error downloading image:', error)
    throw new Error(
      `Failed to download image: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

const IMAGE_MIME_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif'
}

// Read an image from the images directory as base64, for embedding in a
// modpack export. path.basename strips any directory components so a
// crafted fileName can't escape IMAGES_DIR.
export async function readScreenshotAsBase64(
  fileName: string
): Promise<{ fileName: string; mimeType: string; data: string }> {
  const safeName = path.basename(fileName)
  const filePath = path.join(IMAGES_DIR, safeName)
  const buffer = await fs.readFile(filePath)
  const ext = path.extname(safeName).toLowerCase()
  return {
    fileName: safeName,
    mimeType: IMAGE_MIME_TYPES[ext] || 'application/octet-stream',
    data: buffer.toString('base64')
  }
}

// Write a base64-encoded image (from a modpack import) into the images
// directory, mirroring copyImageToImages' unique-filename scheme.
export async function writeScreenshotFromBase64(fileName: string, data: string): Promise<string> {
  const safeName = path.basename(fileName)
  const uniqueFileName = `${Date.now()}_${safeName}`
  const destPath = path.join(IMAGES_DIR, uniqueFileName)

  await fs.ensureDir(IMAGES_DIR)
  await fs.writeFile(destPath, Buffer.from(data, 'base64'))

  debug(`Screenshot imported to: ${destPath}`)
  return uniqueFileName
}

async function resolveFileHashPath(filePath: string): Promise<string> {
  let resolvedPath = resolvePath(filePath)

  // If path is relative (not absolute and not starting with ~), resolve against mods directory
  if (!path.isAbsolute(filePath) && !filePath.startsWith('~')) {
    const settings = await getSettings()
    const modsDir = resolvePath(settings.modsDirectory || path.join(CONFIG_DIR, 'mods'))
    resolvedPath = path.join(modsDir, filePath)
  }

  return resolvedPath
}

function hashFileStream(resolvedPath: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const md5 = crypto.createHash('md5')
    const stream = fs.createReadStream(resolvedPath)
    stream.on('data', (chunk) => md5.update(chunk))
    stream.on('error', reject)
    stream.on('end', () => resolve(md5.digest('hex')))
  })
}

// Best-effort hash used by bulk scans (WAD sync, archive scans) where one
// unreadable file shouldn't abort the whole scan — swallows errors and
// returns '' rather than throwing.
export async function computeFileHash(filePath: string): Promise<string> {
  try {
    const resolvedPath = await resolveFileHashPath(filePath)
    const hash = await hashFileStream(resolvedPath)
    debug(`Computed MD5 hash for ${resolvedPath}: ${hash}`)
    return hash
  } catch (error) {
    console.error(`Error computing hash for ${filePath}:`, error)
    return ''
  }
}

// Strict variant for single-file add/import flows, where the caller needs
// the real OS error (ENOSPC, EPERM, ENAMETOOLONG, ...) surfaced to the user
// instead of a generic "failed to hash" message.
export async function computeFileHashOrThrow(filePath: string): Promise<string> {
  const resolvedPath = await resolveFileHashPath(filePath)
  const hash = await hashFileStream(resolvedPath)
  debug(`Computed MD5 hash for ${resolvedPath}: ${hash}`)
  return hash
}

/**
 * Locate a stored config file by its key (hash or protocolId), regardless of
 * extension — uploads preserve their original extension (.cfg, .ini, .conf,
 * etc.) rather than being forced to .cfg, so lookups need to discover it.
 */
function findConfigFile(key: string): string | null {
  if (!fs.existsSync(CFGS_DIR)) return null
  const match = fs.readdirSync(CFGS_DIR).find((f) => f.startsWith(`${key}.`))
  return match ? path.join(CFGS_DIR, match) : null
}

/**
 * Create a blank, isolated config for a protocol with no originating
 * template — lets a protocol get its own settings even when none of its
 * mod files provided a config template (or the user wants to override one).
 */
export async function createBlankProtocolConfig(
  protocolId: string,
  ext: string = '.cfg'
): Promise<ModProtocolConfig> {
  try {
    initStorage()
    await fs.ensureDir(CFGS_DIR)
    const normalizedExt = ext.startsWith('.') ? ext : `.${ext}`
    const configFile = `${protocolId}${normalizedExt}`
    const dest = path.join(CFGS_DIR, configFile)
    await fs.writeFile(dest, '', 'utf-8')
    debug(`Created blank protocol config: ${dest}`)
    return { configFile }
  } catch (error: unknown) {
    console.error('Error creating blank protocol config:', error)
    throw new Error(
      `Failed to create blank protocol config: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

/**
 * Copy a config template file to a protocol-specific isolated copy.
 *
 * When a protocol is created with mod files that have a configTemplate,
 * this function copies the template into a per-protocol file so each
 * protocol has its own config that users can modify in-game without
 * affecting other protocols.
 */
export async function copyConfigForProtocol(
  templateHash: string,
  protocolId: string
): Promise<ModProtocolConfig> {
  try {
    initStorage()
    const src = findConfigFile(templateHash)
    if (!src) {
      throw new Error(`Config template not found for hash: ${templateHash}`)
    }
    const ext = path.extname(src)
    const configFile = `${protocolId}${ext}`
    const dest = path.join(CFGS_DIR, configFile)

    await fs.copy(src, dest, { overwrite: true })
    debug(`Copied config template ${templateHash} to protocol ${protocolId}`)

    return {
      configFile,
      templateHash
    }
  } catch (error: unknown) {
    console.error('Error copying config for protocol:', error)
    throw new Error(
      `Failed to copy config for protocol: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

/**
 * Read a config file content by hash or protocolId.
 * Returns the raw text content of the config file.
 */
export async function readConfigFileContent(key: string): Promise<string> {
  try {
    initStorage()
    const filePath = findConfigFile(key)
    if (!filePath) {
      throw new Error(`Config file not found for key: ${key}`)
    }
    const content = await fs.readFile(filePath, 'utf-8')
    return content
  } catch (error: unknown) {
    console.error('Error reading config file:', error)
    throw new Error(
      `Failed to read config file: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

/**
 * Write a config file to the cfgs directory (by hash or protocolId).
 * Writes back to whatever extension the file already has; falls back to
 * .cfg only if no file exists yet for this key.
 */
export async function writeConfigFileContent(key: string, content: string): Promise<string> {
  try {
    initStorage()
    const filePath = findConfigFile(key) ?? path.join(CFGS_DIR, `${key}.cfg`)
    await fs.ensureDir(CFGS_DIR)
    await fs.writeFile(filePath, content, 'utf-8')
    debug(`Wrote config file: ${filePath}`)
    return key
  } catch (error: unknown) {
    console.error('Error writing config file:', error)
    throw new Error(
      `Failed to write config file: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

export async function addModFileToCatalog(file: Omit<IModFile, 'id'>): Promise<IModFile> {
  try {
    debug('addModFileToCatalog called with:', file)
    initStorage() // Ensure directories and files exist

    // Read existing catalog
    debug(`Reading catalog from ${MOD_FILE_CATALOG}`)
    let catalog: IModFile[] = []
    if (fs.existsSync(MOD_FILE_CATALOG)) {
      catalog = await fs.readJSON(MOD_FILE_CATALOG)
      debug(`Existing catalog has ${catalog.length} entries`)
    } else {
      debug(`Catalog file doesn't exist, creating new one`)
    }

    if (file.filePath) {
      let relativePath: string
      let hashValue: string
      let originalFileName: string

      // Check if file is already in mods folder (relative path starting with 'files/' or 'files\')
      if (file.filePath.startsWith('files/') || file.filePath.startsWith('files\\')) {
        // File already moved, use as-is
        relativePath = file.filePath
        hashValue = file.hashValue || (await computeFileHash(relativePath))
        originalFileName = file.fileName || path.basename(relativePath)
      } else {
        // Move file to mod folder with hash-based filename
        const moved = await moveToModFolder(file.filePath)
        relativePath = moved.relativePath
        hashValue = moved.hashValue
        originalFileName = file.filePath.split(/[\\/]/).pop() || file.filePath
      }

      // Check for duplicate by hash — if an entry with this hash already exists, return it
      if (hashValue) {
        const existing = catalog.find((entry) => entry.hashValue === hashValue)
        if (existing) {
          debug(`Duplicate file detected by hash ${hashValue}, returning existing entry`)
          return existing
        }
      }

      // Set fileName to the new filename in the mod folder
      const fileName = path.basename(relativePath)
      // Always set name (pretty name), default to original file name if missing
      const name = file.name && file.name.trim() ? file.name : originalFileName
      // Create new catalog entry with an ID
      const createdFile: IModFile = {
        ...file,
        name,
        fileName,
        id: Date.now(),
        hashValue,
        filePath: relativePath, // Use the relative path in mods folder
        loadOrder: file.loadOrder ?? {},
        requiredBy: file.requiredBy ?? [],
        sidecarOnly: file.sidecarOnly ?? false,
        url: file.url ?? '',
        version: file.version ?? ''
      }
      debug('Created new catalog entry:', createdFile)
      // Add to catalog
      catalog.push(createdFile)
      // Save updated catalog
      debug(`Writing updated catalog with ${catalog.length} entries to ${MOD_FILE_CATALOG}`)
      await fs.writeJSON(MOD_FILE_CATALOG, catalog, { spaces: 2 })
      debug(`Catalog file saved successfully`)
      return createdFile
    }
    throw new Error('Invalid file: filePath is required')
  } catch (error: unknown) {
    console.error('Error adding mod file to catalog:', error)
    throw new Error(
      `Failed to add mod file to catalog: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

// Update a mod file in the catalog
export async function updateModFileInCatalog(
  id: number | string,
  updates: Partial<IModFile>
): Promise<IModFile> {
  try {
    const catalog = await getModFileCatalog()
    // Compare as strings to be safe against numeric/string ID mismatches
    const index = catalog.findIndex((f) => String(f.id) === String(id))

    if (index === -1) {
      console.error(
        `[DEBUG] Catalog update failed: Mod file with ID ${id} not found in catalog. Content of catalog IDs:`,
        catalog.map((f) => f.id)
      )
      throw new Error(`Mod file with ID ${id} not found in catalog`)
    }

    const updatedFile = { ...catalog[index], ...updates }
    catalog[index] = updatedFile

    await fs.writeJSON(MOD_FILE_CATALOG, catalog, { spaces: 2 })
    debug(`Successfully updated mod file ${id} in catalog (new name: ${updates.name})`)
    return updatedFile
  } catch (error: unknown) {
    console.error(`Error updating mod file ${id} in catalog:`, error)
    throw new Error(
      `Failed to update mod file: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

// === Mods ===
export async function saveProtocol(
  protocolData: IProtocol & { files: IModFile[] }
): Promise<IProtocol> {
  // Ensure doomVersionId is always a string
  if (protocolData.doomVersionId !== undefined) {
    protocolData.doomVersionId = String(protocolData.doomVersionId)
  }
  try {
    initStorage()
    const settings = await getSettings()
    const targetDir = settings.modsDirectory ? resolvePath(settings.modsDirectory) : MODS_DIR
    const filePath = path.join(targetDir, `${protocolData.id}.json`)

    for (const file of protocolData.files) {
      if (!file.hashValue && file.filePath) {
        file.hashValue = await computeFileHash(file.filePath)
      }
    }

    await fs.writeJSON(filePath, protocolData, { spaces: 2 })
    const protocol = { ...protocolData }
    delete (protocol as Record<string, unknown>).files
    return protocol as IProtocol
  } catch (error: unknown) {
    console.error('Error saving mod:', error)
    throw new Error(`Failed to save mod: ${error instanceof Error ? error.message : String(error)}`)
  }
}

/** Enrich each file in a protocol with catalogue metadata (url, name, version). */
async function enrichFilesWithCatalog(files: IModFile[]): Promise<IModFile[]> {
  if (files.length === 0) return files
  try {
    const catalog = await getModFileCatalog()
    const byHash = new Map<string, IModFile>()
    for (const entry of catalog) {
      if (entry.hashValue) {
        byHash.set(entry.hashValue, entry)
      }
    }
    return files.map((f) => {
      if (!f.hashValue) return f
      const catalogEntry = byHash.get(f.hashValue)
      if (!catalogEntry) return f
      return {
        ...f,
        url: f.url || catalogEntry.url || '',
        name: f.name || catalogEntry.name || '',
        version: f.version || catalogEntry.version || ''
      }
    })
  } catch {
    return files
  }
}

export async function getProtocols(): Promise<IProtocol[]> {
  try {
    initStorage()
    const settings = await getSettings()
    const targetDir = settings.modsDirectory ? resolvePath(settings.modsDirectory) : MODS_DIR
    const protocols: IProtocol[] = []
    if (!fs.existsSync(targetDir)) {
      return protocols
    }
    const filenames = await fs.readdir(targetDir)

    for (const filename of filenames) {
      if (filename.endsWith('.json')) {
        const filePath = path.join(targetDir, filename)
        try {
          const data = await fs.readJSON(filePath)
          const protocol = { ...data }
          if (!Array.isArray(protocol.files)) {
            protocol.files = []
          }
          protocol.files = await enrichFilesWithCatalog(protocol.files)
          protocols.push(protocol as IProtocol)
        } catch (err: unknown) {
          console.error(`Error reading protocol file ${filename}:`, err)
        }
      }
    }
    return protocols
  } catch (error: unknown) {
    console.error('Error getting protocols:', error)
    return []
  }
}

export async function getProtocol(protocolId: string): Promise<IProtocol & { files: IModFile[] }> {
  try {
    initStorage()
    const settings = await getSettings()
    const targetDir = settings.modsDirectory ? resolvePath(settings.modsDirectory) : MODS_DIR
    const filePath = path.join(targetDir, `${protocolId}.json`)
    if (!fs.existsSync(filePath)) {
      throw new Error(`Protocol ${protocolId} not found`)
    }
    const data = await fs.readJSON(filePath)
    if (!Array.isArray(data.files)) {
      data.files = []
    }
    data.files = await enrichFilesWithCatalog(data.files)
    return data as IProtocol & { files: IModFile[] }
  } catch (error: unknown) {
    console.error(`Error getting protocol ${protocolId}:`, error)
    throw new Error(
      `Failed to get protocol: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

export async function getDoomVersion(id: string): Promise<IDoomVersion | undefined> {
  try {
    const versions = await getDoomVersions()
    return versions.find((v) => v.id === id)
  } catch (error: unknown) {
    console.error(`Error getting Doom version by id ${id}:`, error)
    return undefined
  }
}

export async function updateDoomVersion(
  id: string,
  updates: Partial<IDoomVersion>
): Promise<IDoomVersion> {
  const versions = await getDoomVersions()
  const index = versions.findIndex((v) => v.id === id)
  if (index === -1) {
    throw new Error(`Doom version with ID ${id} not found`)
  }
  const updated = { ...versions[index], ...updates }
  versions[index] = updated
  await saveDoomVersions(versions)
  return updated
}

// Add playtime to a protocol's accumulated playtime
export async function addPlaytime(id: string, sessionSeconds: number): Promise<void> {
  try {
    const settings = await getSettings()
    const targetDir = settings.modsDirectory ? resolvePath(settings.modsDirectory) : MODS_DIR
    const filePath = path.join(targetDir, `${id}.json`)

    if (!fs.existsSync(filePath)) {
      console.warn(`addPlaytime: Protocol ${id} not found`)
      return
    }

    const data = await fs.readJSON(filePath)
    const current = data.playtimeSeconds || 0
    data.playtimeSeconds = current + sessionSeconds
    await fs.writeJSON(filePath, data, { spaces: 2 })

    debug(`Added ${sessionSeconds}s playtime to protocol ${id} (total: ${data.playtimeSeconds}s)`)
  } catch (error: unknown) {
    console.error(`Error adding playtime to protocol ${id}:`, error)
  }
}

export async function deleteProtocol(id: string | number): Promise<boolean | undefined> {
  try {
    const settings = await getSettings()
    const targetDir = settings.modsDirectory ? resolvePath(settings.modsDirectory) : MODS_DIR
    const filePath = path.join(targetDir, `${id}.json`)
    debug('Attempting to delete protocol file:', filePath)
    if (await fs.pathExists(filePath)) {
      await fs.remove(filePath)
      debug('Deleted protocol file:', filePath)
      return true
    } else {
      console.warn('[DEBUG] Protocol file does not exist:', filePath)
      return false
    }
  } catch (error: unknown) {
    console.error('Error deleting protocol:', error)
    return false
  }
}

export async function deleteModFileFromCatalog(
  fileId: number,
  deleteFile?: boolean
): Promise<boolean> {
  try {
    const catalog = await getModFileCatalog()
    const index = catalog.findIndex((f) => f.id === fileId)
    if (index === -1) {
      throw new Error(`File with ID ${fileId} not found in catalog`)
    }

    const file = catalog[index]

    if (deleteFile && file.filePath) {
      const resolved = resolvePath(file.filePath)
      try {
        await fs.remove(resolved)
        console.log(`[storage] Deleted file from disk: ${resolved}`)
      } catch (err) {
        console.warn(`[storage] Failed to delete file from disk: ${resolved}`, err)
      }
    }

    catalog.splice(index, 1)
    await fs.writeJSON(MOD_FILE_CATALOG, catalog, { spaces: 2 })
    return true
  } catch (error) {
    console.error('Error deleting file from catalog:', error)
    throw new Error(
      `Failed to delete file from catalog: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

interface BatParseResult {
  sourcePortFamily?: string
  iwad?: string
  modFiles: string[]
  extraParams: string[]
}

function parseBatContent(content: string): BatParseResult {
  const lines = content.replace(/\r\n/g, '\n').split('\n')
  let commandLine = ''
  let sourcePortFamily: string | undefined

  for (const line of lines) {
    const trimmed = line.trim()
    if (
      !trimmed ||
      trimmed.toLowerCase().startsWith('::') ||
      trimmed.toLowerCase().startsWith('@echo') ||
      trimmed.toLowerCase().startsWith('rem ')
    )
      continue

    const portMatch = trimmed.match(/(gzdoom|uzdoom|zandronum|lzdoom|zdoom|helion)\.exe/i)
    if (portMatch) {
      commandLine = trimmed
      sourcePortFamily = portMatch[1].toLowerCase()
      break
    }
  }

  if (!commandLine) {
    commandLine = lines.find((l) => /-(iwad|file)/i.test(l)) || ''
  }

  const tokens: string[] = []
  const regex = /[^\s"']+|"([^"]*)"|'([^']*)'/g
  let match
  while ((match = regex.exec(commandLine)) !== null) {
    tokens.push(match[1] || match[2] || match[0])
  }

  const iwadIndex = tokens.findIndex((t) => t.toLowerCase() === '-iwad')
  const iwad = iwadIndex >= 0 && tokens[iwadIndex + 1] ? tokens[iwadIndex + 1] : undefined

  const modFiles: string[] = []
  const extraParams: string[] = []
  const fileIndex = tokens.findIndex((t) => t.toLowerCase() === '-file')
  if (fileIndex >= 0) {
    for (let i = fileIndex + 1; i < tokens.length; i++) {
      const token = tokens[i]
      if (token.startsWith('-')) {
        extraParams.push(...tokens.slice(i))
        break
      }
      modFiles.push(token)
    }
  }

  return { sourcePortFamily, iwad, modFiles, extraParams }
}

async function scanDirRecursive(dir: string, baseDir: string = dir): Promise<string[]> {
  const files = await fs.readdir(dir)
  const results: string[] = []
  for (const file of files) {
    const fullPath = path.join(dir, file)
    const stat = await fs.stat(fullPath)
    if (stat.isDirectory()) {
      results.push(...(await scanDirRecursive(fullPath, baseDir)))
    } else {
      results.push(fullPath)
    }
  }
  return results
}

function getFileType(fileName: string): string {
  const ext = path.extname(fileName).toUpperCase()
  if (ext === '.ZIP') return 'ZIP'
  if (ext === '.PK3' || ext === '.PK7' || ext === '.IPK3') return 'PK3'
  if (ext === '.DEH' || ext === '.BEX') return 'DEH'
  return 'WAD'
}

function isSupportedFileType(fileName: string): boolean {
  const ext = path.extname(fileName).toUpperCase()
  return ['.WAD', '.PK3', '.PK7', '.IPK3', '.DEH', '.BEX', '.ZIP'].includes(ext)
}

export interface IUnzipScanResult {
  tempDir: string
  supported: {
    tempPath: string
    fileName: string
    relativePath: string
    fileType: string
    hashValue: string
    name: string
    isReferencedByBat: boolean
  }[]
  skipped: {
    fileName: string
    relativePath: string
    reason: string
  }[]
  batFiles?: {
    fileName: string
    relativePath: string
    sourcePortFamily?: string
    iwad?: string
    modFiles: string[]
    extraParams: string[]
  }
}

/** Shared: scan an already-extracted temp directory for supported mod files. */
async function scanExtractedArchive(tempExtractDir: string): Promise<IUnzipScanResult> {
  const allFilePaths = await scanDirRecursive(tempExtractDir)

  // Look for any .bat or .cmd files
  const batFilePaths = allFilePaths.filter((fp) => {
    const ext = path.extname(fp).toLowerCase()
    return ext === '.bat' || ext === '.cmd'
  })

  let batFileResult: IUnzipScanResult['batFiles'] | undefined
  let batReferencedFiles: string[] = []

  if (batFilePaths.length > 0) {
    const batPath = batFilePaths[0]
    const batContent = await fs.readFile(batPath, 'utf-8')
    const parsed = parseBatContent(batContent)

    batFileResult = {
      fileName: path.basename(batPath),
      relativePath: path.relative(tempExtractDir, batPath),
      sourcePortFamily: parsed.sourcePortFamily,
      iwad: parsed.iwad,
      modFiles: parsed.modFiles,
      extraParams: parsed.extraParams
    }

    const batDir = path.dirname(batPath)
    batReferencedFiles = parsed.modFiles.map((file) => {
      const normalizedFile = file.replace(/\\/g, '/')
      return path.resolve(batDir, normalizedFile)
    })
  }

  const supportedFiles: IUnzipScanResult['supported'] = []
  const skippedFiles: IUnzipScanResult['skipped'] = []

  for (const filePath of allFilePaths) {
    const fileName = path.basename(filePath)
    const relativePath = path.relative(tempExtractDir, filePath)

    const ext = path.extname(filePath).toLowerCase()
    if (ext === '.bat' || ext === '.cmd') {
      continue
    }

    if (isSupportedFileType(fileName)) {
      const hashValue = await computeFileHash(filePath)
      const fileType = getFileType(fileName)
      const prettyName = fileName.replace(/\.[^.]+$/, '')

      const isReferencedByBat = batReferencedFiles.some((refPath) => {
        return path.resolve(filePath) === path.resolve(refPath)
      })

      supportedFiles.push({
        tempPath: filePath,
        fileName,
        relativePath,
        fileType,
        hashValue,
        name: prettyName,
        isReferencedByBat
      })
    } else {
      skippedFiles.push({
        fileName,
        relativePath,
        reason: `Unsupported file extension (${ext || 'no extension'})`
      })
    }
  }

  return {
    tempDir: tempExtractDir,
    supported: supportedFiles,
    skipped: skippedFiles,
    batFiles: batFileResult
  }
}

/** Create a unique temp directory for archive extraction. */
async function createExtractDir(): Promise<string> {
  const uniqueId = `extract-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
  const tempExtractDir = path.join(os.tmpdir(), 'uac', 'temp_extract', uniqueId)
  await fs.ensureDir(tempExtractDir)
  return tempExtractDir
}

/** Scan and extract a .zip archive, returning metadata about its contents. */
export async function unzipAndScan(zipFilePath: string): Promise<IUnzipScanResult> {
  const resolvedZipPath = resolvePath(zipFilePath)
  if (!fs.existsSync(resolvedZipPath)) {
    throw new Error(`Zip file not found: ${resolvedZipPath}`)
  }

  const tempExtractDir = await createExtractDir()

  try {
    // extract-zip streams entries via yauzl instead of reading the whole
    // archive into a single Buffer, so it isn't bound by Node's ~2GiB
    // readFileSync limit (unlike adm-zip, which failed on archives >2GiB).
    await extractZip(resolvedZipPath, { dir: tempExtractDir })
    return await scanExtractedArchive(tempExtractDir)
  } catch (error) {
    await fs.remove(tempExtractDir).catch(() => {})
    throw error
  }
}

/** Scan and extract a .rar archive, returning metadata about its contents. */
export async function unrarAndScan(rarFilePath: string): Promise<IUnzipScanResult> {
  const resolvedRarPath = resolvePath(rarFilePath)
  if (!fs.existsSync(resolvedRarPath)) {
    throw new Error(`RAR file not found: ${resolvedRarPath}`)
  }

  const tempExtractDir = await createExtractDir()

  try {
    const extractor = await createExtractorFromFile({
      filepath: resolvedRarPath,
      targetPath: tempExtractDir
    })
    // Must consume the returned generator — extraction is lazy
    const extracted = extractor.extract({})
    void [...extracted.files] // ponytail: must consume lazy generator
    return await scanExtractedArchive(tempExtractDir)
  } catch (error) {
    await fs.remove(tempExtractDir).catch(() => {})
    throw new Error(`Failed to extract RAR archive: ${(error as Error).message || error}`)
  }
}

export interface IZipImportFile {
  tempPath: string
  name: string
  version?: string
  url?: string
  sidecarOnly: boolean
  category?: string
  loadOrder: Record<string, number>
}

export async function importUnzippedFiles(
  tempDir: string,
  filesToImport: IZipImportFile[]
): Promise<IModFile[]> {
  try {
    const importedModFiles: IModFile[] = []
    const settings = await getSettings()
    const modsDir = resolvePath(settings.modsDirectory || path.join(CONFIG_DIR, 'mods'))
    const catalog = await getModFileCatalog()

    const movedFilesMap = new Map<
      string,
      { relativePath: string; fileName: string; hashValue: string }
    >()

    for (const file of filesToImport) {
      const resolvedTempPath = resolvePath(file.tempPath)
      if (!fs.existsSync(resolvedTempPath)) {
        throw new Error(`Temporary file not found for import: ${resolvedTempPath}`)
      }

      const originalFileName = path.basename(resolvedTempPath)
      const hashValue = await computeFileHash(resolvedTempPath)
      if (!hashValue) {
        throw new Error(`Failed to compute hash for file: ${originalFileName}`)
      }

      const ext = path.extname(originalFileName)
      const baseName = path.basename(originalFileName, ext)
      const newFileName = `${baseName}-${hashValue}${ext}`
      const relativePath = path.join('files', newFileName)
      const fullPath = path.join(modsDir, relativePath)

      await fs.ensureDir(path.join(modsDir, 'files'))
      await fs.copy(resolvedTempPath, fullPath, { overwrite: true })

      movedFilesMap.set(file.tempPath, {
        relativePath,
        fileName: newFileName,
        hashValue
      })
    }

    let nextId = Date.now()
    for (const file of filesToImport) {
      const moved = movedFilesMap.get(file.tempPath)!
      const existingIndex = catalog.findIndex((entry) => entry.hashValue === moved.hashValue)

      const resolvedLoadOrder: Record<string, number> = {}
      if (file.loadOrder) {
        for (const [key, offset] of Object.entries(file.loadOrder)) {
          if (movedFilesMap.has(key)) {
            const refHash = movedFilesMap.get(key)!.hashValue
            resolvedLoadOrder[refHash] = offset
          } else {
            resolvedLoadOrder[key] = offset
          }
        }
      }

      if (moved.hashValue && !resolvedLoadOrder[moved.hashValue]) {
        resolvedLoadOrder[moved.hashValue] = 1
      }

      const fileType = getFileType(moved.fileName)

      const catalogEntry: IModFile = {
        id: existingIndex >= 0 ? catalog[existingIndex].id : nextId++,
        name: file.name || moved.fileName.replace(/\.[^.]+$/, ''),
        fileName: moved.fileName,
        filePath: moved.relativePath,
        fileType,
        hashValue: moved.hashValue,
        version: file.version || '',
        url: file.url || '',
        sidecarOnly: file.sidecarOnly || false,
        category: file.category || undefined,
        loadOrder: resolvedLoadOrder,
        requiredBy: existingIndex >= 0 ? catalog[existingIndex].requiredBy || [] : []
      }

      if (existingIndex >= 0) {
        catalog[existingIndex] = catalogEntry
      } else {
        catalog.push(catalogEntry)
      }

      importedModFiles.push(catalogEntry)
    }

    await fs.writeJSON(MOD_FILE_CATALOG, catalog, { spaces: 2 })

    await fs.remove(tempDir)

    return importedModFiles
  } catch (error) {
    try {
      await fs.remove(tempDir)
    } catch {
      // ignore cleanup errors
    }
    throw error
  }
}
