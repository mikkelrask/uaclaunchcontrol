/// <reference types="vite/client" />

import { IUpdateInfo, IVersionData } from '@shared/schema'

interface ICustomAPI {
  onVersionsUpdated: (callback: (data?: IVersionData) => void) => void
  onGameExited: (
    callback: (data: {
      protocolId?: string
      exitCode: number | null
      sessionSeconds: number
      clean: boolean
    }) => void
  ) => void
  onUpdateStatus: (callback: (data: IUpdateInfo) => void) => void
  getAppVersion: () => Promise<string>
  checkForUpdates: () => Promise<void>
  downloadUpdate: () => Promise<void>
  installUpdate: () => Promise<void>
  triggerFakeUpdate: () => Promise<void>
  getInstallType: () => Promise<{ isAppImage: boolean; isSystemInstalled: boolean }>
  getPathForFile: (file: File) => string
}

declare global {
  interface Window {
    electron: Record<string, unknown>
    api: ICustomAPI
  }
}

export {}
