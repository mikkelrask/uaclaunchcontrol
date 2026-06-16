export interface UacModpackImport {
  format: string
  version: string
  game: {
    title: string
    description?: string
    doomVersionSlug: string
    sourcePort?: string
    launchParameters?: string
    /** Per-protocol config reference for import reconstruction */
    protocolConfig?: {
      configFile: string
      templateHash: string
    }
  }
  files: {
    name: string
    hashValue?: string
    url?: string
    /** Config template hash to link from the configs block */
    configHash?: string
  }[]
  /** Embedded config file contents keyed by MD5 hash */
  configs?: Record<string, { content: string }>
}

export interface WadImportSelection {
  sourcePath: string
  fileName: string
  hashValue: string
  targetFileName: string
}

export interface BatParseResult {
  sourcePortFamily?: string
  iwad?: string
  modFiles: string[]
  configFile?: string
  extraParams: string[]
}
