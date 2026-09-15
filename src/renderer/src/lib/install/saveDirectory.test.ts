import { describe, it, expect } from 'vitest'
import { deriveSaveDirectory } from './saveDirectory'

const SAVES = '/home/user/saves'

describe('deriveSaveDirectory', () => {
  it('derives a per-protocol path from the title', () => {
    expect(deriveSaveDirectory('Knee-Deep in Brutal FreeDoom', '', SAVES)).toBe(
      `${SAVES}/knee-deep-in-brutal-freedoom`
    )
  })

  it('derives without a configured saves path', () => {
    expect(deriveSaveDirectory('Brutal Doom', '', undefined)).toBe('brutal-doom')
  })

  it('leaves a path the user typed alone', () => {
    expect(deriveSaveDirectory('Brutal Doom', '/elsewhere/my-saves', SAVES)).toBe(
      '/elsewhere/my-saves'
    )
  })

  it('re-derives a path it derived earlier, so edits to the title follow through', () => {
    expect(deriveSaveDirectory('Brutal Doom', `${SAVES}/old-name`, SAVES)).toBe(
      `${SAVES}/brutal-doom`
    )
  })

  it('keeps the current path while there is no title to slug', () => {
    expect(deriveSaveDirectory('   ', `${SAVES}/brutal-doom`, SAVES)).toBe(`${SAVES}/brutal-doom`)
  })
})
