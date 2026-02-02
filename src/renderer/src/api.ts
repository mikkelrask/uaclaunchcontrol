import { IModFile, IMod, IAppSettings } from '@shared/schema';

const API_BASE = 'http://localhost:7666';

export const api = {
  // Settings operations
  getSettings: (): Promise<IAppSettings> => {
    return fetch(`${API_BASE}/api/settings`).then(res => res.json());
  },
  
  updateSettings: (settings: Partial<IAppSettings>): Promise<IAppSettings> => {
    return fetch(`${API_BASE}/api/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    }).then(res => res.json());
  },
  
  // File catalog operations
  getAvailableModFiles: async (): Promise<IModFile[]> => {
    const response = await fetch(`${API_BASE}/api/mod-files/catalog`);
    if (!response.ok) {
      throw new Error('Failed to get mod file catalog');
    }
    return response.json();
  },
  
  getModFilesByType: async (fileType: string): Promise<IModFile[]> => {
    const response = await fetch(`${API_BASE}/api/mod-files/catalog`);
    if (!response.ok) {
      throw new Error('Failed to get mod files');
    }
    
    const allFiles = await response.json();
    return allFiles.filter((file: IModFile) => file.fileType === fileType);
  },
  
  addToCatalog: async (file: Omit<IModFile, 'id' | 'modId'>): Promise<IModFile> => {
    console.log('[DEBUG] API addToCatalog called with:', file);
    try {
      const response = await fetch(`${API_BASE}/api/mod-files/catalog`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(file)
      });
      
      console.log('[DEBUG] API addToCatalog response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[DEBUG] API addToCatalog error:', errorText);
        throw new Error('Failed to add file to catalog');
      }
      
      const data = await response.json();
      console.log('[DEBUG] API addToCatalog response data:', data);
      return data;
    } catch (error) {
      console.error('[DEBUG] API addToCatalog exception:', error);
      throw error;
    }
  },
  
  // Mod operations
  createMod: async (mod: Omit<IMod, 'id'>): Promise<IMod> => {
    const response = await fetch(`${API_BASE}/api/mods`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mod)
    });
    if (!response.ok) {
      throw new Error('Failed to create mod');
    }
    return response.json();
  },
  
  // Dialog operations for file selection
  showOpenDialog: async (options: any): Promise<{ canceled: boolean, filePaths: string[] }> => {
    console.log('Showing open dialog with options:', options);
    const response = await fetch(`${API_BASE}/api/dialog/open`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options)
    });
    
    if (!response.ok) {
      console.error('Failed to open dialog:', response.statusText);
      // Return a default response in development mode
      return { canceled: true, filePaths: [] };
    }
    
    return response.json();
  },
  
  getDoomVersions: async () => {
    const response = await fetch(`${API_BASE}/api/versions`);
    if (!response.ok) throw new Error('Failed to fetch Doom versions');
    return response.json();
  },
  
  // Other existing API methods...
};

// Clean up by removing standalone functions that are now in the api object