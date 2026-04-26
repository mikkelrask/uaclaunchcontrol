import { app, shell, BrowserWindow, ipcMain, nativeImage } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { startServer } from './server'
import { autoUpdater } from 'electron-updater'
import { getSettings } from './server/storage'
import { IInstallType } from '../shared/schema'

const isDebug = process.env.DEBUG === 'true'

function debug(...args: unknown[]): void {
  if (isDebug) {
    console.log(...args)
  }
}

let mainWindow: BrowserWindow | null = null
let lastCheckWasManual = false

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

function getInstallType(): IInstallType {
  const isLinux = process.platform === 'linux'
  if (!isLinux) {
    debug('[InstallType] Not Linux, returning false for both')
    return { isAppImage: false, isSystemInstalled: false }
  }

  const execPath = process.execPath

  debug(`[InstallType] APPDIR env: ${!!process.env.APPDIR}`)
  debug(`[InstallType] APPIMAGE env: ${!!process.env.APPIMAGE}`)
  debug(`[InstallType] execPath: ${execPath}`)

  // Check if running AS AppImage (env vars)
  const isAppImage = !!process.env.APPDIR || !!process.env.APPIMAGE

  // Check if currently running FROM system location
  const isSystemInstalled = execPath.startsWith('/opt/') || execPath.startsWith('/usr/')

  debug(`[InstallType] Result: isAppImage=${isAppImage}, isSystemInstalled=${isSystemInstalled}`)

  return { isAppImage, isSystemInstalled }
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

  if (app.isPackaged) {
    mainWindow.removeMenu()
  }

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
    mainWindow?.webContents.send('update-status', {
      status: 'not-available',
      version: app.getVersion(),
      isManual: lastCheckWasManual
    })
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

async function checkForUpdates(options: { manual?: boolean } = {}): Promise<void> {
  if (!is.dev) {
    lastCheckWasManual = options.manual ?? false

    if (!options.manual) {
      try {
        const settings = await getSettings()
        if (settings.autoUpdateEnabled === false) {
          console.log('[AutoUpdater] Skipping - disabled in settings')
          return
        }
      } catch {
        // Continue with update check if we can't read settings
      }
    }
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

  ipcMain.handle('check-for-updates', async () => {
    await checkForUpdates({ manual: true })
  })

  ipcMain.handle('get-install-type', () => {
    debug('[IPC] get-install-type called')
    const result = getInstallType()
    console.log('[IPC] get-install-type returning:', result)
    return result
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
