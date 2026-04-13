import { app, shell, BrowserWindow, ipcMain, nativeImage } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { startServer } from './server'
import { autoUpdater } from 'electron-updater'

const isDebug = process.env.DEBUG === 'true'

function debug(...args: unknown[]): void {
  if (isDebug) {
    console.log(...args)
  }
}

let mainWindow: BrowserWindow | null = null

function getLinuxIcon(): Electron.BrowserWindowConstructorOptions['icon'] | undefined {
  if (process.platform !== 'linux') return undefined

  let iconPath: string | undefined
  let iconSource = ''

  if (process.env.APPDIR) {
    iconPath = join(process.env.APPDIR, 'resources', 'app.asar.unpacked', 'resources', 'icon.png')
    iconSource = 'AppImage'
    if (!existsSync(iconPath)) {
      debug('[Icon] AppImage icon not found at:', iconPath)
      iconPath = undefined
    }
  }

  if (!iconPath) {
    iconPath = join(__dirname, '../../resources/icon.png')
    iconSource = 'dev/fallback'
    if (!existsSync(iconPath)) {
      debug('[Icon] Fallback icon not found at:', iconPath)
      return undefined
    }
  }

  debug('[Icon] Using icon from:', iconPath, '(source:', iconSource + ')')
  const img = nativeImage.createFromPath(iconPath)
  if (img.isEmpty()) {
    debug('[Icon] WARNING: Image is empty!')
    return undefined
  }
  debug('[Icon] Image dimensions:', img.getSize())
  return img
}

function createWindow(): void {
  const linuxIcon = getLinuxIcon()

  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    show: false,
    autoHideMenuBar: true,
    title: 'UAC Launch Control',
    ...(process.platform === 'linux' && linuxIcon ? { icon: linuxIcon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.maximize()

  mainWindow.on('ready-to-show', () => {
    if (process.platform === 'linux' && linuxIcon) {
      mainWindow?.setIcon(linuxIcon)
      debug('[Icon] Icon set via setIcon() in ready-to-show')
    }
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function setupAutoUpdater(): void {
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => {
    mainWindow?.webContents.send('update-status', { status: 'checking' })
  })

  autoUpdater.on('update-available', (info) => {
    mainWindow?.webContents.send('update-status', {
      status: 'available',
      version: info.version,
      releaseNotes: info.releaseNotes
    })
  })

  autoUpdater.on('update-not-available', () => {
    mainWindow?.webContents.send('update-status', { status: 'not-available' })
  })

  autoUpdater.on('download-progress', (progress) => {
    mainWindow?.webContents.send('update-status', {
      status: 'downloading',
      percent: progress.percent
    })
  })

  autoUpdater.on('update-downloaded', (info) => {
    mainWindow?.webContents.send('update-status', {
      status: 'downloaded',
      version: info.version
    })
  })

  autoUpdater.on('error', (error) => {
    mainWindow?.webContents.send('update-status', {
      status: 'error',
      error: error.message
    })
  })
}

function checkForUpdates(): void {
  if (!is.dev) {
    autoUpdater.checkForUpdates().catch((err) => {
      console.error('Error checking for updates:', err)
    })
  }
}

app.whenReady().then(async () => {
  await startServer()

  electronApp.setAppUserModelId('com.electron')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.on('ping', () => console.log('pong'))

  ipcMain.handle('get-app-version', () => {
    return app.getVersion()
  })

  ipcMain.handle('check-for-updates', () => {
    checkForUpdates()
  })

  ipcMain.handle('download-update', () => {
    autoUpdater.downloadUpdate().catch((err) => {
      console.error('Error downloading update:', err)
    })
  })

  ipcMain.handle('install-update', () => {
    autoUpdater.quitAndInstall()
  })

  ipcMain.handle('trigger-fake-update', () => {
    mainWindow?.webContents.send('update-status', {
      status: 'available',
      version: '0.2.4',
      releaseNotes:
        '## Bug Fixes\n- Fixed crash when loading mods\n- Improved performance\n\n## Features\n- New dark theme option\n- Added auto-update system'
    })
  })

  createWindow()

  setupAutoUpdater()
  checkForUpdates()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
