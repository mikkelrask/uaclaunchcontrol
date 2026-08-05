import {
  IModFile,
  IProtocol,
  InsertProtocol,
  IAppSettings,
  IDoomVersion,
  IUpdateInfo,
  IPlayerData,
  IPlayerStats
} from '@shared/schema'

export interface IIdgamesMod {
  id: number
  title: string
  dir: string
  filename: string
  size: number
  author: string
  description: string
  rating: number
  votes: number
  urls: { url: string; domain: string; type: 'download' | 'info' }[]
}

export interface IRegistryMod {
  family_name: string
  display_name?: string
  version: string
  category: string | null
  is_sidecar: number
  load_order: Record<string, number>
  urls: { url: string; domain: string }[]
  submitted_at: number
  approved_at: number
}

export const API_BASE = 'http://localhost:7666'

export interface ScannedPort {
  path: string
  name: string
  family: string
}

export interface PortReleaseAsset {
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
  asset: PortReleaseAsset
}

export interface PortDownloadResult {
  executablePath: string
  name: string
  family: string
  version: string
}

export interface FreedoomManifestEntry {
  description: string
  name: string
  url: string
  version: string
  md5: string
  sha1: string
  sha256: string
}

export type FreedoomManifest = Record<
  'freedoom1.wad' | 'freedoom2.wad' | 'freedm.wad',
  FreedoomManifestEntry
>

export interface FreedoomDownloadResult {
  installed: string[]
  doomVersions: IDoomVersion[]
}

export interface OpenDialogOptions {
  title?: string
  defaultPath?: string
  filters?: { name: string; extensions: string[] }[]
  properties?: (
    | 'openFile'
    | 'openDirectory'
    | 'multiSelections'
    | 'showHiddenFiles'
    | 'createDirectory'
  )[]
}

export interface SaveDialogOptions {
  title?: string
  defaultPath?: string
  filters?: { name: string; extensions: string[] }[]
  buttonLabel?: string
}

export interface OpenDialogReturn {
  canceled: boolean
  filePaths: string[]
}

export interface SaveDialogReturn {
  canceled: boolean
  filePath?: string
}

/**
 * Shared response handler for every fetch-based call below. Parses either
 * `{ message }` (this app's standard error shape) or a legacy `{ error }`
 * shape defensively, and throws with that real server-provided text instead
 * of a hardcoded generic string — critical for diagnosing platform-specific
 * failures (e.g. Windows) where the user has no DevTools console access.
 */
async function handleApiResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type')
  if (!response.ok) {
    let errorMessage = `API error: ${response.status}`
    try {
      if (contentType && contentType.includes('application/json')) {
        const errorData = await response.json()
        errorMessage = errorData.message || errorData.error || errorMessage
      } else {
        const text = await response.text()
        console.error('API non-json error:', text)
      }
    } catch (error: unknown) {
      console.error('Failed to parse error response', error)
    }
    throw new Error(errorMessage)
  }

  if (contentType && contentType.includes('application/json')) {
    return response.json()
  }
  return {} as T
}

export const api = {
  // Settings operations
  getSettings: async (): Promise<IAppSettings> => {
    const res = await fetch(`${API_BASE}/api/settings`)
    return handleApiResponse<IAppSettings>(res)
  },

  updateSettings: async (settings: Partial<IAppSettings>): Promise<IAppSettings> => {
    const res = await fetch(`${API_BASE}/api/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    })
    return handleApiResponse<IAppSettings>(res)
  },

  getPortReleases: async (): Promise<PortRelease[]> => {
    const response = await fetch(`${API_BASE}/api/ports/releases`)
    return handleApiResponse<PortRelease[]>(response)
  },

  downloadPortRelease: async (
    downloadUrl: string,
    assetName: string,
    family: string,
    version: string
  ): Promise<PortDownloadResult> => {
    const response = await fetch(`${API_BASE}/api/ports/download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ downloadUrl, assetName, family, version })
    })
    return handleApiResponse<PortDownloadResult>(response)
  },

  getFreedoomManifest: async (): Promise<FreedoomManifest> => {
    const response = await fetch(`${API_BASE}/api/freedoom/manifest`)
    return handleApiResponse<FreedoomManifest>(response)
  },

  downloadFreedoom: async (bundle: 'phase12' | 'freedm'): Promise<FreedoomDownloadResult> => {
    const response = await fetch(`${API_BASE}/api/freedoom/download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bundle })
    })
    return handleApiResponse<FreedoomDownloadResult>(response)
  },

  scanPorts: async (): Promise<ScannedPort[]> => {
    const response = await fetch(`${API_BASE}/api/settings/scan-ports`)
    return handleApiResponse<ScannedPort[]>(response)
  },

  // Mod file catalog operations
  getModFileCatalog: async (): Promise<IModFile[]> => {
    const response = await fetch(`${API_BASE}/api/mod-files/catalog`)
    return handleApiResponse<IModFile[]>(response)
  },

  getModFilesByType: async (fileType: string): Promise<IModFile[]> => {
    // No dedicated by-type route exists on the backend — fetch the full
    // catalog and filter client-side (this mirrors the pre-consolidation
    // api.ts behavior; gameService.ts's version pointed at a by-type route
    // that was never actually implemented server-side).
    const response = await fetch(`${API_BASE}/api/mod-files/catalog`)
    const allFiles = await handleApiResponse<IModFile[]>(response)
    return allFiles.filter((file) => file.fileType === fileType)
  },

  searchModFileCatalog: async (query: string): Promise<IModFile[]> => {
    const response = await fetch(
      `${API_BASE}/api/mod-files/catalog/search?q=${encodeURIComponent(query)}`
    )
    return handleApiResponse<IModFile[]>(response)
  },

  addToCatalog: async (file: Omit<IModFile, 'id'>): Promise<IModFile> => {
    const response = await fetch(`${API_BASE}/api/mod-files/catalog`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(file)
    })
    return handleApiResponse<IModFile>(response)
  },

  computeHash: async (filePath: string): Promise<string> => {
    const response = await fetch(`${API_BASE}/api/mod-files/hash`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePath })
    })
    return handleApiResponse<string>(response)
  },

  lookupMod: async (hash: string, registryUrl: string): Promise<IRegistryMod | null> => {
    try {
      const response = await fetch(`${registryUrl}/mod/${hash}`)
      if (response.ok) {
        return response.json()
      }
      return null
    } catch {
      console.error('[api] lookupMod failed for hash', hash)
      return null
    }
  },

  submitToPending: async (
    data: {
      hash: string
      suggested_name: string
      url: string
      version?: string
      category?: string
      is_sidecar?: number
      load_order?: string
    },
    uuid: string,
    apiUrl: string
  ): Promise<void> => {
    try {
      await fetch(`${apiUrl}/mod/pending`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-UAC-UUID': uuid
        },
        body: JSON.stringify(data)
      })
      // Silently ignore all responses
    } catch {
      console.debug('[api] submitToPending network error (silent)')
      // Network error - silently ignore
    }
  },

  updateInCatalog: async (id: number, updates: Partial<IModFile>): Promise<IModFile> => {
    const response = await fetch(`${API_BASE}/api/mod-files/catalog/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    })
    return handleApiResponse<IModFile>(response)
  },

  deleteFromCatalog: async (id: number, deleteFile?: boolean): Promise<{ success: boolean }> => {
    const params = deleteFile ? '?deleteFile=true' : ''
    const response = await fetch(`${API_BASE}/api/mod-files/catalog/${id}${params}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' }
    })
    return handleApiResponse<{ success: boolean }>(response)
  },

  // Protocol operations
  getProtocols: async (versionSlug?: string, searchQuery?: string): Promise<IProtocol[]> => {
    const params = new URLSearchParams()
    if (versionSlug) params.append('version', versionSlug)
    if (searchQuery) params.append('search', searchQuery)

    const response = await fetch(`${API_BASE}/api/protocols?${params.toString()}`)
    return handleApiResponse<IProtocol[]>(response)
  },

  getProtocol: async (id: string): Promise<{ protocol: IProtocol; files: IModFile[] }> => {
    const response = await fetch(`${API_BASE}/api/protocols/${id}`)
    return handleApiResponse<{ protocol: IProtocol; files: IModFile[] }>(response)
  },

  testLaunch: async (
    protocol: Partial<IProtocol>,
    files: Partial<IModFile>[]
  ): Promise<{ success: boolean }> => {
    const response = await fetch(`${API_BASE}/api/protocols/test-launch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ protocol, files })
    })
    return handleApiResponse<{ success: boolean }>(response)
  },

  createProtocol: async (
    protocol: InsertProtocol,
    files: Omit<IModFile, 'id' | 'modId'>[] = []
  ): Promise<IProtocol> => {
    const response = await fetch(`${API_BASE}/api/protocols`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ protocol, files })
    })
    return handleApiResponse<IProtocol>(response)
  },

  updateProtocol: async (
    id: string,
    protocol: Partial<IProtocol>,
    files?: Omit<IModFile, 'id' | 'modId'>[]
  ): Promise<IProtocol> => {
    const response = await fetch(`${API_BASE}/api/protocols/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ protocol, files })
    })
    return handleApiResponse<IProtocol>(response)
  },

  deleteProtocol: async (id: string): Promise<void> => {
    const response = await fetch(`${API_BASE}/api/protocols/${id}`, { method: 'DELETE' })
    await handleApiResponse<void>(response)
  },

  launchProtocol: async (id: string): Promise<{ success: boolean; message: string }> => {
    const response = await fetch(`${API_BASE}/api/protocols/${id}/launch`, { method: 'POST' })
    return handleApiResponse<{ success: boolean; message: string }>(response)
  },

  // idgames / registry search
  searchIdgames: async (query: string): Promise<IIdgamesMod[]> => {
    const response = await fetch(`${API_BASE}/api/search/idgames?q=${encodeURIComponent(query)}`)
    return handleApiResponse<IIdgamesMod[]>(response)
  },

  downloadIdgamesFile: async (
    downloadUrl: string,
    title: string
  ): Promise<{ downloadPath: string; fileName: string; name: string; hash: string }> => {
    const response = await fetch(`${API_BASE}/api/search/idgames/download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ downloadUrl, title })
    })
    return handleApiResponse(response)
  },

  importIdgamesSingleFile: async (data: {
    tempPath: string
    fileName?: string
    name?: string
    hashValue?: string
    fileType?: string
  }): Promise<{ file: IModFile }> => {
    const response = await fetch(`${API_BASE}/api/search/idgames/import-single`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    return handleApiResponse(response)
  },

  searchRegistry: async (query: string): Promise<IRegistryMod[]> => {
    const response = await fetch(`${API_BASE}/api/search/registry?q=${encodeURIComponent(query)}`)
    return handleApiResponse<IRegistryMod[]>(response)
  },

  // Dialog operations for file selection. Deliberately does NOT throw on
  // failure — a dialog that can't open should read to the user as "nothing
  // selected," not as an app error, so callers can treat every response the
  // same way without wrapping each call in try/catch.
  showOpenDialog: async (options: OpenDialogOptions): Promise<OpenDialogReturn> => {
    const response = await fetch(`${API_BASE}/api/dialog/open`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options)
    })

    if (!response.ok) {
      console.error('Failed to open dialog:', response.statusText)
      return { canceled: true, filePaths: [] }
    }

    return response.json()
  },

  showSaveDialog: async (options: SaveDialogOptions): Promise<SaveDialogReturn> => {
    const response = await fetch(`${API_BASE}/api/dialog/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options)
    })

    if (!response.ok) {
      console.error('Failed to open save dialog:', response.statusText)
      return { canceled: true }
    }

    return response.json()
  },

  getDoomVersions: async (): Promise<IDoomVersion[]> => {
    const response = await fetch(`${API_BASE}/api/versions`)
    return handleApiResponse<IDoomVersion[]>(response)
  },

  getDoomVersion: async (id: string): Promise<IDoomVersion> => {
    const response = await fetch(`${API_BASE}/api/versions/${id}`)
    return handleApiResponse<IDoomVersion>(response)
  },

  getDoomVersionBySlug: async (slug: string): Promise<IDoomVersion> => {
    const response = await fetch(`${API_BASE}/api/versions/bySlug/${slug}`)
    return handleApiResponse<IDoomVersion>(response)
  },

  updateDoomVersions: async (versions: unknown[]): Promise<IDoomVersion[]> => {
    const response = await fetch(`${API_BASE}/api/versions`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(versions)
    })
    return handleApiResponse<IDoomVersion[]>(response)
  },

  updateDoomVersion: async (id: string, updates: Partial<IDoomVersion>): Promise<IDoomVersion> => {
    const response = await fetch(`${API_BASE}/api/versions/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    })
    return handleApiResponse<IDoomVersion>(response)
  },

  deleteDoomVersion: async (id: string): Promise<void> => {
    const response = await fetch(`${API_BASE}/api/versions/${id}`, { method: 'DELETE' })
    if (!response.ok) {
      throw new Error(`Failed to delete version: ${response.status}`)
    }
  },

  moveFile: async (
    filePath: string,
    newPath: string
  ): Promise<{ success: boolean; message: string }> => {
    const response = await fetch(`${API_BASE}/api/move-file`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePath, newPath })
    })
    return handleApiResponse(response)
  },

  moveToModFolder: async (
    sourcePath: string
  ): Promise<{ fullPath: string; relativePath: string; hashValue: string }> => {
    const response = await fetch(`${API_BASE}/api/mod-files/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourcePath })
    })
    return handleApiResponse(response)
  },

  importWadFile: async (
    sourcePath: string
  ): Promise<{ fileName: string; fullPath: string; hashValue: string; alreadyExists: boolean }> => {
    const response = await fetch(`${API_BASE}/api/wads/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourcePath })
    })
    return handleApiResponse(response)
  },

  downloadImage: async (url: string, protocolId: string): Promise<{ fileName: string }> => {
    const response = await fetch(`${API_BASE}/api/protocol/download-image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, protocolId })
    })
    return handleApiResponse(response)
  },

  uploadScreenshot: async (filePath: string): Promise<{ fileName: string }> => {
    const response = await fetch(`${API_BASE}/api/screenshots/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePath })
    })
    return handleApiResponse(response)
  },

  /** Read a screenshot as base64 (for modpack export). */
  readScreenshotContent: async (
    fileName: string
  ): Promise<{ fileName: string; mimeType: string; data: string }> => {
    const response = await fetch(
      `${API_BASE}/api/screenshots/${encodeURIComponent(fileName)}/content`
    )
    return handleApiResponse(response)
  },

  /** Write a base64-encoded screenshot to disk (for modpack import reconstruction). */
  importScreenshot: async (fileName: string, data: string): Promise<{ fileName: string }> => {
    const response = await fetch(`${API_BASE}/api/screenshots/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName, data })
    })
    return handleApiResponse(response)
  },

  getVersion: async (): Promise<string> => {
    return await window.api.getAppVersion()
  },

  onGameExited: (
    callback: (data: {
      protocolId?: string
      exitCode: number | null
      sessionSeconds: number
      clean: boolean
      logTail: string[]
      logFilePath?: string
    }) => void
  ): void => {
    window.api.onGameExited(callback)
  },

  onGameEventDetected: (
    callback: (
      data: { protocolId?: string } & (
        | { type: 'MAP_REACHED'; mapName: string }
        | { type: 'CHEAT_ACTIVATED'; cheat: string }
      )
    ) => void
  ): void => {
    window.api.onGameEventDetected(callback)
  },

  openLogFile: async (filePath: string): Promise<void> => {
    await window.api.openLogFile(filePath)
  },

  addPlaytime: async (protocolId: string, sessionSeconds: number): Promise<void> => {
    await fetch(`${API_BASE}/api/protocols/${protocolId}/playtime`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionSeconds })
    })
  },

  onUpdateStatus: (callback: (data: IUpdateInfo) => void): void => {
    window.api.onUpdateStatus(callback)
  },

  checkForUpdates: (): void => {
    void window.api.checkForUpdates()
  },

  downloadUpdate: (): void => {
    void window.api.downloadUpdate()
  },

  installUpdate: (): void => {
    void window.api.installUpdate()
  },

  triggerFakeUpdate: (): void => {
    void window.api.triggerFakeUpdate()
  },

  setZoomFactor: (factor: number): void => {
    void window.api.setZoomFactor(factor)
  },

  // Player data / achievements
  getPlayerData: async (): Promise<IPlayerData> => {
    const response = await fetch(`${API_BASE}/api/player-data`)
    return handleApiResponse<IPlayerData>(response)
  },

  updatePlayerData: async (data: Partial<IPlayerData>): Promise<IPlayerData> => {
    const response = await fetch(`${API_BASE}/api/player-data`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    return handleApiResponse<IPlayerData>(response)
  },

  updatePlayerStats: async (delta: Partial<IPlayerStats>): Promise<IPlayerStats> => {
    const response = await fetch(`${API_BASE}/api/player-data/stats`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(delta)
    })
    return handleApiResponse<IPlayerStats>(response)
  },

  unlockAchievement: async (
    id: string,
    state: { progress: number; target: number }
  ): Promise<void> => {
    await fetch(`${API_BASE}/api/player-data/achievements/unlock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, state })
    })
  },

  // First-run tour
  getFirstRun: async (): Promise<{ isFirstRun: boolean }> => {
    const response = await fetch(`${API_BASE}/api/first-run`)
    return handleApiResponse<{ isFirstRun: boolean }>(response)
  },

  dismissFirstRun: async (): Promise<void> => {
    await fetch(`${API_BASE}/api/first-run/dismiss`, { method: 'POST' })
  },

  reenableFirstRun: async (): Promise<void> => {
    await fetch(`${API_BASE}/api/first-run/reenable`, { method: 'POST' })
  },

  getInstallType: (): Promise<{ isAppImage: boolean; isSystemInstalled: boolean }> => {
    return window.api.getInstallType()
  },

  readFile: async (filePath: string): Promise<string> => {
    const response = await fetch(`${API_BASE}/api/file-read`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePath })
    })
    const data = await handleApiResponse<{ content: string }>(response)
    return data.content
  },

  unzipScan: async (zipFilePath: string): Promise<unknown> => {
    const response = await fetch(`${API_BASE}/api/mod-files/unzip-scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ zipFilePath })
    })
    return handleApiResponse(response)
  },

  unrarScan: async (rarFilePath: string): Promise<unknown> => {
    const response = await fetch(`${API_BASE}/api/mod-files/unrar-scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rarFilePath })
    })
    return handleApiResponse(response)
  },

  unzipImport: async (tempDir: string, filesToImport: unknown[]): Promise<unknown[]> => {
    const response = await fetch(`${API_BASE}/api/mod-files/unzip-import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tempDir, filesToImport })
    })
    return handleApiResponse(response)
  },

  // ── Config File API ──────────────────────────────────

  /** Upload a config file: hash it, copy to cfgs dir, return metadata. */
  uploadConfigFile: async (filePath: string): Promise<{ hash: string; configFile: string }> => {
    const response = await fetch(`${API_BASE}/api/configs/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePath })
    })
    return handleApiResponse(response)
  },

  /** Create a blank, isolated config for a protocol with no originating template. */
  createBlankConfig: async (
    protocolId: string,
    ext?: string
  ): Promise<{ configFile: string; templateHash?: string }> => {
    const response = await fetch(`${API_BASE}/api/configs/blank`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ protocolId, ext })
    })
    return handleApiResponse(response)
  },

  /** Copy a config template to a protocol-specific copy. */
  copyConfigForProtocol: async (
    templateHash: string,
    protocolId: string
  ): Promise<{ configFile: string; templateHash: string }> => {
    const response = await fetch(`${API_BASE}/api/configs/copy-for-protocol`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ templateHash, protocolId })
    })
    return handleApiResponse(response)
  },

  /** Read a config file content by hash (for export). */
  readConfigContent: async (key: string): Promise<string> => {
    const response = await fetch(`${API_BASE}/api/configs/${key}`)
    const data = await handleApiResponse<{ content: string }>(response)
    return data.content
  },

  /** Write a config file content (for import reconstruction). */
  writeConfigContent: async (key: string, content: string): Promise<void> => {
    const response = await fetch(`${API_BASE}/api/configs/${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, content })
    })
    await handleApiResponse<void>(response)
  }
}
