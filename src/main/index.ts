import { app, shell, BrowserWindow, ipcMain, nativeImage } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'
import https from 'https'
import { IncomingMessage } from 'http'
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

  // Log ALL env vars that might indicate AppImage
  const envKeys = Object.keys(process.env).filter((k) => k.includes('APP'))
  debug(`[InstallType] Possible AppImage env vars: ${envKeys.join(', ')}`)
  debug(`[InstallType] APPDIR: ${process.env.APPDIR || 'NOT SET'}`)
  debug(`[InstallType] APPIMAGE: ${process.env.APPIMAGE || 'NOT SET'}`)
  debug(`[InstallType] execPath: ${execPath}`)
  debug(`[InstallType] execPath includes /tmp: ${execPath.includes('/tmp')}`)

  // Check if running AS AppImage (env vars)
  // AppImage typically sets APPDIR and APPIMAGE env vars
  const isAppImage = !!process.env.APPDIR || !!process.env.APPIMAGE || execPath.includes('/tmp')

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
    debug('[AutoUpdater] Checking for update...')
    mainWindow?.webContents.send('update-status', { status: 'checking' })
  })

  autoUpdater.on('update-available', (info) => {
    debug(`[AutoUpdater] Update available: ${info.version}`)
    mainWindow?.webContents.send('update-status', {
      status: 'available',
      version: info.version,
      releaseNotes: info.releaseNotes
    })
  })

  autoUpdater.on('update-not-available', () => {
    debug(`[AutoUpdater] Update NOT available. Current version: ${app.getVersion()}`)
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
    debug(`[AutoUpdater] Update downloaded: ${info.version}`)
    mainWindow?.webContents.send('update-status', {
      status: 'downloaded',
      version: info.version
    })
  })

  autoUpdater.on('error', (error) => {
    debug(`[AutoUpdater] Error: ${error.message}`)
    mainWindow?.webContents.send('update-status', {
      status: 'error',
      error: error.message
    })
  })
}

async function checkForUpdates(options: { manual?: boolean } = {}): Promise<void> {
  if (!is.dev) {
    lastCheckWasManual = options.manual ?? false
    debug(`[AutoUpdater] checkForUpdates called, manual: ${lastCheckWasManual}`)

    if (!options.manual) {
      try {
        const settings = await getSettings()
        if (settings.autoUpdateEnabled === false) {
          debug('[AutoUpdater] Skipping - disabled in settings')
          return
        }
      } catch {
        // Continue with update check if we can't read settings
      }
    }

    // For system installs (deb/AUR), electron-updater can't find updates
    // because it looks for AppImage files. So we call GitHub API directly.
    const installType = getInstallType()

    if (installType.isSystemInstalled && !installType.isAppImage) {
      // System install - check GitHub releases directly
      debug(`[AutoUpdater] System install detected, checking GitHub API directly`)
      checkGitHubRelease()
      return
    }

    // AppImage or other - use electron-updater
    debug(`[AutoUpdater] Calling autoUpdater.checkForUpdates()`)
    autoUpdater.checkForUpdates().catch((err) => {
      debug(`[AutoUpdater] Error: ${err.message}`)
    })
  } else {
    debug('[AutoUpdater] Skipped - running in dev mode')
  }
}

async function checkGitHubRelease(): Promise<void> {
  const currentVersion = app.getVersion()
  debug(`[AutoUpdater] Checking GitHub for latest version (current: ${currentVersion})`)

  return new Promise((resolve) => {
    const req = https.get(
      'https://api.github.com/repos/mikkelrask/uaclaunchcontrol/releases/latest',
      (res: IncomingMessage) => {
        let data = ''
        res.on('data', (chunk: string) => { data += chunk })
        res.on('end', () => {
          try {
            const release = JSON.parse(data) as { tag_name: string; html_url: string; body?: string }
            const latestVersion = (release.tag_name || '').replace(/^v/, '')
            debug(`[AutoUpdater] Latest version: ${latestVersion}`)

            if (latestVersion && latestVersion !== currentVersion) {
              debug(`[AutoUpdater] Update available: ${latestVersion}`)
              mainWindow?.webContents.send('update-status', {
                status: 'available',
                version: latestVersion,
                releaseNotes: release.body || ''
              })
            } else {
              debug(`[AutoUpdater] No update available`)
              mainWindow?.webContents.send('update-status', {
                status: 'not-available',
                version: currentVersion,
                isManual: lastCheckWasManual
              })
            }
          } catch (err) {
            debug(`[AutoUpdater] GitHub API parse error: ${(err as Error).message}`)
            if (lastCheckWasManual) {
              mainWindow?.webContents.send('update-status', {
                status: 'not-available',
                version: currentVersion,
                isManual: true
              })
            }
          }
          resolve()
        })
      }
    )

    req.on('error', (err: Error) => {
      debug(`[AutoUpdater] GitHub API error: ${err.message}`)
      if (lastCheckWasManual) {
        mainWindow?.webContents.send('update-status', {
          status: 'not-available',
          version: currentVersion,
          isManual: true
        })
      }
      resolve()
    })
  })
}

app.whenReady().then(async () => {
  await startServer()

  // Log install type on startup
  const installType = getInstallType()
  debug(`[Startup] Install type: ${JSON.stringify(installType)}`)
  debug(`[Startup] App version: ${app.getVersion()}`)
  debug(`[Startup] Platform: ${process.platform}, execPath: ${process.execPath}`)

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
    const installType = getInstallType()
    debug(`[FakeUpdate] Install type: ${JSON.stringify(installType)}`)

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
