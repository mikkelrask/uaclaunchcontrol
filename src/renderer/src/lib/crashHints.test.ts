import { describe, it, expect } from 'vitest'
import { inferCrashHint } from './crashHints'

describe('inferCrashHint', () => {
  it('recognizes a missing IWAD', () => {
    expect(inferCrashHint(['Cannot find a game IWAD.'])).toMatch(/IWAD/)
  })

  it('recognizes a missing mod file', () => {
    expect(inferCrashHint(["Unable to open file 'mymod.pk3'"])).toMatch(/mod file/)
  })

  it('recognizes a DECORATE/ZScript error', () => {
    expect(inferCrashHint(['Script error, "mymod.pk3:decorate" line 12:'])).toMatch(/script error/i)
  })

  it('recognizes a VM abort', () => {
    expect(inferCrashHint(['VM execution aborted: tried to read from address zero.'])).toMatch(
      /runtime/
    )
  })

  it('recognizes a version/checksum mismatch', () => {
    expect(inferCrashHint(['Checksum mismatch, cannot continue.'])).toMatch(/wrong version/)
  })

  it('returns null when nothing recognizable is present', () => {
    expect(inferCrashHint(['Vid_Cardname: llvmpipe', 'Sound init'])).toBeNull()
  })

  it('returns null for an empty log tail', () => {
    expect(inferCrashHint([])).toBeNull()
  })
})
