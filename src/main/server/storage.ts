import fs from 'fs-extra'
import path from 'path'
import os from 'os'
import axios from 'axios'
import chokidar from 'chokidar'
import { BrowserWindow } from 'electron'
import { IAppSettings, IDoomVersion, IMod, IModFile } from '../../shared/schema'

// Define storage paths (Aligned with local-structure.txt)
const CONFIG_DIR = path.join(os.homedir(), '.config', 'uac')
const DATA_DIR = path.join(CONFIG_DIR, 'data') // For extra data
export const MODS_DIR = path.join(CONFIG_DIR, 'mods') // For mod {id}.json files
const SETTINGS_FILE = path.join(CONFIG_DIR, 'settings.json') // Directly in CONFIG_DIR per local-structure.txt
const DOOM_VERSIONS_FILE = path.join(CONFIG_DIR, 'doomVersions.json') // Directly in CONFIG_DIR per local-structure.txt
const MOD_FILE_CATALOG = path.join(CONFIG_DIR, 'modFileCatalogue.json')
export const IMAGES_DIR = path.join(CONFIG_DIR, 'images')

const LEGACY_CONFIG_DIRS = [
  path.join(os.homedir(), '.config', 'mrdoom'),
  path.join(os.homedir(), '.config', 'uaclaunchcontrol')
]

// Default settings
const DEFAULT_SETTINGS: IAppSettings = {
  gzDoomPath: 'gzdoom', // Default to assuming gzdoom is in PATH
  theme: 'dark',
  savegamesPath: '~/.config/uac/saves', // Add empty string defaults for optional properties
  modsDirectory: '~/.config/uac/mods',
  screenshotsPath: '~/Pictures/UAC Launch Control/screenshots',
  defaultSourcePort: 'uzdoom',
  wadFilesDirectory: '~/.config/uac/wads'
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
export function initStorage() {
  if (isInitialized) return true
  isInitialized = true
  try {
    fs.ensureDirSync(CONFIG_DIR)
    fs.ensureDirSync(DATA_DIR) // Ensure data directory exists
    fs.ensureDirSync(MODS_DIR) // Ensure mods directory exists

    // Create settings file with defaults if it doesn't exist
    if (!fs.existsSync(SETTINGS_FILE)) {
      fs.writeJSONSync(SETTINGS_FILE, DEFAULT_SETTINGS, { spaces: 2 })
      console.log(`Created default settings file at ${SETTINGS_FILE}`)
    }

    // Create doomVersions file with defaults if it doesn't exist
    if (!fs.existsSync(DOOM_VERSIONS_FILE)) {
      fs.writeJSONSync(DOOM_VERSIONS_FILE, DEFAULT_DOOM_VERSIONS, { spaces: 2 })
      console.log(`Created default doom versions file at ${DOOM_VERSIONS_FILE}`)
    }

    // Create modFileCatalog file with empty array if it doesn't exist
    if (!fs.existsSync(MOD_FILE_CATALOG)) {
      fs.writeJSONSync(MOD_FILE_CATALOG, [], { spaces: 2 }) // Default to empty array
      console.log(`Created default mod file catalog at ${MOD_FILE_CATALOG}`)
    }

    // Sync Doom versions on startup
    syncDoomVersions().then(() => {
      startWadWatcher()
    })

    console.log('Storage initialized successfully')
    return true
  } catch (error: any) {
    console.error('Failed to initialize storage:', error)
    isInitialized = false // Reset on failure so it can try again
    return false
  }
}

// Get application settings
export async function getSettings(): Promise<IAppSettings> {
  try {
    initStorage() // Ensure directories/files exist
    console.log('[DEBUG] Reading settings from', SETTINGS_FILE)
    const settingsData = await fs.readJSON(SETTINGS_FILE)
    const settings: IAppSettings = { ...DEFAULT_SETTINGS, ...settingsData }
    console.log('[DEBUG] Retrieved settings from file:', settings)

    // Resolve tildes for all known path fields before sending to UI
    const resolvedSettings: IAppSettings = {
      ...settings,
      configPath: CONFIG_DIR,
      gzDoomPath: settings.gzDoomPath ? resolvePath(settings.gzDoomPath) : settings.gzDoomPath,
      savegamesPath: settings.savegamesPath ? resolvePath(settings.savegamesPath) : settings.savegamesPath,
      modsDirectory: settings.modsDirectory ? resolvePath(settings.modsDirectory) : settings.modsDirectory,
      screenshotsPath: settings.screenshotsPath ? resolvePath(settings.screenshotsPath) : settings.screenshotsPath,
      wadFilesDirectory: settings.wadFilesDirectory
        ? resolvePath(settings.wadFilesDirectory)
        : settings.wadFilesDirectory
    }

    console.log('[DEBUG] Returning resolved settings to UI:', resolvedSettings)
    return resolvedSettings
  } catch (error: any) {
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
    console.log('[DEBUG] Saving settings to', SETTINGS_FILE, 'with data:', updatedSettings)
    await fs.writeJSON(SETTINGS_FILE, updatedSettings, { spaces: 2 })
    console.log('[DEBUG] Saved settings:', updatedSettings)

    // If wadFilesDirectory changed, restart watcher
    if (settings.wadFilesDirectory && settings.wadFilesDirectory !== currentSettings.wadFilesDirectory) {
      console.log('[DEBUG] wadFilesDirectory changed, restarting watcher...')
      stopWadWatcher()
      await syncDoomVersions()
      startWadWatcher()
    }

    return updatedSettings
  } catch (error: any) {
    console.error('[DEBUG] Error saving settings:', error)
    throw new Error(`Failed to save settings: ${error.message}`)
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
    console.log('[DEBUG] getDoomVersions: Returning resolved versions:', resolved.length)
    return resolved
  } catch (error: any) {
    console.error('Error getting Doom versions:', error)
    return [] // Return empty array on error
  }
}

let wadWatcher: any = null

export function stopWadWatcher() {
  if (wadWatcher) {
    wadWatcher.close()
    wadWatcher = null
  }
}

export function startWadWatcher() {
  console.log('[DEBUG] DEBUG: startWadWatcher called')
  if (wadWatcher) {
    console.log('[DEBUG] DEBUG: Watcher already exists, skipping')
    return
  }

  getSettings().then((settings) => {
    const rawDir = settings.wadFilesDirectory || path.join(CONFIG_DIR, 'wads')
    const wadDir = resolvePath(rawDir)
    console.log(`[DEBUG] DEBUG: Watcher starting for directory: ${wadDir} (from raw: ${rawDir})`)

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
        console.log(`[DEBUG] WAD change detected (${event}): ${filePath}. Syncing...`)
        syncDoomVersions({ notifyDelta: true })
      }
    })

    wadWatcher.on('error', (error) => {
      console.error(`[DEBUG] Chokidar watcher error:`, error)
    })

    console.log(`[DEBUG] Started WAD watcher on ${wadDir}`)
  }).catch(err => {
    console.error('[DEBUG] Error starting WAD watcher:', err)
  })
}

// Sync Doom versions by scanning the WAD directory
export async function syncDoomVersions(options: { notifyDelta?: boolean } = {}): Promise<IDoomVersion[]> {
  try {
    initStorage()
    console.log('[DEBUG] syncDoomVersions starting...')
    const settings = await getSettings()
    const wadDir = resolvePath(settings.wadFilesDirectory || path.join(CONFIG_DIR, 'wads'))

    // Load existing versions to detect changes
    const oldVersions: IDoomVersion[] = await fs.readJSON(DOOM_VERSIONS_FILE).catch(() => [])
    const executable = settings.gzDoomPath || 'gzdoom'

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
              ? existing.args.replace(/-iwad\s+\"[^\"]+\"|-iwad\s+[^\s]+/, `-iwad ${escapePathForCmd(fullPath)}`)
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
    console.log(`[DEBUG] syncDoomVersions: Synced ${updatedVersions.length} versions to ${DOOM_VERSIONS_FILE}`)

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
      const removed = oldVersions.map(v => ({
        ...v,
        icon: v.icon ? resolvePath(v.icon) : v.icon,
        defaultIwad: v.defaultIwad ? resolvePath(v.defaultIwad) : v.defaultIwad
      })).filter((v) => !newIds.has(v.id))
      delta = { added, removed }
    }

    // Notify all windows that versions have been updated
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send('doom-versions-updated', delta)
    })

    return resolvedVersions
  } catch (error: any) {
    console.error('Error syncing Doom versions:', error)
    return []
  }
}

// Get a specific Doom version by slug
export async function getDoomVersionBySlug(slug: string): Promise<IDoomVersion | undefined> {
  try {
    const versions = await getDoomVersions()
    return versions.find((v) => v.slug === slug)
  } catch (error: any) {
    console.error(`Error getting Doom version by slug ${slug}:`, error)
    return undefined
  }
}

// Save all Doom versions (overwrites the file with current state)
export async function saveDoomVersions(versions: IDoomVersion[]): Promise<void> {
  try {
    initStorage() // Ensure file exists
    await fs.writeJSON(DOOM_VERSIONS_FILE, versions, { spaces: 2 })
    console.log('[DEBUG] Saved doom versions to', DOOM_VERSIONS_FILE)

    // Notify all windows that versions have been updated
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send('doom-versions-updated')
    })
  } catch (error: any) {
    console.error('Error saving Doom versions:', error)
    throw new Error(`Failed to save Doom versions: ${error.message}`)
  }
}

// === Mod File Catalog ===
// Get the mod file catalog
export async function getModFileCatalog(): Promise<any[]> {
  try {
    const filePath = path.join(CONFIG_DIR, 'modFileCatalogue.json')
    console.log('[DEBUG] Reading modFileCatalogue.json from:', filePath)
    if (!fs.existsSync(filePath)) {
      return []
    }
    const raw = await fs.promises.readFile(filePath, 'utf-8')
    console.log('[DEBUG] Raw modFileCatalogue.json contents:', raw)
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
    return data
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

    console.log('[DEBUG] Moving file from', resolvedSource, 'to', resolvedDest)

    // Ensure destination directory exists
    await fs.ensureDir(path.dirname(resolvedDest))

    // Use copy then potentially delete (or just copy for now as per original code)
    await fs.copy(resolvedSource, resolvedDest)

    console.log('Moved file to', resolvedDest)
    return resolvedDest
  } catch (error: any) {
    console.error('Error moving file:', error)
    throw new Error(`Failed to move file: ${error.message}`)
  }
}

// Special helper to move a file into the mods/files folder and return the relative path
export async function moveToModFolder(
  sourcePath: string
): Promise<{ fullPath: string; relativePath: string }> {
  try {
    const settings = await getSettings()
    const modsDir = resolvePath(settings.modsDirectory || path.join(CONFIG_DIR, 'mods'))
    const fileName = path.basename(sourcePath)
    const relativePath = path.join('files', fileName)
    const fullPath = path.join(modsDir, relativePath)

    await fs.ensureDir(path.join(modsDir, 'files'))
    await fs.copy(resolvePath(sourcePath), fullPath, { overwrite: true })

    console.log(`[DEBUG] Moved file to mod folder: ${fullPath} (relative: ${relativePath})`)
    return { fullPath, relativePath }
  } catch (error: any) {
    console.error('Error moving file to mod folder:', error)
    throw new Error(`Failed to move file to mod folder: ${error.message}`)
  }
}

// Download an image from a URL and save it directly to the mods directory
export async function downloadImage(url: string, modId: string): Promise<string> {
  try {
    const settings = await getSettings()
    const modsDir = resolvePath(settings.modsDirectory || MODS_DIR)
    await fs.ensureDir(modsDir)

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
    const filePath = path.join(modsDir, fileName)

    await fs.writeFile(filePath, response.data)

    console.log(`[DEBUG] Image downloaded via axios and saved to: ${filePath}`)
    return fileName // Return just the filename
  } catch (error: any) {
    console.error('Error downloading image:', error)
    throw new Error(`Failed to download image: ${error.message}`)
  }
}

// Add a mod file to the catalog
export async function addModFileToCatalog(file: Omit<IModFile, 'id' | 'modId'>): Promise<IModFile> {
  try {
    console.log('addModFileToCatalog called with:', file)
    initStorage() // Ensure directories and files exist

    // Read existing catalog
    console.log(`Reading catalog from ${MOD_FILE_CATALOG}`)
    let catalog: IModFile[] = []
    if (fs.existsSync(MOD_FILE_CATALOG)) {
      catalog = await fs.readJSON(MOD_FILE_CATALOG)
      console.log(`Existing catalog has ${catalog.length} entries`)
    } else {
      console.log(`Catalog file doesn't exist, creating new one`)
    }

    if (file.filePath) {
      // Always set fileName from filePath
      const fileName = file.filePath.split(/[\\/]/).pop() || file.filePath
      // Always set name (pretty name), default to fileName if missing
      const name = file.name && file.name.trim() ? file.name : fileName
      // Create new catalog entry with an ID
      const createdFile: IModFile = {
        ...file,
        name,
        fileName,
        id: Date.now(), // Use timestamp as ID
        modId: '0' // 0 as string for catalog entry
      }
      console.log('Created new catalog entry:', createdFile)
      // Add to catalog
      catalog.push(createdFile)
      // Save updated catalog
      console.log(`Writing updated catalog with ${catalog.length} entries to ${MOD_FILE_CATALOG}`)
      await fs.writeJSON(MOD_FILE_CATALOG, catalog, { spaces: 2 })
      console.log(`Catalog file saved successfully`)
      return createdFile
    }
    throw new Error('Invalid file: filePath is required')
  } catch (error: any) {
    console.error('Error adding mod file to catalog:', error)
    throw new Error(`Failed to add mod file to catalog: ${error.message}`)
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
      console.error(`[DEBUG] Catalog update failed: Mod file with ID ${id} not found in catalog. Content of catalog IDs:`, catalog.map(f => f.id))
      throw new Error(`Mod file with ID ${id} not found in catalog`)
    }

    const updatedFile = { ...catalog[index], ...updates }
    catalog[index] = updatedFile

    await fs.writeJSON(MOD_FILE_CATALOG, catalog, { spaces: 2 })
    console.log(`[DEBUG] Successfully updated mod file ${id} in catalog (new name: ${updates.name})`)
    return updatedFile
  } catch (error: any) {
    console.error(`Error updating mod file ${id} in catalog:`, error)
    throw new Error(`Failed to update mod file: ${error.message}`)
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
    // Data is already in the flat structure { ...IMod, files: [...] }
    await fs.writeJSON(modFilePath, modData, { spaces: 2 })
    // Return only the IMod part (without files) as per previous usage?
    // Or return the whole saved object? Let's return the IMod part for now.
    const { files, ...mod } = modData
    return mod as IMod
  } catch (error: any) {
    console.error('Error saving mod:', error)
    throw new Error(`Failed to save mod: ${error.message}`)
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
          const { files, ...mod } = modData
          mods.push(mod as IMod)
        } catch (err: any) {
          console.error(`Error reading mod file ${modFilename}:`, err)
        }
      }
    }
    return mods
  } catch (error: any) {
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
  } catch (error: any) {
    console.error(`Error getting mod ${modId}:`, error)
    throw new Error(`Failed to get mod: ${error.message}`)
  }
}

// Helper functions (ensureDir, readFile, writeFile, deleteFile) remain the same
// Ensure directory exists
/*
async function ensureDir(dirPath: string): Promise<void> {
  try {
    await fs.ensureDir(dirPath);
  } catch (error: any) {
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
  } catch (error: any) {
    console.error(`Error getting Doom version by id ${id}:`, error)
    return undefined
  }
}

export async function createDoomVersion(_data: any) {
  // TODO: Implement createDoomVersion
  return null
}

export async function updateDoomVersion(_id: string | number, _data: any) {
  // TODO: Implement updateDoomVersion
  return null
}

export async function deleteDoomVersion(_id: string | number) {
  // TODO: Implement deleteDoomVersion
  return false
}

export async function updateSettings(settings: any) {
  // TODO: Implement updateSettings
  return settings
}

export async function getAvailableModFiles(): Promise<IModFile[] | undefined> {
  // TODO: Implement getAvailableModFiles
  return []
}

export async function getModFilesByType(_fileType: string): Promise<IModFile[] | undefined> {
  // TODO: Implement getModFilesByType
  return []
}

export async function createModFile(file: any): Promise<IModFile | undefined> {
  // TODO: Implement createModFile
  return file
}

export async function getModsByDoomVersion(
  _versionId: string | number
): Promise<IMod[] | undefined> {
  // TODO: Implement getModsByDoomVersion
  return []
}

export async function getModFiles(_modId: string | number): Promise<IModFile[] | undefined> {
  // TODO: Implement getModFiles
  return []
}

export async function createMod(mod: any): Promise<IMod | undefined> {
  // TODO: Implement createMod
  return mod
}

export async function updateMod(_id: string | number, _mod: any): Promise<IMod | undefined> {
  // TODO: Implement updateMod
  return _mod
}

export async function deleteMod(id: string | number): Promise<boolean | undefined> {
  try {
    const settings = await getSettings()
    const targetModsDir = settings.modsDirectory ? resolvePath(settings.modsDirectory) : MODS_DIR
    const modFilePath = path.join(targetModsDir, `${id}.json`)
    console.log('[DEBUG] Attempting to delete mod file:', modFilePath)
    if (await fs.pathExists(modFilePath)) {
      await fs.remove(modFilePath)
      console.log('[DEBUG] Deleted mod file:', modFilePath)
      return true
    } else {
      console.warn('[DEBUG] Mod file does not exist:', modFilePath)
      return false
    }
  } catch (error: any) {
    console.error('Error deleting mod:', error)
    return false
  }
}

export async function deleteModFile(_id: string | number): Promise<boolean | undefined> {
  // TODO: Implement deleteModFile
  return false
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
      const hasContent = fs.existsSync(path.join(legacyPath, 'settings.json')) || 
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

    console.log(`[MIGRATION] Migrating from ${resolvedSource} to ${CONFIG_DIR}`)
    
    // Ensure new config dir exists
    await fs.ensureDir(CONFIG_DIR)

    // Copy everything from source to current CONFIG_DIR
    await fs.copy(resolvedSource, CONFIG_DIR, {
      overwrite: true,
      errorOnExist: false
    })

    console.log(`[MIGRATION] Successfully migrated content to ${CONFIG_DIR}`)

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
          console.log(`[MIGRATION] Patched legacy paths in ${fullPath}`)
        }
      }
    }
  } catch (error) {
    console.error(`[MIGRATION] Error patching paths in ${directory}:`, error)
  }
}
