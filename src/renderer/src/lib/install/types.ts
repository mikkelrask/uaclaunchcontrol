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
    /** External screenshot URL — already portable, carried through as-is */
    screenshotPath?: string
    /** Locally-uploaded screenshot, embedded as base64 so the export is self-contained */
    screenshot?: {
      fileName: string
      mimeType: string
      data: string
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
