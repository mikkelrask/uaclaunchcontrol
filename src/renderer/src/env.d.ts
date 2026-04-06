/// <reference types="vite/client" />

interface ICustomAPI {
  onVersionsUpdated: (callback: (data?: any) => void) => void
}

declare global {
  interface Window {
    electron: any
    api: ICustomAPI
  }
}

export {}
