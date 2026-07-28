import path from 'path'
import os from 'os'
import crypto from 'crypto'
import fs from 'fs-extra'
import AdmZip from 'adm-zip'

const CONFIG_DIR = path.join(os.homedir(), '.config', 'uac')

const FREEDOOM_MANIFEST_URL = 'https://freedoom.github.io/download.json'

export type FreedoomWadKey = 'freedoom1.wad' | 'freedoom2.wad' | 'freedm.wad'

export interface FreedoomManifestEntry {
  description: string
  name: string
  url: string
  version: string
  md5: string
  sha1: string
  sha256: string
}

export type FreedoomManifest = Record<FreedoomWadKey, FreedoomManifestEntry>

export type FreedoomBundleId = 'phase12' | 'freedm'

const BUNDLE_WAD_KEYS: Record<FreedoomBundleId, FreedoomWadKey[]> = {
  phase12: ['freedoom1.wad', 'freedoom2.wad'],
  freedm: ['freedm.wad']
}

const REQUIRED_KEYS: FreedoomWadKey[] = ['freedoom1.wad', 'freedoom2.wad', 'freedm.wad']

/** Validates the manifest has all 3 required keys, each with a url + sha256. */
export function isValidFreedoomManifest(json: unknown): json is FreedoomManifest {
  if (!json || typeof json !== 'object') return false
  const obj = json as Record<string, unknown>
  return REQUIRED_KEYS.every((key) => {
    const entry = obj[key]
    return (
      !!entry &&
      typeof entry === 'object' &&
      typeof (entry as FreedoomManifestEntry).url === 'string' &&
      typeof (entry as FreedoomManifestEntry).sha256 === 'string'
    )
  })
}

export async function getFreedoomManifest(): Promise<FreedoomManifest> {
  const response = await fetch(FREEDOOM_MANIFEST_URL, {
    headers: { 'User-Agent': 'UACLaunchControl/1.0' }
  })
  if (!response.ok) {
    throw new Error(
      `Failed to fetch FreeDoom manifest: HTTP ${response.status} ${response.statusText}`
    )
  }
  const json = await response.json()
  if (!isValidFreedoomManifest(json)) {
    throw new Error('FreeDoom manifest has an unexpected shape')
  }
  return json
}

/**
 * Case-insensitively matches extracted filenames against the wad keys a
 * bundle expects. Returns a map of wad key -> matched full path, for keys
 * that were actually found among the extracted files.
 */
export function matchExtractedWadFiles(
  extractedFiles: { name: string; path: string }[],
  wadKeys: FreedoomWadKey[]
): Partial<Record<FreedoomWadKey, string>> {
  const result: Partial<Record<FreedoomWadKey, string>> = {}
  for (const key of wadKeys) {
    const match = extractedFiles.find((f) => f.name.toLowerCase() === key)
    if (match) result[key] = match.path
  }
  return result
}

async function downloadFile(url: string, destPath: string): Promise<void> {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'UACLaunchControl/1.0' }
  })
  if (!response.ok) {
    throw new Error(`Download failed: HTTP ${response.status} ${response.statusText}`)
  }
  const buffer = Buffer.from(await response.arrayBuffer())
  await fs.writeFile(destPath, buffer)
}

function sha256File(filePath: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const hash = crypto.createHash('sha256')
    const stream = fs.createReadStream(filePath)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('error', reject)
    stream.on('end', () => resolve(hash.digest('hex')))
  })
}

/** Recursively lists every file under dir (zip archives may nest a top-level folder). */
async function listFilesRecursive(dir: string): Promise<{ name: string; path: string }[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const results: { name: string; path: string }[] = []
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...(await listFilesRecursive(fullPath)))
    } else if (entry.isFile()) {
      results.push({ name: entry.name, path: fullPath })
    }
  }
  return results
}

/**
 * Downloads a FreeDoom bundle (Phase 1+2, or FreeDM), verifies each
 * extracted WAD's sha256 against the manifest, and writes it into
 * `wadFilesDirectory` under its exact literal manifest-key filename —
 * required for storage.ts's syncDoomVersions() to auto-activate the
 * matching DEFAULT_DOOM_VERSIONS entry (it matches by exact filename).
 */
export async function downloadFreedoomBundle(
  wadFilesDirectory: string,
  bundle: FreedoomBundleId
): Promise<{ installed: FreedoomWadKey[] }> {
  const wadKeys = BUNDLE_WAD_KEYS[bundle]
  const manifest = await getFreedoomManifest()
  const url = manifest[wadKeys[0]].url

  const workDir = path.join(CONFIG_DIR, 'freedoom', bundle)
  const zipPath = path.join(workDir, 'download.zip')
  const extractDir = path.join(workDir, 'extract')

  await fs.remove(workDir).catch(() => {})
  await fs.ensureDir(workDir)

  try {
    await downloadFile(url, zipPath)

    const zip = new AdmZip(zipPath)
    zip.extractAllTo(extractDir, true)

    const extractedFiles = await listFilesRecursive(extractDir)
    const matched = matchExtractedWadFiles(extractedFiles, wadKeys)

    const missing = wadKeys.filter((key) => !matched[key])
    if (missing.length > 0) {
      throw new Error(`FreeDoom archive did not contain expected file(s): ${missing.join(', ')}`)
    }

    const installed: FreedoomWadKey[] = []
    await fs.ensureDir(wadFilesDirectory)

    for (const key of wadKeys) {
      const extractedPath = matched[key]!
      const actualSha256 = await sha256File(extractedPath)
      const expectedSha256 = manifest[key].sha256
      if (actualSha256 !== expectedSha256) {
        throw new Error(
          `Checksum mismatch for ${key}: expected ${expectedSha256}, got ${actualSha256}`
        )
      }
      await fs.copy(extractedPath, path.join(wadFilesDirectory, key), { overwrite: true })
      installed.push(key)
    }

    return { installed }
  } finally {
    await fs.remove(workDir).catch(() => {})
  }
}
