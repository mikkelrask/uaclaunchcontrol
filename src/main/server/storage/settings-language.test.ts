import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import fs from 'fs-extra'
import path from 'node:path'
import os from 'node:os'
import type * as Core from './core'

const fixture = vi.hoisted(() => ({ root: '' }))
vi.mock('os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:os')>()
  return { ...actual, default: { ...actual, homedir: () => fixture.root } }
})

let core: typeof Core
let settingsFile: string

beforeAll(async () => {
  fixture.root = fs.mkdtempSync(path.join(os.tmpdir(), 'uac-language-'))
  // Prevent the deferred WAD watcher; the suite only exercises settings storage.
  vi.useFakeTimers({ toFake: ['setImmediate'] })
  core = await import('./core')
  settingsFile = path.join(fixture.root, '.config/uac/settings.json')
  core.initStorage()
})

afterAll(() => {
  vi.useRealTimers()
  fs.removeSync(fixture.root)
})

describe('language settings persistence', () => {
  it('creates new settings without silently selecting System', async () => {
    expect((await core.getSettings()).language).toBeUndefined()
    expect(await fs.readJSON(settingsFile)).not.toHaveProperty('language')
  })
  it('keeps older settings unset until the user chooses a language', async () => {
    await fs.writeJSON(settingsFile, {
      sourcePorts: [],
      theme: 'terminal',
      registryUuid: 'keep-me'
    })
    expect(await core.getSettings()).toMatchObject({ language: undefined, theme: 'terminal' })
    await core.saveSettings({ uiScale: 110 })
    expect((await core.getSettings()).language).toBeUndefined()
    expect(await fs.readJSON(settingsFile)).not.toHaveProperty('language')
  })

  it('round trips the saved language while preserving other settings and partial updates', async () => {
    await core.saveSettings({ language: 'da-DK' })
    await core.saveSettings({ showLaunchPreview: false })
    expect(await core.getSettings()).toMatchObject({
      language: 'da-DK',
      theme: 'terminal',
      registryUuid: 'keep-me',
      showLaunchPreview: false
    })
    expect(await fs.readJSON(settingsFile)).toMatchObject({ language: 'da-DK' })
  })

  it('recovers invalid on-disk language values without rewriting the file', async () => {
    await fs.writeJSON(settingsFile, { sourcePorts: [], language: 'unsupported' })
    expect((await core.getSettings()).language).toBeUndefined()
    expect((await fs.readJSON(settingsFile)).language).toBe('unsupported')
  })

  it.each(['en', 'system', 'es-ES'] as const)(
    'preserves an explicit %s choice through unrelated saves',
    async (language) => {
      await core.saveSettings({ language })
      await core.saveSettings({ uiScale: 120 })
      expect((await core.getSettings()).language).toBe(language)
      expect((await fs.readJSON(settingsFile)).language).toBe(language)
    }
  )

  it('rejects invalid runtime input before writing anything', async () => {
    const before = await fs.readFile(settingsFile, 'utf8')
    const invalid = JSON.parse('{"language":"fr"}')
    await expect(core.saveSettings(invalid)).rejects.toThrow('Unsupported language')
    expect(await fs.readFile(settingsFile, 'utf8')).toBe(before)
  })
})
