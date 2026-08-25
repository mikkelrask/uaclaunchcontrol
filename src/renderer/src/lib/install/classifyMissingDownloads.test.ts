import { describe, it, expect } from 'vitest'
import { classifyMissingDownloads } from './classifyMissingDownloads'

const GH_ASSET = 'https://github.com/owner/repo/releases/download/v1.0/file.pk3'
const MODDB_START = 'https://www.moddb.com/downloads/start/1234'
const BROWSER_ONLY = 'https://www.moddb.com/mods/foo/downloads/1234'
const GDRIVE = 'https://drive.google.com/file/d/abc/view'

describe('classifyMissingDownloads', () => {
  it('splits missing files by in-app downloadability', () => {
    const { inApp, browserOnly } = classifyMissingDownloads([
      { filePath: '', url: GH_ASSET },
      { filePath: '', url: MODDB_START },
      { filePath: '', url: BROWSER_ONLY },
      { filePath: '', url: GDRIVE }
    ])
    expect(inApp.map((f) => f.url)).toEqual([GH_ASSET, MODDB_START])
    expect(browserOnly.map((f) => f.url)).toEqual([BROWSER_ONLY, GDRIVE])
  })

  it('ignores files that are already on disk', () => {
    const { inApp, browserOnly } = classifyMissingDownloads([
      { filePath: '/mods/doom.pk3', url: GH_ASSET },
      { filePath: '/mods/other.pk3' }
    ])
    expect(inApp).toEqual([])
    expect(browserOnly).toEqual([])
  })

  it('ignores missing files without a url', () => {
    const { inApp, browserOnly } = classifyMissingDownloads([{ filePath: '' }])
    expect(inApp).toEqual([])
    expect(browserOnly).toEqual([])
  })

  it('treats malformed urls as browser-only, not in-app', () => {
    const { inApp, browserOnly } = classifyMissingDownloads([
      { filePath: '', url: 'not a url' },
      { filePath: '', url: 'github.com/nope' } // no /releases/download/ path
    ])
    expect(inApp).toEqual([])
    expect(browserOnly).toHaveLength(2)
  })

  it('returns empty buckets for an empty list', () => {
    const { inApp, browserOnly } = classifyMissingDownloads([])
    expect(inApp).toEqual([])
    expect(browserOnly).toEqual([])
  })
})
