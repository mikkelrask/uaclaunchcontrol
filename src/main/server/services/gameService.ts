import path from 'path'

import * as storage from '../storage'
import { fileService } from './fileService'
import { IProtocol, IModFile, IDoomVersion } from '../../../shared/schema'
import { MODS_DIR } from '../storage'
import { debug } from '../../../shared/debug'

// Service to handle game-related operations
export class GameService {
  async getAllProtocols(): Promise<IProtocol[]> {
    return storage.getProtocols()
  }

  async getProtocol(id: string): Promise<{ protocol: IProtocol; files: IModFile[] }> {
    const protocolWithFiles = await storage.getProtocol(id)
    const { files, ...protocol } = protocolWithFiles
    return { protocol: { ...protocol, files: files || [] }, files: files || [] }
  }

  async saveProtocol(protocol: IProtocol, files: IModFile[]): Promise<IProtocol | undefined> {
    try {
      if (!protocol.id) {
        protocol.id = Date.now().toString()
      }

      const dataToSave = {
        ...protocol,
        files: files || []
      }

      const saved = await storage.saveProtocol(dataToSave)
      return saved
    } catch (error: unknown) {
      console.error(`Error saving protocol ${protocol.id}:`, error)
      return undefined
    }
  }

  async deleteProtocol(id: string): Promise<boolean> {
    try {
      const filePath = path.join(MODS_DIR, `${id}.json`)
      return await fileService.deleteFile(filePath)
    } catch (error: unknown) {
      console.error(`Error deleting protocol ${id}:`, error)
      return false
    }
  }

  async loadProtocolsFromConfig(): Promise<void> {
    try {
      await storage.getProtocols()
      console.log('Checked protocols directory.')
    } catch (error) {
      console.error('Error during initial protocol loading:', error)
    }
  }

  async launchProtocol(id: string): Promise<{ success: boolean; message?: string }> {
    try {
      const protocolWithFiles = await storage.getProtocol(id)
      const { files, ...protocol } = protocolWithFiles
      if (!protocol) throw new Error('Protocol not found')

      const settings = await storage.getSettings()

      // Resolve source port executable
      let executable: string | undefined
      if (protocol.sourcePortId) {
        const port = settings.sourcePorts.find((p) => p.id === protocol.sourcePortId)
        if (port) executable = port.executablePath
      }
      if (!executable && settings.defaultSourcePortId) {
        const port = settings.sourcePorts.find((p) => p.id === settings.defaultSourcePortId)
        if (port) executable = port.executablePath
      }
      if (!executable) {
        const firstPort = settings.sourcePorts.find((p) => !p.ignored)
        if (firstPort) executable = firstPort.executablePath
      }
      if (!executable) {
        throw new Error(
          'No source ports configured. Add at least one source port in Settings > Paths.'
        )
      }
      executable = storage.resolvePath(executable)

      // Load Doom version for args
      const doomVersionId = String(protocol.doomVersionId)
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
        files.forEach((file) => {
          if (file.filePath) {
            const isAbsolute =
              path.isAbsolute(file.filePath) ||
              file.filePath.startsWith('~') ||
              file.filePath.startsWith('/') ||
              file.filePath.includes(':')

            debug(`Processing file: ${file.filePath}, isAbsolute: ${isAbsolute}`)

            let fullPath: string
            if (isAbsolute) {
              fullPath = path.resolve(storage.resolvePath(file.filePath))
            } else {
              const modsDir = storage.resolvePath(settings.modsDirectory || MODS_DIR)
              fullPath = path.join(modsDir, 'files', file.filePath)
              debug(`Resolved relative file: ${file.filePath} -> ${fullPath} (modsDir: ${modsDir})`)
            }
            fileArgs.push(fullPath)
          } else {
            console.warn(`File ${file.id} for protocol ${protocol.id} is missing filePath.`)
          }
        })
      }

      // Add save directory
      const saveDir = protocol.saveDirectory || settings.savegamesPath
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
      if (protocol.launchParameters) {
        customArgs = protocol.launchParameters.split(' ')
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
      const quotedArgs = args.map((arg) => {
        if (arg.includes(' ') && !arg.startsWith('"') && !arg.startsWith("'")) {
          return `"${arg}"`
        }
        return arg
      })

      const quotedExecutable =
        executable.includes(' ') && !executable.startsWith('"') ? `"${executable}"` : executable

      // Log the full command for debugging
      console.log('Launching command:', quotedExecutable, quotedArgs.join(' '))

      // Launch the game using fileService
      const success = await fileService.launchGame(executable, args, protocol.id)

      // Record last launched timestamp
      if (success) {
        protocol.lastLaunchedAt = new Date().toISOString()
        await storage.saveProtocol({ ...protocol, files })
      }

      return { success }
    } catch (error: unknown) {
      console.error(`Error launching protocol ${id}:`, error)
      return { success: false, message: error instanceof Error ? error.message : String(error) }
    }
  }
}

export const gameService = new GameService()
