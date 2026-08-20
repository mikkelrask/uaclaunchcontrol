import path from 'path'
import os from 'os'
import fs from 'fs-extra'
import { existsSync } from 'fs'
import { execSync } from 'child_process'
import AdmZip from 'adm-zip'
import { createLogger } from '@shared/logger'

const log = createLogger('portService')
const CONFIG_DIR = path.join(os.homedir(), '.config', 'uac')

export interface ReleaseAsset {
  name: string
  size: number
  url: string
}

export interface PortRelease {
  repo: string
  tag: string
  version: string
  prerelease: boolean
  publishedAt: string
  asset: ReleaseAsset
}

export interface DownloadResult {
  executablePath: string
  name: string
  family: string
  version: string
}

export interface GitHubAsset {
  name: string
  size: number
  browser_download_url: string
}

interface GitHubRelease {
  tag_name: string
  name: string
  prerelease: boolean
  published_at: string
  assets: GitHubAsset[]
}

// Platform detection
const PLATFORM = process.platform
const isWindows = PLATFORM === 'win32'
const isMac = PLATFORM === 'darwin'
const isLinux = PLATFORM === 'linux'

// ── Asset picking ──────────────────────────────────────

function pickAsset(
  assets: GitHubAsset[],
  patterns: { match: (name: string) => boolean; rank: number }[]
): GitHubAsset | null {
  let best: GitHubAsset | null = null
  let bestRank = -1

  for (const asset of assets) {
    for (const pattern of patterns) {
      if (pattern.match(asset.name) && pattern.rank > bestRank) {
        best = asset
        bestRank = pattern.rank
        break
      }
    }
  }

  return best
}

export function pickGzdoomAsset(assets: GitHubAsset[]): GitHubAsset | null {
  if (isWindows) {
    return pickAsset(assets, [
      // GZDoom names builds both gzdoom-windows.zip and gzdoom-4-x-x-Windows-64bit.zip;
      // the .7z assets are PDB symbol archives, never the build.
      { match: (n) => /windows.*\.zip$/i.test(n) && !/pdb/i.test(n), rank: 10 },
      { match: (n) => /windows/i.test(n) && !/pdb/i.test(n), rank: 5 }
    ])
  }
  if (isMac) {
    return pickAsset(assets, [
      { match: (n) => /macos\.zip$/i.test(n), rank: 10 },
      { match: (n) => /macos/i.test(n), rank: 5 }
    ])
  }
  if (isLinux) {
    return pickAsset(assets, [
      { match: (n) => /\.tar\.xz$/i.test(n) && /linux.*portable/i.test(n), rank: 12 },
      { match: (n) => /\.AppImage$/i.test(n) || /\.AppImage\.zip$/i.test(n), rank: 10 },
      { match: (n) => /\.tar\.xz$/i.test(n), rank: 8 },
      { match: (n) => /linux.*portable/i.test(n), rank: 6 }
    ])
  }
  return null
}

export function pickHelionAsset(assets: GitHubAsset[]): GitHubAsset | null {
  if (isWindows) {
    return pickAsset(assets, [
      { match: (n) => /win-x64_AOT\.zip$/i.test(n), rank: 10 },
      { match: (n) => /win-x64_SelfContained\.zip$/i.test(n), rank: 8 },
      { match: (n) => /\.zip$/i.test(n) && /win/i.test(n), rank: 5 }
    ])
  }
  if (isMac) {
    // No macOS builds for Helion
    return null
  }
  if (isLinux) {
    return pickAsset(assets, [
      { match: (n) => /\.AppImage$/i.test(n), rank: 10 },
      { match: (n) => /linux-x64_AOT\.zip$/i.test(n), rank: 9 },
      { match: (n) => /linux-x64_SelfContained\.zip$/i.test(n), rank: 7 },
      { match: (n) => /linux/i.test(n), rank: 5 }
    ])
  }
  return null
}

export function pickUzdoomAsset(assets: GitHubAsset[]): GitHubAsset | null {
  if (isWindows) {
    return pickAsset(assets, [
      { match: (n) => /^Windows-.*\.zip$/i.test(n), rank: 10 },
      { match: (n) => /windows.*\.zip$/i.test(n), rank: 8 },
      { match: (n) => /\.zip$/i.test(n) && /windows/i.test(n), rank: 5 }
    ])
  }
  if (isMac) {
    return pickAsset(assets, [
      { match: (n) => /^mac[so]{0,2}-.*\.(zip|dmg)$/i.test(n), rank: 10 },
      { match: (n) => /^MacOS-.*\.(zip|dmg)$/i.test(n), rank: 9 },
      { match: (n) => /macos.*\.zip$/i.test(n), rank: 8 },
      { match: (n) => /mac/i.test(n), rank: 5 }
    ])
  }
  if (isLinux) {
    return pickAsset(assets, [
      { match: (n) => /^Linux-UZDoom-(?!Legacy).*\.AppImage$/i.test(n), rank: 10 },
      { match: (n) => /^Linux-.*\.AppImage$/i.test(n), rank: 8 },
      { match: (n) => /\.AppImage$/i.test(n), rank: 5 }
    ])
  }
  return null
}

// ── GitHub API ─────────────────────────────────────────

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || ''
const GITHUB_HEADERS: Record<string, string> = {
  Accept: 'application/vnd.github.v3+json',
  'User-Agent': 'UACLaunchControl/1.0',
  ...(GITHUB_TOKEN ? { Authorization: `Bearer ${GITHUB_TOKEN}` } : {})
}

// Cache releases for the lifetime of the process (no point re-fetching)
let cachedReleases: PortRelease[] | null = null

async function fetchRepoReleases(
  owner: string,
  repo: string,
  picker: (assets: GitHubAsset[]) => GitHubAsset | null
): Promise<PortRelease[]> {
  const url = `https://api.github.com/repos/${owner}/${repo}/releases?per_page=30`
  const res = await fetch(url, { headers: GITHUB_HEADERS })
  if (!res.ok) {
    const rateMsg =
      res.status === 403 || res.status === 429
        ? ' — rate limited. Set GITHUB_TOKEN env var for 5000 req/hr.'
        : ''
    log.warn(`[ports] GitHub API returned ${res.status} for ${owner}/${repo}${rateMsg}`)
    return []
  }
  const releases: GitHubRelease[] = await res.json()

  return releases
    .map((r) => {
      const asset = picker(r.assets)
      if (!asset) return null
      return {
        repo: `${owner}/${repo}`,
        tag: r.tag_name,
        version: r.name || r.tag_name,
        prerelease: r.prerelease,
        publishedAt: r.published_at,
        asset: {
          name: asset.name,
          size: asset.size,
          url: asset.browser_download_url
        }
      }
    })
    .filter((r): r is PortRelease => r !== null)
}

export async function getPortReleases(): Promise<PortRelease[]> {
  // Return cached data from this session
  if (cachedReleases) return cachedReleases

  const [uzdoom, gzdoom, helion] = await Promise.all([
    fetchRepoReleases('UZDoom', 'UZDoom', pickUzdoomAsset),
    fetchRepoReleases('ZDoom', 'gzdoom', pickGzdoomAsset),
    fetchRepoReleases('Helion-Engine', 'Helion', pickHelionAsset)
  ])

  const result: PortRelease[] = [
    ...uzdoom.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)),
    ...gzdoom.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)),
    ...helion.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
  ]

  cachedReleases = result
  return result
}

// ── Download + extraction ──────────────────────────────

export async function downloadPortRelease(
  downloadUrl: string,
  assetName: string,
  family: string,
  version: string
): Promise<DownloadResult> {
  const portsDir = path.join(CONFIG_DIR, 'ports')
  const safeName = `${family}-${version.replace(/[^a-zA-Z0-9._-]/g, '_')}`
  const destDir = path.join(portsDir, safeName)
  const downloadPath = path.join(portsDir, assetName)

  await fs.ensureDir(portsDir)

  // Download
  await downloadFile(downloadUrl, downloadPath)

  let executablePath: string

  if (assetName.endsWith('.AppImage')) {
    // AppImage — just make executable and move
    await fs.move(downloadPath, path.join(destDir, assetName), { overwrite: true })
    executablePath = path.join(destDir, assetName)
    await fs.chmod(executablePath, 0o755)
  } else if (assetName.endsWith('.tar.xz') || assetName.endsWith('.tar.gz')) {
    executablePath = await extractTar(downloadPath, destDir, family)
    await fs.remove(downloadPath).catch(() => {})
  } else if (assetName.endsWith('.deb')) {
    executablePath = await extractDeb(downloadPath, destDir, family)
    await fs.remove(downloadPath).catch(() => {})
  } else if (assetName.endsWith('.zip')) {
    executablePath = await extractZip(downloadPath, destDir, family)
    await fs.remove(downloadPath).catch(() => {})
  } else if (assetName.endsWith('.dmg')) {
    if (!isMac) throw new Error('DMG files are only supported on macOS')
    executablePath = await extractDmg(downloadPath, destDir, family)
    await fs.remove(downloadPath).catch(() => {})
  } else {
    // Standalone executable
    await fs.move(downloadPath, path.join(destDir, assetName), { overwrite: true })
    executablePath = path.join(destDir, assetName)
    if (!isWindows) await fs.chmod(executablePath, 0o755)
  }

  const familyLabel = family === 'gzdoom' ? 'GZDoom' : family === 'uzdoom' ? 'UZDoom' : 'Helion'
  const displayName = `${familyLabel} ${version.replace(/^g/i, '').replace(/^[vV]/, '')}`

  return { executablePath, name: displayName, family, version }
}

// ── Download (uses fetch which handles GitHub CDN redirects properly) ──

async function downloadFile(url: string, destPath: string): Promise<number> {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'UACLaunchControl/1.0' }
  })

  if (!response.ok) {
    throw new Error(`Download failed: HTTP ${response.status} ${response.statusText}`)
  }

  const totalSize = parseInt(response.headers.get('content-length') || '0', 10)

  // Write the whole response at once — reliable, files are ~20-50 MB
  const buffer = Buffer.from(await response.arrayBuffer())
  await fs.writeFile(destPath, buffer)

  return totalSize || buffer.length
}

// ── tar.xz / tar.gz extraction ─────────────────────────
// GZDoom older releases ship portable .tar.xz bundles for Linux.

async function extractTar(tarPath: string, destDir: string, family: string): Promise<string> {
  const tempDir = path.join(destDir, '_extract')
  await fs.ensureDir(tempDir)

  // tar auto-detects xz/gz/bzip2 compression
  execSync(`tar xf "${tarPath}"`, { cwd: tempDir, stdio: 'pipe' })

  // Walk extracted tree looking for the binary
  const possibleNames = isWindows
    ? [`${family}.exe`, 'gzdoom.exe', 'uzdoom.exe']
    : [family, 'gzdoom', 'uzdoom']

  const walkDir = (dir: string): string | null => {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          const found = walkDir(fullPath)
          if (found) return found
        } else if (entry.isFile()) {
          const lower = entry.name.toLowerCase()
          if (possibleNames.includes(lower) || possibleNames.some((n) => lower.includes(n))) {
            return fullPath
          }
        }
      }
    } catch {
      /* empty */
    }
    return null
  }

  const binPath = walkDir(tempDir)
  if (!binPath) {
    throw new Error(`Could not find ${family} binary in extracted archive`)
  }

  const binName = path.basename(binPath)
  const ext = path.extname(binName)
  const destName = ext && ['.exe', '.AppImage'].includes(ext) ? binName : family
  const exeDest = path.join(destDir, destName)

  await fs.move(binPath, exeDest, { overwrite: true })
  await fs.chmod(exeDest, 0o755)

  // Cleanup
  await fs.remove(tempDir).catch(() => {})

  return exeDest
}

// ── .deb extraction ────────────────────────────────────

async function extractDeb(debPath: string, destDir: string, family: string): Promise<string> {
  await fs.ensureDir(destDir)
  const tempDir = path.join(destDir, '_extract')

  try {
    // Validate .deb by checking ar magic bytes: "!<arch>\n"
    const fd = fs.openSync(debPath, 'r')
    const magic = Buffer.alloc(8)
    fs.readSync(fd, magic, 0, 8, 0)
    fs.closeSync(fd)
    if (magic.toString() !== '!<arch>\n') {
      // Corrupted — remove and throw
      await fs.remove(debPath).catch(() => {})
      throw new Error('Downloaded file is corrupted or not a valid .deb package')
    }

    await fs.ensureDir(tempDir)

    // Extract the .deb (ar archive) to get data.tar.*
    execSync(`ar x "${debPath}"`, { cwd: tempDir, stdio: 'pipe' })

    const dataArchives = fs.readdirSync(tempDir).filter((f) => f.startsWith('data.tar.'))
    if (dataArchives.length === 0) throw new Error('No data.tar.* found in .deb')

    // Extract data.tar.* — try zstd flag as well (tar ≥1.34 auto-detects, older needs --zstd)
    const dataPath = path.join(tempDir, dataArchives[0])
    try {
      execSync(`tar xf "${dataPath}" -C "${tempDir}"`, { stdio: 'pipe' })
    } catch {
      execSync(`tar --zstd xf "${dataPath}" -C "${tempDir}"`, { stdio: 'pipe' })
    }

    // Search for the binary in likely locations
    // Prefer opt/ over usr/games/ — usr/games/gzdoom is often a shell script
    // wrapper that references /opt/gzdoom/gzdoom, not the real binary.
    const searchDirs = [
      path.join(tempDir, 'opt', family),
      path.join(tempDir, 'opt', 'gzdoom'),
      path.join(tempDir, 'opt', 'uzdoom'),
      path.join(tempDir, 'opt', 'helion'),
      path.join(tempDir, 'usr', 'bin'),
      path.join(tempDir, 'usr', 'games')
    ]

    let binSrc = ''
    let binName = ''

    for (const dir of searchDirs) {
      if (!existsSync(dir)) continue
      const files = fs.readdirSync(dir)
      const found = files.find(
        (f) => !f.includes('.') || f.endsWith('.exe') // no extension or .exe
      )
      // Prefer a file whose name matches the family
      const preferred = files.find((f) => f.toLowerCase().includes(family))
      if (preferred) {
        binSrc = path.join(dir, preferred)
        binName = preferred
        break
      }
      if (found) {
        binSrc = path.join(dir, found)
        binName = found
      }
    }

    if (!binSrc) {
      // Broader search
      const walk = (dir: string): string | null => {
        try {
          for (const entry of fs.readdirSync(dir)) {
            const full = path.join(dir, entry)
            if (fs.statSync(full).isDirectory()) {
              const found = walk(full)
              if (found) return found
            } else if (entry.toLowerCase().includes(family) && !entry.endsWith('.so')) {
              return full
            } else if (
              entry.toLowerCase() === 'gzdoom' ||
              entry.toLowerCase() === 'uzdoom' ||
              entry.toLowerCase() === 'helion'
            ) {
              return full
            }
          }
        } catch {
          /* empty */
        }
        return null
      }
      const walked = walk(tempDir)
      if (!walked) throw new Error('Could not find binary in extracted .deb')
      binSrc = walked
      binName = path.basename(walked)
    }

    // Copy the binary to destDir
    const destBin = path.join(destDir, binName)
    await fs.copy(binSrc, destBin)
    await fs.chmod(destBin, 0o755)

    // Copy supporting files from opt/gzdoom/* alongside the binary
    // (gzdoom.pk3, brightmaps.pk3, libzmusic.so.1, etc.)
    for (const candidateDir of ['opt/gzdoom', 'opt/uzdoom', 'opt/helion']) {
      const dir = path.join(tempDir, candidateDir)
      if (!existsSync(dir)) continue
      const files = fs.readdirSync(dir)
      for (const f of files) {
        const src = path.join(dir, f)
        if (f === binName) continue
        if (fs.statSync(src).isFile()) {
          await fs.copy(src, path.join(destDir, f)).catch(() => {})
        }
      }
    }

    // Also check usr/share/<family> for .pk3
    const shareDir = path.join(tempDir, 'usr', 'share', family)
    if (existsSync(shareDir)) {
      for (const f of fs.readdirSync(shareDir)) {
        if (f.endsWith('.pk3')) {
          await fs.copy(path.join(shareDir, f), path.join(destDir, f)).catch(() => {})
        }
      }
    }

    await fs.remove(tempDir)
    return destBin
  } catch (err: unknown) {
    await fs.remove(tempDir).catch(() => {})
    throw new Error(`Failed to extract .deb: ${err instanceof Error ? err.message : String(err)}`)
  }
}

// ── .zip extraction (adm-zip) ──────────────────────────

async function extractZip(zipPath: string, destDir: string, family: string): Promise<string> {
  await fs.ensureDir(destDir)

  const zip = new AdmZip(zipPath)
  zip.extractAllTo(destDir, true)

  // Find the executable
  const possibleNames = isWindows
    ? [`${family}.exe`, 'gzdoom.exe', 'uzdoom.exe']
    : [family, 'gzdoom', 'uzdoom']

  const walkDir = async (dir: string): Promise<string | null> => {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        const found = await walkDir(fullPath)
        if (found) return found
      } else if (entry.isFile()) {
        const lower = entry.name.toLowerCase()
        if (possibleNames.includes(lower) || possibleNames.some((n) => lower.includes(n))) {
          if (!isWindows) await fs.chmod(fullPath, 0o755)
          return fullPath
        }
      }
    }
    return null
  }

  const found = await walkDir(destDir)
  if (found) return found
  throw new Error(`Could not find ${family} executable in extracted zip`)
}

// ── .dmg extraction (macOS only) ───────────────────────

async function extractDmg(dmgPath: string, destDir: string, family: string): Promise<string> {
  const result = execSync(`hdiutil attach -nobrowse -readonly "${dmgPath}"`, { encoding: 'utf8' })
  const lines = result.trim().split('\n')
  const mountPoint = lines[lines.length - 1].trim().split(/\s+/).pop()!

  try {
    await fs.ensureDir(destDir)
    const appFiles = fs.readdirSync(mountPoint).filter((f) => f.endsWith('.app'))
    if (appFiles.length === 0) throw new Error('No .app bundle found in DMG')

    const appPath = path.join(mountPoint, appFiles[0])
    const macosDir = path.join(appPath, 'Contents', 'MacOS')
    const binFiles = fs.readdirSync(macosDir)
    const binName = binFiles.find((f) => f.toLowerCase().includes(family)) || binFiles[0]

    await fs.copy(appPath, path.join(destDir, appFiles[0]))
    return path.join(destDir, appFiles[0], 'Contents', 'MacOS', binName)
  } finally {
    try {
      execSync(`hdiutil detach "${mountPoint}"`, { stdio: 'pipe' })
    } catch {
      // Best-effort detach
    }
  }
}
