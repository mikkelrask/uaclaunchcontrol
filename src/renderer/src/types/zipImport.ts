export interface SupportedFile {
  tempPath: string
  fileName: string
  relativePath: string
  fileType: string
  hashValue: string
  name: string
  isReferencedByBat: boolean
}

export interface SkippedFile {
  fileName: string
  relativePath: string
  reason: string
}

export interface BatFile {
  fileName: string
  relativePath: string
  sourcePortFamily?: string
  iwad?: string
  modFiles: string[]
  extraParams: string[]
}

export interface ZipScanResult {
  tempDir: string
  supported: SupportedFile[]
  skipped: SkippedFile[]
  batFiles?: BatFile
}
