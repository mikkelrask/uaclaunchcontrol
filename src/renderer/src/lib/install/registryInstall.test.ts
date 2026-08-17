import { describe, it, expect, beforeEach } from 'vitest'
import { parseInstallMessage } from './registryInstall'
import { setPendingProtocolImport, consumePendingProtocolImport } from './pendingProtocolImport'
import type { UacModpackImport } from './types'

const VALID_IMPORT: UacModpackImport = {
  format: 'uac-modpack',
  version: '1.1',
  game: {
    title: 'Diamond Dragon - Neon Overdrive',
    description: 'A catgirl',
    doomVersionSlug: 'doom2',
    sourcePort: 'gzdoom',
    screenshotPath: 'https://i.imgur.com/Vx0xH6W.png'
  },
  files: [{ name: 'Neon Overdrive', hashValue: 'e26fb963a3debb98aa5c9f077d4c8b1a' }]
}

describe('parseInstallMessage', () => {
  it('parses a well-formed uac-install message', () => {
    const result = parseInstallMessage({
      type: 'uac-install',
      protocolUrl: JSON.stringify(VALID_IMPORT)
    })
    expect(result?.game.title).toBe('Diamond Dragon - Neon Overdrive')
    expect(result?.files).toHaveLength(1)
  })

  it('returns null for non-object payloads', () => {
    expect(parseInstallMessage(null)).toBeNull()
    expect(parseInstallMessage('nope')).toBeNull()
    expect(parseInstallMessage(undefined)).toBeNull()
  })

  it('returns null for messages of other types', () => {
    expect(parseInstallMessage({ type: 'uac-something-else', protocolUrl: '{}' })).toBeNull()
  })

  it('returns null when protocolUrl is missing or not a string', () => {
    expect(parseInstallMessage({ type: 'uac-install' })).toBeNull()
    expect(parseInstallMessage({ type: 'uac-install', protocolUrl: 42 })).toBeNull()
  })

  it('returns null for malformed JSON', () => {
    expect(parseInstallMessage({ type: 'uac-install', protocolUrl: '{not json' })).toBeNull()
  })

  it('returns null for JSON that is not a uac-modpack export', () => {
    expect(
      parseInstallMessage({ type: 'uac-install', protocolUrl: JSON.stringify({ foo: 1 }) })
    ).toBeNull()
    expect(
      parseInstallMessage({
        type: 'uac-install',
        protocolUrl: JSON.stringify({ format: 'other-format', game: {} })
      })
    ).toBeNull()
  })
})

describe('pendingProtocolImport', () => {
  beforeEach(() => {
    setPendingProtocolImport(null)
  })

  it('consume returns the stashed import and clears it', () => {
    setPendingProtocolImport(VALID_IMPORT)
    expect(consumePendingProtocolImport()).toBe(VALID_IMPORT)
    expect(consumePendingProtocolImport()).toBeNull()
  })

  it('returns null when nothing is stashed', () => {
    expect(consumePendingProtocolImport()).toBeNull()
  })
})
