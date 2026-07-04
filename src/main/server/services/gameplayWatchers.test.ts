import { describe, it, expect } from 'vitest'
import { matchGameplayEvent } from './gameplayWatchers'

describe('matchGameplayEvent', () => {
  it('detects reaching MAP30 - Icon of Sin', () => {
    expect(matchGameplayEvent('MAP30 - Icon of Sin')).toEqual({
      type: 'MAP_REACHED',
      mapName: 'MAP30'
    })
  })

  it('detects reaching any MAPxx slot, case-insensitively', () => {
    expect(matchGameplayEvent('map01 - entryway')).toEqual({
      type: 'MAP_REACHED',
      mapName: 'MAP01'
    })
  })

  it('detects IDDQD / console god', () => {
    expect(matchGameplayEvent('Degreelessness Mode ON')).toEqual({
      type: 'CHEAT_ACTIVATED',
      cheat: 'god-mode'
    })
  })

  it('detects IDKFA', () => {
    expect(matchGameplayEvent('Very Happy Ammo Added')).toEqual({
      type: 'CHEAT_ACTIVATED',
      cheat: 'give-all'
    })
  })

  it('detects IDCLIP', () => {
    expect(matchGameplayEvent('No Clipping Mode ON')).toEqual({
      type: 'CHEAT_ACTIVATED',
      cheat: 'noclip'
    })
  })

  it('detects IDBEHOLDL', () => {
    expect(matchGameplayEvent('Power-up Toggled')).toEqual({
      type: 'CHEAT_ACTIVATED',
      cheat: 'beholdl'
    })
  })

  it('detects console fly', () => {
    expect(matchGameplayEvent('You feel lighter')).toEqual({
      type: 'CHEAT_ACTIVATED',
      cheat: 'fly'
    })
  })

  it('returns null for unrelated console lines', () => {
    expect(matchGameplayEvent('Picked up a shotgun.')).toBeNull()
    expect(matchGameplayEvent('Vid_Cardname: llvmpipe')).toBeNull()
    expect(matchGameplayEvent('')).toBeNull()
  })

  it('does not false-positive on a line merely mentioning a map number', () => {
    expect(matchGameplayEvent('Warping to MAP30 requested by console.')).toBeNull()
  })
})
