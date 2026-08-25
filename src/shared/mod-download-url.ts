/**
 * URL predicates shared by the main process (window-open routing: in-app
 * download vs external browser) and the renderer (icon choice for mod-file
 * links). GitHub release-asset and ModDB start-page links are downloaded
 * inside the app; everything else opens in the browser.
 */

const GITHUB_RELEASE_RE = /^\/[^/]+\/[^/]+\/releases\/download\//
const MODDB_START_RE = /^\/(?:downloads|addons)\/start\//

/** GitHub release-asset URLs: github.com/<owner>/<repo>/releases/download/<tag>/<asset> */
export function isGithubReleaseAsset(url: URL): boolean {
  const host = url.hostname.toLowerCase()
  return (
    (host === 'github.com' || host === 'www.github.com') && GITHUB_RELEASE_RE.test(url.pathname)
  )
}

/** ModDB download start pages: moddb.com/downloads/start/<id> and addons/start/<id> */
export function isModdbStartPage(url: URL): boolean {
  const host = url.hostname.toLowerCase()
  return (host === 'moddb.com' || host === 'www.moddb.com') && MODDB_START_RE.test(url.pathname)
}

/** True when clicking this URL downloads inside the app instead of opening the browser. */
export function isInAppDownloadUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl)
    return isGithubReleaseAsset(url) || isModdbStartPage(url)
  } catch {
    return false // malformed URL — treated as a plain browser link
  }
}
