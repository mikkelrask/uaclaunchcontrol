import { apiRequest } from './queryClient';
import type { ModDBSearchResult, ModDBModDetails } from '@shared/schema';

// Service to interact with the ModDB API endpoints
export const moddbService = {
  // Search for mods
  async searchMods(query: string, game?: string): Promise<ModDBSearchResult[]> {
    let url = `/api/moddb/search?query=${encodeURIComponent(query)}`;
    
    if (game) {
      url += `&game=${encodeURIComponent(game)}`;
    }
    
    const res = await apiRequest('GET', url);
    return res.json();
  },

  // Get a specific mod's details
  async getModDetails(id: number): Promise<ModDBModDetails> {
    const res = await apiRequest('GET', `/api/moddb/mods/${id}`);
    return res.json();
  },

  // Get popular Doom mods
  async getPopularDoomMods(): Promise<ModDBSearchResult[]> {
    const res = await apiRequest('GET', '/api/moddb/popular');
    return res.json();
  },

  // Get latest Doom mods
  async getLatestDoomMods(): Promise<ModDBSearchResult[]> {
    const res = await apiRequest('GET', '/api/moddb/latest');
    return res.json();
  }
};
