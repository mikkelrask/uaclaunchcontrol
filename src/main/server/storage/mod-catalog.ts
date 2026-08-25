// Mod file catalog management
import fs from 'fs-extra'
import path from 'path'
import type { IModFile, ModProtocolConfig } from '@shared/schema'
import { debug } from '@shared/debug'
import { MOD_FILE_CATALOG, IMAGES_DIR, CFGS_DIR, CONFIG_DIR } from './paths'
import {
  initStorage,
  getSettings,
  resolvePath,
  computeFileHash,
  computeFileHashOrThrow,
  stripMd5Suffix,
  wadNamePriority
} from './core'
import { syncDoomVersions } from './doom-versions'
import { resizeImageIfNeeded } from './image-resize'

import { createLogger } from '@shared/logger'

const log = createLogger('storage/mod-catalog')
const IMAGE_MIME_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif'
}

// Get the mod file catalog
export async function getModFileCatalog(): Promise<IModFile[]> {
  try {
    const filePath = path.join(CONFIG_DIR, 'modFileCatalogue.json')
    debug('Reading modFileCatalogue.json from:', filePath)
    if (!fs.existsSync(filePath)) {
      return []
    }
    const raw = await fs.promises.readFile(filePath, 'utf-8')
    debug('Raw modFileCatalogue.json contents:', raw)
    let data = []
    try {
      data = JSON.parse(raw)
    } catch (err: unknown) {
      log.error('mod-catalog.ts: Failed to parse modFileCatalogue.json:', err, 'Raw:', raw)
      data = []
    }
    if (!Array.isArray(data)) {
      log.warn('mod-catalog.ts: modFileCatalogue.json is not an array, got:', data)
      return []
    }

    // Migration: requires -> loadOrder
    let migrated = false
    const migratedData = data.map((file: IModFile & { requires?: Record<string, number> }) => {
      if (file.requires !== undefined || typeof file.loadOrder === 'number') {
        migrated = true
        const oldRequires = file.requires || {}
        const newLoadOrder: Record<string, number> = {}

        // Main file gets offset 1 if hash exists
        if (file.hashValue) {
          newLoadOrder[file.hashValue] = 1
        }

        // Shift others by 1
        for (const [hash, offset] of Object.entries(oldRequires)) {
          newLoadOrder[hash] = (offset as number) + 1
        }

        const newFile = { ...file, loadOrder: newLoadOrder }
        delete newFile.requires
        return newFile as IModFile
      }
      // Ensure loadOrder is a Record<string, number> if missing
      if (!file.loadOrder && file.hashValue) {
        migrated = true
        return {
          ...file,
          loadOrder: { [file.hashValue]: 1 }
        } as IModFile
      }
      return file as IModFile
    })

    if (migrated) {
      await fs.writeJSON(filePath, migratedData, { spaces: 2 })
      debug('mod-catalog.ts: Migrated modFileCatalogue.json requires to loadOrder')
    }

    return migratedData
  } catch (error: unknown) {
    log.error('mod-catalog.ts: Error reading modFileCatalogue.json:', error)
    return []
  }
}

// Move a file to a new path
export async function moveFile(filePath: string, newPath: string): Promise<string> {
  try {
    const resolvedSource = resolvePath(filePath)
    const resolvedDest = resolvePath(newPath)

    debug('Moving file from', resolvedSource, 'to', resolvedDest)

    // Ensure destination directory exists
    await fs.ensureDir(path.dirname(resolvedDest))

    // Use copy then potentially delete (or just copy for now as per original code)
    await fs.copy(resolvedSource, resolvedDest)

    debug('Moved file to', resolvedDest)
    return resolvedDest
  } catch (error: unknown) {
    log.error('Error moving file:', error)
    throw new Error(
      `Failed to move file: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

// Special helper to move a file into the mods/files folder and return the relative path
export async function moveToModFolder(
  sourcePath: string
): Promise<{ fullPath: string; relativePath: string; hashValue: string }> {
  try {
    const settings = await getSettings()
    const modsDir = resolvePath(settings.modsDirectory || path.join(CONFIG_DIR, 'mods'))
    const resolvedSource = resolvePath(sourcePath)
    const originalFileName = path.basename(resolvedSource)
    const hashValue = await computeFileHashOrThrow(resolvedSource)
    const ext = path.extname(originalFileName)
    const baseName = path.basename(originalFileName, ext)
    const newFileName = `${baseName}-${hashValue}${ext}`
    const relativePath = path.join('files', newFileName)
    const fullPath = path.join(modsDir, relativePath)

    await fs.ensureDir(path.join(modsDir, 'files'))
    await fs.copy(resolvedSource, fullPath, { overwrite: true })

    debug(`Moved file to mod folder: ${fullPath} (relative: ${relativePath}, hash: ${hashValue})`)
    return { fullPath, relativePath, hashValue }
  } catch (error: unknown) {
    log.error('Error moving file to mod folder:', error)
    throw new Error(
      `Failed to move file to mod folder: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

export async function importWadFile(
  sourcePath: string
): Promise<{ fileName: string; fullPath: string; hashValue: string; alreadyExists: boolean }> {
  try {
    const settings = await getSettings()
    const wadDir = resolvePath(settings.wadFilesDirectory || path.join(CONFIG_DIR, 'wads'))
    const resolvedSource = resolvePath(sourcePath)
    const originalFileName = path.basename(resolvedSource)
    const ext = path.extname(originalFileName)

    if (ext.toLowerCase() !== '.wad') {
      throw new Error('Only .wad files can be imported')
    }

    const hashValue = await computeFileHashOrThrow(resolvedSource)

    await fs.ensureDir(wadDir)

    const baseName = stripMd5Suffix(path.basename(originalFileName, ext))
    const fileName = `${baseName}-${hashValue}${ext}`
    const fullPath = path.join(wadDir, fileName)

    const existingWads = await fs.readdir(wadDir)
    const sortedExistingWads = existingWads
      .filter((existingFileName) => existingFileName.toLowerCase().endsWith('.wad'))
      .sort((a, b) => wadNamePriority(a) - wadNamePriority(b) || a.localeCompare(b))

    for (const existingFileName of sortedExistingWads) {
      if (!existingFileName.toLowerCase().endsWith('.wad')) continue

      const existingPath = path.join(wadDir, existingFileName)
      const existingHash = await computeFileHash(existingPath)
      if (existingHash === hashValue) {
        await syncDoomVersions({ notifyDelta: true })
        debug(`WAD already imported by hash: ${existingPath} (hash: ${hashValue})`)
        return {
          fileName: existingFileName,
          fullPath: existingPath,
          hashValue,
          alreadyExists: true
        }
      }
    }

    await fs.copy(resolvedSource, fullPath, { overwrite: false })

    await syncDoomVersions({ notifyDelta: true })

    debug(`Imported WAD file: ${fullPath} (hash: ${hashValue})`)
    return { fileName, fullPath, hashValue, alreadyExists: false }
  } catch (error: unknown) {
    log.error('Error importing WAD file:', error)
    throw new Error(
      `Failed to import WAD file: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

// Copy a local image file to the images directory, downscaling it if large so
// protocol exports (which embed screenshots as base64) stay under 2MB.
export async function copyImageToImages(sourcePath: string): Promise<string> {
  try {
    const fileName = sourcePath.split(/[\\/]/).pop() || `image_${Date.now()}`
    const timestamp = Date.now()
    const sourceExt = path.extname(fileName)
    const { buffer, ext } = await resizeImageIfNeeded(await fs.readFile(sourcePath), sourceExt)
    const baseName = sourceExt ? fileName.slice(0, -sourceExt.length) : fileName
    const uniqueFileName = `${timestamp}_${baseName}${ext}`
    const destPath = path.join(IMAGES_DIR, uniqueFileName)

    await fs.ensureDir(IMAGES_DIR)
    await fs.writeFile(destPath, buffer)

    debug(`Image copied to: ${destPath}`)
    return uniqueFileName
  } catch (error: unknown) {
    log.error('Error copying image:', error)
    throw new Error(
      `Failed to copy image: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

// Download an image from a URL and save it to the images directory
export async function downloadImage(url: string, protocolId: string): Promise<string> {
  try {
    await fs.ensureDir(IMAGES_DIR)

    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching image`)

    // Better extension detection from Content-Type or URL
    const contentType = res.headers.get('content-type')
    let extension = ''
    if (contentType === 'image/jpeg') extension = '.jpg'
    else if (contentType === 'image/png') extension = '.png'
    else if (contentType === 'image/webp') extension = '.webp'
    else if (contentType === 'image/gif') extension = '.gif'
    else {
      extension = path.extname(new URL(url).pathname) || '.jpg'
    }

    if (extension.length > 5) extension = '.jpg'

    const { buffer, ext } = await resizeImageIfNeeded(
      Buffer.from(await res.arrayBuffer()),
      extension
    )
    const fileName = `${protocolId}-poster${ext}`
    const filePath = path.join(IMAGES_DIR, fileName)

    await fs.writeFile(filePath, buffer)

    debug(`Image downloaded via fetch and saved to: ${filePath}`)
    return fileName // Return just the filename
  } catch (error: unknown) {
    log.error('Error downloading image:', error)
    throw new Error(
      `Failed to download image: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

// Read an image from the images directory as base64, for embedding in a
// modpack export. path.basename strips any directory components so a
// crafted fileName can't escape IMAGES_DIR.
export async function readScreenshotAsBase64(
  fileName: string
): Promise<{ fileName: string; mimeType: string; data: string }> {
  const safeName = path.basename(fileName)
  const filePath = path.join(IMAGES_DIR, safeName)
  const buffer = await fs.readFile(filePath)
  const ext = path.extname(safeName).toLowerCase()
  return {
    fileName: safeName,
    mimeType: IMAGE_MIME_TYPES[ext] || 'application/octet-stream',
    data: buffer.toString('base64')
  }
}

// Windows rejects these characters in filenames (all legal on POSIX), so a
// name that imports fine on Linux would make fs.writeFile throw on Windows —
// leaving the import with a silently empty screenshot field. Trailing
// dots/spaces are likewise invalid there.
const WINDOWS_ILLEGAL_FILENAME_CHARS = '<>:"/\\|?*'

/**
 * Strip everything a platform's filesystem can't store from an imported
 * screenshot's base name, so one name works on every OS. Falls back to a
 * generic slug rather than returning an empty string.
 */
export function sanitizeBaseName(name: string): string {
  const cleaned = [...name]
    .filter((ch) => ch.charCodeAt(0) >= 32 && !WINDOWS_ILLEGAL_FILENAME_CHARS.includes(ch))
    .join('')
    .replace(/[. ]+$/, '')
    .trim()
  return cleaned || 'screenshot'
}

// Write a base64-encoded image (from a modpack import) into the images
// directory, mirroring copyImageToImages' unique-filename scheme and applying
// the same downscaling so the file stays export-safe.
export async function writeScreenshotFromBase64(
  fileName: string | undefined,
  data: string
): Promise<string> {
  // Missing/empty names (older or hand-crafted exports) get a generated one
  // instead of path.basename(undefined) throwing and killing the import.
  const safeName =
    typeof fileName === 'string' && fileName.trim().length > 0
      ? path.basename(fileName)
      : `screenshot-${Date.now()}`
  const ext = path.extname(safeName)
  const { buffer, ext: outExt } = await resizeImageIfNeeded(Buffer.from(data, 'base64'), ext)
  const baseName = ext
    ? sanitizeBaseName(safeName.slice(0, -ext.length))
    : sanitizeBaseName(safeName)
  const uniqueFileName = `${Date.now()}_${baseName}${outExt}`
  const destPath = path.join(IMAGES_DIR, uniqueFileName)

  await fs.ensureDir(IMAGES_DIR)
  await fs.writeFile(destPath, buffer)

  debug(`Screenshot imported to: ${destPath}`)
  return uniqueFileName
}

/**
 * Locate a stored config file by its key (hash or protocolId), regardless of
 * extension — uploads preserve their original extension (.cfg, .ini, .conf,
 * etc.) rather than being forced to .cfg, so lookups need to discover it.
 */
function findConfigFile(key: string): string | null {
  if (!fs.existsSync(CFGS_DIR)) return null
  const match = fs.readdirSync(CFGS_DIR).find((f) => f.startsWith(`${key}.`))
  return match ? path.join(CFGS_DIR, match) : null
}

/**
 * Create a blank, isolated config for a protocol with no originating
 * template — lets a protocol get its own settings even when none of its
 * mod files provided a config template (or the user wants to override one).
 */
export async function createBlankProtocolConfig(
  protocolId: string,
  ext: string = '.cfg'
): Promise<ModProtocolConfig> {
  try {
    initStorage()
    await fs.ensureDir(CFGS_DIR)
    const normalizedExt = ext.startsWith('.') ? ext : `.${ext}`
    const configFile = `${protocolId}${normalizedExt}`
    const dest = path.join(CFGS_DIR, configFile)
    await fs.writeFile(dest, '', 'utf-8')
    debug(`Created blank protocol config: ${dest}`)
    return { configFile }
  } catch (error: unknown) {
    log.error('Error creating blank protocol config:', error)
    throw new Error(
      `Failed to create blank protocol config: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

/**
 * Copy a config template file to a protocol-specific isolated copy.
 *
 * When a protocol is created with mod files that have a configTemplate,
 * this function copies the template into a per-protocol file so each
 * protocol has its own config that users can modify in-game without
 * affecting other protocols.
 */
export async function copyConfigForProtocol(
  templateHash: string,
  protocolId: string
): Promise<ModProtocolConfig> {
  try {
    initStorage()
    const src = findConfigFile(templateHash)
    if (!src) {
      throw new Error(`Config template not found for hash: ${templateHash}`)
    }
    const ext = path.extname(src)
    const configFile = `${protocolId}${ext}`
    const dest = path.join(CFGS_DIR, configFile)

    await fs.copy(src, dest, { overwrite: true })
    debug(`Copied config template ${templateHash} to protocol ${protocolId}`)

    return {
      configFile,
      templateHash
    }
  } catch (error: unknown) {
    log.error('Error copying config for protocol:', error)
    throw new Error(
      `Failed to copy config for protocol: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

/**
 * Read a config file content by hash or protocolId.
 * Returns the raw text content of the config file.
 */
export async function readConfigFileContent(key: string): Promise<string> {
  try {
    initStorage()
    const filePath = findConfigFile(key)
    if (!filePath) {
      throw new Error(`Config file not found for key: ${key}`)
    }
    const content = await fs.readFile(filePath, 'utf-8')
    return content
  } catch (error: unknown) {
    log.error('Error reading config file:', error)
    throw new Error(
      `Failed to read config file: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

/**
 * Write a config file to the cfgs directory (by hash or protocolId).
 * Writes back to whatever extension the file already has; falls back to
 * .cfg only if no file exists yet for this key.
 */
export async function writeConfigFileContent(key: string, content: string): Promise<string> {
  try {
    initStorage()
    const filePath = findConfigFile(key) ?? path.join(CFGS_DIR, `${key}.cfg`)
    await fs.ensureDir(CFGS_DIR)
    await fs.writeFile(filePath, content, 'utf-8')
    debug(`Wrote config file: ${filePath}`)
    return key
  } catch (error: unknown) {
    log.error('Error writing config file:', error)
    throw new Error(
      `Failed to write config file: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

export async function addModFileToCatalog(file: Omit<IModFile, 'id'>): Promise<IModFile> {
  try {
    debug('addModFileToCatalog called with:', file)
    initStorage() // Ensure directories and files exist

    // Read existing catalog
    debug(`Reading catalog from ${MOD_FILE_CATALOG}`)
    let catalog: IModFile[] = []
    if (fs.existsSync(MOD_FILE_CATALOG)) {
      catalog = await fs.readJSON(MOD_FILE_CATALOG)
      debug(`Existing catalog has ${catalog.length} entries`)
    } else {
      debug(`Catalog file doesn't exist, creating new one`)
    }

    if (file.filePath) {
      let relativePath: string
      let hashValue: string
      let originalFileName: string

      // Check if file is already in mods folder (relative path starting with 'files/' or 'files\')
      if (file.filePath.startsWith('files/') || file.filePath.startsWith('files\\')) {
        // File already moved, use as-is
        relativePath = file.filePath
        hashValue = file.hashValue || (await computeFileHash(relativePath))
        originalFileName = file.fileName || path.basename(relativePath)
      } else {
        // Move file to mod folder with hash-based filename
        const moved = await moveToModFolder(file.filePath)
        relativePath = moved.relativePath
        hashValue = moved.hashValue
        originalFileName = file.filePath.split(/[\\/]/).pop() || file.filePath
      }

      // Check for duplicate by hash — if an entry with this hash already exists, return it
      if (hashValue) {
        const existing = catalog.find((entry) => entry.hashValue === hashValue)
        if (existing) {
          debug(`Duplicate file detected by hash ${hashValue}, returning existing entry`)
          return existing
        }
      }

      // Set fileName to the new filename in the mod folder
      const fileName = path.basename(relativePath)
      // Always set name (pretty name), default to original file name if missing
      const name = file.name && file.name.trim() ? file.name : originalFileName
      // Create new catalog entry with an ID
      const createdFile: IModFile = {
        ...file,
        name,
        fileName,
        id: Date.now(),
        hashValue,
        filePath: relativePath, // Use the relative path in mods folder
        loadOrder: file.loadOrder ?? {},
        requiredBy: file.requiredBy ?? [],
        sidecarOnly: file.sidecarOnly ?? false,
        url: file.url ?? '',
        version: file.version ?? ''
      }
      debug('Created new catalog entry:', createdFile)
      // Add to catalog
      catalog.push(createdFile)
      // Save updated catalog
      debug(`Writing updated catalog with ${catalog.length} entries to ${MOD_FILE_CATALOG}`)
      await fs.writeJSON(MOD_FILE_CATALOG, catalog, { spaces: 2 })
      debug(`Catalog file saved successfully`)
      return createdFile
    }
    throw new Error('Invalid file: filePath is required')
  } catch (error: unknown) {
    log.error('Error adding mod file to catalog:', error)
    throw new Error(
      `Failed to add mod file to catalog: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

// Update a mod file in the catalog
export async function updateModFileInCatalog(
  id: number | string,
  updates: Partial<IModFile>
): Promise<IModFile> {
  try {
    const catalog = await getModFileCatalog()
    // Compare as strings to be safe against numeric/string ID mismatches
    const index = catalog.findIndex((f) => String(f.id) === String(id))

    if (index === -1) {
      log.error(
        `[DEBUG] Catalog update failed: Mod file with ID ${id} not found in catalog. Content of catalog IDs:`,
        catalog.map((f) => f.id)
      )
      throw new Error(`Mod file with ID ${id} not found in catalog`)
    }

    const updatedFile = { ...catalog[index], ...updates }
    catalog[index] = updatedFile

    await fs.writeJSON(MOD_FILE_CATALOG, catalog, { spaces: 2 })
    debug(`Successfully updated mod file ${id} in catalog (new name: ${updates.name})`)
    return updatedFile
  } catch (error: unknown) {
    log.error(`Error updating mod file ${id} in catalog:`, error)
    throw new Error(
      `Failed to update mod file: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

export async function deleteModFileFromCatalog(
  fileId: number,
  deleteFile?: boolean
): Promise<boolean> {
  try {
    const catalog = await getModFileCatalog()
    const index = catalog.findIndex((f) => f.id === fileId)
    if (index === -1) {
      throw new Error(`File with ID ${fileId} not found in catalog`)
    }

    const file = catalog[index]

    if (deleteFile && file.filePath) {
      const resolved = resolvePath(file.filePath)
      try {
        await fs.remove(resolved)
        debug(`[storage] Deleted file from disk: ${resolved}`)
      } catch (err: unknown) {
        log.warn(`[storage] Failed to delete file from disk: ${resolved}`, err)
      }
    }

    catalog.splice(index, 1)
    await fs.writeJSON(MOD_FILE_CATALOG, catalog, { spaces: 2 })
    return true
  } catch (error: unknown) {
    log.error('Error deleting file from catalog:', error)
    throw new Error(
      `Failed to delete file from catalog: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}
