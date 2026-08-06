// Doom version management
import fs from 'fs-extra'
import path from 'path'
import chokidar from 'chokidar'
import { BrowserWindow } from 'electron'
import type { FSWatcher } from 'chokidar'
import type { IDoomVersion } from '@shared/schema'
import { debug } from '@shared/debug'
import { DOOM_VERSIONS_FILE, CONFIG_DIR } from './paths'
import {
  initStorage,
  getSettings,
  resolvePath,
  escapePathForCmd,
  generateStableId,
  stripMd5Suffix,
  wadNamePriority,
  computeFileHash,
  DEFAULT_DOOM_VERSIONS
} from './core'
import { createLogger } from '@shared/logger'

const log = createLogger('storage/doom-versions')

let wadSyncTimer: ReturnType<typeof setTimeout> | null = null
let wadWatcher: FSWatcher | null = null

export function stopWadWatcher(): void {
  if (wadSyncTimer) {
    clearTimeout(wadSyncTimer)
    wadSyncTimer = null
  }
  if (wadWatcher) {
    wadWatcher.close()
    wadWatcher = null
  }
}

export async function startWadWatcher(): Promise<void> {
  debug('startWadWatcher called')
  if (wadWatcher) {
    debug('Watcher already exists, skipping')
    return
  }

  try {
    const settings = await getSettings()
    const rawDir = settings.wadFilesDirectory || path.join(CONFIG_DIR, 'wads')
    const wadDir = resolvePath(rawDir)
    debug(`Watcher starting for directory: ${wadDir} (from raw: ${rawDir})`)

    try {
      fs.ensureDirSync(wadDir)
    } catch (error: unknown) {
      log.error(`Failed to ensure directory ${wadDir}:`, error)
      return
    }

    wadWatcher = chokidar.watch(wadDir, {
      persistent: true,
      ignoreInitial: true,
      usePolling: true,
      interval: 100
    })

    wadWatcher.on('all', (event, filePath) => {
      if (filePath.toLowerCase().endsWith('.wad')) {
        // Debounce: coalesce rapid events (common with polling) into one sync
        if (wadSyncTimer) {
          clearTimeout(wadSyncTimer)
        }
        wadSyncTimer = setTimeout(() => {
          wadSyncTimer = null
          debug(`WAD change detected (${event}): ${filePath}. Syncing...`)
          syncDoomVersions({ notifyDelta: true })
        }, 500)
      }
    })

    wadWatcher.on('error', (error) => {
      log.error(`[DEBUG] Chokidar watcher error:`, error)
    })

    debug(`Started WAD watcher on ${wadDir}`)
  } catch (err: unknown) {
    log.error('[DEBUG] Error starting WAD watcher:', err)
  }
}

// Sync Doom versions by scanning the WAD directory
export async function syncDoomVersions(
  options: { notifyDelta?: boolean; skipHash?: boolean } = {}
): Promise<IDoomVersion[]> {
  try {
    initStorage()
    debug('syncDoomVersions starting...')
    const settings = await getSettings()
    const wadDir = resolvePath(settings.wadFilesDirectory || path.join(CONFIG_DIR, 'wads'))

    // Load existing versions to detect changes
    const oldVersions: IDoomVersion[] = await fs.readJSON(DOOM_VERSIONS_FILE).catch(() => [])

    await fs.ensureDir(wadDir)
    const files = await fs.readdir(wadDir)
    const wadFiles = files
      .filter((f) => f.toLowerCase().endsWith('.wad'))
      .sort((a, b) => {
        return wadNamePriority(a) - wadNamePriority(b) || a.localeCompare(b)
      })

    // Create a map of lowercase wad names to full paths
    const wadFileMap = new Map<string, string>()
    for (const wadFile of wadFiles) {
      wadFileMap.set(wadFile.toLowerCase(), path.join(wadDir, wadFile))
    }

    const updatedVersions: IDoomVersion[] = []
    const seenWadHashes = new Set<string>()

    // 1. Check default versions
    for (const def of DEFAULT_DOOM_VERSIONS) {
      const lowerWadName = def.defaultIwad.toLowerCase()
      if (wadFileMap.has(lowerWadName)) {
        const fullPath = wadFileMap.get(lowerWadName)!
        // Only hash on non-initial runs — dedup is a nice-to-have, not a startup blocker
        let hashValue = ''
        if (!options.skipHash) {
          hashValue = await computeFileHash(fullPath)
          if (hashValue) {
            seenWadHashes.add(hashValue)
          }
        }
        // Find existing to preserve custom settings like name/icon overrides if any
        // Note: traditionally defaults use their own defaults, but we should check
        const existing = oldVersions.find((v) => v.id === def.id)

        if (existing) {
          updatedVersions.push({
            ...existing,
            defaultIwad: fullPath, // Update actual path
            args: existing.args.includes('-iwad')
              ? existing.args.replace(
                  /-iwad\s+"[^"]+"|-iwad\s+[^\s]+/,
                  `-iwad ${escapePathForCmd(fullPath)}`
                )
              : `-iwad ${escapePathForCmd(fullPath)} ${existing.args}`.trim()
          })
        } else {
          updatedVersions.push({
            ...def,
            args: `-iwad ${escapePathForCmd(fullPath)}`,
            defaultIwad: fullPath
          })
        }
        wadFileMap.delete(lowerWadName) // Mark as handled
      }
    }

    // 2. Add remaining WADs from disk
    for (const [wadName, wadPath] of wadFileMap) {
      let hashValue = ''
      if (!options.skipHash) {
        hashValue = await computeFileHash(wadPath)
        if (hashValue && seenWadHashes.has(hashValue)) {
          debug(`syncDoomVersions: Skipping duplicate WAD content: ${wadPath}`)
          continue
        }
        if (hashValue) {
          seenWadHashes.add(hashValue)
        }
      }

      const baseName = wadName.replace(/\.wad$/i, '')
      const displayName = stripMd5Suffix(baseName)
      const id = generateStableId(baseName)

      // Check if this wad was already in the list
      const existing = oldVersions.find((v) => v.id === id || v.defaultIwad === wadPath)

      if (existing) {
        updatedVersions.push({
          ...existing,
          args: existing.args.includes('-iwad')
            ? existing.args.replace(
                /-iwad\s+"[^"]+"|-iwad\s+[^\s]+/,
                `-iwad ${escapePathForCmd(wadPath)}`
              )
            : `-iwad ${escapePathForCmd(wadPath)} ${existing.args}`.trim(),
          defaultIwad: wadPath
        })
      } else {
        updatedVersions.push({
          id,
          name: displayName,
          slug: id,
          args: `-iwad ${escapePathForCmd(wadPath)}`,
          icon: '',
          parameters: '',
          defaultIwad: wadPath
        })
      }
    }

    await fs.writeJSON(DOOM_VERSIONS_FILE, updatedVersions, { spaces: 2 })
    debug(`syncDoomVersions: Synced ${updatedVersions.length} versions to ${DOOM_VERSIONS_FILE}`)

    // Prepare resolved versions for the UI
    const resolvedVersions = updatedVersions.map((v) => ({
      ...v,
      icon: v.icon ? resolvePath(v.icon) : v.icon,
      defaultIwad: v.defaultIwad ? resolvePath(v.defaultIwad) : v.defaultIwad
    }))

    // Calculate changes if notification is requested
    let delta = {}
    if (options.notifyDelta) {
      const oldIds = new Set(oldVersions.map((v) => v.id))
      const newIds = new Set(resolvedVersions.map((v) => v.id))
      const added = resolvedVersions.filter((v) => !oldIds.has(v.id))
      const removed = oldVersions
        .map((v) => ({
          ...v,
          icon: v.icon ? resolvePath(v.icon) : v.icon,
          defaultIwad: v.defaultIwad ? resolvePath(v.defaultIwad) : v.defaultIwad
        }))
        .filter((v) => !newIds.has(v.id))
      delta = { added, removed }
    }

    // Notify all windows that versions have been updated
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send('doom-versions-updated', delta)
    })

    return resolvedVersions
  } catch (error: unknown) {
    log.error('Error syncing Doom versions:', error)
    return []
  }
}

// Get all Doom versions
export async function getDoomVersions(): Promise<IDoomVersion[]> {
  try {
    initStorage() // Ensure file exists
    if (!fs.existsSync(DOOM_VERSIONS_FILE)) {
      await syncDoomVersions()
    }
    const versions: IDoomVersion[] = await fs.readJSON(DOOM_VERSIONS_FILE)
    // Resolve tildes before sending to renderer
    const resolved = versions.map((v) => ({
      ...v,
      icon: v.icon ? resolvePath(v.icon) : v.icon,
      defaultIwad: v.defaultIwad ? resolvePath(v.defaultIwad) : v.defaultIwad
    }))
    debug('getDoomVersions: Returning resolved versions:', resolved.length)
    return resolved
  } catch (error: unknown) {
    log.error('Error getting Doom versions:', error)
    return [] // Return empty array on error
  }
}

// Get a specific Doom version by slug
export async function getDoomVersionBySlug(slug: string): Promise<IDoomVersion | undefined> {
  try {
    const versions = await getDoomVersions()
    return versions.find((v) => v.slug === slug)
  } catch (error: unknown) {
    log.error(`Error getting Doom version by slug ${slug}:`, error)
    return undefined
  }
}

// Save all Doom versions (overwrites the file with current state)
export async function saveDoomVersions(versions: IDoomVersion[]): Promise<void> {
  try {
    initStorage() // Ensure file exists
    await fs.writeJSON(DOOM_VERSIONS_FILE, versions, { spaces: 2 })
    debug('Saved doom versions to', DOOM_VERSIONS_FILE)

    // Notify all windows that versions have been updated
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send('doom-versions-updated')
    })
  } catch (error: unknown) {
    log.error('Error saving Doom versions:', error)
    throw new Error(
      `Failed to save Doom versions: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}
