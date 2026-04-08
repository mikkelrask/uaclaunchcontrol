/// <reference types="vite/client" />

interface IVersionData {
  added?: Array<{ name: string }>
  removed?: Array<{ name: string }>
}

interface ICustomAPI {
  onVersionsUpdated: (callback: (data?: IVersionData) => void) => void
}

declare global {
  interface Window {
    electron: Record<string, unknown>
    api: ICustomAPI
  }
}

export {}
