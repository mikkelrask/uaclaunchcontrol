import { contextBridge, ipcRenderer, webUtils } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
const api = {
  onVersionsUpdated: (callback: (data?: unknown) => void) =>
    ipcRenderer.on('doom-versions-updated', (_event, data) => callback(data)),
  onGameExited: (
    callback: (data: {
      protocolId?: string
      exitCode: number | null
      sessionSeconds: number
      clean: boolean
      logTail: string[]
      logFilePath?: string
    }) => void
  ) => ipcRenderer.on('game-exited', (_event, data) => callback(data)),
  onGameEventDetected: (
    callback: (
      data: { protocolId?: string } & (
        | { type: 'MAP_REACHED'; mapName: string }
        | { type: 'CHEAT_ACTIVATED'; cheat: string }
      )
    ) => void
  ) => ipcRenderer.on('game-event-detected', (_event, data) => callback(data)),
  onUpdateStatus: (callback: (data: unknown) => void) =>
    ipcRenderer.on('update-status', (_event, data) => callback(data)),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  triggerFakeUpdate: () => ipcRenderer.invoke('trigger-fake-update'),
  getInstallType: () => ipcRenderer.invoke('get-install-type'),
  getPathForFile: (file: File) => webUtils.getPathForFile(file),
  openLogFile: (filePath: string) => ipcRenderer.invoke('open-log-file', filePath)
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-expect-error (define in dts)
  window.electron = electronAPI
  // @ts-expect-error (define in dts)
  window.api = api
}
