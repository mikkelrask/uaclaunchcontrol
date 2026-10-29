// Built-renderer integration checks with a disposable profile and fixture-only APIs.
// No live backend, real file picker, downloads, or user settings are used.
const { app, BrowserWindow, ipcMain, session } = require('electron')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const assert = require('node:assert/strict')

const root = path.resolve(__dirname, '../..')
const renderer = process.env.UAC_SETTINGS_RENDERER || path.join(root, 'out/renderer/index.html')
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'uac-settings-electron-'))
const screenshotDirectory = process.env.UAC_SETTINGS_SCREENSHOT_DIR
const diagnosticDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'uac-settings-smoke-'))
app.setPath('userData', profile)
app.disableHardwareAcceleration()
const deadline = setTimeout(() => {
  console.error('Settings integration test exceeded 90 seconds')
  app.exit(1)
}, 90000)

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
  sourcePorts: Array.from({ length: 28 }, (_, index) => ({
    id: `port-${index}`,
    name: `Fixture engine ${String(index + 1).padStart(2, '0')}`,
    version: '1.0.0',
    family: index % 2 === 0 ? 'gzdoom' : 'uzdoom',
    executablePath: `/fixture/engines/Engine ${index + 1}/bin/doom`,
    ignored: false
  })),
  defaultSourcePortId: 'port-0',
  defaultDoomVersionId: 'wad-0',
  databaseLinkPresets: [{ name: 'MODDB', url: 'https://www.moddb.com/games/doom-ii' }],
  selectedPresetIndex: 0,
  configPath: '/fixture/uac',
  uiScale: 100,
  defaultView: 'grid',
  autoUpdateEnabled: false,
  registryLookupEnabled: false,
  showLaunchPreview: true,
  customThemeCss: ''
}
let versions = Array.from({ length: 28 }, (_, index) => ({
  id: `wad-${index}`,
  name: `Fixture base game ${String(index + 1).padStart(2, '0')}`,
  slug: index === 0 ? 'doom2' : `fixture-${index}`,
  defaultIwad: `/fixture/wads/Game ${index + 1}.wad`,
  args: `-iwad "/fixture/wads/Game ${index + 1}.wad"`,
  parameters: '',
  ignored: false,
  icon: ''
}))
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
const requests = []
const errors = []
const writes = []
const pickerRequests = []
let nextPickerResult = { canceled: true, filePaths: [] }
let failNextVersionSave = false
let injectedFailures = 0
let window
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const dialog = '[data-testid="settings-dialog"]'
const activePanel = `${dialog} [role="tabpanel"][data-state="active"]`
const listSelector = `${activePanel} [data-settings-resource-list]`
const editorSelector = `${activePanel} [data-settings-editor]`

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
  await window.webContents.insertText(value)
  await waitFor(
    `document.querySelector(${JSON.stringify(selector)})?.value === ${JSON.stringify(value)}`
  )
}
async function openSettings() {
  window.webContents.sendInputEvent({ type: 'keyDown', keyCode: '.', modifiers: ['control'] })
  window.webContents.sendInputEvent({ type: 'keyUp', keyCode: '.', modifiers: ['control'] })
  await waitFor(`!!document.querySelector(${JSON.stringify(dialog)})`)
  await waitFor(`!!document.querySelector(${JSON.stringify(`${dialog} [id$="-language"]`)})`)
}
async function selectTab(tab) {
  const selector = `${dialog} [role="tab"][id$="-trigger-${tab}"]`
  await click(selector)
  await waitFor(
    `document.querySelector(${JSON.stringify(selector)})?.getAttribute('data-state') === 'active'`
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
  fs.writeFileSync(
    path.join(screenshotDirectory, `${name}.png`),
    (await window.webContents.capturePage()).toPNG()
  )
}

ipcMain.on('get-first-run', (event) => {
  event.returnValue = false
})
ipcMain.handle('get-app-version', () => '1.0.0')
ipcMain.handle('get-install-type', () => ({ isAppImage: false, isSystemInstalled: true }))
ipcMain.handle('set-zoom-factor', (_event, factor) => window?.webContents.setZoomFactor(factor))

app
  .whenReady()
  .then(async () => {
    const isolated = session.fromPartition('settings-smoke')
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
      else if (url.pathname === '/api/settings') {
        if (request.method === 'PUT') {
          const payload = await request.json()
          writes.push({ resource: 'settings', payload })
          settings = { ...settings, ...payload }
        }
        result = settings
      } else if (url.pathname === '/api/versions') {
        if (request.method === 'PUT' && failNextVersionSave) {
          failNextVersionSave = false
          injectedFailures += 1
          status = 500
          result = { error: 'Deliberate metadata-write fixture failure' }
        } else {
          if (request.method === 'PUT') {
            versions = await request.json()
            writes.push({ resource: 'versions', payload: versions })
          }
          result = versions
        }
      } else if (url.pathname.startsWith('/api/versions/bySlug/')) {
        result =
          versions.find(
            (version) => version.slug === decodeURIComponent(url.pathname.split('/').pop())
          ) || versions[0]
      } else if (url.pathname.startsWith('/api/versions/')) {
        result =
          versions.find((version) => version.id === url.pathname.split('/').pop()) || versions[0]
      } else if (url.pathname === '/api/dialog/open') {
        pickerRequests.push(await request.json())
        result = nextPickerResult
        nextPickerResult = { canceled: true, filePaths: [] }
      } else if (
        url.pathname === '/api/player-data' ||
        url.pathname.startsWith('/api/player-data/')
      ) {
        result = player
      }
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
    await waitFor(`document.documentElement.lang === 'en' && !!document.querySelector('nav a')`)
    const csp = await evaluate(
      `document.querySelector('meta[http-equiv="Content-Security-Policy"]').content`
    )
    assert(csp.includes("script-src 'self';"))
    assert(!csp.includes('unsafe-eval'))
    await openSettings()
    await capture('general')
    await selectTab('advanced')
    await waitFor(`!!document.querySelector(${JSON.stringify(`${activePanel} textarea`)})`)
    await capture('theme-lab')

    // A long list must not push either inspector below the selected record.
    for (const [tab, prefix] of [
      ['source-ports', 'port'],
      ['wad-config', 'wad']
    ]) {
      await selectTab(tab)
      await waitFor(
        `document.querySelectorAll(${JSON.stringify(`${listSelector} [data-settings-resource-id]`)}).length === 28`
      )
      const list = await rectangle(listSelector)
      const editor = await rectangle(editorSelector)
      assert(editor.x >= list.x + list.width - 2, `${tab}: inspector is not beside inventory`)
      await evaluate(
        `document.querySelector(${JSON.stringify(listSelector)}).scrollTop = document.querySelector(${JSON.stringify(listSelector)}).scrollHeight`
      )
      await pause(50)
      sameRectangle(
        editor,
        await rectangle(editorSelector),
        `${tab}: inventory scroll moved inspector`
      )
      await click(`${listSelector} [data-settings-resource-id="${prefix}-27"]`)
      await waitFor(
        `document.querySelector(${JSON.stringify(`${listSelector} [data-settings-resource-id="${prefix}-27"]`)})?.getAttribute('aria-pressed') === 'true'`
      )
      const defaultSelector = `${editorSelector} [data-settings-default]`
      const nameSelector = `${editorSelector} input[name="name"]`
      await waitFor(`!!document.querySelector(${JSON.stringify(nameSelector)})`)
      const beforeButton = await rectangle(defaultSelector)
      const beforeName = await rectangle(nameSelector)
      await click(defaultSelector)
      await waitFor(
        `document.querySelector(${JSON.stringify(defaultSelector)})?.getAttribute('aria-disabled') === 'true'`
      )
      sameRectangle(beforeButton, await rectangle(defaultSelector), `${tab}: default button`)
      sameRectangle(
        beforeName,
        await rectangle(nameSelector),
        `${tab}: fields below default button`
      )
      await fill(nameSelector, `${prefix} staged edit`)
      await capture(tab)
    }
    assert.equal(writes.length, 0, 'Selecting defaults or editing metadata persisted before Apply')
    assert.equal(settings.defaultSourcePortId, 'port-0')
    assert.equal(settings.defaultDoomVersionId, 'wad-0')
    assert.equal(versions[27].name, 'Fixture base game 28')

    // Narrow layouts show one pane at a time, retaining the original list position.
    window.setSize(560, 900)
    for (const [tab, prefix] of [
      ['source-ports', 'port'],
      ['wad-config', 'wad']
    ]) {
      await selectTab(tab)
      // Tabs retain their editors; an already selected record opens in narrow detail view.
      if (
        await evaluate(
          `!!document.querySelector(${JSON.stringify(editorSelector)})?.getClientRects().length`
        )
      ) {
        await click(`${activePanel} [data-settings-back]`)
      }
      await waitFor(
        `!!document.querySelector(${JSON.stringify(listSelector)})?.getClientRects().length`
      )
      await evaluate(
        `document.querySelector(${JSON.stringify(listSelector)}).scrollTop = document.querySelector(${JSON.stringify(listSelector)}).scrollHeight`
      )
      const listScroll = await evaluate(
        `document.querySelector(${JSON.stringify(listSelector)}).scrollTop`
      )
      await click(`${listSelector} [data-settings-resource-id="${prefix}-27"]`)
      await waitFor(
        `!!document.querySelector(${JSON.stringify(editorSelector)})?.getClientRects().length && document.activeElement?.hasAttribute('data-settings-back')`
      )
      assert.equal(
        await evaluate(
          `!!document.querySelector(${JSON.stringify(listSelector)})?.getClientRects().length`
        ),
        false
      )
      assert.equal(
        await evaluate(
          `document.querySelector(${JSON.stringify(`${editorSelector} input[name="name"]`)})?.value`
        ),
        `${prefix} staged edit`
      )
      await click(`${activePanel} [data-settings-back]`)
      await waitFor(
        `!!document.querySelector(${JSON.stringify(listSelector)})?.getClientRects().length && document.activeElement?.getAttribute('data-settings-resource-id') === '${prefix}-27'`
      )
      assert(
        Math.abs(
          (await evaluate(`document.querySelector(${JSON.stringify(listSelector)}).scrollTop`)) -
            listScroll
        ) < 2,
        `${tab}: Back lost inventory scroll position`
      )
      await capture(`${tab}-narrow-list`)
      await click(`${listSelector} [data-settings-resource-id="${prefix}-27"]`)
      await capture(`${tab}-narrow-editor`)
    }
    window.setSize(1280, 940)

    // All changes above are still drafts. Cancel restores the persisted configuration.
    await click(`${dialog} [data-settings-cancel]`)
    await waitFor(`!document.querySelector(${JSON.stringify(dialog)})`)
    assert.equal(writes.length, 0)
    await openSettings()
    await selectTab('source-ports')
    await click(`${listSelector} [data-settings-resource-id="port-27"]`)
    assert.equal(
      await evaluate(
        `document.querySelector(${JSON.stringify(`${editorSelector} input[name="name"]`)})?.value`
      ),
      'Fixture engine 28'
    )
    assert.equal(
      await evaluate(
        `document.querySelector(${JSON.stringify(`${editorSelector} [data-settings-default]`)})?.getAttribute('aria-disabled')`
      ),
      'false'
    )

    // Browse results and manual typing both stage a path; reset restores OS defaults.
    await selectTab('paths')
    const pathKey = 'screenshotsPath'
    const pathRow = `${activePanel} [data-settings-path="${pathKey}"]`
    assert.equal(
      await evaluate(
        `!!document.querySelector(${JSON.stringify(`${pathRow} input[name="${pathKey}"]`)})`
      ),
      false
    )
    await click(`${pathRow} [data-settings-path-edit="${pathKey}"]`)
    await fill(`${pathRow} input[name="${pathKey}"]`, '/fixture/manual/screenshots')
    window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Enter' })
    window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Enter' })
    await waitFor(
      `!document.querySelector(${JSON.stringify(`${pathRow} input[name="${pathKey}"]`)}) && document.querySelector(${JSON.stringify(pathRow)}).textContent.includes('/fixture/manual/screenshots')`
    )
    await waitFor(
      `document.activeElement?.getAttribute('data-settings-path-edit') === '${pathKey}'`
    )
    assert.equal(settings.screenshotsPath, defaultPaths.screenshotsPath)
    await click(`${pathRow} [data-settings-path-reset="${pathKey}"]`)
    await waitFor(
      `document.querySelector(${JSON.stringify(pathRow)}).textContent.includes(${JSON.stringify(defaultPaths.screenshotsPath)})`
    )
    await click(`${pathRow} [data-settings-path-edit="${pathKey}"]`)
    await fill(`${pathRow} input[name="${pathKey}"]`, '/fixture/canceled/screenshots')
    window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' })
    window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Escape' })
    await waitFor(
      `!!document.querySelector(${JSON.stringify(dialog)}) && document.activeElement?.getAttribute('data-settings-path-edit') === '${pathKey}'`
    )
    assert(
      await evaluate(
        `document.querySelector(${JSON.stringify(pathRow)}).textContent.includes(${JSON.stringify(defaultPaths.screenshotsPath)})`
      )
    )
    nextPickerResult = { canceled: false, filePaths: ['/fixture/browsed/screenshots'] }
    await click(`${pathRow} [data-settings-path-browse="${pathKey}"]`)
    await waitFor(
      `document.querySelector(${JSON.stringify(pathRow)}).textContent.includes('/fixture/browsed/screenshots')`
    )
    assert(pickerRequests.at(-1).properties.includes('openDirectory'))
    assert.equal(writes.length, 0)
    await capture('paths')

    // Theme and actual Electron zoom preview immediately, but stay reversible until Apply.
    await selectTab('general')
    await click(`${dialog} [id$="-theme"]`)
    await click('[role="option"]', 'MAYKR — Bright argent energy')
    await waitFor(`document.documentElement.classList.contains('light')`)
    await capture('light-general')
    await click(`${dialog} [id$="-theme"]`)
    await click('[role="option"]', 'PLUTONIA TERMINAL — Green phosphor')
    await waitFor(`document.documentElement.classList.contains('terminal')`)
    await capture('terminal-general')
    assert.equal(settings.theme, 'dark')
    const slider = `${activePanel} [id$="-scale"] [role="slider"]`
    for (const [scale, keys] of [
      [120, ['Right', 'Right', 'Right', 'Right']],
      [150, ['End']]
    ]) {
      await selectTab('general')
      await click(slider)
      for (const keyCode of keys) {
        window.webContents.sendInputEvent({ type: 'keyDown', keyCode })
        window.webContents.sendInputEvent({ type: 'keyUp', keyCode })
        await pause(40)
      }
      await waitFor(
        `document.querySelector(${JSON.stringify(slider)})?.getAttribute('aria-valuenow') === '${scale}'`
      )
      assert.equal(window.webContents.getZoomFactor(), scale / 100)
      await selectTab('source-ports')
      await evaluate(`document.querySelector(${JSON.stringify(editorSelector)}).scrollTop = 0`)
      if (scale === 150) {
        assert(await evaluate(`matchMedia('(max-height: 700px)').matches`))
        assert.equal(
          await evaluate(
            `!!document.querySelector(${JSON.stringify(`${activePanel} .settings-section-heading p`)})?.getClientRects().length`
          ),
          false
        )
        const field = await rectangle(`${editorSelector} input[name="name"]`)
        const pane = await rectangle(editorSelector)
        assert(
          field.y >= pane.y && field.y + field.height <= pane.y + pane.height + 1,
          '150% zoom hides the first name input below the inspector'
        )
      }
      const scaledEditor = await rectangle(editorSelector)
      const scaledApply = await rectangle(`${dialog} [data-settings-apply]`)
      assert(
        scaledEditor.y + scaledEditor.height <= scaledApply.y + 1,
        `${scale}% zoom overlaps actions`
      )
      assert(
        await evaluate(
          `(() => { const rect = document.querySelector(${JSON.stringify(dialog)}).getBoundingClientRect(); return rect.x >= -1 && rect.y >= -1 && rect.right <= innerWidth + 1 && rect.bottom <= innerHeight + 1 })()`
        ),
        `${scale}% zoom pushes settings outside the viewport`
      )
      await capture(`scale-${scale}`)
    }
    assert.equal(settings.uiScale, 100)

    // Language choices are staged; Cancel preserves the active and persisted locale.
    await selectTab('general')
    await click(`${dialog} [id$="-language"]`)
    await click('[role="option"]', 'Dansk')
    await waitFor(`!document.querySelector('[role="listbox"]')`)
    assert.equal(await evaluate('document.documentElement.lang'), 'en')
    await click(`${dialog} [data-settings-cancel]`)
    await waitFor(`!document.querySelector(${JSON.stringify(dialog)})`)
    await waitFor(`document.documentElement.classList.contains('dark')`)
    assert.equal(window.webContents.getZoomFactor(), 1)
    assert.equal(settings.language, 'en')
    assert.equal(settings.screenshotsPath, defaultPaths.screenshotsPath)
    assert.equal(writes.length, 0)

    await openSettings()
    await selectTab('source-ports')
    await click(`${listSelector} [data-settings-resource-id="port-27"]`)
    await fill(`${editorSelector} input[name="name"]`, 'Persisted engine')
    await click(`${editorSelector} [data-settings-default]`)
    await selectTab('wad-config')
    await click(`${listSelector} [data-settings-resource-id="wad-27"]`)
    await fill(`${editorSelector} input[name="name"]`, 'Persisted base game')
    await click(`${editorSelector} [data-settings-default]`)
    await selectTab('general')
    await click(`${dialog} [id$="-language"]`)
    await click('[role="option"]', 'Dansk')
    await waitFor(`!document.querySelector('[role="listbox"]')`)
    await click(`${dialog} [data-settings-apply]`)
    await waitFor(
      `!document.querySelector(${JSON.stringify(dialog)}) && document.documentElement.lang === 'da-DK'`
    )
    assert.equal(settings.language, 'da-DK')
    assert.equal(settings.defaultSourcePortId, 'port-27')
    assert.equal(settings.sourcePorts[27].name, 'Persisted engine')
    assert.equal(settings.defaultDoomVersionId, 'wad-27')
    assert.equal(versions[27].name, 'Persisted base game')
    assert.equal(versions[27].args, '-iwad "/fixture/wads/Game 28.wad"')

    await openSettings()
    await capture('danish-general')
    window.setSize(1100, 650)
    await selectTab('source-ports')
    await click(`${listSelector} [data-settings-resource-id="port-27"]`)
    const shortEditor = await rectangle(editorSelector)
    const apply = await rectangle(`${dialog} [data-settings-apply]`)
    assert(shortEditor.y + shortEditor.height <= apply.y + 1, 'Short dialog overlaps fixed actions')
    assert.equal(
      await evaluate(
        `document.querySelector(${JSON.stringify(dialog)}).scrollWidth > document.querySelector(${JSON.stringify(dialog)}).clientWidth + 2`
      ),
      false
    )
    await capture('short-dialog')
    assert.equal(errors.length, 0, errors.join('\n'))
    await click(`${dialog} [data-settings-cancel]`)
    await waitFor(`!document.querySelector(${JSON.stringify(dialog)})`)

    // An older config may have no default IDs. Canceled defaults must not leak into it.
    delete settings.defaultSourcePortId
    delete settings.defaultDoomVersionId
    const writesBeforeDefaultDraft = writes.length
    await openSettings()
    for (const [tab, prefix] of [
      ['source-ports', 'port'],
      ['wad-config', 'wad']
    ]) {
      await selectTab(tab)
      await click(`${listSelector} [data-settings-resource-id="${prefix}-26"]`)
      assert.equal(
        await evaluate(
          `document.querySelector(${JSON.stringify(`${editorSelector} [data-settings-default]`)})?.getAttribute('aria-disabled')`
        ),
        'false'
      )
      await click(`${editorSelector} [data-settings-default]`)
    }
    await click(`${dialog} [data-settings-cancel]`)
    await waitFor(`!document.querySelector(${JSON.stringify(dialog)})`)
    await openSettings()
    for (const [tab, prefix] of [
      ['source-ports', 'port'],
      ['wad-config', 'wad']
    ]) {
      await selectTab(tab)
      for (const index of [26, 27]) {
        await click(`${listSelector} [data-settings-resource-id="${prefix}-${index}"]`)
        assert.equal(
          await evaluate(
            `document.querySelector(${JSON.stringify(`${editorSelector} [data-settings-default]`)})?.getAttribute('aria-disabled')`
          ),
          'false',
          `${tab}: canceled or previously saved default leaked into an absent default ID`
        )
      }
    }
    assert.equal(settings.defaultSourcePortId, undefined)
    assert.equal(settings.defaultDoomVersionId, undefined)
    assert.equal(writes.length, writesBeforeDefaultDraft)
    await click(`${dialog} [data-settings-cancel]`)
    await waitFor(`!document.querySelector(${JSON.stringify(dialog)})`)

    // Settings may save while the separate WAD metadata request fails. Cancel must
    // preserve the successfully saved language/theme and discard only the failed draft.
    await openSettings()
    await click(`${dialog} [id$="-language"]`)
    await click('[role="option"]', 'English')
    await waitFor(`!document.querySelector('[role="listbox"]')`)
    await click(`${dialog} [id$="-theme"]`)
    const danishLightTheme = require('../../src/renderer/src/lib/i18n/locales/desktop/da-DK.json')[
      'settings.theme.light'
    ]
    await click('[role="option"]', danishLightTheme || 'MAYKR — Bright argent energy')
    await waitFor(
      `!document.querySelector('[role="listbox"]') && document.documentElement.classList.contains('light')`
    )
    await selectTab('wad-config')
    await click(`${listSelector} [data-settings-resource-id="wad-27"]`)
    await fill(`${editorSelector} input[name="name"]`, 'Failed metadata draft')
    failNextVersionSave = true
    await click(`${dialog} [data-settings-apply]`)
    await waitFor(
      `document.documentElement.lang === 'en' && document.body.textContent.includes('Could not save all changes. Please try again.') && !document.querySelector(${JSON.stringify(`${dialog} [data-settings-apply]`)})?.disabled`
    )
    assert.equal(injectedFailures, 1)
    assert.equal(settings.language, 'en')
    assert.equal(settings.theme, 'light')
    assert.equal(versions[27].name, 'Persisted base game')
    assert(
      await evaluate(
        `document.querySelector(${JSON.stringify(`${dialog} [role="alert"]`)})?.textContent.includes('Could not save all changes. Please try again.')`
      )
    )
    await capture('partial-save-failure')
    await click(`${dialog} [data-settings-cancel]`)
    await waitFor(
      `!document.querySelector(${JSON.stringify(dialog)}) && document.documentElement.classList.contains('light') && document.documentElement.lang === 'en'`
    )
    await openSettings()
    await selectTab('wad-config')
    await click(`${listSelector} [data-settings-resource-id="wad-27"]`)
    assert.equal(
      await evaluate(
        `document.querySelector(${JSON.stringify(`${editorSelector} input[name="name"]`)})?.value`
      ),
      'Persisted base game'
    )
    await click(`${dialog} [data-settings-cancel]`)
    await waitFor(`!document.querySelector(${JSON.stringify(dialog)})`)
    // Chromium may log the deliberate 500; any other renderer error is a failure.
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
      'PASS settings workbench: long inventories, stable editor/default geometry, drafts, narrow Back, paths, theme/zoom preview reversal, language Apply/Cancel, short dialog, absent defaults, partial-save recovery, sandbox/CSP and offline renderer'
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
