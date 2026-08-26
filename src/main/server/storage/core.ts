import fs from 'fs-extra'
import path from 'path'
import crypto from 'crypto'
import os from 'os'
import { IAppSettings, IDatabaseLink, IDoomVersion } from '@shared/schema'
import { createLogger } from '@shared/logger'
import { debug } from '@shared/debug'
import {
  CONFIG_DIR,
  DATA_DIR,
  MODS_DIR,
  SETTINGS_FILE,
  DOOM_VERSIONS_FILE,
  MOD_FILE_CATALOG,
  CFGS_DIR,
  LOGS_DIR,
  FIRST_RUN_SENTINEL
} from './paths'

const log = createLogger('storage/core')

const DEFAULT_DATABASE_LINKS: IDatabaseLink[] = [
  { name: 'MODDB', url: 'https://www.moddb.com/games/doom-ii' },
  { name: 'ZDOOM', url: 'https://forum.zdoom.org/' },
  { name: 'ITCH', url: 'https://itch.io/game-mods/tag-doom' }
]

const DEFAULT_SETTINGS: IAppSettings = {
  sourcePorts: [],
  defaultSourcePortId: undefined,
  defaultDoomVersionId: undefined,
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

export const DEFAULT_DOOM_VERSIONS: IDoomVersion[] = [
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

export function getIsFirstRun(): boolean {
  return _isFirstRun
}

export function dismissFirstRun(): void {
  _isFirstRun = false
  try {
    fs.writeFileSync(FIRST_RUN_SENTINEL, '')
  } catch {
    /* best-effort */
  }
}

export function reenableFirstRun(): void {
  _isFirstRun = true
  try {
    if (fs.existsSync(FIRST_RUN_SENTINEL)) fs.unlinkSync(FIRST_RUN_SENTINEL)
  } catch {
    /* best-effort */
  }
}

export function initStorage(): boolean {
  if (isInitialized) return true
  isInitialized = true
  try {
    fs.ensureDirSync(CONFIG_DIR)
    fs.ensureDirSync(DATA_DIR)
    fs.ensureDirSync(MODS_DIR)
    fs.ensureDirSync(CFGS_DIR)
    fs.ensureDirSync(LOGS_DIR)
    if (!fs.existsSync(SETTINGS_FILE))
      fs.writeJSONSync(SETTINGS_FILE, DEFAULT_SETTINGS, { spaces: 2 })
    if (!fs.existsSync(DOOM_VERSIONS_FILE))
      fs.writeJSONSync(DOOM_VERSIONS_FILE, DEFAULT_DOOM_VERSIONS, { spaces: 2 })
    if (!fs.existsSync(MOD_FILE_CATALOG)) fs.writeJSONSync(MOD_FILE_CATALOG, [], { spaces: 2 })
    if (!fs.existsSync(FIRST_RUN_SENTINEL)) _isFirstRun = true
    // Deferred WAD bootstrap — avoids circular import with doom-versions
    setImmediate(() => {
      import('./doom-versions').then((m) => {
        m.syncDoomVersions({ skipHash: true }).then(() => m.startWadWatcher())
      })
    })
    return true
  } catch (error: unknown) {
    log.error('[storage] Failed to initialize storage:', error)
    isInitialized = false
    return false
  }
}

export async function getSettings(): Promise<IAppSettings> {
  try {
    initStorage()
    const settingsData = await fs.readJSON(SETTINGS_FILE)
    const settings: IAppSettings = { ...DEFAULT_SETTINGS, ...settingsData }
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
    return resolvedSettings
  } catch (error: unknown) {
    log.error(
      `[storage] Error getting settings: ${error instanceof Error ? error.message : String(error)}`
    )
    return DEFAULT_SETTINGS
  }
}

export async function saveSettings(settings: Partial<IAppSettings>): Promise<IAppSettings> {
  try {
    initStorage()
    const currentSettings = await getSettings()
    const updatedSettings = { ...currentSettings, ...settings }
    await fs.writeJSON(SETTINGS_FILE, updatedSettings, { spaces: 2 })
    if (
      settings.wadFilesDirectory &&
      settings.wadFilesDirectory !== currentSettings.wadFilesDirectory
    ) {
      const { stopWadWatcher, syncDoomVersions, startWadWatcher } = await import('./doom-versions')
      stopWadWatcher()
      await syncDoomVersions()
      startWadWatcher()
    }
    return updatedSettings
  } catch (error: unknown) {
    log.error(
      `[storage] Error saving settings: ${error instanceof Error ? error.message : String(error)}`
    )
    throw new Error(
      `Failure: Setting not saved: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

export function resolvePath(p: string): string {
  if (p && typeof p === 'string' && p.startsWith('~')) {
    // path.normalize joins os.homedir() with the remainder using the platform
    // separator — a bare replace() would yield mixed separators on Windows
    // (e.g. C:\Users\runneradmin/test).
    return path.normalize(p.replace(/^~/, os.homedir()))
  }
  return p
}

export function escapePathForCmd(filePath: string): string {
  return filePath.replace(/ /g, '\\ ')
}
export function generateStableId(baseName: string): string {
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

export async function computeFileHash(filePath: string): Promise<string> {
  try {
    const resolvedPath = await resolveFileHashPath(filePath)
    const hash = await hashFileStream(resolvedPath)
    debug(`Computed MD5 hash for ${resolvedPath}: ${hash}`)
    return hash
  } catch (error: unknown) {
    log.error(`Error computing hash for ${filePath}:`, error)
    return ''
  }
}

export async function computeFileHashOrThrow(filePath: string): Promise<string> {
  const resolvedPath = await resolveFileHashPath(filePath)
  const hash = await hashFileStream(resolvedPath)
  debug(`Computed MD5 hash for ${resolvedPath}: ${hash}`)
  return hash
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
