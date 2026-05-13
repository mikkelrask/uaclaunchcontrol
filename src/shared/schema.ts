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
  saveDirectory?: string
  launchParameters?: string
  posterImage?: string
  screenshotPath?: string
  files: IModFile[]
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
export interface IAppSettings {
  sourcePorts: ISourcePort[]
  defaultSourcePortId?: string
  theme: string
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
