// Shared interfaces between main and renderer processes

export interface IMod {
  id: string;
  name: string;
  title?: string; // For backward compatibility
  description: string;
  version?: string;
  author?: string;
  website?: string;
  releaseDate?: string;
  versionId?: string; // ID of Doom version/source port
  doomVersionId?: number | string; // Alternative name for versionId
  sourcePort?: string;
  saveDirectory?: string;
  moddbId?: number;
  launchParameters?: string;
  posterImage?: string;
  screenshotPath?: string;
  files: IModFile[];
}

export type InsertMod = Omit<IMod, 'id'>;

export interface IModFile {
  id: number;
  name?: string;
  fileName?: string; // Alternative name for name
  path?: string;
  filePath?: string; // Alternative name for path
  type?: 'wad' | 'pk3' | 'other';
  fileType?: string; // Alternative name for type
  modId: string; // Reference to parent mod
  loadOrder?: number;
  isRequired?: boolean;
}

export type InsertModFile = Omit<IModFile, 'id'>;

export interface IDoomVersion {
  id: string;
  name: string;
  slug: string;
  args: string;
  executable: string;
  parameters: string;
  defaultIwad: string;
  icon: string;
}

export interface IResponseMessage {
  success: boolean;
  error?: string;
  data?: any;
}

// App settings
export interface IAppSettings {
  gzDoomPath: string;
  theme: string;
  savegamesPath?: string; 
  modsDirectory?: string;
  screenshotsPath?: string;
  defaultSourcePort?: string;
}

// ModDB API response types
export interface ModDBSearchResult {
  id: number;
  name: string;
  summary: string;
  thumbnail: string;
  downloads: number;
  rating: number;
  // Add other properties as needed
}

export interface ModDBModDetails {
  id: number;
  name: string;
  summary: string;
  description: string;
  thumbnail: string;
  downloads: number;
  rating: number;
  // Add other properties as needed
}

export interface ModDBFile {
  id: number;
  name: string;
  size: number;
  url: string;
  // Add other properties as needed
}
