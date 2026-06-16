import { describe, it, expect } from 'vitest'
import { parseBatContent, deriveFileType, resolveRelativePaths, buildHashFileName } from './parsers'

describe('parseBatContent', () => {
  it('extracts source port family from .bat', () => {
    const bat = ['@echo off', 'gzdoom.exe -iwad doom2.wad -file mod1.pk3 mod2.wad'].join('\n')
    const result = parseBatContent(bat)
    expect(result.sourcePortFamily).toBe('gzdoom')
    expect(result.iwad).toBe('doom2.wad')
    expect(result.modFiles).toEqual(['mod1.pk3', 'mod2.wad'])
  })

  it('collects -file entries across multiple lines', () => {
    const bat = [
      ':: GZDoom batch',
      'gzdoom.exe -iwad doom2.wad',
      '-file mod1.pk3',
      '-file mod2.wad mod3.pk3'
    ].join('\n')
    const result = parseBatContent(bat)
    expect(result.modFiles).toEqual(['mod1.pk3', 'mod2.wad', 'mod3.pk3'])
  })

  it('detects uzdoom as source port', () => {
    const bat = 'uzdoom.exe -iwad doom2.wad -file mod.pk3\n'
    const result = parseBatContent(bat)
    expect(result.sourcePortFamily).toBe('uzdoom')
  })

  it('detects zandronum as source port', () => {
    const bat = 'zandronum.exe -iwad doom2.wad -file mod.pk3\n'
    const result = parseBatContent(bat)
    expect(result.sourcePortFamily).toBe('zandronum')
  })

  it('extracts -config file path', () => {
    const bat = 'gzdoom.exe -iwad doom2.wad -config gzdoom.ini -file mod.pk3\n'
    const result = parseBatContent(bat)
    expect(result.configFile).toBe('gzdoom.ini')
  })

  it('extracts +exec config path', () => {
    const bat = 'gzdoom.exe -iwad doom2.wad +exec custom.cfg -file mod.pk3\n'
    const result = parseBatContent(bat)
    expect(result.configFile).toBe('custom.cfg')
  })

  it('captures extra params after -file block', () => {
    const bat = 'gzdoom.exe -iwad doom2.wad -file mod.pk3 +set skill 4 -warp 1 1\n'
    const result = parseBatContent(bat)
    // +set starts with + not -, so it's consumed as mod path; only -warp onward is extra param
    expect(result.extraParams).toEqual(['-warp', '1', '1'])
  })

  it('skips comment lines', () => {
    const bat = [
      ':: This is a comment',
      'rem old stuff',
      'gzdoom.exe -iwad doom2.wad -file mod.pk3'
    ].join('\n')
    const result = parseBatContent(bat)
    expect(result.sourcePortFamily).toBe('gzdoom')
    expect(result.modFiles).toEqual(['mod.pk3'])
  })

  it('handles quoted paths with spaces', () => {
    const bat = 'gzdoom.exe -iwad "C:\\Program Files\\Doom\\doom2.wad" -file "my mod.pk3"\n'
    const result = parseBatContent(bat)
    expect(result.iwad).toBe('C:\\Program Files\\Doom\\doom2.wad')
    expect(result.modFiles).toEqual(['my mod.pk3'])
  })

  it('returns empty modFiles when no -file present', () => {
    const bat = 'gzdoom.exe -iwad doom2.wad\n'
    const result = parseBatContent(bat)
    expect(result.modFiles).toEqual([])
  })

  it('returns undefined source port when no known port found', () => {
    const bat = 'some_other_engine.exe -iwad doom2.wad -file mod.pk3\n'
    const result = parseBatContent(bat)
    expect(result.sourcePortFamily).toBeUndefined()
  })
})

describe('deriveFileType', () => {
  it('returns WAD for .wad', () => {
    expect(deriveFileType('.wad')).toBe('WAD')
  })

  it('returns WAD for .WAD', () => {
    expect(deriveFileType('.WAD')).toBe('WAD')
  })

  it('returns PK3 for pk3', () => {
    expect(deriveFileType('pk3')).toBe('PK3')
  })

  it('returns PK3 for pk7', () => {
    expect(deriveFileType('pk7')).toBe('PK3')
  })

  it('returns PK3 for ipk3', () => {
    expect(deriveFileType('ipk3')).toBe('PK3')
  })

  it('returns DEH for deh', () => {
    expect(deriveFileType('deh')).toBe('DEH')
  })

  it('returns DEH for bex', () => {
    expect(deriveFileType('bex')).toBe('DEH')
  })

  it('returns ZIP for zip', () => {
    expect(deriveFileType('zip')).toBe('ZIP')
  })

  it('returns WAD for unknown extension', () => {
    expect(deriveFileType('xyz')).toBe('WAD')
  })
})

describe('buildHashFileName', () => {
  it('appends hash before extension', () => {
    expect(buildHashFileName('file.wad', 'abc123')).toBe('file-abc123.wad')
  })

  it('replaces existing MD5 suffix', () => {
    expect(buildHashFileName('file-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.wad', 'abc123')).toBe(
      'file-abc123.wad'
    )
  })

  it('handles file with no extension', () => {
    expect(buildHashFileName('file', 'abc123')).toBe('file-abc123')
  })

  it('replaces multiple MD5 suffixes', () => {
    const result = buildHashFileName(
      'file-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.wad',
      'abc123'
    )
    expect(result).toBe('file-abc123.wad')
  })
})

describe('resolveRelativePaths', () => {
  it('resolves relative paths against Unix base path', () => {
    const result = resolveRelativePaths('/games/doom/run.bat', ['mod.pk3'])
    expect(result).toEqual(['/games/doom/mod.pk3'])
  })

  it('resolves relative paths against Windows base path', () => {
    const result = resolveRelativePaths('C:\\games\\doom\\run.bat', ['mod.pk3'])
    expect(result).toEqual(['C:\\games\\doom\\mod.pk3'])
  })

  it('passes absolute paths through unchanged', () => {
    const result = resolveRelativePaths('/games/doom/run.bat', ['/other/mod.pk3'])
    expect(result).toEqual(['/other/mod.pk3'])
  })

  it('passes Windows absolute paths through unchanged', () => {
    const result = resolveRelativePaths('C:\\games\\doom\\run.bat', ['D:\\other\\mod.pk3'])
    expect(result).toEqual(['D:\\other\\mod.pk3'])
  })

  it('returns original array when base path has no separator', () => {
    const files = ['mod.pk3']
    const result = resolveRelativePaths('run.bat', files)
    expect(result).toEqual(files)
    // Should be same reference
    expect(result).toBe(files)
  })
})
