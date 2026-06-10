// Shared interfaces between main and renderer processes

export interface IProtocol {
  id: string
  name: string
  title?: string // For backward compatibility
  description: string
  version?: string
  author?: string
  website?: string
  releaseDate?: string
  versionId?: string // ID of Doom version/source port
  doomVersionId?: string // Consistently use string for IDs
  sourcePortId?: string // References ISourcePort.id in settings.sourcePorts
  lastLaunchedAt?: string // ISO timestamp, updated when protocol is launched
  playtimeSeconds?: number // Total accumulated playtime in seconds
  saveDirectory?: string
  launchParameters?: string
  posterImage?: string
  screenshotPath?: string
  files: IModFile[]
  /** Per-protocol isolated config copy. Seeded from a catalog template at creation time. */
  protocolConfig?: ModProtocolConfig
}

export type InsertProtocol = Omit<IProtocol, 'id'>

export interface IModFile {
  id: number
  name?: string
  fileName?: string
  path?: string
  filePath?: string
  type?: 'wad' | 'pk3' | 'other'
  fileType?: string
  hashValue?: string
  version?: string
  url?: string
  loadOrder?: Record<string, number>
  requiredBy?: string[]
  sidecarOnly?: boolean
  isRequired?: boolean
  /** Config template from catalog — used to seed protocol-specific copies. */
  configTemplate?: ModConfigTemplate
}

export type InsertModFile = Omit<IModFile, 'id'>

export interface IDoomVersion {
  id: string
  name: string
  slug: string
  args: string
  parameters: string
  defaultIwad: string
  icon: string
  ignored?: boolean
}

export interface IResponseMessage {
  success: boolean
  error?: string
  data?: unknown
}

export interface IDoomVersionDelta {
  added?: IDoomVersion[]
  removed?: IDoomVersion[]
}

export interface IInstallType {
  isAppImage: boolean
  isSystemInstalled: boolean
}

export interface IDatabaseLink {
  name: string
  url: string
}

export type SourcePortFamily = 'uzdoom' | 'gzdoom' | 'zdoom' | 'zandronum' | 'lzdoom' | 'other'

export interface ISourcePort {
  id: string
  name: string
  executablePath: string
  version?: string
  family: SourcePortFamily
  ignored?: boolean
}

// App settings
export type ThemeMode = 'dark' | 'light' | 'terminal' | 'custom'

// ── Config Template / Protocol Config ────────────────────

/**
 * A config template stored on a catalog mod file entry.
 * When a protocol is created with this mod file, the config
 * is copied into a protocol-specific file (ModProtocolConfig)
 * so each protocol has an isolated copy.
 */
export interface ModConfigTemplate {
  /** Filename in ~/.config/uac/data/cfgs/ (e.g. "a1b2c3d4...cfg") */
  configFile: string
  /** MD5 hash of the config file content (for change detection) */
  md5Hash: string
}

/**
 * A per-protocol isolated config copy. Created at protocol
 * creation time by copying from a catalog ModConfigTemplate.
 */
export interface ModProtocolConfig {
  /** Filename in ~/.config/uac/data/cfgs/<protocol-id>.cfg */
  configFile: string
  /** MD5 of the template it was seeded from (for staleness detection) */
  templateHash: string
}

export interface IAppSettings {
  sourcePorts: ISourcePort[]
  defaultSourcePortId?: string
  theme: ThemeMode
  savegamesPath?: string
  modsDirectory?: string
  screenshotsPath?: string
  wadFilesDirectory?: string
  databaseLinkPresets: IDatabaseLink[]
  selectedPresetIndex: number
  configPath?: string
  autoUpdateEnabled?: boolean
  registryLookupEnabled?: boolean
  registryUuid?: string
  showLaunchPreview?: boolean
  customThemeCss?: string
  defaultView?: 'grid' | 'list' | 'detail'
  /** @deprecated Migrated to playerData.json — use IPlayerData.rank instead */
  rank?: string
}
export interface IUpdateInfo {
  version: string
  releaseNotes?: string
  status:
    | 'available'
    | 'downloading'
    | 'downloaded'
    | 'error'
    | 'idle'
    | 'checking'
    | 'not-available'
  percent?: number
  error?: string
  isManual?: boolean
}

export interface IVersionData {
  added?: Array<{ name: string }>
  removed?: Array<{ name: string }>
}

// ── Player Data / Achievements ──────────────────────────
// Stored in ~/.config/uac/playerData.json

export interface IPlayerData {
  /** Current rank id (cadet, marine, sergeant, slayer) */
  rank: string
  /** Index of all tracked achievements, keyed by achievement id */
  achievements: Record<string, IAchievementState>
  /** Accumulated player stats, used as fuel for achievement progress */
  stats: IPlayerStats
}

export interface IAchievementState {
  /** Whether the achievement has been unlocked */
  unlocked: boolean
  /** ISO timestamp of unlock, or undefined */
  unlockedAt?: string
  /** Current progress value (e.g. 7 if 7/10 mod files added) */
  progress: number
  /** The threshold this achievement needs */
  target: number
}

export interface IPlayerStats {
  totalProtocolsCreated: number
  totalProtocolsLaunched: number
  totalModFilesAdded: number
  totalWadsImported: number
  totalPlaytimeSeconds: number
  totalCatalogFilesManaged: number
  protocolsLaunchedThisSession: number
  distinctProtocolsLaunched: string[]
  maxModFilesInSingleProtocol: number
  totalSourcePortsAdded: number
  distinctSourcePortFamilies: string[]
}
