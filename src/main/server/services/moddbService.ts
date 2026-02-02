import axios from 'axios'
import { ModDBSearchResult, ModDBModDetails } from '../../../shared/schema'

// Service to handle ModDB API integration
export class ModDBService {
  private readonly API_URL = 'https://api.moddb.com/v1'
  private readonly API_KEY = process.env.MODDB_API_KEY || ''

  // Search for mods
  async searchMods(query: string, gameFilter?: string): Promise<ModDBSearchResult[]> {
    try {
      const params: Record<string, string> = {
        q: query,
        api_key: this.API_KEY
      }

      if (gameFilter) {
        params.game = gameFilter
      }

      const response = await axios.get(`${this.API_URL}/mods/search`, { params })

      if (response.data && response.data.results) {
        return response.data.results
      }

      return []
    } catch (error) {
      console.error('Error searching ModDB:', error)
      return []
    }
  }

  // Get mod details
  async getModDetails(modId: number): Promise<ModDBModDetails | null> {
    try {
      const response = await axios.get(`${this.API_URL}/mods/${modId}`, {
        params: { api_key: this.API_KEY }
      })

      if (response.data && response.data.mod) {
        return response.data.mod
      }

      return null
    } catch (error) {
      console.error('Error fetching mod details from ModDB:', error)
      return null
    }
  }

  // Get popular Doom mods
  async getPopularDoomMods(): Promise<ModDBSearchResult[]> {
    try {
      const response = await axios.get(`${this.API_URL}/mods/popular`, {
        params: {
          api_key: this.API_KEY,
          game: 'doom'
        }
      })

      if (response.data && response.data.results) {
        return response.data.results
      }

      return []
    } catch (error) {
      console.error('Error fetching popular Doom mods from ModDB:', error)
      return []
    }
  }

  // Get latest Doom mods
  async getLatestDoomMods(): Promise<ModDBSearchResult[]> {
    try {
      const response = await axios.get(`${this.API_URL}/mods/latest`, {
        params: {
          api_key: this.API_KEY,
          game: 'doom'
        }
      })

      if (response.data && response.data.results) {
        return response.data.results
      }

      return []
    } catch (error) {
      console.error('Error fetching latest Doom mods from ModDB:', error)
      return []
    }
  }
}

export const moddbService = new ModDBService()
