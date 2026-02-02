import * as fs from 'fs-extra'
import path from 'path'
import os from 'os'
import { IAppSettings, IDoomVersion, IMod, IModFile } from '../../shared/schema'

// Define storage paths (Aligned with local-structure.txt)
const CONFIG_DIR = path.join(os.homedir(), '.config', 'mrdoom')
const DATA_DIR = path.join(CONFIG_DIR, 'data') // For extra data
export const MODS_DIR = path.join(CONFIG_DIR, 'mods') // For mod {id}.json files
const SETTINGS_FILE = path.join(CONFIG_DIR, 'settings.json') // Directly in CONFIG_DIR per local-structure.txt
const DOOM_VERSIONS_FILE = path.join(CONFIG_DIR, 'doomVersions.json') // Directly in CONFIG_DIR per local-structure.txt
const MOD_FILE_CATALOG = path.join(CONFIG_DIR, 'modFileCatalogue.json') // Correctly spelled with 'ue' in CONFIG_DIR

// Default settings
const DEFAULT_SETTINGS: IAppSettings = {
  gzDoomPath: 'gzdoom', // Default to assuming gzdoom is in PATH
  theme: 'dark',
  savegamesPath: '~/.config/gzdoom/saves', // Add empty string defaults for optional properties
  modsDirectory: '~/.config/mrdoom/mods',
  screenshotsPath: '~/Pictures/MRDoom/screenshots',
  defaultSourcePort: 'GZDoom'
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
  }
]

// Ensure config directories exist and create default files
export function initStorage() {
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

    console.log('Storage initialized successfully')
    return true
  } catch (error: any) {
    console.error('Failed to initialize storage:', error)
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
    console.log('[DEBUG] Retrieved settings:', settings)
    return settings
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
    return updatedSettings
  } catch (error: any) {
    console.error('[DEBUG] Error saving settings:', error)
    throw new Error(`Failed to save settings: ${error.message}`)
  }
}

// === Doom Versions ===
// Get all Doom versions (expects direct array in JSON)
export async function getDoomVersions(): Promise<IDoomVersion[]> {
  try {
    initStorage() // Ensure file exists
    const versions = await fs.readJSON(DOOM_VERSIONS_FILE)
    // No need to extract from .versions property anymore
    return versions as IDoomVersion[]
  } catch (error: any) {
    console.error('Error getting Doom versions:', error)
    return [] // Return empty array on error
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

    console.log('Moved file ..')
    return newPath
  } catch (error: any) {
    console.error('Error moving file:', error)
    throw new Error(`Failed to move file: ${error.message}`)
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

// === Mods ===
export async function saveMod(modData: IMod & { files: IModFile[] }): Promise<IMod> {
  // Ensure doomVersionId is always a string
  if (modData.doomVersionId !== undefined) {
    modData.doomVersionId = String(modData.doomVersionId)
  }
  try {
    initStorage() // Ensure mods directory exists
    const modFilePath = path.join(MODS_DIR, `${modData.id}.json`)
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

// Get all mods (reads flat {id}.json files)
export async function getMods(): Promise<IMod[]> {
  try {
    initStorage() // Ensure mods directory exists
    const mods: IMod[] = []
    if (!fs.existsSync(MODS_DIR)) {
      return mods
    }
    const modFiles = await fs.readdir(MODS_DIR)

    for (const modFilename of modFiles) {
      if (modFilename.endsWith('.json')) {
        const modFilePath = path.join(MODS_DIR, modFilename)
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

// Get a specific mod and its files (reads flat {id}.json)
export async function getMod(modId: string): Promise<IMod & { files: IModFile[] }> {
  try {
    initStorage() // Ensure mods directory exists
    const modFilePath = path.join(MODS_DIR, `${modId}.json`)
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
    const modFilePath = path.join(MODS_DIR, `${id}.json`)
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
