import fs from 'fs/promises'
import path from 'path'
import { spawn } from 'child_process'
import { Stats } from 'fs'
import { BrowserWindow } from 'electron'

// Service to handle file system operations
export class FileService {
  // Check if a file exists
  async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  }

  // Get info about a file
  async getFileInfo(filePath: string): Promise<Stats | null> {
    try {
      return await fs.stat(filePath)
    } catch {
      return null
    }
  }

  // Read a directory
  async readDirectory(dirPath: string): Promise<string[]> {
    try {
      return await fs.readdir(dirPath)
    } catch {
      return []
    }
  }

  // Read a file as text
  async readFile(filePath: string): Promise<string | null> {
    try {
      return await fs.readFile(filePath, 'utf8')
    } catch {
      return null
    }
  }

  // Write a file
  async writeFile(filePath: string, data: string): Promise<boolean> {
    try {
      // Create directories if they don't exist
      await fs.mkdir(path.dirname(filePath), { recursive: true })
      await fs.writeFile(filePath, data, 'utf8')
      return true
    } catch {
      return false
    }
  }

  // Delete a file
  async deleteFile(filePath: string): Promise<boolean> {
    try {
      await fs.unlink(filePath)
      return true
    } catch {
      return false
    }
  }

  // Launch a game with parameters — returns once process is confirmed running.
  // If protocolId is provided, the process is monitored after the initial check
  // window and a 'game-crashed' IPC event is sent to all BrowserWindows if the
  // game later exits with a non-zero code.
  async launchGame(executable: string, args: string[], protocolId?: string): Promise<boolean> {
    try {
      const executablePath = this.resolveExecutablePath(executable)

      const startTime = Date.now()

      return await new Promise<boolean>((resolve) => {
        let settled = false

        const proc = spawn(executablePath, args, {
          detached: true,
          stdio: 'ignore'
        })

        const finish = (result: boolean): void => {
          if (settled) return
          settled = true
          clearTimeout(timeout)
          resolve(result)
        }

        const sendGameExited = (exitCode: number | null): void => {
          const sessionSeconds = Math.round((Date.now() - startTime) / 1000)
          const wins = BrowserWindow.getAllWindows()
          for (const win of wins) {
            win.webContents.send('game-exited', {
              protocolId,
              exitCode,
              sessionSeconds,
              clean: exitCode === 0
            })
          }
        }

        // Check window: if the process exits abnormally within this
        // time, we treat it as a launch failure
        const checkWindow = 500
        const timeout = setTimeout(() => {
          // Still running after check window — treat as launched successfully
          proc.unref()
          finish(true)
        }, checkWindow)

        proc.on('error', (err) => {
          console.error('Failed to launch game process:', err)
          finish(false)
        })

        proc.on('exit', (code) => {
          if (code === 0 && !settled) {
            // Clean exit within window — process ran and finished OK
            finish(true)
          } else if (!settled) {
            // Non-zero or null exit within window — launch failure
            console.error(`Game process exited with code ${code} immediately after launch`)
            finish(false)
          }

          // Fire-and-forget: notify frontend about every exit
          // (regardless of timing or exit code) so it can record playtime
          sendGameExited(code)
        })
      })
    } catch (error) {
      console.error('Error launching game:', error)
      return false
    }
  }

  private resolveExecutablePath(userInput: string): string {
    // Only needed on macOS
    if (process.platform !== 'darwin') {
      return userInput
    }

    // If it ends with .app, convert to actual executable
    if (userInput.endsWith('.app')) {
      const appName = userInput.split('/').pop()!.replace('.app', '')
      return `${userInput}/Contents/MacOS/${appName}`
    }

    // If they just gave us a name like "gzdoom", assume it's in /Applications
    if (!userInput.includes('/')) {
      return `/Applications/${userInput}.app/Contents/MacOS/${userInput}`
    }

    return userInput
  }
}

export const fileService = new FileService()

