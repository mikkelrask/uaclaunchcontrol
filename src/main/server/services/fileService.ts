import fs from 'fs/promises'
import path from 'path'
import { spawn } from 'child_process'
import { Stats, createWriteStream, type WriteStream } from 'fs'
import { BrowserWindow } from 'electron'
import { logFilePathFor } from '../storage'
import { matchGameplayEvent } from './gameplayWatchers'

import { createLogger } from '@shared/logger'
const log = createLogger('fileService')

const LOG_RING_BUFFER_SIZE = 60

// Service to handle file system operations
export class FileService {
  // Check if a file exists
  async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath)
      return true
    } catch {
      log.error('[fileService] fileExists failed:', filePath)
      return false
    }
  }

  // Get info about a file
  async getFileInfo(filePath: string): Promise<Stats | null> {
    try {
      return await fs.stat(filePath)
    } catch {
      log.error('[fileService] getFileInfo failed:', filePath)
      return null
    }
  }

  // Read a directory
  async readDirectory(dirPath: string): Promise<string[]> {
    try {
      return await fs.readdir(dirPath)
    } catch {
      log.error('[fileService] readDirectory failed:', dirPath)
      return []
    }
  }

  // Read a file as text
  async readFile(filePath: string): Promise<string | null> {
    try {
      return await fs.readFile(filePath, 'utf8')
    } catch {
      log.error('[fileService] readFile failed:', filePath)
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
      log.error('[fileService] writeFile failed:', filePath)
      return false
    }
  }

  // Delete a file
  async deleteFile(filePath: string): Promise<boolean> {
    try {
      await fs.unlink(filePath)
      return true
    } catch {
      log.error('[fileService] deleteFile failed:', filePath)
      return false
    }
  }

  // Launch a game with parameters — returns once process is confirmed running.
  // If protocolId is provided, the process is monitored after the initial check
  // window and a 'game-crashed' IPC event is sent to all BrowserWindows if the
  // game later exits with a non-zero code. Console output is piped (not
  // ignored) so a crash can be explained, and scanned live for gameplay
  // events (reaching a map, activating a cheat) for achievement flavor.
  async launchGame(executable: string, args: string[], protocolId?: string): Promise<boolean> {
    try {
      const executablePath = this.resolveExecutablePath(executable)

      const startTime = Date.now()
      const logTail: string[] = []
      const logFilePath = protocolId ? logFilePathFor(protocolId) : undefined
      let logStream: WriteStream | null = null
      try {
        if (logFilePath) logStream = createWriteStream(logFilePath, { flags: 'w' })
      } catch (err: unknown) {
        log.error('[fileService] Failed to open launch log file:', err)
      }

      return await new Promise<boolean>((resolve) => {
        let settled = false

        const proc = spawn(executablePath, args, {
          detached: true,
          stdio: ['ignore', 'pipe', 'pipe']
        })

        const finish = (result: boolean): void => {
          if (settled) return
          settled = true
          clearTimeout(timeout)
          resolve(result)
        }

        // A source port's stdout isn't a TTY once piped, so most engines
        // switch to block-buffered output — 'data' events land on arbitrary
        // byte boundaries, not line boundaries. A line (e.g. a map banner)
        // can straddle two chunks, so incomplete trailing text from one
        // chunk must be carried over and prepended to the next.
        let pendingLine = ''

        const processLines = (lines: string[]): void => {
          logTail.push(...lines)
          if (logTail.length > LOG_RING_BUFFER_SIZE) {
            logTail.splice(0, logTail.length - LOG_RING_BUFFER_SIZE)
          }

          for (const line of lines) {
            const match = matchGameplayEvent(line)
            if (match) {
              const wins = BrowserWindow.getAllWindows()
              for (const win of wins) {
                win.webContents.send('game-event-detected', { protocolId, ...match })
              }
            }
          }
        }

        const onOutput = (chunk: Buffer): void => {
          logStream?.write(chunk)

          const text = pendingLine + chunk.toString('utf8')
          const parts = text.split('\n')
          pendingLine = parts.pop() ?? ''
          processLines(parts.filter(Boolean))
        }
        proc.stdout?.on('data', onOutput)
        proc.stderr?.on('data', onOutput)

        const sendGameExited = (exitCode: number | null): void => {
          const sessionSeconds = Math.round((Date.now() - startTime) / 1000)
          const wins = BrowserWindow.getAllWindows()
          for (const win of wins) {
            win.webContents.send('game-exited', {
              protocolId,
              exitCode,
              sessionSeconds,
              clean: exitCode === 0,
              logTail: [...logTail],
              logFilePath
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
          log.error('Failed to launch game process:', err)
          finish(false)
        })

        proc.on('exit', (code) => {
          if (code === 0 && !settled) {
            // Clean exit within window — process ran and finished OK
            finish(true)
          } else if (!settled) {
            // Non-zero or null exit within window — launch failure
            log.error(`Game process exited with code ${code} immediately after launch`)
            finish(false)
          }

          // Flush a final line that never got a trailing newline (e.g. the
          // process died mid-write)
          if (pendingLine) {
            processLines([pendingLine])
            pendingLine = ''
          }

          // Stop listening before the streams could otherwise keep the
          // main process's event loop alive after we've stopped caring
          proc.stdout?.destroy()
          proc.stderr?.destroy()
          logStream?.end()

          // Fire-and-forget: notify frontend about every exit
          // (regardless of timing or exit code) so it can record playtime
          sendGameExited(code)
        })
      })
    } catch (error: unknown) {
      log.error('Error launching game:', error)
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
