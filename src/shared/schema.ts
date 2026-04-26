// Shared interfaces between main and renderer processes

export interface IMod {
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
  sourcePort?: string
  saveDirectory?: string
  launchParameters?: string
  posterImage?: string
  screenshotPath?: string
  files: IModFile[]
}

export type InsertMod = Omit<IMod, 'id'>

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
  requires?: Record<string, number>
  requiredBy?: string[]
  sidecarOnly?: boolean
  loadOrder?: number
  isRequired?: boolean
}

export type InsertModFile = Omit<IModFile, 'id'>

export interface IDoomVersion {
  id: string
  name: string
  slug: string
  args: string
  executable: string
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

// App settings
export interface IAppSettings {
  gzDoomPath: string
  theme: string
  savegamesPath?: string
  modsDirectory?: string
  screenshotsPath?: string
  wadFilesDirectory?: string
  databaseLinkPresets: IDatabaseLink[]
  selectedPresetIndex: number
  configPath?: string
  autoUpdateEnabled?: boolean
}
