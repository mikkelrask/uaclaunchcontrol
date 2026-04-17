import { contextBridge, ipcRenderer, webUtils } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
const api = {
  onVersionsUpdated: (callback: (data?: unknown) => void) =>
    ipcRenderer.on('doom-versions-updated', (_event, data) => callback(data)),
  onUpdateStatus: (callback: (data: unknown) => void) =>
    ipcRenderer.on('update-status', (_event, data) => callback(data)),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  triggerFakeUpdate: () => ipcRenderer.invoke('trigger-fake-update'),
  getInstallType: () => ipcRenderer.invoke('get-install-type'),
  getPathForFile: (file: File) => webUtils.getPathForFile(file)
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
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
