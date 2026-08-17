// Storage barrel — re-exports everything for backward compatibility.

// Path constants
export { MODS_DIR, IMAGES_DIR, CFGS_DIR, LOGS_DIR, logFilePathFor } from './paths'

// Image downscaling (screenshots stay export-safe)
export { resizeImageIfNeeded, MAX_LONGEST_EDGE, MAX_SAFE_BYTES } from './image-resize'

// Core init + settings
export {
  getIsFirstRun,
  dismissFirstRun,
  reenableFirstRun,
  initStorage,
  getSettings,
  saveSettings,
  resolvePath,
  stripMd5Suffix,
  countMd5Suffixes,
  wadNamePriority,
  computeFileHash,
  computeFileHashOrThrow
} from './core'

// Doom Versions
export {
  getDoomVersions,
  stopWadWatcher,
  startWadWatcher,
  syncDoomVersions,
  getDoomVersionBySlug,
  saveDoomVersions
} from './doom-versions'

// Mod File Catalog
export {
  getModFileCatalog,
  addModFileToCatalog,
  updateModFileInCatalog,
  deleteModFileFromCatalog,
  moveFile,
  moveToModFolder,
  importWadFile,
  copyImageToImages,
  downloadImage,
  readScreenshotAsBase64,
  writeScreenshotFromBase64,
  createBlankProtocolConfig,
  copyConfigForProtocol,
  readConfigFileContent,
  writeConfigFileContent
} from './mod-catalog'

// Protocols
export {
  saveProtocol,
  getProtocols,
  getProtocol,
  getDoomVersion,
  updateDoomVersion,
  addPlaytime,
  deleteProtocol
} from './protocols'

// Archive I/O
export { unzipAndScan, unrarAndScan, importUnzippedFiles } from './archive-io'
export type { IUnzipScanResult, IZipImportFile } from './archive-io'
