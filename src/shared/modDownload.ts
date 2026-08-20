// Shared types for in-app mod downloads (GitHub release assets / ModDB start pages)
import type { IModFile } from './schema'

export type ModDownloadEvent =
  | { state: 'preparing'; id: string; message: string }
  | { state: 'started'; id: string; fileName: string; source: 'github' | 'moddb' }
  | {
      state: 'progress'
      id: string
      percent: number
      receivedBytes: number
      totalBytes: number
    }
  | {
      state: 'completed'
      id: string
      filePath: string
      catalogEntry?: IModFile
      alreadyInCatalog?: boolean
    }
  | { state: 'cancelled'; id: string }
  | { state: 'error'; id: string; message: string }
