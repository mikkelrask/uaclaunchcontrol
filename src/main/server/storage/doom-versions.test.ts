import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import fs from 'fs-extra'
import path from 'path'
import os from 'os'
import crypto from 'crypto'
import type { syncDoomVersions as SyncDoomVersions } from './doom-versions'

// The sync resolves its directories once, at import time, from the home
// directory — so this file builds a throwaway home, points HOME at it, and only
// then pulls the storage modules in (see beforeAll). Everything runs on real
// files, so the pipeline is exercised end to end without launching the app.
const HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'uac-sync-'))
const CONFIG = path.join(HOME, '.config', 'uac')
const WADS = path.join(CONFIG, 'wads')
const VERSIONS_FILE = path.join(CONFIG, 'doomVersions.json')

const md5 = (content: string): string => crypto.createHash('md5').update(content).digest('hex')

/** What each fixture file holds, and the hash the stubbed table reports for it. */
const CONTENT = {
  doom: 'ultimate doom 1.9 bytes',
  doom2: 'doom ii 1.9 bytes',
  tnt: 'final doom tnt bytes',
  chex: 'chex quest bytes',
  sigil: 'sigil bytes'
}

const HASH = {
  doom: md5(CONTENT.doom),
  doom2: md5(CONTENT.doom2),
  tnt: md5(CONTENT.tnt),
  chex: md5(CONTENT.chex),
  sigil: md5(CONTENT.sigil)
}

vi.mock('electron', () => ({ BrowserWindow: { getAllWindows: () => [] } }))

vi.mock('@shared/iwad-hashes', () => {
  const known: Record<string, { name: string; slug: string; fileName: string; addon?: true }> = {
    [HASH.doom]: { name: 'Ultimate Doom (1.9)', slug: 'doom', fileName: 'DOOM.WAD' },
    [HASH.doom2]: { name: 'Doom II (1.9)', slug: 'doom2', fileName: 'DOOM2.WAD' },
    [HASH.tnt]: {
      name: 'Final Doom: TNT Evilution (id Anthology)',
      slug: 'tnt',
      fileName: 'TNT.WAD'
    },
    [HASH.chex]: { name: 'Chex Quest (1996-10-31)', slug: 'chex', fileName: 'CHEX.WAD' },
    [HASH.sigil]: {
      name: 'SIGIL (SIGIL 1.23)',
      slug: 'sigil',
      fileName: 'SIGIL_V1_23.wad',
      addon: true
    }
  }
  const names = new Set(Object.values(known).map((wad) => wad.name))

  return {
    identifyWadByHash: (hash: string) => known[hash],
    isKnownWadName: (name: string) => names.has(name)
  }
})

let syncDoomVersions: typeof SyncDoomVersions

beforeAll(async () => {
  vi.stubEnv('HOME', HOME)
  fs.ensureDirSync(WADS)
  fs.writeJSONSync(path.join(CONFIG, 'settings.json'), { wadFilesDirectory: WADS })

  const wad = (name: string, content: string): void =>
    fs.writeFileSync(path.join(WADS, name), content)
  // Named as they land on disk, not as the hash table names them.
  wad('MYSTERY.wad', CONTENT.doom)
  wad('doom2.wad', CONTENT.doom2)
  wad('tnt.wad', CONTENT.tnt)
  wad('SIGIL_V1_23.wad', CONTENT.sigil)
  wad('chex.wad', CONTENT.chex)
  wad('voices.wad', 'strife voices bytes')
  // FreeDoom is not hash-listed, so it is identified by its filename.
  wad('FREEDOOM2.WAD', 'freedoom phase 2 bytes')
  // A second copy of Doom II, under a name that is not the one it ships with.
  wad(`doom2-${HASH.doom2}.wad`, CONTENT.doom2)

  // The module path is a literal, but the import must stay dynamic: it caches
  // its directories from HOME the moment it loads.
  ;({ syncDoomVersions } = await import('./doom-versions'))
  await syncDoomVersions()
})

afterAll(() => {
  vi.unstubAllEnvs()
  fs.removeSync(HOME)
})

interface WrittenVersion {
  name: string
  slug: string
  defaultIwad: string
}

const written = (): WrittenVersion[] => fs.readJSONSync(VERSIONS_FILE)

describe('syncDoomVersions', () => {
  it('names each file for what it contains, not what it is called', () => {
    // MYSTERY.wad holds the Ultimate Doom build, under a filename nothing knows.
    expect(written().find((v) => v.name === 'Ultimate Doom (1.9)')).toMatchObject({
      slug: 'doom',
      defaultIwad: path.join(WADS, 'MYSTERY.wad')
    })

    // FreeDoom has no known hash, so its filename still identifies it.
    expect(written().find((v) => v.slug === 'freedoom2')?.name).toBe('FreeDoom Phase 2')
  })

  it('lists the games a player is here for first, then everything else', () => {
    expect(written().map((v) => v.name)).toEqual([
      'Ultimate Doom (1.9)',
      'Doom II (1.9)',
      'FreeDoom Phase 2',
      'Final Doom: TNT Evilution (id Anthology)',
      'Chex Quest (1996-10-31)',
      'voices'
    ])
  })

  it('represents identical content once, under the name it ships with', () => {
    const doom2 = written().filter((v) => v.slug === 'doom2')

    expect(doom2).toHaveLength(1)
    expect(doom2[0].defaultIwad).toBe(path.join(WADS, 'doom2.wad'))
  })

  it('leaves out add-ons, which cannot be a base WAD', () => {
    expect(written().map((v) => v.slug)).not.toContain('sigil')
  })
})
