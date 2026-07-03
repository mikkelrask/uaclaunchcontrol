import {
  IModFile,
  IProtocol,
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

export const api = {
  // Settings operations
  getSettings: (): Promise<IAppSettings> => {
    return fetch(`${API_BASE}/api/settings`).then((res) => res.json())
  },

  updateSettings: (settings: Partial<IAppSettings>): Promise<IAppSettings> => {
    return fetch(`${API_BASE}/api/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    }).then((res) => res.json())
  },

  getPortReleases: async (): Promise<PortRelease[]> => {
    const response = await fetch(`${API_BASE}/api/ports/releases`)
    if (!response.ok) throw new Error('Failed to fetch port releases')
    return response.json()
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
    if (!response.ok) {
      const err = await response.text()
      throw new Error(err || 'Failed to download port')
    }
    return response.json()
  },

  scanPorts: async (): Promise<ScannedPort[]> => {
    const response = await fetch(`${API_BASE}/api/settings/scan-ports`)
    if (!response.ok) {
      throw new Error('Failed to scan for source ports')
    }
    return response.json()
  },

  // File catalog operations
  getAvailableModFiles: async (): Promise<IModFile[]> => {
    const response = await fetch(`${API_BASE}/api/mod-files/catalog`)
    if (!response.ok) {
      throw new Error('Failed to get mod file catalog')
    }
    return response.json()
  },

  getModFilesByType: async (fileType: string): Promise<IModFile[]> => {
    const response = await fetch(`${API_BASE}/api/mod-files/catalog`)
    if (!response.ok) {
      throw new Error('Failed to get mod files')
    }

    const allFiles = await response.json()
    return allFiles.filter((file: IModFile) => file.fileType === fileType)
  },

  addToCatalog: async (file: Omit<IModFile, 'id'>): Promise<IModFile> => {
    console.log('[DEBUG] API addToCatalog called with:', file)
    try {
      const response = await fetch(`${API_BASE}/api/mod-files/catalog`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(file)
      })

      console.log('[DEBUG] API addToCatalog response status:', response.status)

      if (!response.ok) {
        const errorText = await response.text()
        console.error('[DEBUG] API addToCatalog error:', errorText)
        throw new Error('Failed to add file to catalog')
      }

      const data = await response.json()
      console.log('[DEBUG] API addToCatalog response data:', data)
      return data
    } catch (error) {
      console.error('[DEBUG] API addToCatalog exception:', error)
      throw error
    }
  },
  computeHash: async (filePath: string): Promise<string> => {
    try {
      const response = await fetch(`${API_BASE}/api/mod-files/hash`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath })
      })
      if (!response.ok) {
        throw new Error('Failed to compute hash')
      }
      return response.json()
    } catch (error) {
      console.error('[DEBUG] API computeHash exception:', error)
      throw error
    }
  },

  lookupMod: async (hash: string, registryUrl: string): Promise<IRegistryMod | null> => {
    try {
      const response = await fetch(`${registryUrl}/mod/${hash}`)
      if (response.ok) {
        return response.json()
      }
      return null
    } catch {
      console.error('[api] computeHash failed for file')
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
    console.log(`[DEBUG] API updateInCatalog called for ID ${id} with:`, updates)
    const response = await fetch(`${API_BASE}/api/mod-files/catalog/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    })

    if (!response.ok) {
      throw new Error('Failed to update file in catalog')
    }

    return response.json()
  },

  deleteFromCatalog: async (id: number, deleteFile?: boolean): Promise<{ success: boolean }> => {
    const params = deleteFile ? '?deleteFile=true' : ''
    const response = await fetch(`${API_BASE}/api/mod-files/catalog/${id}${params}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' }
    })

    if (!response.ok) {
      throw new Error('Failed to delete file from catalog')
    }

    return response.json()
  },

  // Protocol operations
  testLaunch: async (
    protocol: Partial<IProtocol>,
    files: Partial<IModFile>[]
  ): Promise<{ success: boolean }> => {
    const response = await fetch(`${API_BASE}/api/protocols/test-launch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ protocol, files })
    })
    if (!response.ok) {
      const err = await response.json().catch(() => ({ message: 'Test launch failed' }))
      throw new Error(err.message || 'Test launch failed')
    }
    return response.json()
  },

  createProtocol: async (protocol: Omit<IProtocol, 'id'>): Promise<IProtocol> => {
    const response = await fetch(`${API_BASE}/api/protocols`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(protocol)
    })
    if (!response.ok) {
      throw new Error('Failed to create protocol')
    }
    return response.json()
  },

  // Dialog operations for file selection
  showOpenDialog: async (options: object): Promise<{ canceled: boolean; filePaths: string[] }> => {
    console.log('Showing open dialog with options:', options)
    const response = await fetch(`${API_BASE}/api/dialog/open`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options)
    })

    if (!response.ok) {
      console.error('Failed to open dialog:', response.statusText)
      // Return a default response in development mode
      return { canceled: true, filePaths: [] }
    }

    return response.json()
  },

  getDoomVersions: async () => {
    const response = await fetch(`${API_BASE}/api/versions`)
    if (!response.ok) throw new Error('Failed to fetch Doom versions')
    return response.json()
  },

  updateDoomVersions: async (versions: unknown[]) => {
    const response = await fetch(`${API_BASE}/api/versions`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(versions)
    })
    if (!response.ok) throw new Error('Failed to update Doom versions')
    return response.json()
  },

  updateDoomVersion: async (id: string, updates: Partial<IDoomVersion>) => {
    const response = await fetch(`${API_BASE}/api/versions/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    })
    if (!response.ok) throw new Error('Failed to update Doom version')
    return response.json()
  },

  moveFile: async (filePath: string, newPath: string) => {
    const response = await fetch(`${API_BASE}/api/move-file`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePath, newPath })
    })
    if (!response.ok) throw new Error('Failed to move file')
    return response.json()
  },
  moveToModFolder: async (
    sourcePath: string
  ): Promise<{ fullPath: string; relativePath: string; hashValue: string }> => {
    const response = await fetch(`${API_BASE}/api/mod-files/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourcePath })
    })
    if (!response.ok) throw new Error('Failed to move file to mod folder')
    return response.json()
  },
  importWadFile: async (
    sourcePath: string
  ): Promise<{ fileName: string; fullPath: string; hashValue: string; alreadyExists: boolean }> => {
    const response = await fetch(`${API_BASE}/api/wads/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourcePath })
    })
    if (!response.ok) throw new Error('Failed to import WAD file')
    return response.json()
  },
  downloadImage: async (url: string, protocolId: string): Promise<{ fileName: string }> => {
    const response = await fetch(`${API_BASE}/api/protocol/download-image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, protocolId })
    })
    if (!response.ok) throw new Error('Failed to download image')
    return response.json()
  },

  uploadScreenshot: async (filePath: string): Promise<{ fileName: string }> => {
    const response = await fetch(`${API_BASE}/api/screenshots/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePath })
    })
    if (!response.ok) throw new Error('Failed to upload screenshot')
    return response.json()
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

  // Player data / achievements
  getPlayerData: async (): Promise<IPlayerData> => {
    const response = await fetch(`${API_BASE}/api/player-data`)
    if (!response.ok) throw new Error('Failed to get player data')
    return response.json()
  },

  updatePlayerData: async (data: Partial<IPlayerData>): Promise<IPlayerData> => {
    const response = await fetch(`${API_BASE}/api/player-data`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    if (!response.ok) throw new Error('Failed to update player data')
    return response.json()
  },

  updatePlayerStats: async (delta: Partial<IPlayerStats>): Promise<IPlayerStats> => {
    const response = await fetch(`${API_BASE}/api/player-data/stats`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(delta)
    })
    if (!response.ok) throw new Error('Failed to update player stats')
    return response.json()
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
    if (!response.ok) throw new Error('Failed to check first run')
    return response.json()
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
    if (!response.ok) {
      throw new Error('Failed to read file')
    }
    const data = await response.json()
    return data.content
  },

  unzipScan: async (zipFilePath: string): Promise<unknown> => {
    const response = await fetch(`${API_BASE}/api/mod-files/unzip-scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ zipFilePath })
    })
    if (!response.ok) {
      throw new Error('Failed to unzip and scan archive')
    }
    return response.json()
  },

  unrarScan: async (rarFilePath: string): Promise<unknown> => {
    const response = await fetch(`${API_BASE}/api/mod-files/unrar-scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rarFilePath })
    })
    if (!response.ok) {
      throw new Error('Failed to extract and scan RAR archive')
    }
    return response.json()
  },

  unzipImport: async (tempDir: string, filesToImport: unknown[]): Promise<unknown[]> => {
    const response = await fetch(`${API_BASE}/api/mod-files/unzip-import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tempDir, filesToImport })
    })
    if (!response.ok) {
      throw new Error('Failed to import files from archive')
    }
    return response.json()
  },

  // ── Config File API ──────────────────────────────────

  /** Upload a config file: hash it, copy to cfgs dir, return metadata. */
  uploadConfigFile: async (filePath: string): Promise<{ hash: string; configFile: string }> => {
    const response = await fetch(`${API_BASE}/api/configs/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePath })
    })
    if (!response.ok) {
      throw new Error('Failed to upload config file')
    }
    return response.json()
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
    if (!response.ok) {
      throw new Error('Failed to copy config for protocol')
    }
    return response.json()
  },

  /** Read a config file content by hash (for export). */
  readConfigContent: async (key: string): Promise<string> => {
    const response = await fetch(`${API_BASE}/api/configs/${key}`)
    if (!response.ok) {
      throw new Error('Failed to read config file')
    }
    const data = await response.json()
    return data.content
  },

  /** Write a config file content (for import reconstruction). */
  writeConfigContent: async (key: string, content: string): Promise<void> => {
    const response = await fetch(`${API_BASE}/api/configs/${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, content })
    })
    if (!response.ok) {
      throw new Error('Failed to write config file')
    }
  }
}
