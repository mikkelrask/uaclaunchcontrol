/**
 * First-run guided tour — step definitions.
 *
 * Each step describes an element to highlight on screen and the tooltip
 * content to show. Steps can navigate across routes and open dialogs.
 */

import { api } from '@/api'

export type StepPlacement = 'bottom' | 'top' | 'left' | 'right'

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

/**
 * All tour steps in order.
 */
export const TOUR_STEPS: TourStepDef[] = [
  // ─── Step 0: Welcome ──────────────────────────────────────────────
  {
    id: 0,
    target: null,
    title: 'Welcome, Marine',
    description: `
      <p class="mb-2">
        <strong>UAC Launch Control</strong> is your command centre for
        managing Doom-engine games and mods.
      </p>
      <p>
        This quick tour will walk you through:
      </p>
      <ul class="list-disc list-inside text-sm space-y-1 mt-2">
        <li>Verifying your path settings</li>
        <li>Adding a source port (GZDoom / UZDoom / Zandronum)</li>
        <li>Installing a mod file into your catalogue</li>
        <li>Creating your first launch protocol</li>
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
        the <strong>Paths</strong> tab to verify your directories.
      </p>
      <p class="text-sm text-app-secondary">
        Make sure <em>Mods Directory</em>, <em>WAD Files Directory</em>,
        and <em>Screenshots Path</em> point to valid locations.
      </p>
    `,
    placement: 'bottom',
    hint: 'Open Settings and check your paths',
    doneLabel: 'Path settings verified ✓',
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
        Open Settings → <strong>Source Ports</strong> tab, click
        <em>"Add Port"</em>, browse to your GZDoom, UZDoom, or
        Zandronum executable, and hit the <strong>Save</strong> button
        on that form.
      </p>
      <p class="mt-2 text-yellow-400/80 text-xs">
        ⚠ Remember to also click the main <strong>Apply</strong> button
        at the bottom of the settings window to persist your changes.
      </p>
    `,
    placement: 'bottom',
    hint: 'Add at least one source port in Settings, then Apply',
    doneLabel: 'Source port detected ✓',
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
    target: '[data-tour="install-tab"]',
    title: 'Step 3: Add a Mod File',
    description: `
      <p class="mb-2">
        Click the <strong>INSTALL</strong> tab, then switch to the
        <strong>Mod Files</strong> tab.
      </p>
      <p>
        From there you can drag &amp; drop a mod file onto the import
        zone or paste a modpack JSON. The file will be added to your
        catalogue and is then available for any protocol.
      </p>
    `,
    placement: 'bottom',
    hint: 'Add a mod file to your catalogue',
    doneLabel: 'Mod file catalogued ✓',
    isComplete: async (): Promise<boolean> => {
      try {
        const files = await api.getAvailableModFiles()
        return files.length > 0
      } catch {
        return false
      }
    }
  },

  // ─── Step 4: Create a Protocol ────────────────────────────────────
  {
    id: 4,
    target: '[data-tour="install-tab"]',
    title: 'Step 4: Create a Launch Protocol',
    description: `
      <p class="mb-2">
        A <strong>protocol</strong> is a named game configuration — it
        ties together a base game (IWAD), a source port, and your chosen
        mod files.
      </p>
      <p>
        On the INSTALL page, switch to the <strong>Configuration</strong>
        tab, fill in a title, pick your IWAD and source port, select mod
        files, and hit <em>Save</em>.
      </p>
    `,
    placement: 'bottom',
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
    target: '[data-tour="launch-button"]',
    title: 'Step 5: Launch Your Game!',
    description: `
      <p class="mb-2">
        You're all set! Head back to the <strong>LAUNCH</strong> page,
        find your new protocol, and click the play button.
      </p>
      <p class="text-accent-highlight font-bold text-lg text-center mt-4">
        Rip and tear!
      </p>
    `,
    placement: 'top'
  }
]
