import { describe, it, expect } from 'vitest'
import { matchImportFiles } from './useJsonDrop'
import type { IModFile } from '@shared/schema'
import type { UacModpackImport } from './types'

describe('matchImportFiles', () => {
  it('preserves the original array order even when matched and missing files are interleaved', () => {
    const importFiles: UacModpackImport['files'] = [
      { name: 'known-a', hashValue: 'hash-a' },
      { name: 'unknown-b', hashValue: 'hash-b' },
      { name: 'known-c', hashValue: 'hash-c' },
      { name: 'unknown-d', hashValue: 'hash-d' }
    ]
    const catalogData: IModFile[] = [
      { id: 1, name: 'known-a', hashValue: 'hash-a' },
      { id: 2, name: 'known-c', hashValue: 'hash-c' }
    ]

    const { files, missingCount } = matchImportFiles(importFiles, catalogData, undefined)

    expect(files.map((f) => f.hashValue)).toEqual(['hash-a', 'hash-b', 'hash-c', 'hash-d'])
    expect(missingCount).toBe(2)
  })

  it('marks unmatched entries with isRequired and empty filePath', () => {
    const importFiles: UacModpackImport['files'] = [{ name: 'gone', hashValue: 'missing-hash' }]

    const { files, missingCount } = matchImportFiles(importFiles, [], undefined)

    expect(missingCount).toBe(1)
    expect(files[0]).toMatchObject({
      name: 'gone',
      fileName: 'gone',
      filePath: '',
      isRequired: true,
      hashValue: 'missing-hash'
    })
  })

  it('attaches a configTemplate to matched files when configHash resolves to written config content', () => {
    const importFiles: UacModpackImport['files'] = [
      { name: 'known', hashValue: 'hash-a', configHash: 'cfg-hash' }
    ]
    const catalogData: IModFile[] = [{ id: 1, name: 'known', hashValue: 'hash-a' }]
    const importConfigs: UacModpackImport['configs'] = { 'cfg-hash': { content: 'cfg text' } }

    const { files } = matchImportFiles(importFiles, catalogData, importConfigs)

    expect(files[0].configTemplate).toEqual({ configFile: 'cfg-hash.cfg', md5Hash: 'cfg-hash' })
  })

  it('preserves an existing catalog configTemplate over an import-provided one', () => {
    const importFiles: UacModpackImport['files'] = [
      { name: 'known', hashValue: 'hash-a', configHash: 'cfg-hash' }
    ]
    const existingTemplate = { configFile: 'existing.cfg', md5Hash: 'existing-hash' }
    const catalogData: IModFile[] = [
      { id: 1, name: 'known', hashValue: 'hash-a', configTemplate: existingTemplate }
    ]
    const importConfigs: UacModpackImport['configs'] = { 'cfg-hash': { content: 'cfg text' } }

    const { files } = matchImportFiles(importFiles, catalogData, importConfigs)

    expect(files[0].configTemplate).toEqual(existingTemplate)
  })
})
