import { describe, it, expect } from 'vitest'
import { countMd5Suffixes, stripMd5Suffix } from './wad-names'

const HASH_A = 'a'.repeat(32)
const HASH_B = 'b'.repeat(32)

describe('stripMd5Suffix', () => {
  it('strips a single appended hash', () => {
    expect(stripMd5Suffix(`doom2-${HASH_A}`)).toBe('doom2')
  })

  it('strips every appended hash', () => {
    expect(stripMd5Suffix(`file-${HASH_A}-${HASH_B}`)).toBe('file')
  })

  it('leaves a plain name alone', () => {
    expect(stripMd5Suffix('plain-file')).toBe('plain-file')
    expect(stripMd5Suffix('')).toBe('')
  })
})

describe('countMd5Suffixes', () => {
  it('counts appended hashes', () => {
    expect(countMd5Suffixes('doom2')).toBe(0)
    expect(countMd5Suffixes(`doom2-${HASH_A}`)).toBe(1)
    expect(countMd5Suffixes(`doom2-${HASH_A}-${HASH_B}`)).toBe(2)
  })
})
