import path from 'path'
import os from 'os'

// Define storage paths (Aligned with local-structure.txt)
export const CONFIG_DIR = path.join(os.homedir(), '.config', 'uac')
export const DATA_DIR = path.join(CONFIG_DIR, 'data') // For extra data
export const MODS_DIR = path.join(CONFIG_DIR, 'mods') // For mod {id}.json files
export const SETTINGS_FILE = path.join(CONFIG_DIR, 'settings.json') // Directly in CONFIG_DIR per local-structure.txt
export const DOOM_VERSIONS_FILE = path.join(CONFIG_DIR, 'doomVersions.json') // Directly in CONFIG_DIR per local-structure.txt
export const MOD_FILE_CATALOG = path.join(CONFIG_DIR, 'modFileCatalogue.json')
export const IMAGES_DIR = path.join(CONFIG_DIR, 'data/images')
export const CFGS_DIR = path.join(CONFIG_DIR, 'data', 'cfgs')
export const LOGS_DIR = path.join(CONFIG_DIR, 'logs')
export const FIRST_RUN_SENTINEL = path.join(CONFIG_DIR, '.first-run-complete')

/** Path to the console log file for a protocol's most recent launch — overwritten each launch. */
export function logFilePathFor(protocolId: string): string {
  return path.join(LOGS_DIR, `${protocolId}.log`)
}
