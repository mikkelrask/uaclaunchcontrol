import { describe, it, expect } from 'vitest'
import { ARCHIVE_EXTENSIONS, getArchiveExtension } from './archive'

describe('getArchiveExtension', () => {
  it('recognises every supported archive extension', () => {
    for (const ext of ARCHIVE_EXTENSIONS) {
      expect(getArchiveExtension(`mod.${ext}`)).toBe(ext)
    }
  })

  it('is case-insensitive', () => {
    expect(getArchiveExtension('MOD.ZIP')).toBe('zip')
    expect(getArchiveExtension('Mod.RaR')).toBe('rar')
    expect(getArchiveExtension('mod.7Z')).toBe('7z')
  })

  it('reads the extension off a full path', () => {
    expect(getArchiveExtension('/home/user/My Mods/pack.v2.7z')).toBe('7z')
    expect(getArchiveExtension('C:\\Users\\me\\Downloads\\pack.rar')).toBe('rar')
  })

  it('ignores dotted directory names and extensions in them', () => {
    expect(getArchiveExtension('/home/user.name/archive')).toBeNull()
    expect(getArchiveExtension('/home/user.7z/archive')).toBeNull()
  })

  it('rejects non-archive and missing extensions', () => {
    for (const name of ['mod.wad', 'mod.pk3', 'mod.7zip', 'mod.7z.bak', 'archive']) {
      expect(getArchiveExtension(name), name).toBeNull()
    }
  })
})
