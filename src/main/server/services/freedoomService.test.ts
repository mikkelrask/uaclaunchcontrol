import { describe, it, expect } from 'vitest'
import { isValidFreedoomManifest, matchExtractedWadFiles } from './freedoomService'

const validEntry = {
  description: 'x',
  name: 'x',
  url: 'https://example.com/x.zip',
  version: '0.13.0',
  md5: 'a',
  sha1: 'b',
  sha256: 'c'
}

describe('isValidFreedoomManifest', () => {
  it('accepts a manifest with all 3 required keys', () => {
    expect(
      isValidFreedoomManifest({
        'freedoom1.wad': validEntry,
        'freedoom2.wad': validEntry,
        'freedm.wad': validEntry
      })
    ).toBe(true)
  })

  it('rejects a manifest missing a required key', () => {
    expect(
      isValidFreedoomManifest({
        'freedoom1.wad': validEntry,
        'freedoom2.wad': validEntry
      })
    ).toBe(false)
  })

  it('rejects an entry missing url or sha256', () => {
    const noUrl = { ...validEntry, url: undefined } as unknown as typeof validEntry
    expect(
      isValidFreedoomManifest({
        'freedoom1.wad': noUrl,
        'freedoom2.wad': validEntry,
        'freedm.wad': validEntry
      })
    ).toBe(false)
  })

  it('rejects non-object input', () => {
    expect(isValidFreedoomManifest(null)).toBe(false)
    expect(isValidFreedoomManifest('not an object')).toBe(false)
    expect(isValidFreedoomManifest(undefined)).toBe(false)
  })
})

describe('matchExtractedWadFiles', () => {
  it('matches case-insensitively', () => {
    const files = [
      { name: 'FreeDoom1.WAD', path: '/tmp/a/FreeDoom1.WAD' },
      { name: 'freedoom2.wad', path: '/tmp/a/freedoom2.wad' },
      { name: 'README.html', path: '/tmp/a/README.html' }
    ]
    const result = matchExtractedWadFiles(files, ['freedoom1.wad', 'freedoom2.wad'])
    expect(result['freedoom1.wad']).toBe('/tmp/a/FreeDoom1.WAD')
    expect(result['freedoom2.wad']).toBe('/tmp/a/freedoom2.wad')
  })

  it('omits keys with no match rather than throwing', () => {
    const files = [{ name: 'freedm.wad', path: '/tmp/a/freedm.wad' }]
    const result = matchExtractedWadFiles(files, ['freedoom1.wad', 'freedoom2.wad'])
    expect(result['freedoom1.wad']).toBeUndefined()
    expect(result['freedoom2.wad']).toBeUndefined()
  })

  it('finds files nested in subdirectories (path is opaque to the matcher)', () => {
    const files = [{ name: 'freedm.wad', path: '/tmp/freedm-0.13.0/deep/nested/freedm.wad' }]
    const result = matchExtractedWadFiles(files, ['freedm.wad'])
    expect(result['freedm.wad']).toBe('/tmp/freedm-0.13.0/deep/nested/freedm.wad')
  })
})
