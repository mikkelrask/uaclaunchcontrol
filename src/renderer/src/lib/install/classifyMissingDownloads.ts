/**
 * Classification of missing mod files after a protocol import, so the app
 * can offer to auto-download the ones it can fetch itself (GitHub release
 * assets, ModDB start pages) and leave only the rest to the browser.
 *
 * Both in-app downloads and external-browser opens are triggered the same
 * way from the renderer — `window.open(url)` — because the main process's
 * setWindowOpenHandler routes every popup by URL: in-app-downloadable links
 * go to startModDownload(), everything else to shell.openExternal(), and
 * the window itself is always denied. See src/main/index.ts and
 * @shared/mod-download-url.
 */

import { isInAppDownloadUrl } from '@shared/mod-download-url'

export interface MissingFile {
  filePath?: string | null
  url?: string | null
}

export interface MissingDownloadClassification {
  /** Missing files whose url the app can download itself */
  inApp: MissingFile[]
  /** Missing files that can only be fetched in an external browser */
  browserOnly: MissingFile[]
}

/** Split missing files (no local path) that carry a url into in-app vs browser-only. */
export function classifyMissingDownloads(
  files: ReadonlyArray<MissingFile>
): MissingDownloadClassification {
  const inApp: MissingFile[] = []
  const browserOnly: MissingFile[] = []
  for (const file of files) {
    if (file.filePath || !file.url) continue
    ;(isInAppDownloadUrl(file.url) ? inApp : browserOnly).push(file)
  }
  return { inApp, browserOnly }
}

/**
 * Fire-and-forget URL opens routed by the main process's window-open
 * handler (in-app download vs external browser). Always denies the actual
 * window, so this never surfaces a popup. A modpack that unpacks into
 * several files can list the same download link multiple times — one
 * download covers them all, so each unique URL is opened at most once.
 */
export function openDownloadLinks(urls: string[]): void {
  for (const url of new Set(urls)) {
    window.open(url, '_blank', 'noopener')
  }
}
