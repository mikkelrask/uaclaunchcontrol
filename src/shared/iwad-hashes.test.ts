import { describe, it, expect } from 'vitest'
import { KNOWN_WADS, identifyWadByHash, isKnownWadName } from './iwad-hashes'

// Hashes verified against the files themselves (romero.com's SIGIL_V1_23.zip
// and a local WAD folder), not just copied out of the source CSV.
const ULTIMATE_DOOM_19 = 'c4fe9fd920207691a9f493668e0a2083'
const SIGIL_123 = 'edd5c3dfd3fb1c981cf7390c5c14454e'
const TNT_ID_ANTHOLOGY = '1d39e405bf6ee3df69a8d2646c8d5c49'

describe('known WAD hash table', () => {
  it('names a build for what it contains', () => {
    expect(identifyWadByHash(ULTIMATE_DOOM_19)?.name).toBe('Ultimate Doom (1.9)')
    expect(identifyWadByHash(TNT_ID_ANTHOLOGY)?.name).toBe(
      'Final Doom: TNT Evilution (id Anthology)'
    )
  })

  it('flags add-ons that need a base game', () => {
    const sigil = identifyWadByHash(SIGIL_123)
    expect(sigil?.addon).toBe(true)
    expect(sigil?.slug).toBe('sigil')
    expect(identifyWadByHash(ULTIMATE_DOOM_19)?.addon).toBeUndefined()
  })

  it('covers the builds that were not supported before', () => {
    // Doom Pocket PC and the KEX rerelease's Legacy of Rust IWAD both ship
    // Doom 1 content, so they ride the Doom icon.
    expect(identifyWadByHash('dae77aff77a0491e3b7254c9c8401aa8')).toMatchObject({
      name: 'Doom Pocket PC',
      slug: 'doom'
    })
    expect(identifyWadByHash('713c5a3c1734b1d55b2813a3dd0136d9')).toMatchObject({
      name: 'Doom (Legacy of Rust)',
      slug: 'doom'
    })
  })

  it('is case-insensitive about the hash', () => {
    expect(identifyWadByHash(ULTIMATE_DOOM_19.toUpperCase())).toEqual(
      identifyWadByHash(ULTIMATE_DOOM_19)
    )
  })

  it('returns nothing for content it does not know', () => {
    expect(identifyWadByHash('0'.repeat(32))).toBeUndefined()
    expect(identifyWadByHash('')).toBeUndefined()
  })

  it('holds one entry per build, keyed by a well-formed md5', () => {
    const entries = Object.entries(KNOWN_WADS)
    const names = new Set(entries.map(([, wad]) => wad.name))

    for (const [md5, wad] of entries) {
      expect(md5).toMatch(/^[a-f0-9]{32}$/)
      expect(wad.name).not.toBe('')
      expect(wad.slug).not.toBe('')
      expect(isKnownWadName(wad.name)).toBe(true)
    }
    // Builds must stay tellable apart: the entry name is what the user sees.
    expect(names.size).toBe(entries.length)
  })
})
