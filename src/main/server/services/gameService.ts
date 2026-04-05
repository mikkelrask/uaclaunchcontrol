import path from 'path'

import * as storage from '../storage'
import { fileService } from './fileService'
import { IMod, IModFile, IDoomVersion } from '../../../shared/schema'
import { MODS_DIR } from '../storage'

// Service to handle game-related operations
export class GameService {
  // Base config directory (usually in user's home directory)

  // Get a list of all mods
  async getAllMods(): Promise<IMod[]> {
    // Uses the new storage function
    return storage.getMods()
  }

  // Get a single mod by ID (string)
  async getMod(id: string): Promise<{ mod: IMod; files: IModFile[] }> {
    // Uses the new storage function
    const modWithFiles = await storage.getMod(id)
    const { files, ...mod } = modWithFiles
    // Always include files property
    return { mod: { ...mod, files: files || [] }, files: files || [] }
  }

  // Save a mod configuration (mod ID is string)
  async saveMod(mod: IMod, files: IModFile[]): Promise<IMod | undefined> {
    try {
      // Ensure mod has an ID (string)
      if (!mod.id) {
        // Generate a simple string ID if creating a new mod
        mod.id = Date.now().toString()
      }

      // Prepare data for storage function (FLAT structure)
      const modDataToSave = {
        ...mod, // Spread mod properties
        files: files || [] // Add files array
      }

      // Save mod metadata and files using new storage function
      // storage.saveMod expects the flat structure
      const savedMod = await storage.saveMod(modDataToSave)

      // storage.saveMod now returns the IMod part, so just return that
      return savedMod
    } catch (error: any) {
      console.error(`Error saving mod ${mod.id}:`, error)
      return undefined
    }
  }

  // Delete a mod (string ID)
  async deleteMod(id: string): Promise<boolean> {
    try {
      const modFilePath = path.join(MODS_DIR, `${id}.json`)
      return await fileService.deleteFile(modFilePath)
    } catch (error: any) {
      console.error(`Error deleting mod ${id}:`, error)
      return false
    }
  }

  // Load mods from file system on startup (Now just calls storage.getMods)
  async loadModsFromConfig(): Promise<void> {
    // The new storage functions load mods on demand
    // We might still want to call getMods here to ensure initialization
    // or handle potential errors during initial load.
    try {
      await storage.getMods() // Call to potentially initialize/check
      console.log('Checked mods directory.')
    } catch (error) {
      console.error('Error during initial mod loading:', error)
    }
  }

  // Launch a mod (accepts string ID)
  async launchMod(id: string): Promise<{ success: boolean; message?: string }> {
    try {
      const modWithFiles = await storage.getMod(id) // Use string ID
      const { files, ...mod } = modWithFiles
      if (!mod) throw new Error('Mod not found')

      // Need settings for executable path
      const settings = await storage.getSettings()
      if (!settings.gzDoomPath) {
        throw new Error('GZDoom executable path not set in settings.')
      }
      const executable = storage.resolvePath(settings.gzDoomPath)

      // Load Doom version for args
      const doomVersionId = String(mod.doomVersionId)
      const doomVersion: Partial<IDoomVersion> | null = doomVersionId
        ? (await storage.getDoomVersion(doomVersionId)) || null
        : null
      let baseArgs: string[] = []
      if (doomVersion && typeof doomVersion.args === 'string') {
        baseArgs = doomVersion.args.split(' ')
      }

      // Add mod files in order
      const fileArgs: string[] = []
      if (files.length > 0) {
        fileArgs.push('-file')
        files
          .sort((a, b) => (a.loadOrder ?? 0) - (b.loadOrder ?? 0))
          .forEach((file) => {
            if (file.filePath) {
              const isAbsolute =
                path.isAbsolute(file.filePath) ||
                file.filePath.startsWith('~') ||
                file.filePath.startsWith('/') ||
                file.filePath.includes(':')

              console.log(`[DEBUG] Processing file: ${file.filePath}, isAbsolute: ${isAbsolute}`)

              let fullPath: string
              if (isAbsolute) {
                fullPath = path.resolve(storage.resolvePath(file.filePath))
              } else {
                const modsDir = storage.resolvePath(settings.modsDirectory || '')
                fullPath = path.join(modsDir, 'files', file.filePath)
                console.log(`[DEBUG] Resolved relative file: ${file.filePath} -> ${fullPath} (modsDir: ${modsDir})`)
              }
              fileArgs.push(fullPath)
            } else {
              console.warn(`Mod file ${file.id} for mod ${mod.id} is missing filePath.`)
            }
          })
      }

      // Add save directory: prefer mod.saveDirectory, else settings.savegamesPath
      const saveDir = mod.saveDirectory || settings.savegamesPath
      let resolvedSaveDir = ''
      if (saveDir) {
        const isAbsolute =
          path.isAbsolute(saveDir) ||
          saveDir.startsWith('~') ||
          saveDir.startsWith('/') ||
          saveDir.includes(':')

        if (isAbsolute) {
          resolvedSaveDir = storage.resolvePath(saveDir)
        } else {
          resolvedSaveDir = path.join(storage.resolvePath(settings.savegamesPath || ''), saveDir)
        }
      }
      const saveArgs: string[] = resolvedSaveDir ? ['-savedir', resolvedSaveDir] : []

      // Add custom launch parameters
      let customArgs: string[] = []
      if (mod.launchParameters) {
        customArgs = mod.launchParameters.split(' ')
      }

      // Combine all args: baseArgs, fileArgs, saveArgs, customArgs
      const args = [...baseArgs, ...fileArgs, ...saveArgs, ...customArgs]
      // Add IWAD argument if available from doomVersion
      let iwad: string | undefined = undefined
      if (
        doomVersion &&
        typeof doomVersion.defaultIwad === 'string' &&
        doomVersion.defaultIwad.trim()
      ) {
        iwad = doomVersion.defaultIwad
      } else if (doomVersion && typeof doomVersion.args === 'string') {
        const match = doomVersion.args.match(/-iwad\s+(\S+)/i)
        if (match) {
          iwad = match[1]
        }
      }
      // Only add -iwad if not already present in baseArgs
      if (iwad && !baseArgs.some((arg) => arg === '-iwad')) {
        args.unshift('-iwad', storage.resolvePath(iwad))
      }

      // Quote arguments that contain spaces for clearer logging and potential shell compatibility
      const quotedArgs = args.map(arg => {
        if (arg.includes(' ') && !arg.startsWith('"') && !arg.startsWith("'")) {
          return `"${arg}"`
        }
        return arg
      })

      const quotedExecutable = (executable.includes(' ') && !executable.startsWith('"')) 
        ? `"${executable}"` 
        : executable

      // Log the full command for debugging
      console.log('Launching command:', quotedExecutable, quotedArgs.join(' '))

      // Launch the game using fileService
      const success = await fileService.launchGame(executable, args)
      return { success }
    } catch (error: any) {
      console.error(`Error launching mod ${id}:`, error)
      return { success: false, message: error.message }
    }
  }
}

export const gameService = new GameService()
