// Run with Electron after npm run build. Uses fixture APIs and a temporary profile;
// it never starts the real backend or reads/writes the user's UAC settings.
const { app, BrowserWindow, ipcMain, session } = require('electron')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const assert = require('node:assert/strict')

console.log('Starting isolated Electron renderer test')
const deadline = setTimeout(() => {
  console.error('Electron test exceeded 30 seconds')
  app.exit(1)
}, 30000)
const root = path.resolve(__dirname, '../..')
const renderer = process.env.UAC_I18N_RENDERER || path.join(root, 'out/renderer/index.html')
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'uac-i18n-electron-'))
app.setPath('userData', profile)
app.disableHardwareAcceleration()
let language = 'da-DK'
let settings = {
  language,
  theme: 'dark',
  sourcePorts: [],
  databaseLinkPresets: [],
  selectedPresetIndex: 0,
  configPath: '/fixture/uac',
  wadFilesDirectory: '/fixture/wads',
  uiScale: 100
}
const network = []
const errors = []
const stats = {
  totalProtocolsCreated: 0,
  totalProtocolsLaunched: 0,
  totalModFilesAdded: 0,
  totalWadsImported: 0,
  totalPlaytimeSeconds: 0,
  totalCatalogFilesManaged: 0,
  protocolsLaunchedThisSession: 0,
  distinctProtocolsLaunched: [],
  maxModFilesInSingleProtocol: 0,
  totalSourcePortsAdded: 0,
  distinctSourcePortFamilies: [],
  reachedIconOfSin: 0
}
const player = { rank: 'cadet', achievements: {}, stats }
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
async function waitFor(window, expression) {
  const deadline = Date.now() + 10000
  while (Date.now() < deadline) {
    if (await window.webContents.executeJavaScript(expression)) return
    await pause(50)
  }
  throw new Error(`Timed out: ${expression}`)
}

ipcMain.on('get-first-run', (event) => {
  event.returnValue = false
})
ipcMain.handle('get-app-version', () => '1.0.0')
ipcMain.handle('get-install-type', () => ({ isAppImage: false, isSystemInstalled: true }))
ipcMain.handle('set-zoom-factor', () => {})

app
  .whenReady()
  .then(async () => {
    console.log('Electron ready')
    const isolated = session.fromPartition('i18n-smoke')
    isolated.webRequest.onBeforeRequest(
      { urls: ['http://*/*', 'https://*/*'] },
      (details, callback) => {
        network.push(details.url)
        callback({ cancel: !details.url.startsWith('http://localhost:7666/') })
      }
    )
    await isolated.protocol.handle('http', async (request) => {
      const url = new URL(request.url)
      assert.equal(url.origin, 'http://localhost:7666')
      let result = []
      if (url.pathname === '/api/settings') {
        if (request.method === 'PUT') settings = { ...settings, ...(await request.json()) }
        result = settings
      } else if (url.pathname === '/api/player-data') result = player
      else if (url.pathname.startsWith('/api/player-data/')) result = player
      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      })
    })
    const window = new BrowserWindow({
      show: false,
      width: 1280,
      height: 900,
      webPreferences: {
        session: isolated,
        sandbox: true,
        contextIsolation: true,
        offscreen: true,
        backgroundThrottling: false,
        preload: path.resolve(path.dirname(renderer), '../preload/index.js')
      }
    })
    window.webContents.on('console-message', (event) => {
      if (event.level === 'error' || /Content Security Policy|EvalError/.test(event.message))
        errors.push(event.message)
    })
    window.webContents.on('render-process-gone', (_event, details) =>
      errors.push(JSON.stringify(details))
    )

    for (const [locale, launch, label] of [
      ['da-DK', 'START', 'Sprog'],
      ['es-ES', 'LAUNCH', 'Language'],
      ['en', 'LAUNCH', 'Language']
    ]) {
      language = locale
      settings.language = language
      console.log('Loading fixture language:', locale)
      await window.loadFile(renderer)
      await waitFor(
        window,
        `document.documentElement.lang === ${JSON.stringify(locale)} && [...document.querySelectorAll('nav a')].some(el => el.textContent.trim() === ${JSON.stringify(launch)})`
      )
      // Exercise the application's existing Settings shortcut in the isolated fixture.
      window.webContents.sendInputEvent({ type: 'keyDown', keyCode: '.', modifiers: ['control'] })
      window.webContents.sendInputEvent({ type: 'keyUp', keyCode: '.', modifiers: ['control'] })
      await waitFor(
        window,
        `!!document.querySelector('[role="dialog"]') && document.querySelector('[role="dialog"]').textContent.includes(${JSON.stringify(label)})`
      )
      const csp = await window.webContents.executeJavaScript(
        `document.querySelector('meta[http-equiv="Content-Security-Policy"]').content`
      )
      assert(csp.includes("script-src 'self';"))
      assert(!csp.includes('unsafe-eval'))
      const placeholderText = await window.webContents.executeJavaScript(
        `document.querySelector('[role="dialog"]').textContent`
      )
      assert(!placeholderText.includes('{br}'))
      if (locale === 'da-DK' && process.env.UAC_I18N_SCREENSHOT) {
        await pause(300)
        fs.writeFileSync(
          process.env.UAC_I18N_SCREENSHOT,
          (await window.webContents.capturePage()).toPNG()
        )
      }
      console.log(`PASS packaged file:// renderer: ${locale}; settings, rich text, CSP, sandbox`)
    }
    assert(
      network.every((url) => url.startsWith('http://localhost:7666/')),
      JSON.stringify(network)
    )
    assert.equal(errors.length, 0, errors.join('\n'))
    console.log('PASS no external requests, renderer errors or CSP violations')
    clearTimeout(deadline)
    window.destroy()
    app.quit()
  })
  .catch((error) => {
    console.error(error)
    app.exit(1)
  })
app.on('quit', () => fs.rmSync(profile, { recursive: true, force: true }))
