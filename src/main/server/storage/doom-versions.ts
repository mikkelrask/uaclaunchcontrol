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
  wadNamePriority,
  computeFileHash
} from './core'
import { isBetterRepresentative, isGeneratedVersionName, resolveWadIdentity } from './wad-identity'
import type { IWadIdentity } from './wad-identity'
import { createLogger } from '@shared/logger'

const log = createLogger('storage/doom-versions')

/** A `.wad` in the WAD directory, with what it turned out to contain. */
interface IScannedWad {
  fileName: string
  filePath: string
  md5: string
  identity: IWadIdentity
}

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
  options: { notifyDelta?: boolean } = {}
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
    // Cleanest names first: the order lists the entries, and breaks ties between
    // equally named copies of the same content.
    const wadFiles = files
      .filter((f) => f.toLowerCase().endsWith('.wad'))
      .sort((a, b) => {
        return wadNamePriority(a) - wadNamePriority(b) || a.localeCompare(b)
      })

    // Identical files are one WAD to the user, so one entry stands for them —
    // the copy named the way the table names it, or the cleanest name otherwise.
    const scanned: IScannedWad[] = []
    const winnerByHash = new Map<string, IScannedWad>()

    for (const wadFile of wadFiles) {
      const wadPath = path.join(wadDir, wadFile)
      // The hash identifies the build; the filename only says what the user (or
      // the installer it came from) happens to call it.
      const md5 = await computeFileHash(wadPath)
      const identity = resolveWadIdentity(wadFile, md5)

      if (!identity.usable) {
        debug(`syncDoomVersions: Skipping add-on WAD, it needs a base game: ${wadPath}`)
        continue
      }

      const file: IScannedWad = { fileName: wadFile, filePath: wadPath, md5, identity }
      scanned.push(file)

      if (!md5) continue
      const winner = winnerByHash.get(md5)
      if (winner && !isBetterRepresentative(wadFile, winner.fileName, identity.fileName)) continue
      winnerByHash.set(md5, file)
    }

    const updatedVersions: IDoomVersion[] = []

    for (const { fileName: wadFile, filePath: wadPath, md5, identity } of scanned) {
      // A copy of a WAD that is already represented doesn't get its own entry.
      if (md5 && winnerByHash.get(md5)?.filePath !== wadPath) {
        debug(`syncDoomVersions: Skipping duplicate WAD content: ${wadPath}`)
        continue
      }

      const iwadArg = escapePathForCmd(wadPath)

      // Check if this wad was already in the list
      const existing = oldVersions.find((v) => v.id === identity.id || v.defaultIwad === wadPath)

      if (existing) {
        // A name the user typed stays; one the app generated is replaced, so
        // better identification reaches configs that already exist.
        const name = isGeneratedVersionName(existing.name, wadFile) ? identity.name : existing.name
        const customIcon = existing.icon.includes('/') || existing.icon.includes('\\')

        updatedVersions.push({
          ...existing,
          name,
          slug: identity.slug,
          icon: customIcon ? existing.icon : identity.icon,
          args: existing.args.includes('-iwad')
            ? existing.args.replace(/-iwad\s+"[^"]+"|-iwad\s+[^\s]+/, `-iwad ${iwadArg}`)
            : `-iwad ${iwadArg} ${existing.args}`.trim(),
          defaultIwad: wadPath
        })
      } else {
        updatedVersions.push({
          id: identity.id,
          name: identity.name,
          slug: identity.slug,
          args: `-iwad ${iwadArg}`,
          icon: identity.icon,
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
