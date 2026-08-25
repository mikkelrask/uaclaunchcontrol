/**
 * Query-cache contracts for renderer API mutations.
 *
 * The app's QueryClient is configured with `staleTime: Infinity` and
 * `refetchOnWindowFocus: false` — cached query data is IMMUTABLE until
 * something explicitly invalidates it, refetches it, or overwrites it via
 * `setQueryData`. A server mutation that writes state but never touches the
 * cache therefore shows stale UI until an app restart (the "state doesn't
 * update" bug class).
 *
 * THIS FILE IS THE SINGLE SOURCE OF TRUTH for that coupling. Every
 * state-changing method on `api` (detected automatically by
 * `queryCacheContract.test.ts` from its non-GET fetch calls) MUST be listed
 * in exactly one of:
 *
 *   - `QUERY_CACHE_CONTRACTS` — query keys that MUST be refreshed
 *     (invalidated / setQueryData'd / refetched) in every file that calls
 *     the mutation.
 *   - `NO_CACHE_CONTRACT` — mutations that intentionally leave the query
 *     cache untouched, with a written justification.
 *
 * When you add a new api mutation:
 *   1. If it changes server state that any query feeds from → add it to
 *      `QUERY_CACHE_CONTRACTS` and make sure every call site refreshes the
 *      listed keys (the test will enforce this).
 *   2. If it genuinely doesn't affect any cached query (pure file write,
 *      external call, local-only flag) → add it to `NO_CACHE_CONTRACT`
 *      with a reason. No exception: an unclassified mutation FAILS the
 *      test.
 *
 * Call sites that legitimately delegate cache refresh to another module
 * (e.g. a modal whose parent invalidates on completion) go in
 * `CALL_SITE_EXCEPTIONS` with a reason — prefer a real refresh over an
 * exception.
 */

/** Mutation → query keys its call sites MUST refresh. */
export const QUERY_CACHE_CONTRACTS: Record<string, string[]> = {
  // Settings / source ports
  updateSettings: ['/api/settings'],
  updateDoomVersions: ['/api/versions'],
  updateDoomVersion: ['/api/versions'],
  deleteDoomVersion: ['/api/versions'],

  // Player data / achievements
  updatePlayerData: ['/api/player-data', '/api/settings'],
  updatePlayerStats: ['/api/player-data', '/api/settings'],
  unlockAchievement: ['/api/player-data', '/api/settings'],

  // Protocols
  createProtocol: ['/api/protocols'],
  updateProtocol: ['/api/protocols'],
  deleteProtocol: ['/api/protocols'],
  launchProtocol: ['/api/protocols'],
  addPlaytime: ['/api/protocols', '/api/player-data'],

  // Mod file catalog
  addToCatalog: ['/api/mod-files/catalog'],
  updateInCatalog: ['/api/mod-files/catalog'],
  deleteFromCatalog: ['/api/mod-files/catalog'],

  // WADs / versions
  importWadFile: ['/api/versions'],
  importIdgamesSingleFile: ['/api/mod-files/catalog'],
  downloadFreedoom: ['/api/versions']
}

/** Mutations with no query-cache impact, each with a justification. */
export const NO_CACHE_CONTRACT: Record<string, string> = {
  dismissFirstRun:
    'first-run flag is read ad-hoc via getFirstRun() (never a cached query); wizard local state only',
  reenableFirstRun:
    'same as dismissFirstRun — flag read ad-hoc, no cached query',
  downloadPortRelease:
    'port lands in caller local settings state (onPortDownloaded); persisted + invalidated by the Settings dialog save / onboarding flush',
  downloadIdgamesFile:
    'downloads to a temp dir; the catalog is only touched by the subsequent importIdgamesSingleFile (which has a contract)',
  importScreenshot:
    'writes a screenshot file during modpack import; protocol data is refreshed by the create/import flow',
  uploadScreenshot:
    'writes a file; consumed as form state, no cached query depends on it',
  downloadImage:
    'writes a file; consumed as form state (protocol screenshotPath)',
  uploadConfigFile:
    'writes a config file; the catalog entry referencing it is saved via addToCatalog/updateInCatalog (contracted)',
  createBlankConfig:
    'writes a config file; result returned to caller and stored on the protocol at create time',
  copyConfigForProtocol:
    'writes a config file; result returned to caller and stored on the protocol at create time',
  writeConfigContent:
    'writes a config file during modpack import; protocol data refreshed by the create/import flow',
  moveFile:
    'moves an icon file; the versions entry referencing it is persisted by the dialog save (updateDoomVersions, contracted)',
  moveToModFolder:
    'moves a file into the mods dir; the catalog entry is created by the caller via addToCatalog (contracted)',
  unzipImport:
    'extracts files into the mods dir; catalog entries are created by the caller via addToCatalog (contracted)',
  unzipScan: 'read-only scan of an archive; no persistent state',
  unrarScan: 'read-only scan of an archive; no persistent state',
  computeHash: 'pure computation; no persistent state',
  testLaunch: 'server-side dry-run launch; no persistent state',
  submitToPending:
    'submits to the external registry, deliberately silent; no local cached query'
}

/**
 * Files that call a contracted mutation but delegate the cache refresh to
 * another module. Keyed by basename → mutation → justification. Prefer a
 * real refresh at the call site over an exception.
 */
export const CALL_SITE_EXCEPTIONS: Record<string, Record<string, string>> = {
  'ZipImportModal.tsx': {
    addToCatalog:
      'refresh delegated to onImportComplete — every caller invalidates the catalog (CatalogManager via useFileImport, ModDownloadManager, GamesPage)'
  }
}
