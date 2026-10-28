import { describe, it, expect } from 'vitest'
import {
  isGithubReleaseAsset,
  isGithubArchiveUrl,
  isModdbStartPage,
  isInAppDownloadUrl,
  getTrackedRegistryDownload
} from './mod-download-url'

describe('getTrackedRegistryDownload', () => {
  const registryApi = 'https://db.uac-soft.online'

  it('extracts the source URL and hash from a tracked file link', () => {
    expect(
      getTrackedRegistryDownload(
        `${registryApi}/api/downloads/mods/ABCDEF0123456789ABCDEF0123456789?url=${encodeURIComponent('https://github.com/owner/repo/releases/download/v1/mod.pk3')}`,
        registryApi
      )
    ).toEqual({
      hash: 'abcdef0123456789abcdef0123456789',
      sourceUrl: 'https://github.com/owner/repo/releases/download/v1/mod.pk3'
    })
  })

  it('rejects links from another origin or with malformed registry data', () => {
    const tracked = `${registryApi}/api/downloads/mods/abcdef0123456789abcdef0123456789?url=https%3A%2F%2Fgithub.com%2Fa%2Fb%2Freleases%2Fdownload%2Fv1%2Fm.pk3`
    expect(getTrackedRegistryDownload(tracked.replace('db.uac-soft.online', 'attacker.test'), registryApi)).toBeNull()
    expect(getTrackedRegistryDownload(`${registryApi}/api/downloads/mods/not-a-hash?url=https%3A%2F%2Fgithub.com`, registryApi)).toBeNull()
    expect(getTrackedRegistryDownload(`${registryApi}/api/downloads/mods/abcdef0123456789abcdef0123456789`, registryApi)).toBeNull()
  })
})

describe('isGithubReleaseAsset', () => {
  it('accepts github.com release download asset URLs', () => {
    expect(
      isGithubReleaseAsset(new URL('https://github.com/owner/repo/releases/download/v1.0/mod.pk3'))
    ).toBe(true)
  })

  it('accepts www.github.com release download asset URLs', () => {
    expect(
      isGithubReleaseAsset(
        new URL('https://www.github.com/owner/repo/releases/download/v1.0/mod.zip')
      )
    ).toBe(true)
  })

  it('rejects repository pages', () => {
    expect(isGithubReleaseAsset(new URL('https://github.com/owner/repo'))).toBe(false)
    expect(isGithubReleaseAsset(new URL('https://github.com/owner/repo/releases'))).toBe(false)
  })

  it('rejects archive tarball links', () => {
    expect(
      isGithubReleaseAsset(new URL('https://github.com/owner/repo/archive/refs/heads/main.zip'))
    ).toBe(false)
  })

  it('rejects codeload archive links', () => {
    expect(
      isGithubReleaseAsset(new URL('https://codeload.github.com/owner/repo/zip/refs/heads/main'))
    ).toBe(false)
  })

  it('rejects other hosts with a matching path', () => {
    expect(
      isGithubReleaseAsset(new URL('https://example.com/owner/repo/releases/download/v1.0/mod.pk3'))
    ).toBe(false)
  })
})

describe('isGithubArchiveUrl', () => {
  it('accepts repo archive master zips', () => {
    expect(isGithubArchiveUrl(new URL('https://github.com/JRHard771/AI-Director/archive/master.zip'))).toBe(true)
  })

  it('accepts any branch ref', () => {
    expect(
      isGithubArchiveUrl(new URL('https://github.com/owner/repo/archive/develop.zip'))
    ).toBe(true)
  })

  it('accepts refs/heads and refs/tags archive zips', () => {
    expect(
      isGithubArchiveUrl(new URL('https://github.com/owner/repo/archive/refs/heads/main.zip'))
    ).toBe(true)
    expect(
      isGithubArchiveUrl(new URL('https://github.com/owner/repo/archive/refs/tags/v1.0.zip'))
    ).toBe(true)
  })

  it('accepts www.github.com archives', () => {
    expect(
      isGithubArchiveUrl(new URL('https://www.github.com/owner/repo/archive/main.zip'))
    ).toBe(true)
  })

  it('rejects archive links without a .zip suffix', () => {
    expect(isGithubArchiveUrl(new URL('https://github.com/owner/repo/archive/master'))).toBe(false)
    expect(
      isGithubArchiveUrl(new URL('https://github.com/owner/repo/archive/refs/heads/main'))
    ).toBe(false)
  })

  it('rejects blob pages that end in .zip', () => {
    expect(
      isGithubArchiveUrl(new URL('https://github.com/owner/repo/blob/master/mod.zip'))
    ).toBe(false)
  })

  it('rejects release assets and other hosts', () => {
    expect(
      isGithubArchiveUrl(new URL('https://github.com/owner/repo/releases/download/v1/mod.zip'))
    ).toBe(false)
    expect(
      isGithubArchiveUrl(new URL('https://codeload.github.com/owner/repo/zip/refs/heads/main'))
    ).toBe(false)
  })
})

describe('isModdbStartPage', () => {
  it('accepts www.moddb.com download start links', () => {
    expect(isModdbStartPage(new URL('https://www.moddb.com/downloads/start/12345'))).toBe(true)
  })

  it('accepts bare moddb.com download start links', () => {
    expect(isModdbStartPage(new URL('https://moddb.com/downloads/start/12345'))).toBe(true)
  })

  it('accepts addons start links', () => {
    expect(isModdbStartPage(new URL('https://www.moddb.com/addons/start/98765'))).toBe(true)
  })

  it('rejects mod pages', () => {
    expect(isModdbStartPage(new URL('https://www.moddb.com/mods/foo'))).toBe(false)
  })

  it('rejects files.moddb.com direct file hosts', () => {
    expect(isModdbStartPage(new URL('https://files.moddb.com/12345/download/foo.zip'))).toBe(false)
  })

  it('rejects other hosts with a matching path', () => {
    expect(isModdbStartPage(new URL('https://example.com/downloads/start/12345'))).toBe(false)
  })
})

describe('isInAppDownloadUrl', () => {
  it('accepts github release asset strings', () => {
    expect(isInAppDownloadUrl('https://github.com/a/b/releases/download/v1/mod.pk3')).toBe(true)
  })

  it('accepts github repo/branch archive zip strings', () => {
    expect(isInAppDownloadUrl('https://github.com/JRHard771/AI-Director/archive/master.zip')).toBe(
      true
    )
    expect(isInAppDownloadUrl('https://github.com/a/b/archive/refs/heads/main.zip')).toBe(true)
  })

  it('accepts moddb start-page strings', () => {
    expect(isInAppDownloadUrl('https://www.moddb.com/downloads/start/123')).toBe(true)
  })

  it('rejects ordinary URLs', () => {
    expect(isInAppDownloadUrl('https://example.com/mod.pk3')).toBe(false)
    expect(isInAppDownloadUrl('https://www.moddb.com/mods/foo')).toBe(false)
    expect(isInAppDownloadUrl('https://github.com/a/b/archive/master')).toBe(false)
  })

  it('returns false for malformed URLs instead of throwing', () => {
    expect(isInAppDownloadUrl('not a url')).toBe(false)
    expect(isInAppDownloadUrl('')).toBe(false)
  })
})
