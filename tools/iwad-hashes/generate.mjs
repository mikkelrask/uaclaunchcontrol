#!/usr/bin/env node
/**
 * Generates src/shared/iwad-hashes.ts from doom_wad_hashes.csv.
 *
 * The CSV is the source of truth: one row per known revision of every WAD the
 * app recognises (name, release, version, filename, size, md5, sha1, crc32).
 * This script turns it into the MD5 -> identity lookup the app uses to name a
 * detected WAD file, and to reject PWAD add-ons that cannot be a base IWAD.
 *
 *   node tools/iwad-hashes/generate.mjs
 *
 * Row layout is anchored to the right (filename, filesize, md5, sha1, crc32 are
 * always the last five fields) because a few rows carry extra middle columns.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const CSV_PATH = path.join(HERE, 'doom_wad_hashes.csv')
const OUT_PATH = path.join(HERE, '..', '..', 'src', 'shared', 'iwad-hashes.ts')

/**
 * PWAD add-ons: they ship extra levels for a game the player must already own,
 * so they can never be used as the base IWAD of a launch.
 */
const isAddon = (fileName) => /^sigil/i.test(fileName) || fileName.toLowerCase() === 'nerve.wad'

/** Identity slug per CSV game name — selects the built-in icon (see DoomIcons.tsx). */
const GAME_SLUGS = {
  Doom: 'doom',
  'Ultimate Doom': 'doom',
  'Doom Pocket PC': 'doom',
  'Doom II': 'doom2',
  'Final Doom: TNT Evilution': 'tnt',
  'Final Doom: Plutonia': 'plutonia',
  Heretic: 'heretic',
  Hexen: 'hexen',
  'Hexen: Deathkings of the Dark Citadel': 'hexen-deathkings',
  'Chex Quest': 'chex',
  'Chex Quest 2': 'chex2',
  'Chex Quest 3': 'chex3',
  SIGIL: 'sigil',
  'SIGIL II': 'sigil2'
}

/**
 * Words that describe how a build was distributed rather than which revision it
 * is — a version label is only useful when it says something *other* than these.
 */
const NON_SPECIFIC = new Set([
  'original',
  'standalone',
  'unnumbered',
  'release',
  'rerelease',
  'vanilla rerelease',
  'classic complete',
  'retail',
  'registered',
  'shareware',
  'expansion',
  'fan release',
  'demo',
  'demo beta',
  'registered beta',
  'beta'
])

const RELEASE_ALIASES = { 'shareware beta (wide area beta)': 'shareware beta' }

/** `(label)` overrides for rows whose CSV columns don't summarise the revision. */
const LABEL_OVERRIDES = [
  // The KEX rerelease's Doom 1 IWAD: the CSV calls the build "Doom", the game
  // it adds is Legacy of Rust.
  { name: 'Doom', fileName: 'id1.wad', label: 'Legacy of Rust' },
  // Only one Pocket PC build exists, and the name already says which one.
  { name: 'Doom Pocket PC', fileName: 'doom.wad', label: '' },
  // No Rest for the Living is the episode every NERVE.WAD build ships.
  { name: 'Doom II', fileName: 'nerve.wad', label: 'No Rest for the Living' }
]

/**
 * Rows filed under a name that is too broad: the 1.9 Ultimate Doom build is
 * listed as plain "Doom", while its game and release columns both say
 * Ultimate Doom — and every other Ultimate Doom build is named as such.
 */
const NAME_OVERRIDES = [
  { name: 'Doom', release: 'Ultimate Doom', fileName: 'doom.wad', gameName: 'Ultimate Doom' }
]

function splitCsvLine(line) {
  const fields = []
  let value = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (quoted) {
      if (char === '"' && line[i + 1] === '"') {
        value += '"'
        i++
      } else if (char === '"') {
        quoted = false
      } else {
        value += char
      }
    } else if (char === '"') {
      quoted = true
    } else if (char === ',') {
      fields.push(value.trim())
      value = ''
    } else {
      value += char
    }
  }
  fields.push(value.trim())
  return fields
}

function parseRows(csv) {
  const lines = csv.replace(/\r\n/g, '\n').split('\n').filter((l) => l.trim() !== '')
  const header = splitCsvLine(lines[0])
  if (header[0] !== 'name' || !header.includes('md5')) {
    throw new Error(`Unexpected CSV header: ${lines[0]}`)
  }

  return lines.slice(1).map((line, index) => {
    const fields = splitCsvLine(line)
    // Right-anchored: filename, filesize, md5, sha1, crc32.
    const [fileName, size, md5] = fields.slice(-5)
    const leading = fields.slice(0, -5)
    let [, , release, version] = leading
    if (leading.length > 4) {
      // Rows with extra middle columns (the Plutonia ones) push release/version right.
      release = leading[leading.length - 2]
      version = leading[leading.length - 1]
    }

    const row = {
      line: index + 2,
      name: leading[0],
      release: RELEASE_ALIASES[release] ?? release ?? '',
      version: version ?? '',
      fileName,
      size: Number(size),
      md5
    }
    if (!row.name) throw new Error(`Row ${row.line}: missing name`)

    const renamed = NAME_OVERRIDES.find(
      (o) => o.name === row.name && o.release === row.release && o.fileName.toLowerCase() === fileName.toLowerCase()
    )
    if (renamed) row.name = renamed.gameName

    if (!/^[a-f0-9]{32}$/.test(md5)) throw new Error(`Row ${row.line}: bad md5 "${md5}"`)
    if (!/\.wad$/i.test(fileName)) throw new Error(`Row ${row.line}: bad filename "${fileName}"`)
    if (!GAME_SLUGS[row.name]) throw new Error(`Row ${row.line}: no slug for "${row.name}"`)

    const override = LABEL_OVERRIDES.find(
      (o) => o.name === row.name && o.fileName.toLowerCase() === fileName.toLowerCase()
    )
    row.label = override ? override.label : labelFor(row)
    row.addon = isAddon(fileName)
    row.slug = GAME_SLUGS[row.name]
    row.displayName = row.label ? `${row.name} (${row.label})` : row.name
    return row
  })
}

/** The most specific of version/release, so `Doom II (1.9)` beats `Doom II (registered)`. */
function labelFor(row) {
  const specific = (value) => value && !NON_SPECIFIC.has(value.toLowerCase())
  if (specific(row.version)) return row.version
  if (specific(row.release)) return row.release
  return row.version || row.release
}

/**
 * Builds of one game must stay tellable apart, so a label that repeats within a
 * game (say two "1.0"s) gets widened with its release. Widening can itself
 * collide with another build's label, so repeat until every game is unique.
 */
function disambiguate(rows) {
  const byName = new Map()
  for (const row of rows) {
    if (!byName.has(row.name)) byName.set(row.name, [])
    byName.get(row.name).push(row)
  }

  const apply = (row) => {
    row.displayName = row.label ? `${row.name} (${row.label})` : row.name
  }

  /**
   * The most informative label we can build from the release/version pair,
   * preferring one that leaves the game name itself out ("Compatible 1.0"
   * rather than "SIGIL Compatible 1.0" under "SIGIL").
   */
  const widenedLabel = (row) => {
    const nameTokens = new Set(row.name.toLowerCase().split(/\s+/))
    const dedupe = (skipNameTokens) => {
      const out = []
      const seen = new Set()
      for (const token of `${row.release} ${row.version}`.split(/\s+/)) {
        const key = token.toLowerCase()
        if (!key || seen.has(key) || (skipNameTokens && nameTokens.has(key))) continue
        seen.add(key)
        out.push(token)
      }
      return out.join(' ')
    }

    const preferred = dedupe(true)
    return preferred && preferred !== row.label ? preferred : dedupe(false) || row.label
  }

  for (const builds of byName.values()) {
    for (let pass = 0; pass < 5; pass++) {
      const counts = new Map()
      for (const row of builds) counts.set(row.label, (counts.get(row.label) ?? 0) + 1)
      const clashing = builds.filter((row) => counts.get(row.label) > 1)
      if (clashing.length === 0) break

      for (const row of clashing) {
        row.label = widenedLabel(row)
        apply(row)
      }
    }
    if (new Set(builds.map((r) => r.label)).size !== builds.length) {
      throw new Error(
        `Cannot tell these builds apart: ${builds.map((r) => `${r.displayName} (row ${r.line})`).join(', ')}`
      )
    }
  }
}

function assertUnique(rows, keys) {
  for (const key of keys) {
    const seen = new Map()
    for (const row of rows) {
      const previous = seen.get(row[key])
      if (previous) {
        throw new Error(`Duplicate ${key} "${row[key]}" (rows ${previous} and ${row.line})`)
      }
      seen.set(row[key], row.line)
    }
  }
}

/** Single-quoted TS string literal, matching the repo's formatting. */
const quote = (value) => `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`

// prettier: printWidth 100, singleQuote, no semicolons, no trailing commas —
// the generated file has to survive `npm run format` unchanged.
const PRINT_WIDTH = 100

function renderEntry(row) {
  const fields = [
    `name: ${quote(row.displayName)}`,
    `slug: ${quote(row.slug)}`,
    `fileName: ${quote(row.fileName)}`
  ]
  if (row.addon) fields.push('addon: true')

  const inline = `  ${quote(row.md5)}: { ${fields.join(', ')} },`
  if (inline.length <= PRINT_WIDTH) return inline

  const body = fields.map((field) => `    ${field}`).join(',\n')
  return `  ${quote(row.md5)}: {\n${body}\n  },`
}

function renderTable(rows) {
  const ordered = rows.filter((r) => !r.addon).concat(rows.filter((r) => r.addon))
  return ordered
    .map(renderEntry)
    .join('\n')
    .replace(/,$/, '')
}

function main() {
  const rows = parseRows(fs.readFileSync(CSV_PATH, 'utf8'))
  const iwads = rows.filter((r) => !r.addon)
  const addons = rows.filter((r) => r.addon)

  disambiguate(rows)
  assertUnique(rows, ['md5', 'displayName'])

  const output = `// GENERATED FILE — do not edit by hand.
// Source: tools/iwad-hashes/doom_wad_hashes.csv (${rows.length} revisions:
// ${iwads.length} IWADs, ${addons.length} PWAD add-ons).
// Regenerate with: npm run sync:iwad-hashes

/** One known WAD revision, identified by its file's MD5 sum. */
export interface IKnownWad {
  /** Display name of the build, e.g. \`Ultimate Doom (BFG)\`. */
  name: string
  /** Identity slug — selects the built-in icon in \`icons/DoomIcons.tsx\`. */
  slug: string
  /** The name this build ships under, used to pick between identical copies. */
  fileName: string
  /**
   * PWAD add-on content (SIGIL, No Rest for the Living, ...). It supplies extra
   * levels for a game the player must already own, so it can never be used as
   * the base WAD of a launch.
   */
  addon?: true
}

/** MD5 sum of the WAD file -> the revision it contains. */
export const KNOWN_WADS: Record<string, IKnownWad> = {
${renderTable(rows)}
}

const KNOWN_WAD_NAMES = new Set(Object.values(KNOWN_WADS).map((wad) => wad.name))

/** Identifies a WAD file by MD5 sum. Unknown content returns undefined. */
export function identifyWadByHash(md5: string): IKnownWad | undefined {
  return KNOWN_WADS[md5.toLowerCase()]
}

/**
 * True when \`name\` is a name this table produced, i.e. an auto-generated one
 * rather than something the user typed into Settings.
 */
export function isKnownWadName(name: string): boolean {
  return KNOWN_WAD_NAMES.has(name)
}
`

  fs.writeFileSync(OUT_PATH, output)
  console.log(`Wrote ${path.relative(process.cwd(), OUT_PATH)}: ${rows.length} revisions`)
  for (const row of iwads) console.log(`  ${row.md5}  ${row.displayName}`)
  for (const row of addons) console.log(`  ${row.md5}  ${row.displayName}  [add-on, skipped]`)
}

main()
