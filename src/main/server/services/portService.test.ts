import { describe, it, expect, vi, afterEach } from 'vitest'

interface Asset {
  name: string
  size: number
  browser_download_url: string
}

const ORIG_PLATFORM = process.platform

function setPlatform(p: string): void {
  Object.defineProperty(process, 'platform', {
    value: p,
    configurable: true,
    writable: true
  })
}

function restorePlatform(): void {
  Object.defineProperty(process, 'platform', {
    value: ORIG_PLATFORM,
    configurable: true,
    writable: true
  })
}

function makeAssets(names: string[]): Asset[] {
  return names.map((name) => ({ name, size: 1, browser_download_url: '' }))
}

afterEach(() => {
  vi.unstubAllGlobals()
  restorePlatform()
})

/* ── GZDoom ──────────────────────────────────────────── */

describe('pickGzdoomAsset', () => {
  it('picks windows.zip on Windows', async () => {
    setPlatform('win32')
    vi.resetModules()
    const { pickGzdoomAsset } = await import('./portService')
    const assets = makeAssets(['gzdoom-macos.zip', 'gzdoom-windows.zip', 'gzdoom-linux.AppImage'])
    expect(pickGzdoomAsset(assets)?.name).toBe('gzdoom-windows.zip')
  })

  it('picks macos.zip on macOS', async () => {
    setPlatform('darwin')
    vi.resetModules()
    const { pickGzdoomAsset } = await import('./portService')
    const assets = makeAssets(['gzdoom-macos.zip', 'gzdoom-windows.zip', 'gzdoom-linux.AppImage'])
    expect(pickGzdoomAsset(assets)?.name).toBe('gzdoom-macos.zip')
  })

  it('picks portable tar.xz on Linux when available', async () => {
    setPlatform('linux')
    vi.resetModules()
    const { pickGzdoomAsset } = await import('./portService')
    const assets = makeAssets([
      'gzdoom-linux-portable.tar.xz',
      'gzdoom-linux.AppImage',
      'gzdoom-linux.tar.xz'
    ])
    expect(pickGzdoomAsset(assets)?.name).toBe('gzdoom-linux-portable.tar.xz')
  })

  it('favours AppImage over plain tar.xz on Linux', async () => {
    setPlatform('linux')
    vi.resetModules()
    const { pickGzdoomAsset } = await import('./portService')
    const assets = makeAssets(['gzdoom-linux.AppImage', 'gzdoom-linux.tar.xz'])
    expect(pickGzdoomAsset(assets)?.name).toBe('gzdoom-linux.AppImage')
  })

  it('returns null for unknown platform', async () => {
    setPlatform('freebsd')
    vi.resetModules()
    const { pickGzdoomAsset } = await import('./portService')
    expect(pickGzdoomAsset([])).toBeNull()
  })
})

/* ── UZDoom ──────────────────────────────────────────── */

describe('pickUzdoomAsset', () => {
  it('picks Windows-UZDoom.zip on Windows', async () => {
    setPlatform('win32')
    vi.resetModules()
    const { pickUzdoomAsset } = await import('./portService')
    const assets = makeAssets([
      'Windows-UZDoom.zip',
      'macOS-UZDoom-0.1.0.zip',
      'Linux-UZDoom-0.1.0.AppImage'
    ])
    expect(pickUzdoomAsset(assets)?.name).toBe('Windows-UZDoom.zip')
  })

  it('picks MacOS-*.dmg on macOS', async () => {
    setPlatform('darwin')
    vi.resetModules()
    const { pickUzdoomAsset } = await import('./portService')
    const assets = makeAssets(['MacOS-UZDoom-0.1.0.dmg', 'Windows-UZDoom.zip'])
    expect(pickUzdoomAsset(assets)?.name).toBe('MacOS-UZDoom-0.1.0.dmg')
  })

  it('picks Linux-UZDoom AppImage on Linux', async () => {
    setPlatform('linux')
    vi.resetModules()
    const { pickUzdoomAsset } = await import('./portService')
    const assets = makeAssets([
      'Linux-UZDoom-Legacy-0.9.0.AppImage',
      'Linux-UZDoom-0.1.0.AppImage'
    ])
    expect(pickUzdoomAsset(assets)?.name).toBe('Linux-UZDoom-0.1.0.AppImage')
  })

  it('excludes Legacy suffix on Linux', async () => {
    setPlatform('linux')
    vi.resetModules()
    const { pickUzdoomAsset } = await import('./portService')
    // Only a Legacy build — should not match rank-10 pattern, falls through to rank 8
    const assets = makeAssets(['Linux-UZDoom-Legacy-0.9.0.AppImage'])
    expect(pickUzdoomAsset(assets)?.name).toBe('Linux-UZDoom-Legacy-0.9.0.AppImage')
  })
})

/* ── Helion ──────────────────────────────────────────── */

describe('pickHelionAsset', () => {
  it('picks win-x64_AOT.zip on Windows', async () => {
    setPlatform('win32')
    vi.resetModules()
    const { pickHelionAsset } = await import('./portService')
    const assets = makeAssets([
      'helion-win-x64_AOT.zip',
      'helion-win-x64_SelfContained.zip',
      'helion-linux.AppImage'
    ])
    expect(pickHelionAsset(assets)?.name).toBe('helion-win-x64_AOT.zip')
  })

  it('returns null on macOS (no Helion builds)', async () => {
    setPlatform('darwin')
    vi.resetModules()
    const { pickHelionAsset } = await import('./portService')
    expect(pickHelionAsset([])).toBeNull()
  })

  it('picks AppImage on Linux over zip bundles', async () => {
    setPlatform('linux')
    vi.resetModules()
    const { pickHelionAsset } = await import('./portService')
    const assets = makeAssets([
      'helion-linux.AppImage',
      'helion-linux-x64_AOT.zip',
      'helion-linux-x64_SelfContained.zip'
    ])
    expect(pickHelionAsset(assets)?.name).toBe('helion-linux.AppImage')
  })
})
