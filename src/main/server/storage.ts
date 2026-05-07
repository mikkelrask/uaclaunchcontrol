import fs from 'fs-extra'
import path from 'path'
import os from 'os'
import axios from 'axios'
import chokidar from 'chokidar'
import crypto from 'crypto'
import { BrowserWindow } from 'electron'
import {
  IAppSettings,
  IDatabaseLink,
  IDoomVersion,
  IMod,
  IModFile,
  InsertMod
} from '../../shared/schema'
import { debug } from '../../shared/debug'

// Define storage paths (Aligned with local-structure.txt)
const CONFIG_DIR = path.join(os.homedir(), '.config', 'uac')
const DATA_DIR = path.join(CONFIG_DIR, 'data') // For extra data
export const MODS_DIR = path.join(CONFIG_DIR, 'mods') // For mod {id}.json files
const SETTINGS_FILE = path.join(CONFIG_DIR, 'settings.json') // Directly in CONFIG_DIR per local-structure.txt
const DOOM_VERSIONS_FILE = path.join(CONFIG_DIR, 'doomVersions.json') // Directly in CONFIG_DIR per local-structure.txt
const MOD_FILE_CATALOG = path.join(CONFIG_DIR, 'modFileCatalogue.json')
export const IMAGES_DIR = path.join(CONFIG_DIR, 'data/images')

const LEGACY_CONFIG_DIRS = [
  path.join(os.homedir(), '.config', 'mrdoom'),
  path.join(os.homedir(), '.config', 'uaclaunchcontrol')
]

const DEFAULT_DATABASE_LINKS: IDatabaseLink[] = [
  { name: 'MODDB', url: 'https://www.moddb.com/games/doom-ii' },
  { name: 'ZDOOM', url: 'https://forum.zdoom.org/' },
  { name: 'DOOMWORLD', url: 'https://www.doomworld.com/' },
  { name: 'ITCH', url: 'https://itch.io/game-mods/tag-doom' }
]

const DEFAULT_SETTINGS: IAppSettings = {
  sourcePortPath: 'uzdoom',
  theme: 'dark',
  savegamesPath: '~/.config/uac/saves',
  modsDirectory: '~/.config/uac/mods',
  screenshotsPath: '~/Pictures/UAC Launch Control/screenshots',
  databaseLinkPresets: DEFAULT_DATABASE_LINKS,
  selectedPresetIndex: 0,
  wadFilesDirectory: '~/.config/uac/wads',
  autoUpdateEnabled: true,
  registryLookupEnabled: false
}

// Default Doom Versions
const DEFAULT_DOOM_VERSIONS: IDoomVersion[] = [
  {
    id: '1',
    name: 'Doom',
    slug: 'doom',
    args: '-iwad doom.wad',
    icon: 'doom.png',
    executable: 'gzdoom',
    parameters: '',
    defaultIwad: 'doom.wad'
  },
  {
    id: '2',
    name: 'Doom II',
    slug: 'doom2',
    args: '-iwad doom2.wad',
    icon: 'doom2.png',
    executable: 'gzdoom',
    parameters: '',
    defaultIwad: 'doom2.wad'
  },
  {
    id: '3',
    name: 'Final Doom: TNT',
    slug: 'tnt',
    args: '-iwad tnt.wad',
    icon: 'tnt.png',
    executable: 'gzdoom',
    parameters: '',
    defaultIwad: 'tnt.wad'
  },
  {
    id: '4',
    name: 'Final Doom: Plutonia',
    slug: 'plutonia',
    args: '-iwad plutonia.wad',
    icon: 'plutonia.png',
    executable: 'gzdoom',
    parameters: '',
    defaultIwad: 'plutonia.wad'
  },
  {
    id: '5',
    name: 'FreeDoom Phase 1',
    slug: 'freedoom1',
    args: '-iwad freedoom1.wad',
    icon: 'freedoom1.png',
    executable: 'gzdoom',
    parameters: '',
    defaultIwad: 'freedoom1.wad'
  },
  {
    id: '6',
    name: 'FreeDoom Phase 2',
    slug: 'freedoom2',
    args: '-iwad freedoom2.wad',
    icon: 'freedoom2.png',
    executable: 'gzdoom',
    parameters: '',
    defaultIwad: 'freedoom2.wad'
  },
  {
    id: '7',
    name: 'Heretic: Shadow of the Serpent',
    slug: 'heretic',
    args: '-iwad heretic.wad',
    icon: 'heretic.png',
    executable: 'gzdoom',
    parameters: '',
    defaultIwad: 'heretic.wad'
  },
  {
    id: '8',
    name: 'Hexen: Beyond Heretic',
    slug: 'hexen',
    args: '-iwad hexen.wad',
    icon: 'hexen.png',
    executable: 'gzdoom',
    parameters: '',
    defaultIwad: 'hexen.wad'
  },
  {
    id: '9',
    name: 'Hexen: Deathkings of the Dark Citadel',
    slug: 'hexen-deathkings',
    args: '-iwad hexdd.wad',
    icon: 'hexdd.png',
    executable: 'gzdoom',
    parameters: '-iwad hexdd.wad',
    defaultIwad: 'hexdd.wad'
  }
]

let isInitialized = false
// Ensure config directories exist and create default files
export function initStorage(): boolean {
  if (isInitialized) return true
  isInitialized = true
  try {
    fs.ensureDirSync(CONFIG_DIR)
    fs.ensureDirSync(DATA_DIR) // Ensure data directory exists
    fs.ensureDirSync(MODS_DIR) // Ensure mods directory exists

    // Check for legacy config BEFORE creating new files
    const legacyConfig = checkLegacyConfigSync()
    if (legacyConfig.found) {
      console.log(`Legacy config found at ${legacyConfig.path}, waiting for migration...`)
      console.log('Storage initialized successfully (waiting for migration)')
      return true
    }

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

    // Sync Doom versions on startup
    syncDoomVersions().then(() => {
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

// Synchronous version for use during init
function checkLegacyConfigSync(): { found: boolean; path: string | null } {
  const newConfigHasContent = fs.existsSync(path.join(CONFIG_DIR, 'settings.json'))
  if (newConfigHasContent) {
    return { found: false, path: null }
  }

  for (const legacyPath of LEGACY_CONFIG_DIRS) {
    if (fs.existsSync(legacyPath)) {
      const hasContent =
        fs.existsSync(path.join(legacyPath, 'settings.json')) ||
        fs.existsSync(path.join(legacyPath, 'mods'))
      if (hasContent) {
        return { found: true, path: legacyPath }
      }
    }
  }
  return { found: false, path: null }
}

// Get application settings
export async function getSettings(): Promise<IAppSettings> {
  try {
    initStorage() // Ensure directories/files exist
    debug('Reading settings from', SETTINGS_FILE)
    const settingsData = await fs.readJSON(SETTINGS_FILE)
    if (settingsData.gzDoomPath !== undefined) {
      settingsData.sourcePortPath = settingsData.gzDoomPath
      delete settingsData.gzDoomPath
      await fs.writeJSON(SETTINGS_FILE, settingsData, { spaces: 2 })
    }
    const settings: IAppSettings = { ...DEFAULT_SETTINGS, ...settingsData }
    debug('Retrieved settings from file:', settings)

    // Resolve tildes for all known path fields before sending to UI
    const resolvedSettings: IAppSettings = {
      ...settings,
      configPath: CONFIG_DIR,
      sourcePortPath: settings.sourcePortPath
        ? resolvePath(settings.sourcePortPath)
        : settings.sourcePortPath,
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
  if (wadWatcher) {
    wadWatcher.close()
    wadWatcher = null
  }
}

export function startWadWatcher(): void {
  debug('startWadWatcher called')
  if (wadWatcher) {
    debug('Watcher already exists, skipping')
    return
  }

  getSettings()
    .then((settings) => {
      const rawDir = settings.wadFilesDirectory || path.join(CONFIG_DIR, 'wads')
      const wadDir = resolvePath(rawDir)
      debug(`Watcher starting for directory: ${wadDir} (from raw: ${rawDir})`)

      try {
        fs.ensureDirSync(wadDir)
      } catch (e) {
        console.error(`[DEBUG] DEBUG: Failed to ensure directory ${wadDir}:`, e)
        return
      }

      wadWatcher = chokidar.watch(wadDir, {
        persistent: true,
        ignoreInitial: false,
        usePolling: true,
        interval: 100
      })

      wadWatcher.on('all', (event, filePath) => {
        if (filePath.toLowerCase().endsWith('.wad')) {
          debug(`WAD change detected (${event}): ${filePath}. Syncing...`)
          syncDoomVersions({ notifyDelta: true })
        }
      })

      wadWatcher.on('error', (error) => {
        console.error(`[DEBUG] Chokidar watcher error:`, error)
      })

      debug(`Started WAD watcher on ${wadDir}`)
    })
    .catch((err) => {
      console.error('[DEBUG] Error starting WAD watcher:', err)
    })
}

// Sync Doom versions by scanning the WAD directory
export async function syncDoomVersions(
  options: { notifyDelta?: boolean } = {}
): Promise<IDoomVersion[]> {
  try {
    initStorage()
    debug('syncDoomVersions starting...')
    const settings = await getSettings()
    const wadDir = resolvePath(settings.wadFilesDirectory || path.join(CONFIG_DIR, 'wads'))

    // Load existing versions to detect changes
    const oldVersions: IDoomVersion[] = await fs.readJSON(DOOM_VERSIONS_FILE).catch(() => [])
    const executable = settings.sourcePortPath || 'uzdoom'

    await fs.ensureDir(wadDir)
    const files = await fs.readdir(wadDir)
    const wadFiles = files.filter((f) => f.toLowerCase().endsWith('.wad'))

    // Create a map of lowercase wad names to full paths
    const wadFileMap = new Map<string, string>()
    for (const wadFile of wadFiles) {
      wadFileMap.set(wadFile.toLowerCase(), path.join(wadDir, wadFile))
    }

    const updatedVersions: IDoomVersion[] = []

    // 1. Check default versions
    for (const def of DEFAULT_DOOM_VERSIONS) {
      const lowerWadName = def.defaultIwad.toLowerCase()
      if (wadFileMap.has(lowerWadName)) {
        const fullPath = wadFileMap.get(lowerWadName)!
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
      const baseName = wadName.replace(/\.wad$/i, '')
      const id = generateStableId(baseName)

      // Check if this wad was already in the list
      const existing = oldVersions.find((v) => v.id === id || v.defaultIwad === wadPath)

      if (existing) {
        updatedVersions.push({
          ...existing,
          defaultIwad: wadPath
        })
      } else {
        updatedVersions.push({
          id,
          name: baseName,
          slug: baseName.toLowerCase(),
          args: `-iwad ${escapePathForCmd(wadPath)}`,
          icon: '',
          executable: executable,
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
    const hashValue = await computeFileHash(resolvedSource)
    if (!hashValue) {
      throw new Error('Failed to compute MD5 hash for file')
    }
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
export async function downloadImage(url: string, modId: string): Promise<string> {
  try {
    await fs.ensureDir(IMAGES_DIR)

    const response = await axios.get(url, { responseType: 'arraybuffer' })

    // Better extension detection from Content-Type or URL
    const contentType = response.headers['content-type']
    let extension = ''
    if (contentType === 'image/jpeg') extension = '.jpg'
    else if (contentType === 'image/png') extension = '.png'
    else if (contentType === 'image/webp') extension = '.webp'
    else if (contentType === 'image/gif') extension = '.gif'
    else {
      extension = path.extname(new URL(url).pathname) || '.jpg'
    }

    if (extension.length > 5) extension = '.jpg'

    const fileName = `${modId}-poster${extension}`
    const filePath = path.join(IMAGES_DIR, fileName)

    await fs.writeFile(filePath, response.data)

    debug(`Image downloaded via axios and saved to: ${filePath}`)
    return fileName // Return just the filename
  } catch (error: unknown) {
    console.error('Error downloading image:', error)
    throw new Error(
      `Failed to download image: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

export async function computeFileHash(filePath: string): Promise<string> {
  try {
    let resolvedPath = resolvePath(filePath)

    // If path is relative (not absolute and not starting with ~), resolve against mods directory
    if (!path.isAbsolute(filePath) && !filePath.startsWith('~')) {
      const settings = await getSettings()
      const modsDir = resolvePath(settings.modsDirectory || path.join(CONFIG_DIR, 'mods'))
      resolvedPath = path.join(modsDir, filePath)
    }

    const fileBuffer = await fs.promises.readFile(resolvedPath)
    const hash = crypto.createHash('md5').update(fileBuffer).digest('hex')
    debug(`Computed MD5 hash for ${resolvedPath}: ${hash}`)
    return hash
  } catch (error) {
    console.error(`Error computing hash for ${filePath}:`, error)
    return ''
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

      // Check if file is already in mods folder (relative path starting with 'files/')
      if (file.filePath.startsWith('files/')) {
        // File already moved, use as-is
        relativePath = file.filePath
        hashValue = await computeFileHash(relativePath)
        originalFileName = file.fileName || path.basename(relativePath)
      } else {
        // Move file to mod folder with hash-based filename
        const moved = await moveToModFolder(file.filePath)
        relativePath = moved.relativePath
        hashValue = moved.hashValue
        originalFileName = file.filePath.split(/[\\/]/).pop() || file.filePath
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
export async function saveMod(modData: IMod & { files: IModFile[] }): Promise<IMod> {
  // Ensure doomVersionId is always a string
  if (modData.doomVersionId !== undefined) {
    modData.doomVersionId = String(modData.doomVersionId)
  }
  try {
    initStorage() // Ensure mods directory exists
    const settings = await getSettings()
    const targetModsDir = settings.modsDirectory ? resolvePath(settings.modsDirectory) : MODS_DIR
    const modFilePath = path.join(targetModsDir, `${modData.id}.json`)

    // Compute hashValue for files missing it
    for (const file of modData.files) {
      if (!file.hashValue && file.filePath) {
        file.hashValue = await computeFileHash(file.filePath)
      }
    }

    // Data is already in the flat structure { ...IMod, files: [...] }
    await fs.writeJSON(modFilePath, modData, { spaces: 2 })
    // Return only the IMod part (without files) as per previous usage?
    // Or return the whole saved object? Let's return the IMod part for now.
    const mod = { ...modData }
    delete (mod as Record<string, unknown>).files
    return mod as IMod
  } catch (error: unknown) {
    console.error('Error saving mod:', error)
    throw new Error(`Failed to save mod: ${error instanceof Error ? error.message : String(error)}`)
  }
}

export async function getMods(): Promise<IMod[]> {
  try {
    initStorage() // Ensure mods directory exists
    const settings = await getSettings()
    const targetModsDir = settings.modsDirectory ? resolvePath(settings.modsDirectory) : MODS_DIR
    const mods: IMod[] = []
    if (!fs.existsSync(targetModsDir)) {
      return mods
    }
    const modFiles = await fs.readdir(targetModsDir)

    for (const modFilename of modFiles) {
      if (modFilename.endsWith('.json')) {
        const modFilePath = path.join(targetModsDir, modFilename)
        try {
          // Read the flat mod data { ...IMod, files: [...] }
          const modData = await fs.readJSON(modFilePath)
          // Extract the mod part (excluding files)
          const mod = { ...modData }
          delete (mod as Record<string, unknown>).files
          mods.push(mod as IMod)
        } catch (err: unknown) {
          console.error(`Error reading mod file ${modFilename}:`, err)
        }
      }
    }
    return mods
  } catch (error: unknown) {
    console.error('Error getting mods:', error)
    return []
  }
}

export async function getMod(modId: string): Promise<IMod & { files: IModFile[] }> {
  try {
    initStorage() // Ensure mods directory exists
    const settings = await getSettings()
    const targetModsDir = settings.modsDirectory ? resolvePath(settings.modsDirectory) : MODS_DIR
    const modFilePath = path.join(targetModsDir, `${modId}.json`)
    if (!fs.existsSync(modFilePath)) {
      throw new Error(`Mod ${modId} not found`)
    }
    // Read the flat data { ...IMod, files: [...] }
    const modData = await fs.readJSON(modFilePath)
    // Always ensure files is present and is an array
    if (!Array.isArray(modData.files)) {
      modData.files = []
    }
    return modData as IMod & { files: IModFile[] }
  } catch (error: unknown) {
    console.error(`Error getting mod ${modId}:`, error)
    throw new Error(`Failed to get mod: ${error instanceof Error ? error.message : String(error)}`)
  }
}

// Helper functions (ensureDir, readFile, writeFile, deleteFile) remain the same
// Ensure directory exists
/*
async function ensureDir(dirPath: string): Promise<void> {
  try {
    await fs.ensureDir(dirPath);
  } catch (error: unknown) {
    console.error(`Error ensuring directory ${dirPath}:`, error);
  }
}
*/

// Read file content
/*
async function _readFile<T>(filePath: string, defaultValue: T): Promise<T> {
  try {
    if (await fs.pathExists(filePath)) {
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    }
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error);
  }
  return defaultValue;
}
*/

// Write file content
/*
async function _writeFile<T>(filePath: string, data: T): Promise<boolean> {
  try {
    await ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error(`Error writing ${filePath}:`, error);
    return false;
  }
}
*/

// Delete a file
/*
async function _deleteFile(filePath: string): Promise<boolean> {
  try {
    if (await fs.pathExists(filePath)) {
      await fs.remove(filePath); // fs.remove handles files and directories
      return true;
    }
    return false;
  } catch (error) {
    console.error(`Error deleting ${filePath}:`, error);
    return false;
  }
}
*/

// Get path for a mod's JSON config file (used internally?)
/*
function _getModFilePath(modId: string): string {
  return path.join(MODS_DIR, `${modId}.json`);
}
*/

// --- API-required stubs ---

export async function getDoomVersion(id: string): Promise<IDoomVersion | undefined> {
  try {
    const versions = await getDoomVersions()
    return versions.find((v) => v.id === id)
  } catch (error: unknown) {
    console.error(`Error getting Doom version by id ${id}:`, error)
    return undefined
  }
}

export async function createDoomVersion(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _data: Partial<IDoomVersion>
): Promise<IDoomVersion | null> {
  // TODO: Implement createDoomVersion
  return null
}

export async function deleteDoomVersion(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _id: string | number
): Promise<boolean> {
  // TODO: Implement deleteDoomVersion
  return false
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

export async function updateSettings(settings: IAppSettings): Promise<IAppSettings> {
  // TODO: Implement updateSettings
  return settings
}

export async function getAvailableModFiles(): Promise<IModFile[] | undefined> {
  // TODO: Implement getAvailableModFiles
  return []
}

export async function getModFilesByType(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _fileType: string
): Promise<IModFile[]> {
  // TODO: Implement getModFilesByType
  return []
}

export async function createModFile(file: Omit<IModFile, 'id' | 'modId'>): Promise<IModFile> {
  // TODO: Implement createModFile
  return file as unknown as IModFile
}

export async function getModsByDoomVersion(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _versionId: string | number
): Promise<IMod[]> {
  // TODO: Implement getModsByDoomVersion
  return []
}

export async function getModFiles(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _modId: string | number
): Promise<IModFile[]> {
  // TODO: Implement getModFiles
  return []
}

export async function createMod(mod: InsertMod): Promise<IMod> {
  // TODO: Implement createMod
  return { ...mod, id: '', files: [] } as IMod
}

export async function updateMod(
  _id: string | number,
  _mod: Partial<IMod>
): Promise<IMod | undefined> {
  // TODO: Implement updateMod
  return _mod as unknown as IMod
}

export async function deleteMod(id: string | number): Promise<boolean | undefined> {
  try {
    const settings = await getSettings()
    const targetModsDir = settings.modsDirectory ? resolvePath(settings.modsDirectory) : MODS_DIR
    const modFilePath = path.join(targetModsDir, `${id}.json`)
    debug('Attempting to delete mod file:', modFilePath)
    if (await fs.pathExists(modFilePath)) {
      await fs.remove(modFilePath)
      debug('Deleted mod file:', modFilePath)
      return true
    } else {
      console.warn('[DEBUG] Mod file does not exist:', modFilePath)
      return false
    }
  } catch (error: unknown) {
    console.error('Error deleting mod:', error)
    return false
  }
}

export async function deleteModFileFromCatalog(fileId: number): Promise<boolean> {
  try {
    const catalog = await getModFileCatalog()
    const index = catalog.findIndex((f) => f.id === fileId)
    if (index === -1) {
      throw new Error(`File with ID ${fileId} not found in catalog`)
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

// Migration helpers
export async function checkLegacyConfig(): Promise<{ found: boolean; path: string | null }> {
  // If the new config directory already has a settings file, it's considered populated.
  // No need to check for legacy data – migration has already happened or the user started fresh.
  const newConfigHasContent = fs.existsSync(path.join(CONFIG_DIR, 'settings.json'))
  if (newConfigHasContent) {
    return { found: false, path: null }
  }

  for (const legacyPath of LEGACY_CONFIG_DIRS) {
    if (fs.existsSync(legacyPath)) {
      // Check if it has content (e.g., settings.json or mods folder)
      const hasContent =
        fs.existsSync(path.join(legacyPath, 'settings.json')) ||
        fs.existsSync(path.join(legacyPath, 'mods'))
      if (hasContent) {
        return { found: true, path: legacyPath }
      }
    }
  }
  return { found: false, path: null }
}

export async function executeMigration(sourcePath: string): Promise<boolean> {
  try {
    const resolvedSource = resolvePath(sourcePath)
    if (!fs.existsSync(resolvedSource)) {
      throw new Error(`Migration source not found: ${resolvedSource}`)
    }

    debug(`Migrating from ${resolvedSource} to ${CONFIG_DIR}`)

    // Ensure new config dir exists
    await fs.ensureDir(CONFIG_DIR)

    // Copy everything from source to current CONFIG_DIR
    await fs.copy(resolvedSource, CONFIG_DIR, {
      overwrite: true,
      errorOnExist: false
    })

    debug(`Successfully migrated content to ${CONFIG_DIR}`)

    // Patch internal JSON paths to point to the new uac directory
    await patchLegacyPaths(CONFIG_DIR)

    return true
  } catch (error) {
    console.error('[MIGRATION] Migration failed:', error)
    return false
  }
}

/**
 * Recursively scans a directory for .json files and replaces legacy path strings
 * with the new .config/uac standard.
 */
async function patchLegacyPaths(directory: string): Promise<void> {
  try {
    const files = await fs.readdir(directory)
    for (const file of files) {
      const fullPath = path.join(directory, file)
      const stats = await fs.stat(fullPath)

      if (stats.isDirectory()) {
        await patchLegacyPaths(fullPath)
      } else if (file.endsWith('.json')) {
        const content = await fs.readFile(fullPath, 'utf-8')
        let patched = content

        // Replace all known legacy paths with the new standard
        patched = patched.replace(/\.config\/mrdoom/g, '.config/uac')
        patched = patched.replace(/\.config\/uaclaunchcontrol/g, '.config/uac')

        if (patched !== content) {
          await fs.writeFile(fullPath, patched)
          debug(`Patched legacy paths in ${fullPath}`)
        }
      }
    }
  } catch (error) {
    console.error(`[MIGRATION] Error patching paths in ${directory}:`, error)
  }
}
