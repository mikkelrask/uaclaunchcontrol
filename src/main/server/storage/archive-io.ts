// Archive I/O — extract and import zip/rar/7z mod archives
import sevenZipWasm from '7z-wasm'
import type { SevenZipModuleFactory } from '7z-wasm'
import { createExtractorFromFile } from 'node-unrar-js'
import fs from 'fs-extra'
import path from 'path'
import os from 'os'
import { open, type Entry, type ZipFile } from 'yauzl'
import type { IModFile } from '@shared/schema'
import { getArchiveExtension } from '@shared/archive'
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

async function scanDirRecursive(dir: string): Promise<string[]> {
  const files = await fs.readdir(dir)
  const results: string[] = []
  for (const file of files) {
    const fullPath = path.join(dir, file)
    const stat = await fs.stat(fullPath)
    if (stat.isDirectory()) {
      results.push(...(await scanDirRecursive(fullPath)))
    } else {
      results.push(fullPath)
    }
  }
  return results
}

export function getFileType(fileName: string): string {
  const ext = path.extname(fileName).toUpperCase()
  if (ext === '.ZIP') return 'ZIP'
  // `.pk7` and `.7z` are the same 7-Zip container; GZDoom loads both as
  // archives, so they share the PK3 label the app already uses for .pk7.
  if (ext === '.PK3' || ext === '.PK7' || ext === '.IPK3' || ext === '.7Z') return 'PK3'
  if (ext === '.DEH' || ext === '.BEX') return 'DEH'
  return 'WAD'
}

function isSupportedFileType(fileName: string): boolean {
  const ext = path.extname(fileName).toUpperCase()
  return ['.WAD', '.PK3', '.PK7', '.IPK3', '.DEH', '.BEX', '.ZIP'].includes(ext)
}

export interface IArchiveScanResult {
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
async function scanExtractedArchive(tempExtractDir: string): Promise<IArchiveScanResult> {
  const allFilePaths = await scanDirRecursive(tempExtractDir)

  // Look for any .bat or .cmd files
  const batFilePaths = allFilePaths.filter((fp) => {
    const ext = path.extname(fp).toLowerCase()
    return ext === '.bat' || ext === '.cmd'
  })

  let batFileResult: IArchiveScanResult['batFiles'] | undefined
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

  const supportedFiles: IArchiveScanResult['supported'] = []
  const skippedFiles: IArchiveScanResult['skipped'] = []

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

const ZIP_SYMLINK_MODE = 0o120000 // S_IFLNK

/**
 * Stream-extract a zip archive into `destDir`.
 *
 * Replaces extract-zip, which extracts symlink entries without validating
 * their targets (GHSA-jmr9-qjv8-65gv — a crafted archive could plant a
 * symlink pointing outside the extraction directory). Here every entry is
 * checked to stay inside `destDir` and symlinks are rejected outright —
 * mod archives never legitimately contain them.
 *
 * Still streams entries via yauzl's random-access fd reads instead of
 * reading the whole archive into a Buffer, so it isn't bound by Node's
 * ~2GiB readFileSync limit (adm-zip failed on archives >2GiB).
 */
export async function extractZipSafe(zipFilePath: string, destDir: string): Promise<void> {
  const resolvedDest = path.resolve(destDir)
  const zipfile = await new Promise<ZipFile>((resolve, reject) => {
    open(zipFilePath, { lazyEntries: true }, (err, zip) => {
      if (err) reject(err)
      else resolve(zip)
    })
  })

  try {
    await new Promise<void>((resolve, reject) => {
      zipfile.on('error', reject)
      zipfile.on('end', resolve)

      const fail = (error: Error): void => {
        zipfile.close()
        reject(error)
      }

      zipfile.on('entry', (entry: Entry) => {
        const destPath = path.join(resolvedDest, entry.fileName)
        const relative = path.relative(resolvedDest, destPath)
        if (
          relative === '..' ||
          relative.startsWith(`..${path.sep}`) ||
          path.isAbsolute(relative)
        ) {
          fail(new Error(`Archive entry escapes extraction directory: ${entry.fileName}`))
          return
        }
        if (((entry.externalFileAttributes >>> 16) & 0o170000) === ZIP_SYMLINK_MODE) {
          fail(new Error(`Archive contains a symlink, which is not allowed: ${entry.fileName}`))
          return
        }
        if (entry.fileName.endsWith('/')) {
          fs.ensureDir(destPath)
            .then(() => zipfile.readEntry())
            .catch(reject)
          return
        }
        fs.ensureDir(path.dirname(destPath))
          .then(() => {
            zipfile.openReadStream(entry, (streamErr, readStream) => {
              if (streamErr || !readStream) {
                fail(streamErr ?? new Error(`Failed to open archive entry: ${entry.fileName}`))
                return
              }
              readStream.on('error', reject)
              const out = fs.createWriteStream(destPath)
              out.on('error', reject)
              out.on('close', () => zipfile.readEntry())
              readStream.pipe(out)
            })
          })
          .catch(reject)
      })

      zipfile.readEntry()
    })
  } catch (error) {
    zipfile.close()
    throw error
  }
}

/** Scan and extract a .zip archive, returning metadata about its contents. */
export async function unzipAndScan(zipFilePath: string): Promise<IArchiveScanResult> {
  const resolvedZipPath = resolvePath(zipFilePath)
  if (!fs.existsSync(resolvedZipPath)) {
    throw new Error(`Zip file not found: ${resolvedZipPath}`)
  }

  const tempExtractDir = await createExtractDir()

  try {
    await extractZipSafe(resolvedZipPath, tempExtractDir)
    return await scanExtractedArchive(tempExtractDir)
  } catch (error: unknown) {
    await fs.remove(tempExtractDir).catch(() => {})
    throw error
  }
}

/** Scan and extract a .rar archive, returning metadata about its contents. */
export async function unrarAndScan(rarFilePath: string): Promise<IArchiveScanResult> {
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

/**
 * `7z-wasm` ships a UMD bundle whose `module.exports` is `{ default: factory }`.
 * Module systems disagree on how far to unwrap that: Node's ESM loader exposes
 * the factory as the default export, while esbuild's `__toESM` (what the built
 * main process goes through) stops at the wrapper object. Unwrap whatever we
 * were handed instead of trusting one interop.
 */
const createSevenZip: SevenZipModuleFactory =
  typeof sevenZipWasm === 'function'
    ? sevenZipWasm
    : (sevenZipWasm as unknown as { default: SevenZipModuleFactory }).default

/** Condense 7-Zip's stderr into the reason for a toast. */
function sevenZipErrorMessage(stderr: string): string {
  const lines = stderr
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  // 7-Zip ends a failed run with an `ERRORS:` block holding the real reason;
  // the `ERROR:` lines above it only echo the path it was working on.
  const errorsIndex = lines.indexOf('ERRORS:')
  return (errorsIndex >= 0 ? lines.slice(errorsIndex + 1) : lines).join('\n')
}

/**
 * Extract a .7z archive into `destDir` with the reference 7-Zip engine
 * (7-Zip 24.09 compiled to WASM).
 *
 * The host filesystem is reached through Emscripten's NODEFS mount, so 7-Zip
 * reads the archive and writes the extracted files directly: only the
 * decoder's own window enters the WASM heap, which keeps multi-GB archives
 * off it (7zip-bin's p7zip 16.02 binary, the alternative, is a 2016 build
 * that happily recreates archive symlinks — see `-snl-` below).
 *
 * `-snl-` forbids recreating symbolic links. Mod archives never legitimately
 * contain them, and a link pointing outside `destDir` is the same bug class
 * the zip path here hardens against (GHSA-jmr9-qjv8-65gv). 7-Zip confines
 * entry names on its own as well: absolute names and `..` segments are
 * rewritten relative to the destination instead of being followed.
 *
 * `callMain` is synchronous — as with the RAR path, extraction blocks the
 * main process for its duration.
 */
export async function extract7zSafe(archivePath: string, destDir: string): Promise<void> {
  const archiveName = path.basename(archivePath)
  let stderr = ''

  const sevenZip = await createSevenZip({
    // An encrypted archive must fail, not block forever waiting on stdin.
    // The shipped .d.ts types `stdin` as `() => number`, but Emscripten's
    // contract — and 7z-wasm's own CLI — return null to signal EOF.
    stdin: (() => null) as unknown as () => number,
    print: () => {},
    printErr: (line: string) => {
      stderr += `${line}\n`
    }
  })

  sevenZip.FS.mkdir('/in')
  sevenZip.FS.mkdir('/out')
  sevenZip.FS.mount(sevenZip.NODEFS, { root: path.dirname(archivePath) }, '/in')
  sevenZip.FS.mount(sevenZip.NODEFS, { root: destDir }, '/out')

  const args = [
    'x', // extract, keeping archive paths
    '-y', // yes to every query
    '-bso0',
    '-bsp0', // silence banner + progress
    '-snl-', // never recreate symbolic links
    `/in/${archiveName}`,
    '-o/out'
  ]

  try {
    sevenZip.callMain(args)
  } catch (error) {
    // 7-Zip leaves through an Emscripten abort that carries no message of its
    // own; stderr is the only place the reason shows up.
    throw new Error(
      sevenZipErrorMessage(stderr) ||
        `7-Zip aborted on "${archiveName}" (the archive may be encrypted or corrupt): ${String(error)}`
    )
  }

  // Fatal extraction failures arrive as `ERROR:`/`Open ERROR:` lines. A run
  // that only emitted `WARNING:` lines still wrote every file it could, and
  // there is no "ignore warnings" escape hatch in the UI — so only errors stop
  // the import.
  const hasError = stderr.split('\n').some((line) => /^\s*(ERROR|Open ERROR)\b/i.test(line))
  if (hasError) throw new Error(sevenZipErrorMessage(stderr))
}

/** Scan and extract a .7z archive, returning metadata about its contents. */
export async function sevenZipAndScan(archiveFilePath: string): Promise<IArchiveScanResult> {
  const resolvedPath = resolvePath(archiveFilePath)
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`7Z file not found: ${resolvedPath}`)
  }

  const tempExtractDir = await createExtractDir()

  try {
    await extract7zSafe(resolvedPath, tempExtractDir)
    return await scanExtractedArchive(tempExtractDir)
  } catch (error: unknown) {
    await fs.remove(tempExtractDir).catch(() => {})
    throw new Error(`Failed to extract 7Z archive: ${(error as Error).message || error}`)
  }
}

/**
 * Scan and extract whichever archive format `archiveFilePath` is, dispatched
 * on its extension. Every import entry point (drag/drop, file picker, in-app
 * download, idgames handoff) goes through here.
 */
export async function scanArchiveFile(archiveFilePath: string): Promise<IArchiveScanResult> {
  const ext = getArchiveExtension(archiveFilePath)
  if (ext === 'zip') return unzipAndScan(archiveFilePath)
  if (ext === 'rar') return unrarAndScan(archiveFilePath)
  if (ext === '7z') return sevenZipAndScan(archiveFilePath)
  throw new Error(`Unsupported archive type: ${path.basename(archiveFilePath)}`)
}

export interface IArchiveImportFile {
  tempPath: string
  name: string
  version?: string
  url?: string
  sidecarOnly: boolean
  category?: string
  loadOrder: Record<string, number>
}

export async function importArchiveFiles(
  tempDir: string,
  filesToImport: IArchiveImportFile[]
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
