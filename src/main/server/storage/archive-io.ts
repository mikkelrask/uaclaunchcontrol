// Archive I/O — extract and import zip/rar mod archives
import { createExtractorFromFile } from 'node-unrar-js'
import fs from 'fs-extra'
import path from 'path'
import os from 'os'
import extractZip from 'extract-zip'
import type { IModFile } from '@shared/schema'
import { CONFIG_DIR, MOD_FILE_CATALOG } from './paths'
import { resolvePath, computeFileHash, getSettings } from './core'
import { getModFileCatalog } from './mod-catalog'

interface BatParseResult {
  sourcePortFamily?: string
  iwad?: string
  modFiles: string[]
  extraParams: string[]
}

function parseBatContent(content: string): BatParseResult {
  const lines = content.replace(/\r\n/g, '\n').split('\n')
  let commandLine = ''
  let sourcePortFamily: string | undefined

  for (const line of lines) {
    const trimmed = line.trim()
    if (
      !trimmed ||
      trimmed.toLowerCase().startsWith('::') ||
      trimmed.toLowerCase().startsWith('@echo') ||
      trimmed.toLowerCase().startsWith('rem ')
    )
      continue

    const portMatch = trimmed.match(/(gzdoom|uzdoom|zandronum|lzdoom|zdoom|helion)\.exe/i)
    if (portMatch) {
      commandLine = trimmed
      sourcePortFamily = portMatch[1].toLowerCase()
      break
    }
  }

  if (!commandLine) {
    commandLine = lines.find((l) => /-(iwad|file)/i.test(l)) || ''
  }

  const tokens: string[] = []
  const regex = /[^\s"']+|"([^"]*)"|'([^']*)'/g
  let match
  while ((match = regex.exec(commandLine)) !== null) {
    tokens.push(match[1] || match[2] || match[0])
  }

  const iwadIndex = tokens.findIndex((t) => t.toLowerCase() === '-iwad')
  const iwad = iwadIndex >= 0 && tokens[iwadIndex + 1] ? tokens[iwadIndex + 1] : undefined

  const modFiles: string[] = []
  const extraParams: string[] = []
  const fileIndex = tokens.findIndex((t) => t.toLowerCase() === '-file')
  if (fileIndex >= 0) {
    for (let i = fileIndex + 1; i < tokens.length; i++) {
      const token = tokens[i]
      if (token.startsWith('-')) {
        extraParams.push(...tokens.slice(i))
        break
      }
      modFiles.push(token)
    }
  }

  return { sourcePortFamily, iwad, modFiles, extraParams }
}

async function scanDirRecursive(dir: string, baseDir: string = dir): Promise<string[]> {
  const files = await fs.readdir(dir)
  const results: string[] = []
  for (const file of files) {
    const fullPath = path.join(dir, file)
    const stat = await fs.stat(fullPath)
    if (stat.isDirectory()) {
      results.push(...(await scanDirRecursive(fullPath, baseDir)))
    } else {
      results.push(fullPath)
    }
  }
  return results
}

function getFileType(fileName: string): string {
  const ext = path.extname(fileName).toUpperCase()
  if (ext === '.ZIP') return 'ZIP'
  if (ext === '.PK3' || ext === '.PK7' || ext === '.IPK3') return 'PK3'
  if (ext === '.DEH' || ext === '.BEX') return 'DEH'
  return 'WAD'
}

function isSupportedFileType(fileName: string): boolean {
  const ext = path.extname(fileName).toUpperCase()
  return ['.WAD', '.PK3', '.PK7', '.IPK3', '.DEH', '.BEX', '.ZIP'].includes(ext)
}

export interface IUnzipScanResult {
  tempDir: string
  supported: {
    tempPath: string
    fileName: string
    relativePath: string
    fileType: string
    hashValue: string
    name: string
    isReferencedByBat: boolean
  }[]
  skipped: {
    fileName: string
    relativePath: string
    reason: string
  }[]
  batFiles?: {
    fileName: string
    relativePath: string
    sourcePortFamily?: string
    iwad?: string
    modFiles: string[]
    extraParams: string[]
  }
}

/** Shared: scan an already-extracted temp directory for supported mod files. */
async function scanExtractedArchive(tempExtractDir: string): Promise<IUnzipScanResult> {
  const allFilePaths = await scanDirRecursive(tempExtractDir)

  // Look for any .bat or .cmd files
  const batFilePaths = allFilePaths.filter((fp) => {
    const ext = path.extname(fp).toLowerCase()
    return ext === '.bat' || ext === '.cmd'
  })

  let batFileResult: IUnzipScanResult['batFiles'] | undefined
  let batReferencedFiles: string[] = []

  if (batFilePaths.length > 0) {
    const batPath = batFilePaths[0]
    const batContent = await fs.readFile(batPath, 'utf-8')
    const parsed = parseBatContent(batContent)

    batFileResult = {
      fileName: path.basename(batPath),
      relativePath: path.relative(tempExtractDir, batPath),
      sourcePortFamily: parsed.sourcePortFamily,
      iwad: parsed.iwad,
      modFiles: parsed.modFiles,
      extraParams: parsed.extraParams
    }

    const batDir = path.dirname(batPath)
    batReferencedFiles = parsed.modFiles.map((file) => {
      const normalizedFile = file.replace(/\\/g, '/')
      return path.resolve(batDir, normalizedFile)
    })
  }

  const supportedFiles: IUnzipScanResult['supported'] = []
  const skippedFiles: IUnzipScanResult['skipped'] = []

  for (const filePath of allFilePaths) {
    const fileName = path.basename(filePath)
    const relativePath = path.relative(tempExtractDir, filePath)

    const ext = path.extname(filePath).toLowerCase()
    if (ext === '.bat' || ext === '.cmd') {
      continue
    }

    if (isSupportedFileType(fileName)) {
      const hashValue = await computeFileHash(filePath)
      const fileType = getFileType(fileName)
      const prettyName = fileName.replace(/\.[^.]+$/, '')

      const isReferencedByBat = batReferencedFiles.some((refPath) => {
        return path.resolve(filePath) === path.resolve(refPath)
      })

      supportedFiles.push({
        tempPath: filePath,
        fileName,
        relativePath,
        fileType,
        hashValue,
        name: prettyName,
        isReferencedByBat
      })
    } else {
      skippedFiles.push({
        fileName,
        relativePath,
        reason: `Unsupported file extension (${ext || 'no extension'})`
      })
    }
  }

  return {
    tempDir: tempExtractDir,
    supported: supportedFiles,
    skipped: skippedFiles,
    batFiles: batFileResult
  }
}

/** Create a unique temp directory for archive extraction. */
async function createExtractDir(): Promise<string> {
  const uniqueId = `extract-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
  const tempExtractDir = path.join(os.tmpdir(), 'uac', 'temp_extract', uniqueId)
  await fs.ensureDir(tempExtractDir)
  return tempExtractDir
}

/** Scan and extract a .zip archive, returning metadata about its contents. */
export async function unzipAndScan(zipFilePath: string): Promise<IUnzipScanResult> {
  const resolvedZipPath = resolvePath(zipFilePath)
  if (!fs.existsSync(resolvedZipPath)) {
    throw new Error(`Zip file not found: ${resolvedZipPath}`)
  }

  const tempExtractDir = await createExtractDir()

  try {
    // extract-zip streams entries via yauzl instead of reading the whole
    // archive into a single Buffer, so it isn't bound by Node's ~2GiB
    // readFileSync limit (unlike adm-zip, which failed on archives >2GiB).
    await extractZip(resolvedZipPath, { dir: tempExtractDir })
    return await scanExtractedArchive(tempExtractDir)
  } catch (error: unknown) {
    await fs.remove(tempExtractDir).catch(() => {})
    throw error
  }
}

/** Scan and extract a .rar archive, returning metadata about its contents. */
export async function unrarAndScan(rarFilePath: string): Promise<IUnzipScanResult> {
  const resolvedRarPath = resolvePath(rarFilePath)
  if (!fs.existsSync(resolvedRarPath)) {
    throw new Error(`RAR file not found: ${resolvedRarPath}`)
  }

  const tempExtractDir = await createExtractDir()

  try {
    const extractor = await createExtractorFromFile({
      filepath: resolvedRarPath,
      targetPath: tempExtractDir
    })
    // Must consume the returned generator — extraction is lazy
    const extracted = extractor.extract({})
    void [...extracted.files] // ponytail: must consume lazy generator
    return await scanExtractedArchive(tempExtractDir)
  } catch (error: unknown) {
    await fs.remove(tempExtractDir).catch(() => {})
    throw new Error(`Failed to extract RAR archive: ${(error as Error).message || error}`)
  }
}

export interface IZipImportFile {
  tempPath: string
  name: string
  version?: string
  url?: string
  sidecarOnly: boolean
  category?: string
  loadOrder: Record<string, number>
}

export async function importUnzippedFiles(
  tempDir: string,
  filesToImport: IZipImportFile[]
): Promise<IModFile[]> {
  try {
    const importedModFiles: IModFile[] = []
    const settings = await getSettings()
    const modsDir = resolvePath(settings.modsDirectory || path.join(CONFIG_DIR, 'mods'))
    const catalog = await getModFileCatalog()

    const movedFilesMap = new Map<
      string,
      { relativePath: string; fileName: string; hashValue: string }
    >()

    for (const file of filesToImport) {
      const resolvedTempPath = resolvePath(file.tempPath)
      if (!fs.existsSync(resolvedTempPath)) {
        throw new Error(`Temporary file not found for import: ${resolvedTempPath}`)
      }

      const originalFileName = path.basename(resolvedTempPath)
      const hashValue = await computeFileHash(resolvedTempPath)
      if (!hashValue) {
        throw new Error(`Failed to compute hash for file: ${originalFileName}`)
      }

      const ext = path.extname(originalFileName)
      const baseName = path.basename(originalFileName, ext)
      const newFileName = `${baseName}-${hashValue}${ext}`
      const relativePath = path.join('files', newFileName)
      const fullPath = path.join(modsDir, relativePath)

      await fs.ensureDir(path.join(modsDir, 'files'))
      await fs.copy(resolvedTempPath, fullPath, { overwrite: true })

      movedFilesMap.set(file.tempPath, {
        relativePath,
        fileName: newFileName,
        hashValue
      })
    }

    let nextId = Date.now()
    for (const file of filesToImport) {
      const moved = movedFilesMap.get(file.tempPath)!

      const existingIndex = catalog.findIndex((entry) => entry.hashValue === moved.hashValue)

      const resolvedLoadOrder: Record<string, number> = {}
      if (file.loadOrder) {
        for (const [key, offset] of Object.entries(file.loadOrder)) {
          if (movedFilesMap.has(key)) {
            const refHash = movedFilesMap.get(key)!.hashValue
            resolvedLoadOrder[refHash] = offset
          } else {
            resolvedLoadOrder[key] = offset
          }
        }
      }

      if (moved.hashValue && !resolvedLoadOrder[moved.hashValue]) {
        resolvedLoadOrder[moved.hashValue] = 1
      }

      const fileType = getFileType(moved.fileName)

      const catalogEntry: IModFile = {
        id: existingIndex >= 0 ? catalog[existingIndex].id : nextId++,
        name: file.name || moved.fileName.replace(/\.[^.]+$/, ''),
        fileName: moved.fileName,
        filePath: moved.relativePath,
        fileType,
        hashValue: moved.hashValue,
        version: file.version || '',
        url: file.url || '',
        sidecarOnly: file.sidecarOnly || false,
        category: file.category || undefined,
        loadOrder: resolvedLoadOrder,
        requiredBy: existingIndex >= 0 ? catalog[existingIndex].requiredBy || [] : []
      }

      if (existingIndex >= 0) {
        catalog[existingIndex] = catalogEntry
      } else {
        catalog.push(catalogEntry)
      }

      importedModFiles.push(catalogEntry)
    }

    await fs.writeJSON(MOD_FILE_CATALOG, catalog, { spaces: 2 })

    await fs.remove(tempDir)

    return importedModFiles
  } catch (error: unknown) {
    try {
      await fs.remove(tempDir)
    } catch {
      // ignore cleanup errors
    }
    throw error
  }
}
