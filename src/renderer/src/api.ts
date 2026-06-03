import { IModFile, IProtocol, IAppSettings, IDoomVersion, IUpdateInfo } from '@shared/schema'

export interface IRegistryMod {
  family_name: string
  version: string
  category: string | null
  is_sidecar: number
  load_order: Record<string, number>
  urls: { url: string; domain: string }[]
  submitted_at: number
  approved_at: number
}

export const API_BASE = 'http://localhost:7666'

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

  deleteFromCatalog: async (id: number): Promise<{ success: boolean }> => {
    const response = await fetch(`${API_BASE}/api/mod-files/catalog/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' }
    })

    if (!response.ok) {
      throw new Error('Failed to delete file from catalog')
    }

    return response.json()
  },

  // Protocol operations
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
  checkMigration: async (): Promise<{ found: boolean; path: string | null }> => {
    const response = await fetch(`${API_BASE}/api/migration/check`)
    return response.json()
  },
  executeMigration: async (sourcePath: string): Promise<{ success: boolean }> => {
    const response = await fetch(`${API_BASE}/api/migration/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourcePath })
    })
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
    }) => void
  ): void => {
    window.api.onGameExited(callback)
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
  }
}
