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

let fixtureFirstRun = false
let settingsFailures = 0
let settingsWrites = 0
ipcMain.on('get-first-run', (event) => {
  event.returnValue = fixtureFirstRun
})
ipcMain.handle('get-app-version', () => '1.0.0')
let fixtureInstallType = { isAppImage: true, isSystemInstalled: false }
const updateCalls = { downloads: 0, installs: 0, cancellations: 0 }
ipcMain.handle('get-install-type', () => fixtureInstallType)
ipcMain.handle('check-for-updates', () => {})
ipcMain.handle('download-update', (event) => {
  updateCalls.downloads++
  event.sender.send('update-status', { status: 'downloading', percent: 42.5 })
})
ipcMain.handle('install-update', () => {
  updateCalls.installs++
})
ipcMain.handle('cancel-mod-download', (event, id) => {
  updateCalls.cancellations++
  event.sender.send('mod-download-status', { state: 'cancelled', id })
})
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
        if (request.method === 'PUT') {
          settingsWrites++
          const payload = await request.json()
          if (settingsFailures > 0) {
            settingsFailures--
            return new Response(JSON.stringify({ message: 'fixture_save_failed' }), {
              status: 500,
              headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
            })
          }
          settings = { ...settings, ...payload }
        }
        result = settings
      } else if (url.pathname === '/api/protocols') result = [protocolFixture]
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
    // Missing preferences stay English, even before the first-run boot sequence.
    for (const [choice, firstRun] of [
      ['en', false],
      ['system', false],
      ['da-DK', true]
    ]) {
      delete settings.language
      fixtureFirstRun = firstRun
      const beforeChoice = { ...settings }
      const writesBefore = settingsWrites
      await window.loadFile(renderer)
      await waitFor(
        window,
        `document.querySelector('[role="dialog"]')?.textContent.includes(${JSON.stringify(catalogs.en['languageStartup.title'])})`
      )
      assert.equal(
        await window.webContents.executeJavaScript('document.documentElement.lang'),
        'en'
      )
      assert.deepEqual(
        await window.webContents.executeJavaScript(
          `[...document.querySelectorAll('input[name="startup-language"]')].map(el => el.value)`
        ),
        ['system', 'en', 'da-DK']
      )
      assert.equal(settingsWrites, writesBefore)
      const initialDeviceLanguages =
        await window.webContents.executeJavaScript('navigator.languages')
      const initialMatch = initialDeviceLanguages.find((tag) => /^(en|da)(-|_|$)/i.test(tag))
      const initialSystemName = initialMatch?.toLowerCase().startsWith('da') ? 'Dansk' : 'English'
      const systemDescription = catalogs.en['languageStartup.systemDescription'].replace(
        '{languageName}',
        initialSystemName
      )
      assert(
        (
          await window.webContents.executeJavaScript(
            `document.querySelector('[role="dialog"]').textContent`
          )
        ).includes(systemDescription)
      )
      assert(!(await window.webContents.executeJavaScript(`!!document.querySelector('nav')`)))
      window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' })
      window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Escape' })
      assert(
        await window.webContents.executeJavaScript(
          `!!document.querySelector('input[name="startup-language"]')`
        )
      )
      if (choice !== 'en')
        await clickSelector(window, `input[name="startup-language"][value="${choice}"]`)
      if (choice === 'en') {
        settingsFailures = 1
        await clickSelector(window, 'button', catalogs.en['languageStartup.continue'])
        await waitFor(
          window,
          `document.querySelector('[role="alert"]')?.textContent.includes('fixture_save_failed')`
        )
        assert.equal(settings.language, undefined)
        assert.equal(
          await window.webContents.executeJavaScript('document.documentElement.lang'),
          'en'
        )
      }
      if (choice === 'da-DK' && process.env.UAC_I18N_LANGUAGE_SCREENSHOT) {
        await pause(200)
        fs.writeFileSync(
          process.env.UAC_I18N_LANGUAGE_SCREENSHOT,
          (await window.webContents.capturePage()).toPNG()
        )
      }
      if (firstRun) {
        window.setSize(640, 480)
        await pause(50)
        await waitFor(
          window,
          `[...document.querySelector('[role="dialog"]').getAnimations()].every(animation => animation.playState !== 'running')`
        )
        const bounds = await window.webContents.executeJavaScript(`(() => {
          const el = document.querySelector('[role="dialog"]');
          const rect = el.getBoundingClientRect();
          return { top: rect.top, bottom: rect.bottom, height: innerHeight, right: rect.right, width: innerWidth, maxHeight: getComputedStyle(el).maxHeight };
        })()`)
        assert(
          bounds.top >= 0 && bounds.bottom <= bounds.height && bounds.right <= bounds.width,
          JSON.stringify(bounds)
        )
        window.setSize(1280, 900)
        await pause(100)
      }
      await clickSelector(window, 'button', catalogs.en['languageStartup.continue'])
      const deviceLanguages = await window.webContents.executeJavaScript('navigator.languages')
      const matched = deviceLanguages.find((tag) => /^(en|da)(-|_|$)/i.test(tag))
      const expected =
        choice === 'system' ? (matched?.toLowerCase().startsWith('da') ? 'da-DK' : 'en') : choice
      await waitFor(
        window,
        `document.documentElement.lang === ${JSON.stringify(expected)} && !document.querySelector('input[name="startup-language"]')`
      )
      assert.deepEqual(settings, { ...beforeChoice, language: choice })
      await translations.changeLanguage(expected)
      if (firstRun) {
        await waitFor(
          window,
          `document.body.textContent.includes(${JSON.stringify(translations.t('onboarding.welcome.title'))})`
        )
        assert(!(await window.webContents.executeJavaScript(`!!document.querySelector('nav')`)))
      } else {
        await waitFor(window, `!!document.querySelector('nav')`)
      }
      // An explicit choice, including System and English, survives a renderer restart.
      await window.loadFile(renderer)
      await waitFor(
        window,
        `document.documentElement.lang === ${JSON.stringify(expected)} && !!document.querySelector('${firstRun ? 'body' : 'nav'}')`
      )
      assert(
        !(await window.webContents.executeJavaScript(
          `!!document.querySelector('input[name="startup-language"]')`
        ))
      )
      console.log(
        `PASS startup language choice: ${choice}; firstRun=${firstRun}; persistence/retry`
      )
    }
    fixtureFirstRun = false
    // An old Spanish preference remains valid data and displays English until released.
    settings.language = 'es-ES'
    await window.loadFile(renderer)
    await waitFor(
      window,
      `document.documentElement.lang === 'en' && !!document.querySelector('nav')`
    )
    assert(
      !(await window.webContents.executeJavaScript(
        `!!document.querySelector('input[name="startup-language"]')`
      ))
    )
    assert.equal(settings.language, 'es-ES')

    for (const locale of ['da-DK', 'en']) {
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

      await clickSelector(window, 'header button:has(img)')
      await waitFor(
        window,
        `document.body.textContent.includes(${JSON.stringify(message('achievements.profile.title'))})`
      )
      for (const [category, expected] of [
        ['progression', message('achievements.items.first-protocol.title')],
        ['collection', message('achievements.items.mod-collector.title')],
        ['combat', message('achievements.items.first-blood.title')],
        ['exploration', message('achievements.items.world-traveler.title')],
        ['secret', message('achievements.card.secretHint')]
      ]) {
        await waitFor(
          window,
          `document.querySelector('[role="tab"][id$="-trigger-${category}"]').textContent.trim() === ${JSON.stringify(message('achievements.category.' + category))}`
        )
        await clickSelector(window, `[role="tab"][id$="-trigger-${category}"]`)
        await waitFor(
          window,
          `document.querySelector('[role="tabpanel"][data-state="active"]').textContent.includes(${JSON.stringify(expected)})`
        )
      }
      if (locale === 'da-DK' && process.env.UAC_I18N_PROFILE_SCREENSHOT) {
        await clickSelector(window, '[role="tab"][id$="-trigger-progression"]')
        await pause(200)
        fs.writeFileSync(
          process.env.UAC_I18N_PROFILE_SCREENSHOT,
          (await window.webContents.capturePage()).toPNG()
        )
      }
      window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' })
      window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Escape' })
      await waitFor(window, `!document.querySelector('[role="dialog"]')`)
      await clickSelector(
        window,
        `button[aria-label=${JSON.stringify(message('navigation.notifications'))}]`
      )
      await waitFor(
        window,
        `document.body.textContent.includes(${JSON.stringify(message('notifications.empty'))})`
      )
      window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' })
      window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Escape' })
      await waitFor(window, `!document.querySelector('[role="dialog"]')`)
      // Exercise the application's existing Settings shortcut in the isolated fixture.
      window.webContents.sendInputEvent({ type: 'keyDown', keyCode: '.', modifiers: ['control'] })
      window.webContents.sendInputEvent({ type: 'keyUp', keyCode: '.', modifiers: ['control'] })
      await waitFor(
        window,
        `!!document.querySelector('[role="dialog"]') && document.querySelector('[role="dialog"]').textContent.includes(${JSON.stringify(label)})`
      )
      await clickSelector(window, 'button[id$="-language"]')
      await waitFor(window, `document.querySelectorAll('[role="option"]').length === 3`)
      const languageOptions = await window.webContents.executeJavaScript(
        `[...document.querySelectorAll('[role="option"]')].map(el => el.textContent)`
      )
      assert(languageOptions.includes('English'))
      assert(languageOptions.includes('Dansk'))
      assert(!languageOptions.some((label) => label.includes('Español')))
      window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' })
      window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Escape' })
      await waitFor(window, `!document.querySelector('[role="option"]')`)
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
      window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' })
      window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Escape' })
      await waitFor(window, `!document.querySelector('[role="dialog"]')`)
      await clickSelector(
        window,
        `button[aria-label=${JSON.stringify(message('navigation.menu'))}]`
      )
      await waitFor(window, `!!document.querySelector('[role="dialog"]')`)
      assert(
        (await window.webContents.executeJavaScript('document.body.textContent')).includes(
          message('about.description')
        )
      )
      assert(
        (await window.webContents.executeJavaScript('document.body.textContent')).includes(
          message('about.repository')
        )
      )
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
          // A real catalog validation warning exercises translated diagnostic headings,
          // history classification and the shared notification accessibility defaults.
          await window.webContents.executeJavaScript(`(() => {
            const input = document.querySelector('#edit-name');
            Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '');
            input.dispatchEvent(new Event('input', { bubbles: true }));
          })()`)
          await clickSelector(window, '[role="dialog"] button', message('catalog.edit.saveChanges'))
          const warningTitle = message('notifications.status.caution', { code: 'name_required' })
          await waitFor(
            window,
            `document.body.textContent.includes(${JSON.stringify(warningTitle)})`
          )
          const warningHistory = await window.webContents.executeJavaScript(
            `JSON.parse(localStorage.getItem('uac:notifications') || '[]')`
          )
          assert(
            warningHistory.some((item) => item.kind === 'warning' && item.title === warningTitle)
          )
          await waitFor(
            window,
            `!!document.querySelector('button[aria-label=' + ${JSON.stringify(JSON.stringify(message('ui.toast.close')))} + ']')`
          )
          const regionLabel = await window.webContents.executeJavaScript(
            `document.querySelector('ol[tabindex="-1"]')?.parentElement.getAttribute('aria-label')`
          )
          assert.equal(regionLabel, message('ui.toast.viewport', { hotkey: 'F8' }))
          await clickSelector(
            window,
            `button[aria-label=${JSON.stringify(message('ui.toast.close'))}]`
          )
          await clickSelector(window, '[role="dialog"] button', message('catalog.edit.cancel'))
          await waitFor(window, `!document.querySelector('[role="dialog"]')`)
        }
      }

      // Exercise production update/download IPC with fixture-only handlers. No real installs or transfers.
      const callsBefore = { ...updateCalls }
      window.webContents.send('update-status', {
        status: 'available',
        version: '9.9.1-fixture',
        releaseNotes: '# Knee Deep in the Dead\n\nKeep GZDoom and UZDoom names.'
      })
      await waitFor(
        window,
        `document.body.textContent.includes(${JSON.stringify(message('updates.notice.available', { version: '9.9.1-fixture' }))})`
      )
      await clickSelector(window, 'button', message('updates.action.view'))
      await waitFor(
        window,
        `document.querySelector('[role="dialog"]')?.textContent.includes(${JSON.stringify(message('updates.dialog.title'))})`
      )
      const updateBody = await window.webContents.executeJavaScript(
        `document.querySelector('[role="dialog"]').textContent`
      )
      assert(updateBody.includes('9.9.1-fixture'))
      assert(updateBody.includes('Knee Deep in the Dead'))
      assert(updateBody.includes('GZDoom and UZDoom'))
      if (locale === 'da-DK' && process.env.UAC_I18N_UPDATE_SCREENSHOT) {
        await pause(200)
        fs.writeFileSync(
          process.env.UAC_I18N_UPDATE_SCREENSHOT,
          (await window.webContents.capturePage()).toPNG()
        )
      }
      await clickSelector(window, '[role="dialog"] button', message('updates.dialog.download'))
      const percent = new Intl.NumberFormat(locale, {
        style: 'percent',
        maximumFractionDigits: 0
      }).format(0.425)
      await waitFor(
        window,
        `document.querySelector('[role="dialog"]').textContent.includes(${JSON.stringify(percent)})`
      )
      const progressBody = await window.webContents.executeJavaScript(
        `document.querySelector('[role="dialog"]').textContent`
      )
      assert(progressBody.includes('9.9.1-fixture'), 'Progress must retain the release version')
      assert(progressBody.includes('Knee Deep in the Dead'), 'Progress must retain release notes')
      window.webContents.send('update-status', { status: 'downloaded', version: '9.9.1-fixture' })
      await waitFor(
        window,
        `document.querySelector('[role="dialog"]').textContent.includes(${JSON.stringify(message('updates.dialog.install'))})`
      )
      await clickSelector(window, '[role="dialog"] button', message('updates.dialog.install'))
      await waitFor(window, 'true')
      assert.equal(updateCalls.downloads, callsBefore.downloads + 1)
      assert.equal(updateCalls.installs, callsBefore.installs + 1)
      await clickSelector(window, '[role="dialog"] button', message('ui.dialog.close'))
      await waitFor(window, `!document.querySelector('[role="dialog"]')`)
      const history = await window.webContents.executeJavaScript(
        `JSON.parse(localStorage.getItem('uac:notifications') || '[]')`
      )
      assert(
        history.some(
          (entry) =>
            entry.kind === 'update' &&
            entry.title === message('updates.notice.availableTitle') &&
            entry.action?.kind === 'view-update'
        )
      )
      assert(
        history.some(
          (entry) =>
            entry.kind === 'update' &&
            entry.title === message('updates.notice.readyTitle') &&
            entry.action?.kind === 'restart-update'
        )
      )

      window.webContents.send('mod-download-status', {
        state: 'preparing',
        id: 'fixture-wait',
        message: 'opaque backend phase',
        phase: 'waiting-for-moddb'
      })
      await waitFor(
        window,
        `document.body.textContent.includes(${JSON.stringify(message('downloads.waitingForModdb'))})`
      )
      await clickSelector(window, 'button', message('downloads.cancel'))
      await waitFor(
        window,
        `document.body.textContent.includes(${JSON.stringify(message('downloads.cancelled'))})`
      )
      assert.equal(updateCalls.cancellations, callsBefore.cancellations + 1)
      await clickSelector(
        window,
        `button[aria-label=${JSON.stringify(message('downloads.dismiss'))}]`
      )
      await waitFor(
        window,
        `!document.body.textContent.includes(${JSON.stringify(message('downloads.cancelled'))})`
      )
      window.webContents.send('mod-download-status', {
        state: 'started',
        id: 'fixture-progress',
        fileName: 'Knee Deep {release}.pk3',
        source: 'github'
      })
      window.webContents.send('mod-download-status', {
        state: 'progress',
        id: 'fixture-progress',
        percent: 42.5,
        receivedBytes: 425,
        totalBytes: 1000
      })
      await waitFor(
        window,
        `document.body.textContent.includes('Knee Deep {release}.pk3') && document.body.textContent.includes(${JSON.stringify(percent)})`
      )
      window.webContents.send('mod-download-status', {
        state: 'completed',
        id: 'fixture-progress',
        filePath: '',
        alreadyInCatalog: true
      })
      await waitFor(
        window,
        `document.body.textContent.includes(${JSON.stringify(message('downloads.alreadyCataloged'))})`
      )
      await clickSelector(
        window,
        `button[aria-label=${JSON.stringify(message('downloads.dismiss'))}]`
      )
      await waitFor(
        window,
        `!document.body.textContent.includes(${JSON.stringify(message('downloads.alreadyCataloged'))})`
      )
      window.webContents.send('mod-download-status', {
        state: 'error',
        id: 'fixture-fallback',
        message: 'opaque backend failure',
        reason: { code: 'browser-fallback' }
      })
      await waitFor(
        window,
        `document.body.textContent.includes(${JSON.stringify(message('downloads.browserFallback'))})`
      )
      const fallbackBody = await window.webContents.executeJavaScript(`document.body.textContent`)
      assert(!fallbackBody.includes('opaque backend failure'))
      if (locale === 'da-DK' && process.env.UAC_I18N_DOWNLOAD_SCREENSHOT) {
        await pause(200)
        fs.writeFileSync(
          process.env.UAC_I18N_DOWNLOAD_SCREENSHOT,
          (await window.webContents.capturePage()).toPNG()
        )
      }
      await clickSelector(
        window,
        `button[aria-label=${JSON.stringify(message('downloads.dismiss'))}]`
      )
      await waitFor(
        window,
        `!document.body.textContent.includes(${JSON.stringify(message('downloads.browserFallback'))})`
      )

      // Crash replay and copy use captured fixture data and an in-memory clipboard.
      const crashFixture = {
        protocolName: 'Knee Deep fixture',
        exitCode: 7,
        sessionSeconds: 1234,
        logTail: [
          'Script error, "Fixture.pk3:DECORATE" line 12:',
          'raw path /fixture/{unchanged}',
          '<script>window.fixtureBad = true</script>'
        ]
      }
      await window.webContents.executeJavaScript(
        `Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { window.fixtureCopiedLog = text } } }); window.dispatchEvent(new CustomEvent('show-crash-log-modal', { detail: ${JSON.stringify(crashFixture)} }))`
      )
      await waitFor(
        window,
        `document.querySelector('[role="dialog"]')?.textContent.includes(${JSON.stringify(message('crash.hint.script'))})`
      )
      const crashBody = await window.webContents.executeJavaScript(
        `document.querySelector('[role="dialog"]').textContent`
      )
      assert(crashBody.includes(message('crash.title', { protocol: crashFixture.protocolName })))
      assert(crashBody.includes(message('crash.exitSummary', { code: 7, seconds: 1234 })))
      assert(
        !crashBody.includes(message('crash.openFile')),
        'Historical replay must not offer a mutable log-file path'
      )
      assert.equal(
        await window.webContents.executeJavaScript(
          `document.querySelector('[role="dialog"] pre').textContent`
        ),
        crashFixture.logTail.join('\n')
      )
      assert(!(await window.webContents.executeJavaScript('Boolean(window.fixtureBad)')))
      if (locale === 'da-DK' && process.env.UAC_I18N_CRASH_SCREENSHOT) {
        await pause(200)
        fs.writeFileSync(
          process.env.UAC_I18N_CRASH_SCREENSHOT,
          (await window.webContents.capturePage()).toPNG()
        )
      }
      await clickSelector(window, '[role="dialog"] button', message('crash.copy'))
      await waitFor(
        window,
        `window.fixtureCopiedLog === ${JSON.stringify(crashFixture.logTail.join('\n'))}`
      )
      await waitFor(
        window,
        `document.body.textContent.includes(${JSON.stringify(message('crash.copied'))})`
      )
      await clickSelector(window, '[role="dialog"] button', message('ui.dialog.close'))
      await waitFor(window, `!document.querySelector('[role="dialog"]')`)
      await window.webContents.executeJavaScript(
        `window.dispatchEvent(new CustomEvent('show-crash-log-modal', { detail: { exitCode: null, sessionSeconds: 0, logTail: [] } }))`
      )
      await waitFor(
        window,
        `document.querySelector('[role="dialog"]')?.textContent.includes(${JSON.stringify(message('crash.noOutput'))})`
      )
      assert(
        (
          await window.webContents.executeJavaScript(
            `document.querySelector('[role="dialog"]').textContent`
          )
        ).includes(message('crash.signalSummary', { seconds: 0 }))
      )
      await clickSelector(window, '[role="dialog"] button', message('ui.dialog.close'))
      await waitFor(window, `!document.querySelector('[role="dialog"]')`)
      window.webContents.send('doom-versions-updated', {
        added: [{ name: 'Knee Deep IWAD fixture' }]
      })
      await waitFor(
        window,
        `document.body.textContent.includes(${JSON.stringify(message('watcher.added', { name: 'Knee Deep IWAD fixture' }))})`
      )
      window.webContents.send('doom-versions-updated', {
        removed: [{ name: 'Knee Deep IWAD fixture' }]
      })
      await waitFor(
        window,
        `document.body.textContent.includes(${JSON.stringify(message('watcher.removed', { name: 'Knee Deep IWAD fixture' }))})`
      )
      await window.webContents.executeJavaScript(`window.location.hash = '/missing-fixture-route'`)
      await waitFor(
        window,
        `document.body.textContent.includes(${JSON.stringify(message('notFound.title'))})`
      )
      await window.webContents.executeJavaScript(`window.location.hash = '/'`)
      await waitFor(window, `!!document.querySelector('nav a')`)
      if (locale === 'en') {
        // System package installs offer the release link, without self-update actions.
        fixtureInstallType = { isAppImage: false, isSystemInstalled: true }
        await window.loadFile(renderer)
        await waitFor(
          window,
          `document.documentElement.lang === 'en' && !!document.querySelector('nav a')`
        )
        window.webContents.send('update-status', {
          status: 'available',
          version: '9.9.2-system-fixture'
        })
        await waitFor(
          window,
          `document.body.textContent.includes(${JSON.stringify(message('updates.notice.available', { version: '9.9.2-system-fixture' }))})`
        )
        await clickSelector(window, 'button', message('updates.action.view'))
        await waitFor(
          window,
          `!!document.querySelector('[role="dialog"]') && ![...document.querySelectorAll('[role="dialog"] button')].some(button => button.textContent.trim() === ${JSON.stringify(message('updates.dialog.download'))})`
        )
        window.webContents.send('update-status', {
          status: 'downloaded',
          version: '9.9.2-system-fixture'
        })
        await waitFor(
          window,
          `document.body.textContent.includes(${JSON.stringify(message('updates.notice.ready', { version: '9.9.2-system-fixture' }))})`
        )
        assert(
          !(await window.webContents.executeJavaScript(
            `[...document.querySelectorAll('[role="dialog"] button')].some(button => button.textContent.trim() === ${JSON.stringify(message('updates.dialog.install'))})`
          ))
        )
        await clickSelector(window, '[role="dialog"] button', message('ui.dialog.close'))
        await waitFor(window, `!document.querySelector('[role="dialog"]')`)
        assert.equal(updateCalls.downloads, callsBefore.downloads + 1)
        assert.equal(updateCalls.installs, callsBefore.installs + 1)
      }
      // Each locale reload should start with an empty notification-history fixture.
      await window.webContents.executeJavaScript(`localStorage.removeItem('uac:notifications')`)
      console.log(
        `PASS file:// renderer: ${locale}; crash replay/raw-log copy, watcher/About/404, updates/downloads, profile, settings, onboarding, library/install, CSP, sandbox`
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
