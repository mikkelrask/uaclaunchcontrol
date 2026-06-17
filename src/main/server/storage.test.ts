import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import path from 'path'
import fs from 'fs-extra'
import os from 'os'
import {
  stripMd5Suffix,
  countMd5Suffixes,
  wadNamePriority,
  resolvePath,
  computeFileHash
} from './storage'

describe('stripMd5Suffix', () => {
  it('strips a single MD5 suffix', () => {
    expect(stripMd5Suffix('doom2-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')).toBe('doom2')
  })

  it('strips multiple MD5 suffixes', () => {
    expect(
      stripMd5Suffix('file-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb')
    ).toBe('file')
  })

  it('returns original if no MD5 pattern', () => {
    expect(stripMd5Suffix('plain-file')).toBe('plain-file')
  })

  it('handles empty string', () => {
    expect(stripMd5Suffix('')).toBe('')
  })
})

describe('countMd5Suffixes', () => {
  it('counts zero for plain names', () => {
    expect(countMd5Suffixes('doom2')).toBe(0)
  })

  it('counts one for a hashed name', () => {
    expect(countMd5Suffixes('doom2-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')).toBe(1)
  })

  it('counts two for double-hashed name', () => {
    expect(
      countMd5Suffixes('doom2-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb')
    ).toBe(2)
  })
})

describe('wadNamePriority', () => {
  it('returns 0 for plain WAD names', () => {
    expect(wadNamePriority('doom2.wad')).toBe(0)
  })

  it('returns 1 for single-hash names', () => {
    expect(wadNamePriority('doom2-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.wad')).toBe(1)
  })

  it('returns 2 for double-hash names', () => {
    expect(
      wadNamePriority('doom2-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.wad')
    ).toBe(2)
  })
})

describe('resolvePath', () => {
  it('expands tilde to home directory', () => {
    const result = resolvePath('~/test')
    expect(result).toBe(path.join(os.homedir(), 'test'))
  })

  it('passes absolute paths through unchanged', () => {
    const result = resolvePath('/usr/local/bin')
    expect(result).toBe('/usr/local/bin')
  })

  it('passes Windows paths through unchanged', () => {
    const result = resolvePath('C:\\Users\\mr\\Doom')
    expect(result).toBe('C:\\Users\\mr\\Doom')
  })

  it('passes Windows forward-slash paths through unchanged', () => {
    const result = resolvePath('C:/Users/mr/Doom')
    expect(result).toBe('C:/Users/mr/Doom')
  })

  it('handles tilde alone', () => {
    const result = resolvePath('~')
    expect(result).toBe(os.homedir())
  })
})

describe('computeFileHash', () => {
  let tmpDir: string

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uac-test-'))
  })

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('returns known MD5 for "hello world"', async () => {
    const filePath = path.join(tmpDir, 'hello.txt')
    fs.writeFileSync(filePath, 'hello world')
    const hash = await computeFileHash(filePath)
    expect(hash).toBe('5eb63bbbe01eeed093cb22bb8f5acdc3')
  })

  it('returns different hash for different content', async () => {
    const filePath = path.join(tmpDir, 'other.txt')
    fs.writeFileSync(filePath, 'goodbye world')
    const hash = await computeFileHash(filePath)
    expect(hash).not.toBe('5eb63bbbe01eeed093cb22bb8f5acdc3')
  })

  it('returns empty string for non-existent file', async () => {
    const orig = console.error
    console.error = () => {} // suppress expected ENOENT noise
    const hash = await computeFileHash(path.join(tmpDir, 'nope.txt'))
    console.error = orig
    expect(hash).toBe('')
  })
})
