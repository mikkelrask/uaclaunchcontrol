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

beforeAll(async () => {
  fixture.root = fs.mkdtempSync(path.join(os.tmpdir(), 'uac-default-paths-'))
  // Loading persisted settings initializes storage; keep its deferred watcher inert.
  vi.useFakeTimers({ toFake: ['setImmediate'] })
  core = await import('./core')
})

afterAll(() => {
  vi.useRealTimers()
  fs.removeSync(fixture.root)
})

function expectedDefaults() {
  return {
    wadFilesDirectory: path.join(fixture.root, '.config', 'uac', 'wads'),
    modsDirectory: path.join(fixture.root, '.config', 'uac', 'mods'),
    savegamesPath: path.join(fixture.root, '.config', 'uac', 'saves'),
    screenshotsPath: path.join(fixture.root, 'Pictures', 'UAC Launch Control', 'screenshots')
  }
}

describe('default settings directory paths', () => {
  it('resolves absolute defaults without creating configuration or directories', () => {
    expect(fs.readdirSync(fixture.root)).toEqual([])

    const defaults = core.getDefaultSettingsPaths()

    expect(defaults).toEqual(expectedDefaults())
    expect(Object.values(defaults).every((directory) => path.isAbsolute(directory))).toBe(true)
    expect(fs.readdirSync(fixture.root)).toEqual([])
  })

  it('ignores custom saved paths without modifying settings or sharing mutable defaults', async () => {
    const settingsFile = path.join(fixture.root, '.config', 'uac', 'settings.json')
    const customPaths = {
      wadFilesDirectory: path.join(fixture.root, 'custom', 'wads'),
      modsDirectory: path.join(fixture.root, 'custom', 'mods'),
      savegamesPath: path.join(fixture.root, 'custom', 'saves'),
      screenshotsPath: path.join(fixture.root, 'custom', 'screenshots')
    }
    await fs.outputJSON(settingsFile, {
      sourcePorts: [],
      theme: 'terminal',
      language: 'da-DK',
      registryUuid: 'preserve-this-id',
      ...customPaths
    })
    expect(await core.getSettings()).toMatchObject(customPaths)
    const before = await fs.readFile(settingsFile, 'utf8')

    const defaults = core.getDefaultSettingsPaths()

    expect(defaults).toEqual(expectedDefaults())
    // A caller editing its response must not change the canonical reset locations.
    defaults.wadFilesDirectory = customPaths.wadFilesDirectory
    expect(core.getDefaultSettingsPaths()).toEqual(expectedDefaults())
    expect(await fs.readFile(settingsFile, 'utf8')).toBe(before)
    expect(await core.getSettings()).toMatchObject({
      ...customPaths,
      theme: 'terminal',
      language: 'da-DK',
      registryUuid: 'preserve-this-id'
    })
  })
})
