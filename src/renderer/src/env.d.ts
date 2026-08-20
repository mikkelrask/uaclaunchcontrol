/// <reference types="vite/client" />

import { IUpdateInfo, IVersionData } from '@shared/schema'
import { ModDownloadEvent } from '@shared/modDownload'

interface ICustomAPI {
  onVersionsUpdated: (callback: (data?: IVersionData) => void) => void
  onGameExited: (
    callback: (data: {
      protocolId?: string
      exitCode: number | null
      sessionSeconds: number
      clean: boolean
      logTail: string[]
      logFilePath?: string
    }) => void
  ) => void
  onGameEventDetected: (
    callback: (
      data: { protocolId?: string } & (
        | { type: 'MAP_REACHED'; mapName: string }
        | { type: 'CHEAT_ACTIVATED'; cheat: string }
      )
    ) => void
  ) => void
  onUpdateStatus: (callback: (data: IUpdateInfo) => void) => void
  onModDownloadStatus: (callback: (data: ModDownloadEvent) => void) => void
  cancelModDownload: (id: string) => Promise<void>
  getAppVersion: () => Promise<string>
  checkForUpdates: () => Promise<void>
  downloadUpdate: () => Promise<void>
  installUpdate: () => Promise<void>
  triggerFakeUpdate: () => Promise<void>
  getInstallType: () => Promise<{ isAppImage: boolean; isSystemInstalled: boolean }>
  getPathForFile: (file: File) => string
  openLogFile: (filePath: string) => Promise<void>
  setZoomFactor: (factor: number) => Promise<void>
}

declare global {
  interface Window {
    electron: Record<string, unknown>
    api: ICustomAPI
  }
}

export {}
