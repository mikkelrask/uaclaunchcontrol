import path from 'path'
import type { IDoomVersion } from '@shared/schema'
import { identifyWadByHash, isKnownWadName } from '@shared/iwad-hashes'
import {
  DEFAULT_DOOM_VERSIONS,
  generateStableId,
  wadNamePriority
} from './core'
import { stripMd5Suffix } from '@shared/wad-names'

/** How a `.wad` file in the WAD directory should appear as a launch entry. */
export interface IWadIdentity {
  /**
   * False for PWAD add-ons (SIGIL, No Rest for the Living, ...): they supply
   * extra levels for a game the player must already own, so they can never be
   * the base WAD of a launch.
   */
  usable: boolean
  /** Entry id — stable across syncs, so protocols keep pointing at the same WAD. */
  id: string
  /** Display name of the build, e.g. `Ultimate Doom (BFG)`. */
  name: string
  /** Identity slug — also selects the built-in icon (see `icons/DoomIcons.tsx`). */
  slug: string
  /** The name this build ships under; picks the representative of identical copies. */
  fileName: string
  /** Icon set by the seeded defaults; '' when the slug alone picks the icon. */
  icon: string
}

/**
 * Identifies a WAD file by MD5 sum, so a file is named for what it contains
 * rather than for what it happens to be called — the same file is `doomu.wad`,
 * `DOOM.WAD` and `DOOM_1.9.wad` to different users.
 *
 * Falls back to the filename for content the table doesn't know: the seeded
 * defaults (FreeDoom, whose builds are not hash-listed) and, failing that, the
 * filename itself.
 */
export function resolveWadIdentity(fileName: string, md5: string): IWadIdentity {
  const known = md5 ? identifyWadByHash(md5) : undefined
  if (known) {
    // Same name, same id — a re-detected WAD keeps its entry (and any protocol
    // pointing at it) even when the file is renamed.
    const id = `wad-${known.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')}`
    return { usable: !known.addon, id, name: known.name, slug: known.slug, fileName: known.fileName, icon: '' }
  }

  const seeded = findSeededDefault(fileName)
  if (seeded) {
    return {
      usable: true,
      id: seeded.id,
      name: seeded.name,
      slug: seeded.slug,
      fileName: path.basename(seeded.defaultIwad),
      icon: seeded.icon
    }
  }

  const baseName = fileName.replace(/\.wad$/i, '')
  const id = generateStableId(baseName)
  return {
    usable: true,
    id,
    name: stripMd5Suffix(baseName),
    slug: id,
    fileName,
    icon: ''
  }
}

/**
 * True when a version's name was generated rather than typed by the user into
 * Settings — only those may be replaced when a WAD is identified. Anything
 * else is a deliberate rename and is left alone.
 */
export function isGeneratedVersionName(name: string, fileName: string): boolean {
  if (!name) return true
  if (isKnownWadName(name)) return true
  if (name === stripMd5Suffix(fileName.replace(/\.wad$/i, ''))) return true
  return findSeededDefault(fileName)?.name === name
}

/**
 * Which of two copies of the same content should represent it: the copy named
 * the way the table names it (a file at `DOOM.WAD` over `DOOM_1.9.WAD`), or the
 * cleanest name when neither is - one an installer added an md5 to, say.
 */
export function isBetterRepresentative(
  candidate: string,
  current: string,
  canonical: string
): boolean {
  if (candidate.toLowerCase() === canonical.toLowerCase()) return true
  if (current.toLowerCase() === canonical.toLowerCase()) return false
  return wadNamePriority(candidate) < wadNamePriority(current)
}

/** The seeded default that expects this WAD filename, if any. */
function findSeededDefault(fileName: string): IDoomVersion | undefined {
  const wanted = fileName.toLowerCase()
  return DEFAULT_DOOM_VERSIONS.find(
    (def) => path.basename(def.defaultIwad).toLowerCase() === wanted
  )
}
