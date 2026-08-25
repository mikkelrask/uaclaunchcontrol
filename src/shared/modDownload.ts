// Shared types for in-app mod downloads (GitHub release assets / ModDB start pages)
import type { IModFile } from './schema'

/** Pruned registry metadata for a downloaded archive, carried into the import UI. */
export interface ModDownloadRegistryMeta {
  name: string
  version?: string
  url?: string
  category?: string | null
}

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
      /** Registry metadata of the downloaded archive (zips hand off to the import UI). */
      registry?: ModDownloadRegistryMeta
    }
  | { state: 'cancelled'; id: string }
  | { state: 'error'; id: string; message: string }
