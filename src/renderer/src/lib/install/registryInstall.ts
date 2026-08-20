// Registry install handoff. The registry browse frontend is embedded in the
// app as an iframe; when the user clicks "Install Protocol" there, the
// frontend postMessages the protocol's export JSON to us:
//
//   { type: 'uac-install', protocolUrl: '<uac-modpack JSON string>' }
//
// We validate origin + payload, stash the parsed import for the install page
// (see pendingProtocolImport.ts), and navigate there — behaving exactly like
// dragging an exported protocol JSON onto the install page.
import { useEffect } from 'react'
import { REGISTRY_FRONTEND_URL } from '@shared/registry-config'
import { createLogger } from '@shared/logger'
import type { UacModpackImport } from './types'
import { setPendingProtocolImport } from './pendingProtocolImport'

const log = createLogger('registry-install')

const REGISTRY_ORIGIN = new URL(REGISTRY_FRONTEND_URL).origin

/**
 * Validate a raw postMessage payload and extract the protocol import.
 * Returns null for anything that isn't a well-formed uac-install message.
 */
export function parseInstallMessage(data: unknown): UacModpackImport | null {
  if (typeof data !== 'object' || data === null) return null
  const msg = data as Record<string, unknown>
  if (msg.type !== 'uac-install') return null
  const json = msg.protocolUrl
  if (typeof json !== 'string' || json.trim().length === 0) return null
  try {
    const parsed: UacModpackImport = JSON.parse(json)
    if (parsed?.format !== 'uac-modpack' || typeof parsed?.game !== 'object') return null
    return parsed
  } catch {
    return null
  }
}

/**
 * Listen for uac-install messages from the embedded registry iframe and
 * route them to the install page. `onInstall` is called (e.g. navigate to
 * /install) once a valid import has been stashed.
 */
export function useRegistryInstallHandoff(onInstall: () => void): void {
  useEffect(() => {
    const onMessage = (event: MessageEvent): void => {
      if (event.origin !== REGISTRY_ORIGIN) return
      const parsed = parseInstallMessage(event.data)
      if (!parsed) return
      log.debug('Received uac-install from registry:', parsed.game?.title)
      setPendingProtocolImport(parsed)
      onInstall()
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [onInstall])
}
