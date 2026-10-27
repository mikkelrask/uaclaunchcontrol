// Run with Electron after npm run build. Uses fixture APIs and a temporary profile;
// it never starts the real backend or reads/writes the user's UAC settings.
const { app, BrowserWindow, ipcMain, session } = require('electron')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const assert = require('node:assert/strict')
const { Tolgee } = require('@tolgee/react')
const { FormatIcu } = require('@tolgee/format-icu')
const catalogs = Object.fromEntries(
  ['en', 'da-DK', 'es-ES'].map((locale) => [
    locale,
    require(`../../src/renderer/src/lib/i18n/locales/desktop/${locale}.json`)
  ])
)
const translations = Tolgee()
  .use(FormatIcu())
  .init({ language: 'en', fallbackLanguage: 'en', staticData: catalogs })

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

// Native input targets are measured from the disposable renderer, never a live app.
async function clickSelector(window, selector) {
  const point = await window.webContents.executeJavaScript(`(() => {
    const element = document.querySelector(${JSON.stringify(selector)})
    if (!element) throw new Error('Missing fixture control: ' + ${JSON.stringify(selector)})
    const rect = element.getBoundingClientRect()
    return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) }
  })()`)
  window.webContents.sendInputEvent({ type: 'mouseDown', button: 'left', clickCount: 1, ...point })
  window.webContents.sendInputEvent({ type: 'mouseUp', button: 'left', clickCount: 1, ...point })
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
      } else if (url.pathname === '/api/versions')
        result = [
          {
            id: 'doom-fixture',
            name: 'Doom II',
            slug: 'doom2',
            defaultIwad: '/fixture/DOOM2.WAD',
            args: '-iwad DOOM2.WAD',
            parameters: '-nomonsters',
            icon: ''
          }
        ]
      else if (url.pathname === '/api/settings/scan-ports')
        result = [{ path: '/fixture/UZDoom.AppImage', name: 'UZDoom', family: 'uzdoom' }]
      else if (url.pathname === '/api/ports/releases')
        result = [
          {
            repo: 'UZDoom/UZDoom',
            tag: 'v99',
            version: '99.0.0',
            prerelease: true,
            publishedAt: '2026-10-01T12:00:00Z',
            asset: { name: 'UZDoom.AppImage', url: 'https://example.invalid/engine', size: 1572864 }
          }
        ]
      else if (url.pathname === '/api/player-data') result = player
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

    await translations.run()
    for (const locale of ['da-DK', 'es-ES', 'en']) {
      await translations.changeLanguage(locale)
      const message = (key, params) => translations.t(key, params)
      const launch = message('navigation.launch')
      const label = message('settings.language.label')
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
      for (const [tab, expected] of [
        ['paths', message('settings.paths.title')],
        ['wad-config', message('settings.wads.identity')],
        ['source-ports', message('sourcePorts.infrastructure')],
        ['advanced', message('settings.customTheme.title')]
      ]) {
        await clickSelector(window, `[role="tab"][id$="-trigger-${tab}"]`)
        await waitFor(
          window,
          `document.querySelector('[role="tabpanel"][data-state="active"]').textContent.includes(${JSON.stringify(expected)})`
        )
        if (tab === 'advanced') {
          const content = await window.webContents.executeJavaScript(
            `document.querySelector('[role="tabpanel"][data-state="active"]').textContent`
          )
          assert(content.includes('--variable-name: hue saturation lightness;'))
          assert(content.includes('.custom { ... }'))
          assert(!content.includes('{wrapper}'))
        }
        if (tab === 'source-ports') {
          // Scan only fixtures; check the active catalog or English fallback.
          await clickSelector(window, '[role="tabpanel"][data-state="active"] button')
          await waitFor(
            window,
            `document.querySelector('[role="tabpanel"][data-state="active"]').textContent.includes(${JSON.stringify(message('sourcePorts.scan.found', { count: 1 }))})`
          )
          await clickSelector(
            window,
            '[role="tabpanel"][data-state="active"] button:nth-of-type(2)'
          )
          await waitFor(
            window,
            `[...document.querySelectorAll('[role="dialog"]')].some(el => el.textContent.includes('99.0.0') && el.textContent.includes(${JSON.stringify(message('portDownload.preview'))}))`
          )
          const body = await window.webContents.executeJavaScript(`document.body.textContent`)
          assert(body.includes('UZDoom.AppImage'))
          assert(
            body.includes(
              new Intl.NumberFormat(locale, {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1
              }).format(1.5) + ' MB'
            )
          )
          assert(
            body.includes(
              new Intl.DateTimeFormat(locale, {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
              }).format(new Date('2026-10-01T12:00:00Z'))
            )
          )
          window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' })
          window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Escape' })
          await waitFor(window, `document.querySelectorAll('[role="dialog"]').length === 1`)
        }
      }
      window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' })
      window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Escape' })
      await waitFor(window, `!document.querySelector('[role="dialog"]')`)
      window.webContents.sendInputEvent({ type: 'keyDown', keyCode: '?', modifiers: ['shift'] })
      window.webContents.sendInputEvent({ type: 'keyUp', keyCode: '?', modifiers: ['shift'] })
      await waitFor(
        window,
        `!!document.querySelector('[role="dialog"]') && document.querySelector('[role="dialog"]').textContent.includes(${JSON.stringify(message('shortcuts.search'))})`
      )
      const keys = await window.webContents.executeJavaScript(
        `document.querySelector('[role="dialog"]').textContent`
      )
      assert(keys.includes('Ctrl + .'))
      assert(keys.includes(message('shortcuts.moreInfo', { wiki: message('shortcuts.wiki') })))
      console.log(
        `PASS file:// renderer: ${locale}; all settings tabs, scan/downloads, shortcuts, rich text, CSP, sandbox`
      )
    }
    assert(
      network.every((url) => url.startsWith('http://localhost:7666/')),
      JSON.stringify(network)
    )
    assert.equal(errors.length, 0, errors.join('\n'))
    console.log('PASS no external requests, renderer errors or CSP violations')
    translations.stop()
    clearTimeout(deadline)
    window.destroy()
    app.quit()
  })
  .catch((error) => {
    console.error(error)
    app.exit(1)
  })
app.on('quit', () => fs.rmSync(profile, { recursive: true, force: true }))
