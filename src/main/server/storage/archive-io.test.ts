import { describe, it, expect } from 'vitest'
import fs from 'fs-extra'
import os from 'os'
import path from 'path'
import { extractZipSafe, extract7zSafe, scanArchiveFile, sevenZipAndScan } from './archive-io'

interface ZipEntry {
  name: string
  data: Buffer
  /** Unix mode bits stored in the entry's external attributes (default: regular file). */
  mode?: number
}

function crc32(buf: Buffer): number {
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i]
    for (let k = 0; k < 8; k++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

/**
 * Build a minimal STORE-method zip so tests can control entry names and mode
 * bits verbatim — adm-zip normalizes '../' names and can't express symlinks.
 */
function buildZip(entries: ZipEntry[]): Buffer {
  const locals: Buffer[] = []
  const central: Buffer[] = []
  let offset = 0

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, 'utf8')
    const crc = crc32(entry.data)

    const lfh = Buffer.alloc(30)
    lfh.writeUInt32LE(0x04034b50, 0) // PK\x03\x04
    lfh.writeUInt16LE(20, 4) // version needed
    lfh.writeUInt16LE(0, 8) // method: store
    lfh.writeUInt16LE(0x21, 12) // mod date
    lfh.writeUInt32LE(crc, 14)
    lfh.writeUInt32LE(entry.data.length, 18)
    lfh.writeUInt32LE(entry.data.length, 22)
    lfh.writeUInt16LE(nameBuf.length, 26)
    const local = Buffer.concat([lfh, nameBuf, entry.data])
    locals.push(local)

    const mode = entry.mode ?? 0o100644
    const cd = Buffer.alloc(46)
    cd.writeUInt32LE(0x02014b50, 0) // PK\x01\x02
    cd.writeUInt16LE((0o3 << 8) | 20, 4) // version made by: unix, 3.30
    cd.writeUInt16LE(20, 6) // version needed
    cd.writeUInt16LE(0, 10) // method: store
    cd.writeUInt16LE(0x21, 14) // mod date
    cd.writeUInt32LE(crc, 16)
    cd.writeUInt32LE(entry.data.length, 20)
    cd.writeUInt32LE(entry.data.length, 24)
    cd.writeUInt16LE(nameBuf.length, 28)
    cd.writeUInt32LE((mode << 16) >>> 0, 38) // external attributes
    cd.writeUInt32LE(offset, 42)
    central.push(Buffer.concat([cd, nameBuf]))
    offset += local.length
  }

  const cdBuf = Buffer.concat(central)
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0) // PK\x05\x06
  eocd.writeUInt16LE(entries.length, 8)
  eocd.writeUInt16LE(entries.length, 10)
  eocd.writeUInt32LE(cdBuf.length, 12)
  eocd.writeUInt32LE(offset, 16)
  return Buffer.concat([...locals, cdBuf, eocd])
}

async function extractToTemp(zip: Buffer): Promise<{ dir: string; cleanup: () => Promise<void> }> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'uac-ziptest-'))
  const zipPath = path.join(dir, 'archive.zip')
  await fs.writeFile(zipPath, zip)
  return { dir, cleanup: () => fs.remove(dir) }
}

describe('extractZipSafe', () => {
  it('extracts nested files and directory entries', async () => {
    const zip = buildZip([
      { name: 'folder/', data: Buffer.alloc(0) },
      { name: 'folder/map.wad', data: Buffer.from('WAD-DATA') },
      { name: 'readme.txt', data: Buffer.from('hello') }
    ])
    const { dir, cleanup } = await extractToTemp(zip)
    try {
      await extractZipSafe(path.join(dir, 'archive.zip'), path.join(dir, 'out'))
      expect(await fs.readFile(path.join(dir, 'out/folder/map.wad'), 'utf8')).toBe('WAD-DATA')
      expect(await fs.readFile(path.join(dir, 'out/readme.txt'), 'utf8')).toBe('hello')
    } finally {
      await cleanup()
    }
  })

  it('rejects entries that escape the extraction directory', async () => {
    const zip = buildZip([{ name: '../evil.txt', data: Buffer.from('pwned') }])
    const { dir, cleanup } = await extractToTemp(zip)
    try {
      await expect(
        extractZipSafe(path.join(dir, 'archive.zip'), path.join(dir, 'out'))
      ).rejects.toThrow(/escapes extraction directory|invalid relative path/)
      expect(await fs.pathExists(path.join(dir, 'evil.txt'))).toBe(false)
    } finally {
      await cleanup()
    }
  })

  it('rejects traversal through nested .. segments', async () => {
    const zip = buildZip([{ name: 'a/../../evil.txt', data: Buffer.from('pwned') }])
    const { dir, cleanup } = await extractToTemp(zip)
    try {
      await expect(
        extractZipSafe(path.join(dir, 'archive.zip'), path.join(dir, 'out'))
      ).rejects.toThrow(/escapes extraction directory|invalid relative path/)
      expect(await fs.pathExists(path.join(dir, 'evil.txt'))).toBe(false)
    } finally {
      await cleanup()
    }
  })

  it('rejects symlink entries', async () => {
    const zip = buildZip([{ name: 'link', data: Buffer.from('../../etc/passwd'), mode: 0o120777 }])
    const { dir, cleanup } = await extractToTemp(zip)
    try {
      await expect(
        extractZipSafe(path.join(dir, 'archive.zip'), path.join(dir, 'out'))
      ).rejects.toThrow(/symlink/)
      expect(await fs.pathExists(path.join(dir, 'out/link'))).toBe(false)
    } finally {
      await cleanup()
    }
  })
})

// ── 7z extraction ──────────────────────────────────────────────────────────
//
// Fixtures live in ./__fixtures__ and were produced with:
//   * archive.7z       — py7zr writes `mods/readme.txt` + `mods/nested/map.wad`
//   * archive-hostile.7z — same, plus two symlink entries (`mods/inside.link` →
//     `readme.txt`, `mods/outside.link` → `/etc/passwd`) and two entries whose
//     names escape the extraction root (`../escape.txt`, `/tmp/…`) — py7zr's
//     internal `_writestr` skips the path check its public API applies.

describe('extract7zSafe', () => {
  const FIXTURES = path.join(__dirname, '__fixtures__')

  /** Temp host layout: `<dir>/in` holds the archive, `<dir>/out` is extracted into. */
  async function extractToTemp(archive: string): Promise<{
    dir: string
    outDir: string
    cleanup: () => Promise<void>
  }> {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'uac-7ztest-'))
    const inDir = path.join(dir, 'in')
    const outDir = path.join(dir, 'out')
    await fs.ensureDir(inDir)
    await fs.ensureDir(outDir)
    await fs.copy(path.join(FIXTURES, archive), path.join(inDir, archive))
    return { dir, outDir, cleanup: () => fs.remove(dir) }
  }

  it('extracts nested files and directories', async () => {
    const { dir, outDir, cleanup } = await extractToTemp('archive.7z')
    try {
      await extract7zSafe(path.join(dir, 'in/archive.7z'), outDir)
      expect(await fs.readFile(path.join(outDir, 'mods/readme.txt'), 'utf8')).toContain(
        'UAC archive fixture'
      )
      expect(await fs.readFile(path.join(outDir, 'mods/nested/map.wad'))).toEqual(
        Buffer.from('WAD\x00fixture')
      )
    } finally {
      await cleanup()
    }
  })

  it('never recreates symlinks and keeps escaping entries inside the destination', async () => {
    const { dir, outDir, cleanup } = await extractToTemp('archive-hostile.7z')
    try {
      await extract7zSafe(path.join(dir, 'in/archive-hostile.7z'), outDir)

      // 7-Zip was told not to restore links — neither the benign nor the
      // /etc/passwd-pointing entry may exist afterwards.
      expect(await fs.pathExists(path.join(outDir, 'mods/inside.link'))).toBe(false)
      expect(await fs.pathExists(path.join(outDir, 'mods/outside.link'))).toBe(false)

      // `../escape.txt` and `/tmp/…` are rewritten relative to the destination
      // instead of resolving to their literal (outside) locations.
      expect(await fs.pathExists(path.join(outDir, 'escape.txt'))).toBe(true)
      expect(await fs.pathExists(path.join(outDir, 'tmp/7ztest-escaped.txt'))).toBe(true)

      // Nothing landed next to the archive/extraction dirs.
      expect((await fs.readdir(dir)).sort()).toEqual(['in', 'out'])
      expect(await fs.pathExists(path.join(dir, 'escape.txt'))).toBe(false)
    } finally {
      await cleanup()
    }
  })

  it('reports a readable error for a file that is not a 7z archive', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'uac-7ztest-'))
    try {
      const bogus = path.join(dir, 'bogus.7z')
      await fs.writeFile(bogus, Buffer.from('definitely not a 7z archive'))
      await expect(sevenZipAndScan(bogus)).rejects.toThrow(
        /Failed to extract 7Z archive: .*(not archive|Cannot open)/i
      )
    } finally {
      await fs.remove(dir)
    }
  })
})

describe('scanArchiveFile', () => {
  it('rejects paths that are not a supported archive', async () => {
    await expect(scanArchiveFile('/tmp/definitely-not-an-archive.wad')).rejects.toThrow(
      /Unsupported archive type/
    )
  })
})
