import { describe, it, expect } from 'vitest'
import {
  isBetterRepresentative,
  isGeneratedVersionName,
  resolveWadIdentity
} from './wad-identity'

const ULTIMATE_DOOM_19 = 'c4fe9fd920207691a9f493668e0a2083'
const SIGIL_PWAD = 'edd5c3dfd3fb1c981cf7390c5c14454e'

describe('resolveWadIdentity', () => {
  it('identifies a known build whatever the file is called', () => {
    expect(resolveWadIdentity('doomu.wad', ULTIMATE_DOOM_19)).toMatchObject({
      usable: true,
      name: 'Ultimate Doom (1.9)',
      slug: 'doom'
    })
    expect(resolveWadIdentity('DOOM_1.9.WAD', ULTIMATE_DOOM_19).name).toBe('Ultimate Doom (1.9)')
  })

  it('gives the same entry id to the same content under different names', () => {
    expect(resolveWadIdentity('doomu.wad', ULTIMATE_DOOM_19).id).toBe(
      resolveWadIdentity('Doom (1995).wad', ULTIMATE_DOOM_19).id
    )
  })

  it('refuses to launch an add-on as a base WAD', () => {
    expect(resolveWadIdentity('SIGIL_V1_23.wad', SIGIL_PWAD).usable).toBe(false)
  })

  it('reports the name a build ships under', () => {
    expect(resolveWadIdentity('my-copy.wad', ULTIMATE_DOOM_19).fileName).toBe('DOOM.WAD')
  })

  it('keeps the seeded defaults for builds that are not hash-listed', () => {
    // FreeDoom builds change every release, so they are matched by filename.
    expect(resolveWadIdentity('FREEDOOM1.WAD', 'f'.repeat(32))).toMatchObject({
      usable: true,
      id: '5',
      name: 'FreeDoom Phase 1',
      slug: 'freedoom1'
    })
  })

  it('falls back to the filename for unknown content', () => {
    expect(resolveWadIdentity('voices.wad', 'a'.repeat(32))).toMatchObject({
      usable: true,
      id: 'wad-voices',
      name: 'voices',
      slug: 'wad-voices'
    })
    // An md5-suffixed download keeps its user-facing name.
    expect(resolveWadIdentity(`mymap-${'b'.repeat(32)}.wad`, '').name).toBe('mymap')
  })
})

describe('isGeneratedVersionName', () => {
  it('accepts the names the app derives', () => {
    expect(isGeneratedVersionName('Ultimate Doom (1.9)', 'doomu.wad')).toBe(true)
    expect(isGeneratedVersionName('doomu', 'doomu.wad')).toBe(true)
    expect(isGeneratedVersionName('FreeDoom Phase 1', 'FREEDOOM1.WAD')).toBe(true)
    expect(isGeneratedVersionName('', 'doomu.wad')).toBe(true)
  })

  it('protects a name the user typed', () => {
    expect(isGeneratedVersionName('Doom II: Hell on Earth', 'doom2.wad')).toBe(false)
  })
})

describe('isBetterRepresentative', () => {
  it('prefers the name the build ships under, whatever the case', () => {
    expect(isBetterRepresentative('doom.wad', 'DOOM_1.9.WAD', 'DOOM.WAD')).toBe(true)
    expect(isBetterRepresentative('DOOM_1.9.WAD', 'DOOM.WAD', 'DOOM.WAD')).toBe(false)
  })

  it('falls back to the name without an appended md5', () => {
    const suffixed = `doom2-${'c'.repeat(32)}.wad`
    expect(isBetterRepresentative('doom2.wad', suffixed, '')).toBe(true)
    expect(isBetterRepresentative(suffixed, 'doom2.wad', '')).toBe(false)
  })
})
