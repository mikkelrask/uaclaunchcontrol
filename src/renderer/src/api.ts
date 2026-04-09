import { IModFile, IMod, IAppSettings, IDoomVersion } from '@shared/schema'

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

  // Mod operations
  createMod: async (mod: Omit<IMod, 'id'>): Promise<IMod> => {
    const response = await fetch(`${API_BASE}/api/mods`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mod)
    })
    if (!response.ok) {
      throw new Error('Failed to create mod')
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
  ): Promise<{ fullPath: string; relativePath: string }> => {
    const response = await fetch(`${API_BASE}/api/mod-files/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourcePath })
    })
    if (!response.ok) throw new Error('Failed to move file to mod folder')
    return response.json()
  },
  downloadImage: async (url: string, modId: string): Promise<{ fileName: string }> => {
    const response = await fetch(`${API_BASE}/api/mod/download-image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, modId })
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
  }

  // Other existing API methods...
}

// Clean up by removing standalone functions that are now in the api object
