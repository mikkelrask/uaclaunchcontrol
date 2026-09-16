import { describe, it, expect, beforeAll } from 'vitest'
import crypto from 'node:crypto'
import fs from 'fs-extra'
import os from 'os'
import path from 'path'

// The catalogue resolves its directories once, at import time, from the home
// directory — so this file builds a throwaway home, points HOME at it, and only
// then pulls the storage modules in (see beforeAll). Everything runs on real
// files, so hashing, copying and deletion are exercised end to end.
const HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'uac-catalog-'))
const MODS_DIR = path.join(HOME, '.config', 'uac', 'mods')
const FILES_DIR = path.join(MODS_DIR, 'files')

// Dynamic import is required: paths.ts resolves CONFIG_DIR from os.homedir()
// at module-load time, so HOME must be redirected before the modules load.
type Storage = typeof import('../storage')
let storage: Storage

const md5 = (content: string): string => crypto.createHash('md5').update(content).digest('hex')

/** Write a file outside the mods dir, like a drop from ~/Downloads. */
async function writeSource(name: string, content: string): Promise<string> {
  const sourcePath = path.join(HOME, name)
  await fs.writeFile(sourcePath, content)
  return sourcePath
}

const storedFiles = (): Promise<string[]> => fs.readdir(FILES_DIR)

beforeAll(async () => {
  process.env.HOME = HOME
  storage = await import('../storage')
  storage.initStorage()
})

describe('addModFileToCatalog', () => {
  it('copies a new file into the mods dir under its content hash', async () => {
    const content = 'fresh content'
    const { file, existing } = await storage.addModFileToCatalog({
      name: 'Fresh',
      filePath: await writeSource('Fresh.pk3', content),
      fileType: 'PK3',
      fileName: 'Fresh.pk3'
    })

    expect(existing).toBe(false)
    expect(file.hashValue).toBe(md5(content))
    expect(file.filePath).toBe(`files/Fresh-${md5(content)}.pk3`)
    expect(await fs.pathExists(path.join(MODS_DIR, file.filePath!))).toBe(true)
  })

  it('reuses the existing entry — and copies nothing — for content already catalogued', async () => {
    const content = 'duplicate content'
    const first = await storage.addModFileToCatalog({
      name: 'Dup one',
      filePath: await writeSource('DupOne.pk3', content),
      fileType: 'PK3'
    })
    const second = await storage.addModFileToCatalog({
      name: 'Dup two',
      filePath: await writeSource('DupTwo.pk3', content),
      fileType: 'PK3'
    })

    expect(second.existing).toBe(true)
    expect(second.file.id).toBe(first.file.id)
    expect(
      (await storage.getModFileCatalog()).filter((f) => f.hashValue === md5(content))
    ).toHaveLength(1)
    expect(await storedFiles()).toContain(`DupOne-${md5(content)}.pk3`)
    expect(await storedFiles()).not.toContain(`DupTwo-${md5(content)}.pk3`)
  })

  it('does not stack a second hash suffix onto an already suffixed file', async () => {
    const content = 'pre-suffixed content'
    const hash = md5(content)
    await fs.ensureDir(FILES_DIR)
    const source = path.join(FILES_DIR, `Pre-Suffixed-${hash}.pk3`)
    await fs.writeFile(source, content)

    const { file, existing } = await storage.addModFileToCatalog({
      name: 'Pre-suffixed',
      filePath: source,
      fileType: 'PK3'
    })

    expect(existing).toBe(false)
    expect(file.filePath).toBe(`files/Pre-Suffixed-${hash}.pk3`)
    expect(await storedFiles()).not.toContain(`Pre-Suffixed-${hash}-${hash}.pk3`)
    expect(await fs.readFile(path.join(MODS_DIR, file.filePath!), 'utf-8')).toBe(content)
  })
})

describe('deleteModFileFromCatalog', () => {
  it('deletes the catalogued file from disk when asked to', async () => {
    const { file } = await storage.addModFileToCatalog({
      name: 'Doomed',
      filePath: await writeSource('Doomed.pk3', 'doomed content'),
      fileType: 'PK3'
    })
    const onDisk = path.join(MODS_DIR, file.filePath!)
    expect(await fs.pathExists(onDisk)).toBe(true)

    const result = await storage.deleteModFileFromCatalog(file.id, true)

    expect(result.fileOutcome).toBe('deleted')
    expect(result.filePath).toBe(onDisk)
    expect(await fs.pathExists(onDisk)).toBe(false)
    expect((await storage.getModFileCatalog()).some((f) => f.id === file.id)).toBe(false)
  })

  it('leaves the file on disk unless a disk deletion was asked for', async () => {
    const { file } = await storage.addModFileToCatalog({
      name: 'Kept',
      filePath: await writeSource('Kept.pk3', 'kept content'),
      fileType: 'PK3'
    })
    const onDisk = path.join(MODS_DIR, file.filePath!)

    const result = await storage.deleteModFileFromCatalog(file.id, false)

    expect(result.fileOutcome).toBe('not-requested')
    expect(await fs.pathExists(onDisk)).toBe(true)
    expect((await storage.getModFileCatalog()).some((f) => f.id === file.id)).toBe(false)
  })

  it('reports a file that is already gone instead of failing', async () => {
    const { file } = await storage.addModFileToCatalog({
      name: 'Vanished',
      filePath: await writeSource('Vanished.pk3', 'vanished content'),
      fileType: 'PK3'
    })
    await fs.remove(path.join(MODS_DIR, file.filePath!))

    const result = await storage.deleteModFileFromCatalog(file.id, true)

    expect(result.fileOutcome).toBe('already-absent')
    expect((await storage.getModFileCatalog()).some((f) => f.id === file.id)).toBe(false)
  })
})
