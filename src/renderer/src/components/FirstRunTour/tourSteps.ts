/**
 * First-run guided tour — step definitions.
 *
 * Each step describes an element to highlight on screen and the tooltip
 * content to show. Steps can navigate across routes and open dialogs.
 */

import { api } from '@/api'
import { navigate } from 'wouter/use-hash-location'

export type StepPlacement =
  | 'bottom'
  | 'top'
  | 'left'
  | 'right'
  | 'top-right'
  | 'left-top'
  | 'bottom-right'

export interface TourStepDef {
  /** Index within the overall flow. */
  id: number
  /** CSS selector for the element to highlight, or null for full‑screen steps. */
  target: string | null
  /** Short heading shown in the tooltip card. */
  title: string
  /** Body content — can contain HTML (<strong>, <Link>, etc.). */
  description: string
  /** Where the tooltip card appears relative to the target. */
  placement: StepPlacement
  /**
   * Called *before* the step is shown.
   * Use for side‑effects like navigating to a route or opening a dialog.
   * Return a promise if the effect is async.
   */
  beforeEnter?: () => void | Promise<void>
  /**
   * Called *before* moving to the next / previous step.
   * Use for cleanup (closing dialogs that were opened in beforeEnter).
   */
  beforeExit?: () => void | Promise<void>
  /**
   * Optional validation function. Called periodically while the step is visible.
   * Return true when the user has completed the required action.
   * When true, the Next button animates with a glow and an optional
   * auto‑advance timer fires.
   */
  isComplete?: () => boolean | Promise<boolean>
  /**
   * Short label shown under the step title when the action is not yet complete.
   * E.g. "Add a source port first".
   */
  hint?: string
  /**
   * Short confirmation shown under the step title when the action IS complete.
   * E.g. "Source port added ✓".
   */
  doneLabel?: string
}

/**
 * Poll a completion function at a given interval.
 * Returns an unsubscribe function.
 */
export function pollComplete(
  fn: () => boolean | Promise<boolean>,
  onComplete: () => void,
  interval = 1500
): () => void {
  let active = true
  let timer: ReturnType<typeof setTimeout> | null = null

  const check = async (): Promise<void> => {
    if (!active) return
    try {
      const done = await fn()
      if (done && active) {
        onComplete()
        return // stop polling
      }
    } catch {
      // ignore polling errors
    }
    if (active) {
      timer = setTimeout(check, interval)
    }
  }

  check()
  return () => {
    active = false
    if (timer) clearTimeout(timer)
  }
}

function navigateTour(path: string, tab?: string): void {
  navigate(path)

  if (tab) {
    window.dispatchEvent(new CustomEvent('uac:switch-tab'))
  }
}

/**
 * All tour steps in order.
 */
export const TOUR_STEPS: TourStepDef[] = [
  // ─── Step 0: Welcome ──────────────────────────────────────────────
  {
    id: 0,
    target: null,
    title: 'Welcome, cadet',
    description: `
      <p class="mb-2">
        <strong>UAC Launch Control</strong> is your new home. Your command centre for
        managing and launching mission protocols.
      </p>
      <p>
        Your training will be brief, but will cover:
      </p>
      <ul class="list-disc list-inside text-sm space-y-1 mt-2">
        <li>Verifying your path settings</li>
        <li>Adding source port(s) (GZDoom / UZDoom / Zandronum)</li>
        <li>Adding a mod file into your catalogue</li>
        <li>Creating and launching your first protocol</li>
      </ul>
    `,
    placement: 'bottom'
  },

  // ─── Step 1: Settings → Paths ─────────────────────────────────────
  {
    id: 1,
    target: '[data-tour="settings-button"]',
    title: 'Step 1: Configure Paths',
    description: `
      <p class="mb-2">
        Click the <strong>gear icon</strong> to open Settings, then go to
        the <strong>Paths</strong> tab, and verify or change directory paths to your system.
      </p>
      <p class="text-sm text-app-secondary">
        Make sure especially <em>WAD Files Directory</em> refers to where you keep your wad-files.
      </p>
    `,
    placement: 'bottom',
    hint: 'Open Settings and check your paths',
    doneLabel: 'Default paths are set ✓',
    isComplete: async (): Promise<boolean> => {
      try {
        const s = await api.getSettings()
        return !!(s.modsDirectory && s.wadFilesDirectory && s.screenshotsPath)
      } catch {
        return false
      }
    }
  },

  // ─── Step 2: Source Ports ─────────────────────────────────────────
  {
    id: 2,
    target: '[data-tour="settings-button"]',
    title: 'Step 2: Add a Source Port',
    description: `
      <p class="mb-2">
        While still in the <strong>Path</strong> tab of Settings, click<br />
        <em>"+ Add Port"</em>, and navigate to your GZDoom, UZDoom, or
        Zandronum executable, and hit the <strong>Save</strong> button
        on that form after filling out the information.
      </p>
      <p class="mb-2">
        If you have multiple source ports installed, repeat the process for the ones you want to add.
      </p>
      <p class="mt-2 text-yellow-400/80 text-xs">
        ⚠ Click the main <strong>Apply</strong> button
        at the bottom of the settings window to persist your changes.
      </p>
    `,
    placement: 'bottom',
    hint: 'Add at least one source port in Settings, then Apply',
    doneLabel: 'At least one source port has been added ✓',
    isComplete: async (): Promise<boolean> => {
      try {
        const s = await api.getSettings()
        return s.sourcePorts.length > 0
      } catch {
        return false
      }
    }
  },

  // ─── Step 3: Add a Mod File ───────────────────────────────────────
  {
    id: 3,
    target: '[data-tour="mod-files-panel"]',
    title: 'Step 3: Add a Mod File',
    description: `
      <p class="mb-2">
        The tour has taken you to INSTALL → <strong>Mod Files</strong>.
      </p>
      <p class="mb-2">
        You can always get back here by hitting the <code>m</code> key on your keyboard.
      </p>
      <p>
        Drag &amp; drop any mod file onto the drop
        zone or click it to open a file picker. After filling out the information the file will be added to your
        catalogue and is then available for any protocol.
      </p>
    `,
    placement: 'right',
    beforeEnter: () => navigateTour('/install?tab=files', 'files'),
    hint: 'Add a mod file to your catalogue',
    doneLabel: 'Mod file catalogued ✓',
    isComplete: async (): Promise<boolean> => {
      try {
        const files = await api.getModFileCatalog()
        return files.length > 0
      } catch {
        return false
      }
    }
  },

  // ─── Step 4: Create a Protocol ────────────────────────────────────
  {
    id: 4,
    target: '[data-tour="protocol-form"]',
    title: 'Step 4: Create a Launch Protocol',
    description: `
      <p class="mb-2">
        A <strong>protocol</strong> is a named game configuration — it
        ties together a base game (IWAD), a source port, and your chosen
        mod files.
      </p>
      <p class="mb-2">
        The tour has taken you back to INSTALL → <strong>Configuration</strong>. Hit <code>i</code> any time to get back here.
      </p>
      <p>
        Fill in at least a <strong>title</strong>, select a <strong>base wad</strong> and optionally add <strong>mod files</strong>,
        before clicking the <strong>Create Protocol</strong> button at the bottom.
      </p>
    `,
    placement: 'bottom-right',
    beforeEnter: () => navigateTour('/install?tab=install', 'install'),
    hint: 'Create a protocol on the Configuration tab',
    doneLabel: 'Protocol created ✓',
    isComplete: async (): Promise<boolean> => {
      try {
        const res = await fetch('http://localhost:7666/api/protocols')
        if (!res.ok) return false
        const protocols = await res.json()
        return Array.isArray(protocols) && protocols.length > 0
      } catch {
        return false
      }
    }
  },

  // ─── Step 5: Launch ───────────────────────────────────────────────
  {
    id: 5,
    target: '[data-tour="launch-card"]',
    title: 'Step 5: Rip & Tear!',
    description: `
      <p class="mb-2">
        You're all set!
      </p>
      <p class="mb-2">
        Hover the newly created <strong>Protocol</strong> and give that <strong>Launch</strong> button a click to start killing demons.
      </p>
      <p>
        For more detailed help, see the documentation on <a href="https://www.uac-soft.online" class="underline">uac-soft.online</a>.
      </p>
    `,
    placement: 'right',
    beforeEnter: () => navigateTour('/')
  }
]
