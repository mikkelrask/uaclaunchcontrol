// Exercise the built first-run tour with a disposable Electron profile and fixture APIs.
// The real backend, user configuration, file chooser and downloads are never accessed.
const { app, BrowserWindow, ipcMain, session } = require('electron')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const assert = require('node:assert/strict')

const root = path.resolve(__dirname, '../..')
const renderer = process.env.UAC_ONBOARDING_RENDERER || path.join(root, 'out/renderer/index.html')
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'uac-onboarding-electron-'))
const diagnosticDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'uac-onboarding-smoke-'))
const screenshotDirectory = process.env.UAC_ONBOARDING_SCREENSHOT_DIR
app.setPath('userData', profile)
app.disableHardwareAcceleration()
const deadline = setTimeout(() => {
  console.error('Onboarding integration test exceeded 90 seconds')
  app.exit(1)
}, 90000)

let firstRun = true
const defaultPaths = {
  wadFilesDirectory: '/fixture/wads',
  modsDirectory: '/fixture/mods',
  savegamesPath: '/fixture/saves',
  screenshotsPath: '/fixture/screenshots'
}
let settings = {
  ...defaultPaths,
  language: 'en',
  theme: 'dark',
  sourcePorts: [],
  databaseLinkPresets: [],
  selectedPresetIndex: 0,
  configPath: '/fixture/uac',
  uiScale: 100,
  defaultView: 'grid',
  registryLookupEnabled: false,
  autoUpdateEnabled: false,
  showLaunchPreview: true
}
let versions = []
const scannedPorts = [
  { path: '/usr/bin/gzdoom', name: 'GZDoom', family: 'gzdoom' },
  { path: '/home/operator/.local/bin/Helion.AppImage', name: 'Helion', family: 'helion' },
  { path: '/home/operator/.local/bin/UZDoom.AppImage', name: 'UZDoom', family: 'uzdoom' },
  {
    path: '/home/operator/.local/bin/UZDoom-experimental.AppImage',
    name: 'UZDoom experimental',
    family: 'uzdoom'
  },
  { path: '/usr/bin/zandronum', name: 'Zandronum', family: 'zandronum' },
  { path: '/usr/bin/zandronum-server', name: 'Zandronum server', family: 'zandronum' },
  { path: '/usr/bin/zdoom', name: 'ZDoom', family: 'zdoom' }
]
const commercialGames = [
  ['doom', 'Ultimate Doom (1.9)', 'doom.wad'],
  ['doom2', 'Doom II (1.9)', 'doom2.wad'],
  ['tnt', 'Final Doom: TNT Evilution', 'tnt.wad'],
  ['plutonia', 'Final Doom: The Plutonia Experiment', 'plutonia.wad'],
  ['heretic', 'Heretic', 'heretic.wad'],
  ['hexen', 'Hexen: Beyond Heretic', 'hexen.wad'],
  ['hexdd', 'Hexen: Deathkings of the Dark Citadel', 'hexdd.wad'],
  ['chex', 'Chex Quest', 'chex.wad'],
  ['chex3', 'Chex Quest 3', 'chex3.wad'],
  ['strife', 'Strife', 'strife1.wad'],
  ['hacx', 'Hacx', 'hacx.wad']
].map(([slug, name, file]) => ({
  id: slug,
  slug,
  name,
  defaultIwad: `/fixture/chosen-wads/${file}`,
  args: `-iwad "/fixture/chosen-wads/${file}"`,
  parameters: '',
  icon: ''
}))
const player = {
  rank: 'cadet',
  achievements: {},
  stats: {
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
}
const errors = []
const requests = []
const writes = []
let nextPickerResult = { canceled: true, filePaths: [] }
let failNextDirectory = false
let failNextDownload = false
let failNextVersions = false
let delayNextDirectoryWrite = 0
let delayedDirectoryStarted = false
let directoryFailures = 0
let downloadFailures = 0
let downloadRequests = 0
let scanRequests = 0
let delayNextSettingsWrite = 0
let delayedSaveStarted = false
let window

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const wizard = '[data-testid="onboarding-wizard"]'
const activePanel = `${wizard} [data-onboarding-step="ports"]`
const listSelector = `${activePanel} [data-settings-resource-list]`
const editorSelector = '[data-onboarding-port-editor]'
const scanSelector = `${activePanel} [data-onboarding-scan-result]`

async function evaluate(expression) {
  try {
    return await window.webContents.executeJavaScript(expression)
  } catch (error) {
    throw new Error(`Renderer expression failed: ${expression.slice(0, 600)}`, { cause: error })
  }
}
async function waitFor(expression, description = expression) {
  const end = Date.now() + 10000
  while (Date.now() < end) {
    if (await evaluate(expression)) return
    await pause(40)
  }
  throw new Error(`Timed out: ${description}`)
}
async function click(selector, text) {
  const point = await evaluate(`(async () => {
    const element = [...document.querySelectorAll(${JSON.stringify(selector)})].find(el => el.getClientRects().length && (${JSON.stringify(text)} === undefined || el.textContent.trim() === ${JSON.stringify(text)}))
    if (!element) throw new Error('Missing fixture control: ' + ${JSON.stringify(selector)})
    const animations = []
    for (let parent = element; parent; parent = parent.parentElement) {
      animations.push(...parent.getAnimations().filter(animation => animation.effect?.getTiming().iterations !== Infinity))
    }
    await Promise.allSettled(animations.map(animation => animation.finished))
    element.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    const rect = element.getBoundingClientRect()
    return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) }
  })()`)
  const zoom = window.webContents.getZoomFactor()
  const inputPoint = { x: Math.round(point.x * zoom), y: Math.round(point.y * zoom) }
  window.webContents.sendInputEvent({ type: 'mouseMove', ...inputPoint })
  window.webContents.sendInputEvent({
    type: 'mouseDown',
    button: 'left',
    clickCount: 1,
    ...inputPoint
  })
  window.webContents.sendInputEvent({
    type: 'mouseUp',
    button: 'left',
    clickCount: 1,
    ...inputPoint
  })
  await pause(50)
}
async function fill(selector, value) {
  await click(selector)
  window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'A', modifiers: ['control'] })
  window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'A', modifiers: ['control'] })
  await waitFor(
    `(() => { const input = document.querySelector(${JSON.stringify(selector)}); return input === document.activeElement && input.selectionStart === 0 && input.selectionEnd === input.value.length })()`
  )
  if (value) await window.webContents.insertText(value)
  else {
    window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Backspace' })
    window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Backspace' })
  }
  await waitFor(
    `document.querySelector(${JSON.stringify(selector)})?.value === ${JSON.stringify(value)}`
  )
}
async function rectangle(selector) {
  return evaluate(`(() => {
    const element = document.querySelector(${JSON.stringify(selector)})
    if (!element?.getClientRects().length) throw new Error('Hidden or missing: ' + ${JSON.stringify(selector)})
    const { x, y, width, height } = element.getBoundingClientRect()
    return { x, y, width, height }
  })()`)
}
function sameRectangle(before, after, description) {
  for (const key of ['x', 'y', 'width', 'height']) {
    assert(Math.abs(before[key] - after[key]) < 0.75, `${description}: ${key} moved`)
  }
}
async function capture(name) {
  if (!screenshotDirectory) return
  await evaluate(`(async () => {
    const animations = document.getAnimations().filter(animation => animation.effect?.getTiming().iterations !== Infinity)
    await Promise.allSettled(animations.map(animation => animation.finished))
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  })()`)
  fs.mkdirSync(screenshotDirectory, { recursive: true })
  // Offscreen Chromium can retire a compositor surface during native resize or
  // zoom. Retry that transient capture failure; interaction assertions still fail normally.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const screenshot = await window.webContents.capturePage()
      fs.writeFileSync(path.join(screenshotDirectory, `${name}.png`), screenshot.toPNG())
      return
    } catch (error) {
      if (!String(error).includes('UnknownVizError') || attempt === 2) throw error
      await pause(100)
    }
  }
}

async function key(keyCode) {
  window.webContents.sendInputEvent({ type: 'keyDown', keyCode })
  window.webContents.sendInputEvent({ type: 'keyUp', keyCode })
  await pause(60)
}
async function step(name) {
  await waitFor(
    `!!document.querySelector(${JSON.stringify(`${wizard} [data-onboarding-step="${name}"]`)})`
  )
}
async function footerReachable(name) {
  assert.equal(
    await evaluate(
      'document.querySelectorAll(\'li[data-state="open"][data-swipe-direction]\').length'
    ),
    0,
    'Achievement toast interrupted setup'
  )
  const bounds = await rectangle(wizard)
  const viewport = await evaluate('({ width: innerWidth, height: innerHeight })')
  sameRectangle({ x: 0, y: 0, ...viewport }, bounds, 'Onboarding no longer covers the viewport')
  const next = await rectangle(`${wizard} [data-onboarding-step="${name}"] [data-onboarding-next]`)
  assert(
    next.y >= 0 && next.y + next.height <= viewport.height + 1,
    `${name}: Next is outside viewport`
  )
  assert(
    next.x >= 0 && next.x + next.width <= viewport.width + 1,
    `${name}: Next overflows horizontally`
  )
  const stripTop = await evaluate(
    `Math.min(...[...document.querySelectorAll(${JSON.stringify(`${wizard} .fixed.bottom-4`)})].filter(element => element.getClientRects().length).map(element => element.getBoundingClientRect().top))`
  )
  for (const control of ['next', 'back']) {
    const bounds = await rectangle(
      `${wizard} [data-onboarding-step="${name}"] [data-onboarding-${control}]`
    )
    assert(
      bounds.y + bounds.height < stripTop,
      `${name}: ${control} overlaps the decorative clock/REC strip`
    )
  }
}
async function replay() {
  await evaluate("window.dispatchEvent(new Event('uac:replay-onboarding'))")
  await waitFor(`!!document.querySelector(${JSON.stringify(wizard)})`)
  await waitFor("!document.querySelector('.fixed.inset-0.z-50')")
  await click(`${wizard} [data-onboarding-next]`)
  await step('ports')
}

ipcMain.on('get-first-run', (event) => {
  event.returnValue = firstRun
})
ipcMain.handle('get-app-version', () => '1.0.0')
ipcMain.handle('get-install-type', () => ({ isAppImage: false, isSystemInstalled: true }))
ipcMain.handle('set-zoom-factor', (_event, factor) => window?.webContents.setZoomFactor(factor))

app
  .whenReady()
  .then(async () => {
    const isolated = session.fromPartition('onboarding-smoke')
    isolated.webRequest.onBeforeRequest(
      { urls: ['http://*/*', 'https://*/*'] },
      (details, callback) => {
        requests.push(details.url)
        callback({ cancel: !details.url.startsWith('http://localhost:7666/') })
      }
    )
    await isolated.protocol.handle('http', async (request) => {
      const url = new URL(request.url)
      assert.equal(url.origin, 'http://localhost:7666')
      let result = []
      let status = 200
      if (url.pathname === '/api/settings/default-paths') result = defaultPaths
      else if (url.pathname === '/api/first-run') result = { isFirstRun: firstRun }
      else if (url.pathname === '/api/first-run/dismiss') {
        firstRun = false
        result = {}
      } else if (url.pathname === '/api/settings') {
        if (request.method === 'PUT') {
          const payload = await request.json()
          if (
            delayNextDirectoryWrite &&
            Object.keys(payload).length === 1 &&
            payload.wadFilesDirectory
          ) {
            const delay = delayNextDirectoryWrite
            delayNextDirectoryWrite = 0
            delayedDirectoryStarted = true
            await pause(delay)
          }
          if (delayNextSettingsWrite) {
            const delay = delayNextSettingsWrite
            delayNextSettingsWrite = 0
            delayedSaveStarted = true
            await pause(delay)
          }
          if (payload.wadFilesDirectory && failNextDirectory) {
            failNextDirectory = false
            directoryFailures += 1
            status = 500
            result = { error: 'Deliberate folder-save fixture failure' }
          } else {
            if (payload.sourcePorts)
              assert(
                payload.sourcePorts.every((port) => port.name.trim() && port.executablePath.trim()),
                'An incomplete source port was persisted'
              )
            settings = { ...settings, ...payload }
            writes.push({ resource: 'settings', payload })
            result = settings
          }
        } else result = settings
      } else if (url.pathname === '/api/settings/scan-ports') {
        scanRequests += 1
        await pause(180)
        result = scannedPorts
      } else if (url.pathname === '/api/versions') {
        if (failNextVersions) {
          failNextVersions = false
          status = 500
          result = { error: 'Deliberate base-game scan fixture failure' }
        } else result = versions
      } else if (url.pathname.startsWith('/api/versions/')) result = versions[0] || {}
      else if (url.pathname === '/api/dialog/open') {
        const options = await request.json()
        assert(
          options.properties.includes('openDirectory') || options.properties.includes('openFile')
        )
        result = nextPickerResult
        nextPickerResult = { canceled: true, filePaths: [] }
      } else if (url.pathname === '/api/freedoom/download') {
        const { bundle } = await request.json()
        assert(['phase12', 'freedm'].includes(bundle))
        downloadRequests += 1
        await pause(350)
        if (failNextDownload) {
          failNextDownload = false
          downloadFailures += 1
          status = 500
          result = { error: 'Deliberate download fixture failure' }
        } else {
          const slugs = bundle === 'phase12' ? ['freedoom1', 'freedoom2'] : ['freedm']
          for (const slug of slugs) {
            if (versions.some((version) => version.slug === slug)) continue
            versions.push({
              id: slug,
              slug,
              name: slug === 'freedm' ? 'FreeDM' : `FreeDoom Phase ${slug.endsWith('1') ? 1 : 2}`,
              defaultIwad: `${settings.wadFilesDirectory}/${slug}.wad`,
              args: `-iwad "${settings.wadFilesDirectory}/${slug}.wad"`,
              parameters: '',
              icon: ''
            })
          }
          result = { installed: slugs, doomVersions: versions }
        }
      } else if (url.pathname === '/api/player-data/stats') result = player.stats
      else if (url.pathname === '/api/player-data' || url.pathname.startsWith('/api/player-data/'))
        result = player
      return new Response(JSON.stringify(result), {
        status,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, PUT, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      })
    })
    window = new BrowserWindow({
      show: false,
      width: 1280,
      height: 940,
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
    await window.loadFile(renderer)
    await waitFor(`!!document.querySelector(${JSON.stringify(wizard)})`)
    assert.equal(
      await evaluate('!!document.querySelector("nav a")'),
      false,
      'Fresh-install wizard leaked the launcher shell'
    )
    await waitFor("!document.querySelector('.fixed.inset-0.z-50')")
    await capture('welcome')
    await click(`${wizard} [data-onboarding-next]`)
    await step('ports')
    await waitFor(
      `document.querySelectorAll(${JSON.stringify(`${scanSelector} [data-onboarding-scan-choice]`)}).length === 7`
    )
    assert.equal(scanRequests, 1)
    assert.equal(
      await evaluate('!!document.querySelector("[role=dialog]")'),
      false,
      'Automatic discovery interrupted setup with a modal'
    )
    await footerReachable('ports')
    const frame = await rectangle(`${wizard} .onboarding-stage-inner`)
    assert(frame.width <= 800, 'Setup expanded back into a full-width settings page')
    await capture('ports-discovery')
    window.webContents.setZoomFactor(1.2)
    await waitFor('Math.abs(innerWidth - 1280 / 1.2) < 2')
    await footerReachable('ports')
    await capture('ports-discovery-120')
    window.webContents.setZoomFactor(1)
    await waitFor('innerWidth === 1280')
    await click(`${activePanel} button`, 'Scan Path')
    await waitFor(
      `document.querySelectorAll(${JSON.stringify(`${scanSelector} [data-onboarding-scan-choice]`)}).length === 7`
    )
    assert.equal(scanRequests, 2, 'Manual Scan did not request a fresh discovery')
    await click(`${activePanel} [data-onboarding-scan-import]`)
    await waitFor(
      `document.querySelectorAll(${JSON.stringify(`${listSelector} [data-settings-resource-id]`)}).length === 7`
    )
    await pause(550)
    assert.equal(settings.sourcePorts.length, 7)
    const lastId = settings.sourcePorts.at(-1).id
    const lastRow = `${listSelector} [data-settings-resource-id="${lastId}"]`
    const defaultControl = `${lastRow} [data-onboarding-port-default]`
    await evaluate(
      `document.querySelector(${JSON.stringify(defaultControl)}).scrollIntoView({ block: 'nearest' })`
    )
    const defaultBefore = await rectangle(defaultControl)
    await click(defaultControl)
    sameRectangle(
      defaultBefore,
      await rectangle(defaultControl),
      'Default selection resized its row'
    )
    await pause(550)
    assert.equal(settings.defaultSourcePortId, lastId)
    await evaluate(
      `document.querySelector(${JSON.stringify(`${activePanel} .onboarding-step-body`)}).scrollTop = 0`
    )
    await capture('ports-added')

    // Details appear only on request; unfinished edits never reach saved settings.
    await click(`${lastRow} [data-onboarding-port-edit]`)
    await waitFor(`!!document.querySelector(${JSON.stringify(editorSelector)})`)
    const oldName = settings.sourcePorts.find((port) => port.id === lastId).name
    await fill(`${editorSelector} input[name="name"]`, '')
    assert.equal(
      await evaluate(
        `document.querySelector(${JSON.stringify(`${editorSelector} [data-onboarding-port-save]`)})?.disabled`
      ),
      true
    )
    await pause(550)
    assert.equal(settings.sourcePorts.find((port) => port.id === lastId).name, oldName)
    await key('Escape')
    await waitFor(
      `!document.querySelector(${JSON.stringify(editorSelector)}) && !!document.querySelector(${JSON.stringify(wizard)})`
    )
    await waitFor(`document.activeElement?.hasAttribute('data-onboarding-port-edit')`)

    nextPickerResult = { canceled: false, filePaths: ['/fixture/new-engine/doom'] }
    await click(`${activePanel} button`, 'Add Port')
    await waitFor(`!!document.querySelector(${JSON.stringify(editorSelector)})`)
    await fill(`${editorSelector} input[name="name"]`, 'My source port')
    await fill(`${editorSelector} input[name="executablePath"]`, '')
    await pause(550)
    assert.equal(settings.sourcePorts.length, 7, 'An unfinished added port reached autosave')
    assert.equal(
      await evaluate(
        `document.querySelector(${JSON.stringify(`${editorSelector} [data-onboarding-port-save]`)})?.disabled`
      ),
      true
    )
    await fill(`${editorSelector} input[name="executablePath"]`, '/fixture/new-engine/doom')
    await capture('ports-editor')
    await click(`${editorSelector} [data-onboarding-port-save]`)
    await waitFor(`!document.querySelector(${JSON.stringify(editorSelector)})`)
    await pause(550)
    assert.equal(settings.sourcePorts.length, 8)
    const newId = settings.sourcePorts.at(-1).id
    const newEdit = `${listSelector} [data-settings-resource-id="${newId}"] [data-onboarding-port-edit]`

    window.setSize(560, 900)
    await waitFor('innerWidth === 560')
    await footerReachable('ports')
    await capture('ports-narrow')
    await click(newEdit)
    await waitFor(`!!document.querySelector(${JSON.stringify(editorSelector)})`)
    const modal = await rectangle(editorSelector)
    const viewport = await evaluate('({width:innerWidth,height:innerHeight})')
    assert(
      modal.x >= 0 && modal.x + modal.width <= viewport.width + 1,
      'Narrow editor overflows viewport'
    )
    await key('Escape')
    await waitFor(
      `!document.querySelector(${JSON.stringify(editorSelector)}) && !!document.querySelector(${JSON.stringify(wizard)})`
    )
    window.setSize(1280, 940)
    window.webContents.setZoomFactor(1.2)
    await waitFor('Math.abs(innerWidth - 1280 / 1.2) < 2')
    await footerReachable('ports')
    await evaluate(
      `document.querySelector(${JSON.stringify(`${activePanel} .onboarding-step-body`)}).scrollTop = 0`
    )
    await capture('ports-120')
    window.webContents.setZoomFactor(1)
    await waitFor('innerWidth === 1280')
    await click(`${activePanel} [data-onboarding-next]`)
    await step('wads')
    const wads = `${wizard} [data-onboarding-step="wads"]`
    const freeGames = `${wads} [data-onboarding-freegames]`
    const freeGamesToggle = `${wads} [data-onboarding-freegames-trigger]`
    await waitFor(`!!document.querySelector(${JSON.stringify(freeGamesToggle)})`)
    assert.equal(versions.length, 0)
    assert.equal(
      await evaluate(`document.querySelector(${JSON.stringify(freeGames)})?.open`),
      false
    )
    await footerReachable('wads')
    await capture('wads-empty')
    await click(freeGamesToggle)
    await waitFor(`document.querySelector(${JSON.stringify(freeGames)})?.open`)
    await capture('wads-free-offer')
    await key('Escape')
    await waitFor(
      `!document.querySelector(${JSON.stringify(freeGames)})?.open && !!document.querySelector(${JSON.stringify(wizard)})`
    )
    await waitFor(`document.activeElement?.hasAttribute('data-onboarding-freegames-trigger')`)
    const editPath = `${wads} [data-settings-path-edit="wadFilesDirectory"]`
    const pathInput = `${wads} input[name="wadFilesDirectory"]`
    await click(editPath)
    await fill(pathInput, '/fixture/cancelled')
    await key('Escape')
    await waitFor(
      `!document.querySelector(${JSON.stringify(pathInput)}) && !!document.querySelector(${JSON.stringify(wizard)})`
    )
    assert.equal(settings.wadFilesDirectory, defaultPaths.wadFilesDirectory)
    await click(editPath)
    await fill(pathInput, '/fixture/unavailable')
    failNextDirectory = true
    await click(`${wads} [data-onboarding-path-done]`)
    await waitFor(
      `!!document.querySelector(${JSON.stringify(`${wads} [data-onboarding-path-error]`)})`
    )
    assert.equal(directoryFailures, 1)
    assert.equal(settings.wadFilesDirectory, defaultPaths.wadFilesDirectory)
    await click(`${wads} [data-onboarding-path-cancel]`)
    nextPickerResult = { canceled: false, filePaths: ['/fixture/chosen-wads'] }
    delayNextDirectoryWrite = 1000
    await click(`${wads} [data-settings-path-browse="wadFilesDirectory"]`)
    const directoryDeadline = Date.now() + 5000
    while (!delayedDirectoryStarted && Date.now() < directoryDeadline) await pause(30)
    assert(delayedDirectoryStarted, 'Delayed directory fixture never started')
    assert.equal(
      await evaluate(
        `([...document.querySelectorAll(${JSON.stringify(`${wizard} button`)})].find(button => button.textContent.trim() === 'Skip setup'))?.disabled`
      ),
      true,
      'Skip remained available while the folder write was pending'
    )
    await key('Escape')
    assert(
      await evaluate(`!!document.querySelector(${JSON.stringify(wizard)})`),
      'Escape dismissed a pending folder write'
    )
    await waitFor(
      `document.querySelector(${JSON.stringify(wads)}).textContent.includes('/fixture/chosen-wads')`
    )
    assert.equal(settings.wadFilesDirectory, '/fixture/chosen-wads')
    await click(freeGamesToggle)
    await click(`${wads} [data-freedoom-download="phase12"]`)
    await waitFor(
      `document.querySelector(${JSON.stringify(`${wads} [data-freedoom-bundle="phase12"]`)})?.getAttribute('data-freedoom-state') === 'downloading'`
    )
    assert.equal(
      await evaluate(
        `document.querySelector(${JSON.stringify(`${wads} [data-freedoom-download="freedm"]`)})?.disabled`
      ),
      true
    )
    await waitFor(
      `document.querySelector(${JSON.stringify(`${wads} [data-freedoom-bundle="phase12"]`)})?.getAttribute('data-freedoom-state') === 'installed'`
    )
    assert.equal(versions.length, 2)
    failNextDownload = true
    await click(`${wads} [data-freedoom-download="freedm"]`)
    await waitFor(
      `document.querySelector(${JSON.stringify(`${wads} [data-freedoom-bundle="freedm"]`)})?.getAttribute('data-freedoom-state') === 'failed'`
    )
    assert.equal(downloadFailures, 1)
    await click(`${wads} [data-freedoom-download="freedm"]`)
    await waitFor(
      `document.querySelector(${JSON.stringify(`${wads} [data-freedoom-bundle="freedm"]`)})?.getAttribute('data-freedoom-state') === 'installed'`
    )
    assert.equal(downloadRequests, 3)
    assert.equal(versions.length, 3)
    await click(freeGamesToggle)
    versions = [...commercialGames, ...versions]
    await click(`${wads} [data-onboarding-next]`)
    await step('registry')
    assert.equal(
      await evaluate(
        `document.querySelector(${JSON.stringify(`${wizard} [role="switch"]`)})?.getAttribute('data-state')`
      ),
      'unchecked'
    )
    await footerReachable('registry')
    await capture('registry')
    window.setSize(1100, 1300)
    await waitFor('innerWidth === 1100 && innerHeight === 1300')
    await footerReachable('registry')
    await capture('registry-tall')
    window.setSize(1280, 940)
    await waitFor('innerWidth === 1280')
    await click(`${wizard} [data-onboarding-back]`)
    await step('wads')
    await waitFor(
      `document.querySelectorAll(${JSON.stringify(`${wads} [data-settings-resource-id]`)}).length === 14`
    )
    assert.equal(
      await evaluate(`document.querySelector(${JSON.stringify(freeGames)})?.open`),
      false
    )
    assert.equal(
      await evaluate(
        `document.querySelector(${JSON.stringify(freeGamesToggle)})?.getAttribute('data-freedoom-installed')`
      ),
      'true'
    )
    await click(`${wads} [data-settings-resource-id="doom"]`)
    await waitFor(
      `document.querySelector(${JSON.stringify(`${wads} [data-settings-resource-id="doom"]`)})?.getAttribute('aria-pressed') === 'true'`
    )
    await pause(550)
    assert.equal(settings.defaultDoomVersionId, 'doom')
    await evaluate(
      `document.querySelector(${JSON.stringify(`${wads} .onboarding-step-body`)}).scrollTop = 0`
    )
    await capture('wads-installed')
    window.webContents.setZoomFactor(1.2)
    await waitFor('Math.abs(innerWidth - 1280 / 1.2) < 2')
    await footerReachable('wads')
    await capture('wads-120-installed')
    window.webContents.setZoomFactor(1)
    await waitFor('innerWidth === 1280')
    window.setSize(560, 850)
    await waitFor('innerWidth === 560')
    await footerReachable('wads')
    await capture('wads-narrow')
    window.setSize(1280, 940)
    await click(`${wads} [data-onboarding-next]`)
    await step('registry')
    window.webContents.setZoomFactor(1.2)
    await waitFor('Math.abs(innerWidth - 1280 / 1.2) < 2')
    await footerReachable('registry')
    await capture('registry-120')
    window.webContents.setZoomFactor(1)
    await waitFor('innerWidth === 1280')
    await click(`${wizard} [data-onboarding-next]`)
    await waitFor(
      `document.querySelector(${JSON.stringify(wizard)})?.textContent.includes('8 source ports and 14 WAD files')`
    )
    await capture('complete')
    await click(`${wizard} [data-onboarding-next]`)
    await waitFor(
      `!document.querySelector(${JSON.stringify(wizard)}) && !!document.querySelector('nav a')`
    )
    assert.equal(firstRun, false)
    assert.equal(settings.registryLookupEnabled, false)
    assert.equal(settings.sourcePorts.length, 8)
    assert.equal(settings.defaultDoomVersionId, 'doom')
    await waitFor('!!document.querySelector(\'li[data-state="open"][data-swipe-direction]\')')
    await click('li[data-state="open"][data-swipe-direction] [toast-close]')
    await waitFor('!document.querySelector(\'li[data-state="open"][data-swipe-direction]\')')

    // A successful retry reconciles a default whose WAD disappeared after setup.
    await replay()
    await waitFor(
      `document.querySelector(${JSON.stringify(scanSelector)})?.textContent.includes('No new source ports found.')`
    )
    assert.equal(
      await evaluate(
        `document.querySelectorAll(${JSON.stringify(`${scanSelector} [data-onboarding-scan-choice]`)}).length`
      ),
      0,
      'Replay duplicated configured ports in discovery'
    )
    assert.equal(
      await evaluate(
        `document.querySelectorAll(${JSON.stringify(`${listSelector} [data-settings-resource-id]`)}).length`
      ),
      8
    )
    failNextVersions = true
    await click(`${activePanel} [data-onboarding-next]`)
    await step('wads')
    await waitFor(
      `!!document.querySelector(${JSON.stringify(`${wads} [data-onboarding-wads-retry]`)})`
    )
    versions = versions.filter((version) => version.id !== 'doom')
    await click(`${wads} [data-onboarding-wads-retry]`)
    await waitFor(
      `!document.querySelector(${JSON.stringify(`${wads} [data-onboarding-wads-retry]`)})`
    )
    await pause(550)
    assert.equal(
      settings.defaultDoomVersionId,
      '',
      'Retry kept a default WAD that no longer exists'
    )
    await click(`${wads} [data-onboarding-back]`)
    await step('ports')
    await waitFor(
      `document.querySelector(${JSON.stringify(scanSelector)})?.textContent.includes('No new source ports found.')`
    )
    assert.equal(
      await evaluate(
        `document.querySelectorAll(${JSON.stringify(`${scanSelector} [data-onboarding-scan-choice]`)}).length`
      ),
      0,
      'Back duplicated configured ports in discovery'
    )

    // Skipping a replay waits for the latest accepted edit, even during an older save.
    await click(newEdit)
    await waitFor(`!!document.querySelector(${JSON.stringify(editorSelector)})`)
    delayNextSettingsWrite = 4500
    await fill(`${editorSelector} input[name="name"]`, 'First queued name')
    await click(`${editorSelector} [data-onboarding-port-save]`)
    const saveDeadline = Date.now() + 5000
    while (!delayedSaveStarted && Date.now() < saveDeadline) await pause(30)
    assert(delayedSaveStarted, 'Delayed autosave fixture never started')
    await click(newEdit)
    await fill(`${editorSelector} input[name="name"]`, 'Final queued name')
    await click(`${editorSelector} [data-onboarding-port-save]`)
    await waitFor(`!document.querySelector(${JSON.stringify(editorSelector)})`)
    nextPickerResult = { canceled: false, filePaths: ['/fixture/cancelled-engine/doom'] }
    await click(`${activePanel} button`, 'Add Port')
    await waitFor(
      `!!document.querySelector(${JSON.stringify(`${editorSelector} input[name="name"]`)})`
    )
    await fill(`${editorSelector} input[name="name"]`, '')
    await click(`${editorSelector} [data-onboarding-port-cancel]`)
    await waitFor(`!document.querySelector(${JSON.stringify(editorSelector)})`)
    await click(`${wizard} button`, 'Skip setup')
    assert(
      await evaluate(`!!document.querySelector(${JSON.stringify(wizard)})`),
      'Skip dismissed setup before its pending save finished'
    )
    await waitFor(`!document.querySelector(${JSON.stringify(wizard)})`)
    assert.equal(settings.sourcePorts.length, 8)
    assert.equal(
      settings.sourcePorts.find((port) => port.id === newId)?.name,
      'Final queued name',
      'A stale in-flight save overwrote the final valid edit'
    )
    assert.equal(settings.defaultDoomVersionId, '')
    assert(settings.sourcePorts.every((port) => port.name.trim() && port.executablePath.trim()))
    assert(writes.length > 0)
    assert(
      errors.every((message) =>
        message.includes('Failed to load resource: the server responded with a status of 500')
      ),
      errors.join('\n')
    )
    assert(
      requests.every((url) => url.startsWith('http://localhost:7666/')),
      JSON.stringify(requests)
    )
    console.log(
      'PASS fresh onboarding: inline discovery/import, compact port rows, optional edit dialogs, 14-game inventory, compact FreeDoom offer/download/retry, narrow and 120% layouts, folder recovery/queued writes, valid-only persistence, default reconciliation, Back/Next/Finish/Skip, sandbox and offline renderer'
    )
    clearTimeout(deadline)
    window.destroy()
    app.quit()
  })
  .catch(async (error) => {
    console.error(error)
    if (errors.length) console.error('Renderer errors:', errors.join('\n'))
    if (window && !window.isDestroyed()) {
      fs.writeFileSync(
        path.join(diagnosticDirectory, 'failure.html'),
        await evaluate('document.documentElement.outerHTML').catch(() => 'Renderer unavailable')
      )
      const screenshot = await window.webContents.capturePage().catch(() => null)
      if (screenshot)
        fs.writeFileSync(path.join(diagnosticDirectory, 'failure.png'), screenshot.toPNG())
      console.error('Diagnostics:', diagnosticDirectory)
    }
    app.exit(1)
  })
app.on('quit', () => fs.rmSync(profile, { recursive: true, force: true }))
