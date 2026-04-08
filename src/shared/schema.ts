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
  fileName?: string // Alternative name for name
  path?: string
  filePath?: string // Alternative name for path
  type?: 'wad' | 'pk3' | 'other'
  fileType?: string // Alternative name for type
  modId: string // Reference to parent mod
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

// App settings
export interface IAppSettings {
  gzDoomPath: string
  theme: string
  savegamesPath?: string
  modsDirectory?: string
  screenshotsPath?: string
  wadFilesDirectory?: string
  defaultSourcePort?: string
  configPath?: string
}
