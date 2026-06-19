import type {
  IDoomVersion,
  IProtocol,
  IModFile,
  InsertProtocol,
  IAppSettings
} from '@shared/schema'
import type { IRegistryMod, IIdgamesMod } from '@/api'

interface OpenDialogOptions {
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

interface SaveDialogOptions {
  title?: string
  defaultPath?: string
  filters?: { name: string; extensions: string[] }[]
  buttonLabel?: string
}

interface OpenDialogReturn {
  canceled: boolean
  filePaths: string[]
}

interface SaveDialogReturn {
  canceled: boolean
  filePath?: string
}

import { API_BASE } from '@/api'

// Helper function to handle API errors
async function handleApiResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type')
  if (!response.ok) {
    let errorMessage = `API error: ${response.status}`
    try {
      if (contentType && contentType.includes('application/json')) {
        const errorData = await response.json()
        errorMessage = errorData.error || errorData.message || errorMessage
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

// Client API service
export const gameService = {
  // DoomVersion operations
  async getDoomVersions(): Promise<IDoomVersion[]> {
    const response = await fetch(`${API_BASE}/api/versions`)
    return handleApiResponse<IDoomVersion[]>(response)
  },

  async getDoomVersion(id: string): Promise<IDoomVersion> {
    const response = await fetch(`${API_BASE}/api/versions/${id}`)
    return handleApiResponse<IDoomVersion>(response)
  },

  async getDoomVersionBySlug(slug: string): Promise<IDoomVersion> {
    const response = await fetch(`${API_BASE}/api/versions/bySlug/${slug}`)
    return handleApiResponse<IDoomVersion>(response)
  },

  async createDoomVersion(version: Omit<IDoomVersion, 'id'>): Promise<IDoomVersion> {
    const response = await fetch(`${API_BASE}/api/versions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(version)
    })
    return handleApiResponse<IDoomVersion>(response)
  },

  async updateDoomVersion(id: string, version: Partial<IDoomVersion>): Promise<IDoomVersion> {
    const response = await fetch(`${API_BASE}/api/versions/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(version)
    })
    return handleApiResponse<IDoomVersion>(response)
  },

  async deleteDoomVersion(id: string): Promise<void> {
    const response = await fetch(`${API_BASE}/api/versions/${id}`, {
      method: 'DELETE'
    })

    if (!response.ok) {
      throw new Error(`Failed to delete version: ${response.status}`)
    }
  },

  // Protocol operations
  async getProtocols(versionSlug?: string, searchQuery?: string): Promise<IProtocol[]> {
    const params = new URLSearchParams()
    if (versionSlug) params.append('version', versionSlug)
    if (searchQuery) params.append('search', searchQuery)

    const url = `${API_BASE}/api/protocols?${params.toString()}`
    const response = await fetch(url)
    return handleApiResponse<IProtocol[]>(response)
  },

  async searchModFileCatalog(query: string): Promise<IModFile[]> {
    const url = `${API_BASE}/api/mod-files/catalog/search?q=${encodeURIComponent(query)}`
    const response = await fetch(url)
    return handleApiResponse<IModFile[]>(response)
  },

  async downloadIdgamesFile(
    downloadUrl: string,
    title: string
  ): Promise<{ files: IModFile[] }> {
    const response = await fetch(`${API_BASE}/api/search/idgames/download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ downloadUrl, title })
    })
    if (!response.ok) throw new Error('Failed to download file')
    return response.json()
  },

  async searchIdgames(query: string): Promise<IIdgamesMod[]> {
    const url = `${API_BASE}/api/search/idgames?q=${encodeURIComponent(query)}`
    const response = await fetch(url)
    return handleApiResponse<IIdgamesMod[]>(response)
  },

  async searchRegistry(query: string): Promise<IRegistryMod[]> {
    const url = `${API_BASE}/api/search/registry?q=${encodeURIComponent(query)}`
    const response = await fetch(url)
    return handleApiResponse<IRegistryMod[]>(response)
  },

  async getProtocol(id: string): Promise<{ protocol: IProtocol; files: IModFile[] }> {
    const response = await fetch(`${API_BASE}/api/protocols/${id}`)
    return handleApiResponse<{ protocol: IProtocol; files: IModFile[] }>(response)
  },

  async createProtocol(
    protocol: InsertProtocol,
    files: Omit<IModFile, 'id' | 'modId'>[] = []
  ): Promise<IProtocol> {
    const response = await fetch(`${API_BASE}/api/protocols`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ protocol, files })
    })
    return handleApiResponse<IProtocol>(response)
  },

  async updateProtocol(
    id: string,
    protocol: Partial<IProtocol>,
    files?: Omit<IModFile, 'id' | 'modId'>[]
  ): Promise<IProtocol> {
    const response = await fetch(`${API_BASE}/api/protocols/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ protocol, files })
    })
    return handleApiResponse<IProtocol>(response)
  },

  async deleteProtocol(id: string): Promise<void> {
    const response = await fetch(`${API_BASE}/api/protocols/${id}`, {
      method: 'DELETE'
    })

    if (!response.ok) {
      throw new Error(`Failed to delete protocol: ${response.status}`)
    }
  },

  async launchProtocol(id: string): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${API_BASE}/api/protocols/${id}/launch`, {
      method: 'POST'
    })
    return handleApiResponse<{ success: boolean; message: string }>(response)
  },

  // Move file
  async moveFile(
    filePath: string,
    newPath: string
  ): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${API_BASE}/api/move-file`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePath, newPath })
    })
    return handleApiResponse<{ success: boolean; message: string }>(response)
  },

  // Settings operations
  async getSettings(): Promise<IAppSettings> {
    const response = await fetch(`${API_BASE}/api/settings`)
    return handleApiResponse<IAppSettings>(response)
  },

  async updateSettings(settings: Partial<IAppSettings>): Promise<IAppSettings> {
    const response = await fetch(`${API_BASE}/api/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    })
    return handleApiResponse<IAppSettings>(response)
  },

  // ModFile catalog operations
  async getModFileCatalog(): Promise<IModFile[]> {
    const response = await fetch(`${API_BASE}/api/mod-files/catalog`)
    return handleApiResponse<IModFile[]>(response)
  },

  async getModFilesByType(fileType: string): Promise<IModFile[]> {
    const response = await fetch(`${API_BASE}/api/mod-files/catalog/by-type/${fileType}`)
    return handleApiResponse<IModFile[]>(response)
  },

  async addModFileToCatalog(file: Omit<IModFile, 'id' | 'modId'>): Promise<IModFile> {
    const response = await fetch(`${API_BASE}/api/mod-files/catalog`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(file)
    })
    return handleApiResponse<IModFile>(response)
  },

  // Dialog functions
  showOpenDialog: async (options: OpenDialogOptions): Promise<OpenDialogReturn> => {
    const response = await fetch(`${API_BASE}/api/dialog/open`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options)
    })
    return handleApiResponse<OpenDialogReturn>(response)
  },

  showSaveDialog: async (options: SaveDialogOptions): Promise<SaveDialogReturn> => {
    const response = await fetch(`${API_BASE}/api/dialog/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options)
    })
    return handleApiResponse<SaveDialogReturn>(response)
  }
}
