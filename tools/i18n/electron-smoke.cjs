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
  console.error('Electron test exceeded 60 seconds')
  app.exit(1)
}, 60000)
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
  modsDirectory: '/fixture/mods',
  savegamesPath: '/fixture/saves',
  screenshotsPath: '/fixture/screenshots',
  uiScale: 100
}
const protocolFixture = {
  id: 'localisation-fixture',
  name: 'Fixture Protocol',
  title: 'Fixture Protocol',
  description: '',
  doomVersionId: 'doom-fixture',
  files: [],
  playtimeSeconds: 5400,
  lastLaunchedAt: '2026-10-24T12:00:00Z',
  launchParameters: '-skill 4'
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
  fs.writeFileSync(
    '/tmp/uac-i18n-smoke-dom.txt',
    await window.webContents.executeJavaScript('document.body.innerHTML')
  )
  fs.writeFileSync(
    '/tmp/uac-i18n-smoke-failure.png',
    (await window.webContents.capturePage()).toPNG()
  )
  throw new Error(`Timed out: ${expression}`)
}

// Native input targets are measured from the disposable renderer, never a live app.
async function clickSelector(window, selector, text) {
  const point = await window.webContents.executeJavaScript(`(async () => {
    const element = [...document.querySelectorAll(${JSON.stringify(selector)})].find(el => ${JSON.stringify(text)} === undefined || el.textContent.trim() === ${JSON.stringify(text)})
    if (!element) throw new Error('Missing fixture control: ' + ${JSON.stringify(selector)})
    const animations = []
    for (let parent = element; parent; parent = parent.parentElement) {
      animations.push(...parent.getAnimations().filter(animation => animation.effect?.getTiming().iterations !== Infinity))
    }
    await Promise.allSettled(animations.map(animation => animation.finished))
    element.scrollIntoView({ block: 'center' })
    const rect = element.getBoundingClientRect()
    return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2), hoverCard: !!element.closest('.game-card') }
  })()`)
  window.webContents.sendInputEvent({ type: 'mouseMove', x: point.x, y: point.y })
  if (point.hoverCard) await pause(350)
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
      } else if (url.pathname === '/api/settings/default-paths')
        result = {
          wadFilesDirectory: '/fixture/wads',
          modsDirectory: '/fixture/mods',
          savegamesPath: '/fixture/saves',
          screenshotsPath: '/fixture/screenshots'
        }
      else if (url.pathname === '/api/protocols') result = [protocolFixture]
      else if (url.pathname === '/api/protocols/localisation-fixture')
        result = { protocol: protocolFixture, files: [] }
      else if (url.pathname === '/api/mod-files/catalog')
        result = [
          {
            id: 1,
            name: 'Fixture Mod',
            fileName: 'fixture.pk3',
            fileType: 'PK3',
            filePath: '/fixture/fixture.pk3',
            hashValue: 'a'.repeat(32),
            category: 'weapon'
          }
        ]
      else if (url.pathname === '/api/versions')
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
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, PUT, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
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
      for (const tab of ['paths', 'wad-config', 'source-ports', 'advanced']) {
        await clickSelector(window, `[role="tab"][id$="-trigger-${tab}"]`)
        await waitFor(
          window,
          `(() => {
            const trigger = document.querySelector('[role="tab"][id$="-trigger-${tab}"]')
            const panel = document.getElementById(trigger?.getAttribute('aria-controls'))
            return trigger?.getAttribute('data-state') === 'active' && !!panel?.getClientRects().length && panel.textContent.trim().length > 0
          })()`
        )
        if (tab === 'advanced') {
          await clickSelector(window, '[role="tabpanel"][data-state="active"] details > summary')
          await waitFor(
            window,
            `!!document.querySelector('[role="tabpanel"][data-state="active"] details[open]')`
          )
          const content = await window.webContents.executeJavaScript(
            `document.querySelector('[role="tabpanel"][data-state="active"]').textContent`
          )
          assert(content.includes('--variable-name: hue saturation lightness;'))
          assert(content.includes('.custom { ... }'))
          assert(!content.includes('{wrapper}'))
        }
        if (tab === 'source-ports') {
          // Scan only fixtures; check the active catalog or English fallback.
          await clickSelector(
            window,
            '[data-testid="settings-dialog"] button',
            message('sourcePorts.scanPath')
          )
          await waitFor(
            window,
            `[...document.querySelectorAll('[role="dialog"]')].some(el => el.textContent.includes(${JSON.stringify(message('sourcePorts.scan.found', { count: 1 }))}))`
          )
          window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' })
          window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Escape' })
          await waitFor(window, `document.querySelectorAll('[role="dialog"]').length === 1`)
          await clickSelector(
            window,
            '[data-testid="settings-dialog"] button',
            message('sourcePorts.get')
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
      window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' })
      window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Escape' })
      await waitFor(window, `!document.querySelector('[role="dialog"]')`)
      await clickSelector(
        window,
        `button[aria-label=${JSON.stringify(message('navigation.menu'))}]`
      )
      await waitFor(window, `!!document.querySelector('[role="dialog"]')`)
      await clickSelector(window, 'button', message('navigation.tour'))
      await waitFor(
        window,
        `document.body.textContent.includes(${JSON.stringify(message('onboarding.welcome.title'))})`
      )
      await waitFor(
        window,
        `document.body.textContent.includes(${JSON.stringify(message('onboarding.boot.access'))})`
      )
      await waitFor(window, `!document.querySelector('.fixed.inset-0.z-50')`)
      await clickSelector(window, 'button', message('onboarding.welcome.initialize'))
      await waitFor(
        window,
        `[...document.querySelectorAll('h2')].some(el => el.textContent === ${JSON.stringify(message('sourcePorts.title'))})`
      )
      await waitFor(
        window,
        `document.body.textContent.includes(${JSON.stringify(message('sourcePorts.scan.found', { count: 1 }))})`
      )
      await clickSelector(window, 'button', message('onboarding.next'))
      await waitFor(
        window,
        `[...document.querySelectorAll('h2')].some(el => el.textContent === ${JSON.stringify(message('onboarding.wads.title'))})`
      )
      const wadGuide = await window.webContents.executeJavaScript(
        `document.querySelector('a[href="https://uac-soft.online/guides/acquiring-doom/"]')?.textContent`
      )
      assert.equal(wadGuide, message('onboarding.wads.acquireGuide'))
      await clickSelector(window, 'button', message('onboarding.next'))
      await waitFor(
        window,
        `[...document.querySelectorAll('h2')].some(el => el.textContent === ${JSON.stringify(message('onboarding.registry.title'))})`
      )
      const registryToggle = await window.webContents.executeJavaScript(
        `document.querySelector('[role="switch"]')?.getAttribute('data-state')`
      )
      assert.equal(registryToggle, 'unchecked')
      await clickSelector(window, 'button', message('onboarding.next'))
      const summary = message('onboarding.complete.summary', { portCount: 0, wadCount: 1 })
      await waitFor(window, `document.body.textContent.includes(${JSON.stringify(summary)})`)
      await clickSelector(window, 'button', message('onboarding.complete.finish'))
      await waitFor(
        window,
        `!document.body.textContent.includes(${JSON.stringify(message('onboarding.skip'))})`
      )
      assert(!settings.registryLookupEnabled)
      assert.equal(settings.wadFilesDirectory, '/fixture/wads')
      assert.equal(settings.sourcePorts.length, 0)
      // Allow the fixture's final settings-save/cache refresh to settle before reloading.
      await pause(200)
      // Library and install forms use only the disposable API fixture above.
      await waitFor(window, `document.body.textContent.includes('Fixture Protocol')`)
      for (const mode of ['list', 'detail', 'grid']) {
        await clickSelector(
          window,
          `button[title=${JSON.stringify(message('library.view.' + mode))}]`
        )
        await waitFor(
          window,
          `!!document.querySelector('button[title=' + ${JSON.stringify(JSON.stringify(message('library.view.' + mode)))} + '] span')`
        )
      }
      await clickSelector(window, 'button', message('library.card.adjust'))
      await waitFor(
        window,
        `document.querySelector('[role="dialog"]')?.textContent.includes(${JSON.stringify(message('library.editor.saveChanges'))})`
      )
      await clickSelector(window, 'button', message('library.editor.deleteInstance'))
      await waitFor(
        window,
        `[...document.querySelectorAll('[role="dialog"]')].some(el => el.textContent.includes(${JSON.stringify(message('library.delete.deleteThisProtocol'))}))`
      )
      await clickSelector(window, '[role="dialog"] button', message('library.delete.cancel'))
      await waitFor(window, `document.querySelectorAll('[role="dialog"]').length === 1`)
      window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' })
      window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Escape' })
      await waitFor(window, `!document.querySelector('[role="dialog"]')`)
      await clickSelector(window, 'nav a[href$="/install?tab=install"]')
      await waitFor(
        window,
        `document.body.textContent.includes(${JSON.stringify(message('install.page.newLaunchProtocol'))})`
      )
      await window.webContents.executeJavaScript(
        `document.querySelector('[role="tabpanel"] form').requestSubmit()`
      )
      await waitFor(
        window,
        `document.body.textContent.includes(${JSON.stringify(message('install.validation.title'))})`
      )
      for (const [tab, expected] of [
        ['files', message('install.page.manageYourFileCatalogAddNewFilesOrRemove')],
        ['wads', message('install.wads.dragDropWadHereOrClickToSelect')],
        ['install', message('install.configuration.protocolIdentity')]
      ]) {
        await clickSelector(window, `[role="tab"][id$="-trigger-${tab}"]`)
        await waitFor(
          window,
          `document.querySelector('[role="tabpanel"][data-state="active"]').textContent.includes(${JSON.stringify(expected)})`
        )
        if (tab === 'files') {
          await waitFor(
            window,
            `document.querySelector('table')?.textContent.includes('Fixture Mod')`
          )
          const content = await window.webContents.executeJavaScript(
            `document.querySelector('table').textContent`
          )
          assert(content.includes(message('catalog.category.weapon')))
          await clickSelector(
            window,
            `button[title=${JSON.stringify(message('catalog.columns.edit'))}]`
          )
          await waitFor(
            window,
            `document.querySelector('[role="dialog"]')?.textContent.includes(${JSON.stringify(message('catalog.fields.category'))})`
          )
          window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' })
          window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Escape' })
          await waitFor(window, `!document.querySelector('[role="dialog"]')`)
        }
      }
      console.log(
        `PASS file:// renderer: ${locale}; settings, downloads, shortcuts, complete onboarding/boot, library views/editor/delete cancellation, install tabs/validation, CSP, sandbox`
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
