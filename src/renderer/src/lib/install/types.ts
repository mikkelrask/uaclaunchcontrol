export interface UacModpackImport {
  format: string
  version: string
  game: {
    title: string
    description?: string
    doomVersionSlug: string
    sourcePort?: string
    launchParameters?: string
  }
  files: {
    name: string
    hashValue?: string
    url?: string
  }[]
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
  extraParams: string[]
}
