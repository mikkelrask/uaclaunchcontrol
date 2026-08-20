// In-app mod downloads — GitHub release-asset and ModDB start-page links are
// downloaded inside the app and added to the mod file catalog. Every other
// link keeps the external-browser behavior (router lives in src/main/index.ts).
import {
  BrowserWindow,
  ipcMain,
  session,
  shell,
  webContents as webContentsRegistry,
  type DownloadItem,
  type WebContents
} from 'electron'
import { randomUUID } from 'crypto'
import path from 'path'
import fs from 'fs-extra'
import { CONFIG_DIR } from '../storage/paths'
import { getFileType } from '../storage/archive-io'
import { getModFileCatalog, addModFileToCatalog } from '../storage/mod-catalog'
import { computeFileHashOrThrow, getSettings } from '../storage/core'
import { REGISTRY_API_URL } from '@shared/registry-config'
import type { ModDownloadEvent } from '@shared/modDownload'
import { debug } from '@shared/debug'
import { createLogger } from '@shared/logger'

const log = createLogger('modDownload')

const DOWNLOADS_DIR = path.join(CONFIG_DIR, 'downloads')
const GITHUB_RELEASE_RE = /^\/[^/]+\/[^/]+\/releases\/download\//
const MODDB_START_RE = /^\/(?:downloads|addons)\/start\//
const REGISTRY_LOOKUP_TIMEOUT_MS = 5000

/** Registry mod shape — mirrors the renderer's IRegistryMod (api.ts). */
interface RegistryMod {
  family_name: string
  display_name?: string
  version: string
  category: string | null
  urls?: { url: string; domain: string }[]
}

/**
 * A registry family (e.g. "The Abyssal Crown") can bundle several distinct
 * files (e.g. "Abyssal Core", "Abyssal Crown"), each with its own
 * display_name. Using family_name alone as every file's display name makes
 * sibling files indistinguishable in the UI — so whenever a file's
 * display_name differs from its family_name, show both.
 */
function formatRegistryName(familyName: string, displayName?: string | null): string {
  if (displayName && displayName !== familyName) {
    return `${familyName} (${displayName})`
  }
  return familyName
}

/** Prefer the ModDB mirror for a mod's download, else the first URL listed. */
function pickBestUrl(urls: { url: string; domain: string }[] | undefined): string {
  if (!urls || urls.length === 0) return ''
  if (urls.length === 1) return urls[0].url
  const moddb = urls.find((u) => u.domain.includes('moddb.com'))
  return moddb ? moddb.url : urls[0].url
}

/**
 * Best-effort registry enrichment for a downloaded file: exact hash lookup
 * first, then (when the hash misses — e.g. a release asset was re-uploaded
 * with different bytes while the registry still keys the entry by the
 * original hash) an exact download-URL lookup, which is the stable identity.
 */
async function lookupRegistryMod(hash: string, sourceUrl?: string): Promise<RegistryMod | null> {
  try {
    const settings = await getSettings()
    if (!settings.registryLookupEnabled) return null
    const byHash = await fetch(`${REGISTRY_API_URL}/mod/${hash}`, {
      signal: AbortSignal.timeout(REGISTRY_LOOKUP_TIMEOUT_MS)
    })
    if (byHash.ok) return (await byHash.json()) as RegistryMod
    if (sourceUrl) {
      const byUrl = await fetch(
        `${REGISTRY_API_URL}/api/mods/by-url?url=${encodeURIComponent(sourceUrl)}`,
        { signal: AbortSignal.timeout(REGISTRY_LOOKUP_TIMEOUT_MS) }
      )
      if (byUrl.ok) return (await byUrl.json()) as RegistryMod
    }
    return null
  } catch (err: unknown) {
    log.error('Registry lookup failed for', hash, err)
    return null
  }
}
const GITHUB_GUARD_MS = 30_000 // release URL never fires a download (e.g. 404) → fallback
const MODDB_GUARD_MS = 45_000 // ModDB countdown + page load budget → fallback

/** GitHub release-asset URLs: github.com/<owner>/<repo>/releases/download/<tag>/<asset> */
export function isGithubReleaseAsset(url: URL): boolean {
  const host = url.hostname.toLowerCase()
  return (
    (host === 'github.com' || host === 'www.github.com') && GITHUB_RELEASE_RE.test(url.pathname)
  )
}

/** ModDB download start pages: moddb.com/downloads/start/<id> and addons/start/<id> */
export function isModdbStartPage(url: URL): boolean {
  const host = url.hostname.toLowerCase()
  return (host === 'moddb.com' || host === 'www.moddb.com') && MODDB_START_RE.test(url.pathname)
}

interface DownloadTask {
  id: string
  url: string
  source: 'github' | 'moddb'
  window?: BrowserWindow
  childWebContentsIds: Set<number>
  item?: DownloadItem
  timer?: NodeJS.Timeout
  destPath?: string
}

const activeTasks = new Map<string, DownloadTask>()
let downloadSession: Electron.Session | undefined
let mainWin: BrowserWindow | null = null

function sendStatus(event: ModDownloadEvent): void {
  if (!mainWin || mainWin.isDestroyed()) return
  mainWin.webContents.send('mod-download-status', event)
}

/**
 * Called once from main app.whenReady (after createWindow). Owns the
 * `persist:mod-downloads` partition — everything downloading on it (direct
 * session downloads, hidden ModDB windows and their popups) routes through
 * the single `will-download` handler below.
 */
export function registerModDownloadSession(mainWindow: BrowserWindow): void {
  mainWin = mainWindow
  downloadSession = session.fromPartition('persist:mod-downloads')
  downloadSession.on('will-download', (event, item, webContents) => {
    handleWillDownload(event, item, webContents)
  })
  ipcMain.handle('cancel-mod-download', (_event, id: string) => {
    if (typeof id === 'string') cancelModDownload(id)
  })
}

/** Starts an in-app download for a target URL. No-op for non-target URLs. */
export async function startModDownload(url: string): Promise<void> {
  const parsed = new URL(url)
  const source = isGithubReleaseAsset(parsed) ? 'github' : isModdbStartPage(parsed) ? 'moddb' : null
  if (!source) return

  debug(`[ModDownload] Starting ${source} download for ${url}`)
  const task: DownloadTask = {
    id: randomUUID(),
    url,
    source,
    childWebContentsIds: new Set()
  }
  activeTasks.set(task.id, task)

  // Chromium's setSavePath fails the download if the parent dir is missing.
  await fs.ensureDir(DOWNLOADS_DIR)

  if (source === 'github') {
    task.timer = setTimeout(() => guardTimeout(task), GITHUB_GUARD_MS)
    downloadSession?.downloadURL(url)
  } else {
    startModdbWindow(task)
  }
}

export function cancelModDownload(id: string): void {
  const task = activeTasks.get(id)
  if (!task) return
  debug(`[ModDownload] Cancelling ${id}`)
  if (task.item) {
    // 'done' with state 'cancelled' fires → status + cleanup happen there.
    task.item.cancel()
  } else {
    // No transfer yet (still on the ModDB countdown / guard window).
    sendStatus({ state: 'cancelled', id: task.id })
    cleanupTask(task)
  }
}

// ── ModDB: hidden window that observes the site's own countdown JS ──

function startModdbWindow(task: DownloadTask): void {
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      session: downloadSession,
      sandbox: true,
      backgroundThrottling: false
    }
  })
  task.window = win

  // ModDB may hand the file to a popup; the popup shares the partition so its
  // download still hits the same will-download handler.
  win.webContents.setWindowOpenHandler(() => ({ action: 'allow' }))
  win.webContents.on('did-create-window', (child) => {
    child.hide()
    task.childWebContentsIds.add(child.webContents.id)
  })

  task.timer = setTimeout(() => guardTimeout(task), MODDB_GUARD_MS)
  sendStatus({
    state: 'preparing',
    id: task.id,
    message: 'Waiting for ModDB to start the download…'
  })
  win.loadURL(task.url).catch((err: unknown) => {
    log.error('ModDB start page failed to load:', err)
    guardTimeout(task)
  })
}

// ── will-download routing ──

function handleWillDownload(
  _event: Electron.Event,
  item: DownloadItem,
  webContents: WebContents | null
): void {
  const task = findTask(webContents, item)
  if (!task) {
    // Nothing else in the app downloads through this partition — cancel
    // unexpected traffic rather than letting it write to disk silently.
    debug('[ModDownload] Rejecting unmatched download:', item.getURL())
    item.cancel()
    return
  }

  if (task.timer) {
    clearTimeout(task.timer)
    task.timer = undefined
  }

  const destPath = path.join(DOWNLOADS_DIR, sanitizeFileName(item.getFilename()))
  item.setSavePath(destPath)
  task.item = item
  task.destPath = destPath

  sendStatus({
    state: 'started',
    id: task.id,
    fileName: item.getFilename(),
    source: task.source
  })

  item.on('updated', (_e, state) => {
    if (state !== 'progressing') return
    const receivedBytes = item.getReceivedBytes()
    const totalBytes = item.getTotalBytes()
    sendStatus({
      state: 'progress',
      id: task.id,
      percent: totalBytes > 0 ? (receivedBytes / totalBytes) * 100 : 0,
      receivedBytes,
      totalBytes
    })
  })

  item.once('done', (_e, state) => {
    if (state === 'completed') {
      void finalizeDownload(task)
    } else if (state === 'cancelled') {
      sendStatus({ state: 'cancelled', id: task.id })
      cleanupTask(task)
    } else {
      // interrupted — the download cannot be resumed by us
      sendStatus({
        state: 'error',
        id: task.id,
        message: `Download interrupted (${state})`
      })
      shell.openExternal(task.url).catch(() => {})
      cleanupTask(task)
    }
  })
}

/**
 * `will-download` fires with `webContents === null` for session-initiated
 * downloads (`ses.downloadURL` — the GitHub path): no webContents is
 * associated with the item. Those match only via the URL chain; window- and
 * popup-initiated downloads (ModDB) match via webContents ids.
 */
function findTask(webContents: WebContents | null, item: DownloadItem): DownloadTask | undefined {
  for (const task of activeTasks.values()) {
    const sameWebContents =
      webContents !== null &&
      ((task.window && task.window.webContents.id === webContents.id) ||
        task.childWebContentsIds.has(webContents.id))
    const sameUrl = item.getURLChain().includes(task.url)
    if (sameWebContents || sameUrl) return task
  }
  return undefined
}

function guardTimeout(task: DownloadTask): void {
  task.timer = undefined
  debug(`[ModDownload] Guard timeout for ${task.id} — no download started, opening externally`)
  sendStatus({
    state: 'error',
    id: task.id,
    message: 'Download did not start — opening in your browser instead'
  })
  shell.openExternal(task.url).catch(() => {})
  cleanupTask(task)
}

// ── Completion: land the file in the mod file catalog ──

async function finalizeDownload(task: DownloadTask): Promise<void> {
  try {
    const destPath = task.destPath
    if (!destPath) throw new Error('Download completed without a destination path')
    const ext = path.extname(destPath).toLowerCase()

    if (ext === '.zip' || ext === '.rar') {
      // Archives go through the existing ZipImportModal flow — the file stays
      // in the downloads dir until the user imports (or cancels) it.
      sendStatus({ state: 'completed', id: task.id, filePath: destPath })
      return
    }

    const hashValue = await computeFileHashOrThrow(destPath)
    const catalog = await getModFileCatalog()
    const existing = catalog.find((entry) => entry.hashValue === hashValue)
    if (existing) {
      await fs.remove(destPath).catch(() => {})
      sendStatus({
        state: 'completed',
        id: task.id,
        filePath: '',
        catalogEntry: existing,
        alreadyInCatalog: true
      })
      return
    }

    // Enrich from the registry (display name, version, category, preferred
    // url) — same enrichment the ZipImportModal applies on archive imports.
    // Falls back to filename-derived values when the hash isn't registered.
    const registryMod = await lookupRegistryMod(hashValue, task.url)
    const catalogEntry = await addModFileToCatalog({
      filePath: destPath,
      fileName: path.basename(destPath),
      fileType: getFileType(destPath),
      url: registryMod ? pickBestUrl(registryMod.urls) || task.url : task.url,
      name: registryMod
        ? formatRegistryName(registryMod.family_name, registryMod.display_name)
        : path.basename(destPath, ext),
      version: registryMod?.version || '',
      category: registryMod?.category || undefined,
      loadOrder: {},
      sidecarOnly: false
    })
    // addModFileToCatalog copied the file into mods/files — the downloads-dir
    // copy is redundant.
    await fs.remove(destPath).catch(() => {})
    sendStatus({ state: 'completed', id: task.id, filePath: '', catalogEntry })
  } catch (err: unknown) {
    log.error('finalizeDownload failed:', err)
    sendStatus({
      state: 'error',
      id: task.id,
      message: err instanceof Error ? err.message : String(err)
    })
  } finally {
    cleanupTask(task)
  }
}

// ── Helpers ──

/**
 * Strip path separators / illegal filename chars / control chars — Chromium
 * returns a basename, defensive only. Control chars are removed by char code
 * (keeps non-ASCII filenames intact).
 */
function sanitizeFileName(name: string): string {
  const cleaned = name
    .replace(/[\\/:*?"<>|]/g, '_')
    .split('')
    .filter((ch) => {
      const code = ch.charCodeAt(0)
      return code >= 0x20 && code !== 0x7f
    })
    .join('')
    .trim()
  return cleaned || 'download'
}

function cleanupTask(task: DownloadTask): void {
  if (task.timer) {
    clearTimeout(task.timer)
    task.timer = undefined
  }
  activeTasks.delete(task.id)
  destroyModdbWindows(task)
}

function destroyModdbWindows(task: DownloadTask): void {
  for (const id of task.childWebContentsIds) {
    const wc = webContentsRegistry.fromId(id)
    if (wc && !wc.isDestroyed()) {
      BrowserWindow.fromWebContents(wc)?.destroy()
    }
  }
  task.childWebContentsIds.clear()
  if (task.window && !task.window.isDestroyed()) {
    task.window.destroy()
  }
  task.window = undefined
}
