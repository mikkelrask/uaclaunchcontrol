import { describe, it, expect } from 'vitest'
import {
  isGithubReleaseAsset,
  isGithubArchiveUrl,
  isModdbStartPage,
  isInAppDownloadUrl
} from './mod-download-url'

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
