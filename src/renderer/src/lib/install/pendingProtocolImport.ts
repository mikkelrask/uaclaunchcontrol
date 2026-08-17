// Handoff between the registry page (which receives a protocol via
// postMessage) and the install page (which owns the form). The install page
// fully unmounts on navigation, so the import must survive the route change:
// the registry listener stashes the parsed import here, then navigates;
// InstallPage consumes it on mount and applies it exactly like a JSON drop.
import type { UacModpackImport } from './types'

let pending: UacModpackImport | null = null

export function setPendingProtocolImport(data: UacModpackImport | null): void {
  pending = data
}

/** Returns the stashed import and clears it — safe to call repeatedly. */
export function consumePendingProtocolImport(): UacModpackImport | null {
  const data = pending
  pending = null
  return data
}
