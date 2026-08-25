#!/usr/bin/env node
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/**
 * Keeps ALL project documentation honest before a release.
 *
 * Three layers:
 *   1. Agent-facing — AGENTS.md (test/lint stats, via sync-agents.mjs)
 *   2. Repo-facing  — README.md hero screenshot bumped to the newest IMG/*.png
 *   3. User-facing  — website (uac-landingpage):
 *        a. GENERATED sections (settings defaults, keyboard shortcuts) are
 *           rewritten from the app source between BEGIN/END markers.
 *        b. DRIFT REPORT for prose that only a human/agent can fix — settings
 *           keys the docs don't mention, shortcuts missing from the doc table,
 *           stale version strings, known-removed features.
 *
 * Usage:  node scripts/sync-docs.mjs
 *         (also run automatically by scripts/bump-version.mjs before a release)
 */
import { execFileSync } from 'child_process'
import fs from 'fs'
import path from 'path'

const ROOT = process.cwd()
const SITE = path.resolve(ROOT, '../uac-landingpage')

// ---- 1. AGENTS.md -----------------------------------------------------------
console.log('📋 Syncing AGENTS.md stats...')
execFileSync('node', ['scripts/sync-agents.mjs'], { stdio: 'inherit' })

// ---- helpers ----------------------------------------------------------------
const read = (p) => fs.readFileSync(p, 'utf-8')
const write = (p, c) => fs.writeFileSync(p, c)

// ---- 2. README.md hero screenshot -------------------------------------------
const README = 'README.md'
const IMG_DIR = 'IMG'

const shots = fs.existsSync(IMG_DIR)
  ? fs
      .readdirSync(IMG_DIR)
      .filter((f) => /^\d+\.\d+\.\d+\.png$/.test(f))
      .sort((a, b) => {
        const pa = a.split('.').map(Number)
        const pb = b.split('.').map(Number)
        return pa[0] - pb[0] || pa[1] - pb[1] || pa[2] - pb[2]
      })
  : []

const newest = shots[shots.length - 1]
if (newest) {
  const readme = read(README)
  const re = /IMG\/\d+\.\d+\.\d+\.png/g
  if (!re.test(readme)) {
    console.warn(`⚠️ No "IMG/x.y.z.png" reference found in ${README} — hero not touched`)
  } else {
    const updated = readme.replace(re, `IMG/${newest}`)
    if (updated !== readme) {
      write(README, updated)
      console.log(`✅ README hero screenshot → IMG/${newest}`)
    } else {
      console.log(`✅ README hero screenshot already current (IMG/${newest})`)
    }
  }
} else {
  console.warn(`⚠️ No "N.N.N.png" screenshots in ${IMG_DIR}/ — README hero not touched`)
}

// ---- 3. Website docs ----------------------------------------------------------
// The website docs are hand-written prose; sync-docs does NOT write them.
// It checks for drift: stale version references, removed-feature mentions,
// and nav entries that don't match doc files (or vice versa). The
// settings/shortcuts generated sections were removed; if they ever come
// back, delete them again. The prose itself is a human (or agent) job.
if (!fs.existsSync(SITE)) {
  console.warn(`⚠️ ${SITE} not found — website docs sync skipped`)
  process.exit(0)
}

const version = JSON.parse(read('package.json')).version
const drift = []
const report = (sev, msg) => {
  drift.push({ sev, msg })
  console.log(`${sev === 'ERROR' ? '❌' : '⚠️'} ${msg}`)
}

// ---- 3c. Drift report: version strings & removed features across docs ----------
const docsDir = path.join(SITE, 'src/content/docs')
const appVersionRe = /\b0\.\d+\.\d+\b/g
const REMOVED_TERMS = ['BFG Edition', 'bfg edition']

function walk(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]))
}

for (const f of walk(docsDir)) {
  if (!/\.(md|mdx)$/.test(f)) continue
  const src = read(f)
  const rel = path.relative(SITE, f)
  for (const term of REMOVED_TERMS) {
    if (src.toLowerCase().includes(term.toLowerCase())) {
      report('WARN', `${rel} mentions removed feature "${term}"`)
    }
  }
  const versionHits = [...src.matchAll(appVersionRe)].map((x) => x[0])
  // ignore version-looking strings inside image/asset filenames
  const stale = [
    ...new Set(
      versionHits.filter(
        (v) =>
          v !== version &&
          !/IMG\/|assets\//.test(
            src.slice(Math.max(0, src.indexOf(v, 0) - 60), src.indexOf(v, 0) + 60)
          )
      )
    )
  ]
  if (stale.length) {
    report(
      'WARN',
      `${rel} has version refs other than current (${version}): ${stale.join(', ')} — verify they are intentional`
    )
  }
}

// ---- 3d. Nav ↔ docs completeness (astro.config.mjs) --------------------------
// The sidebar is hand-curated (order matters), but completeness is mechanical:
// every doc needs a nav entry (or it's unreachable), every nav slug needs a
// real doc (or it 404s). This checks presence only — never reorders.
const astroConfig = read(path.join(SITE, 'astro.config.mjs'))
const slugRe = /slug:\s*["']([^"']+)["']/g
const navSlugs = new Set()
let mSlug
while ((mSlug = slugRe.exec(astroConfig)) !== null) navSlugs.add(mSlug[1])

const docFiles = walk(docsDir)
  .filter((f) => /\.(md|mdx)$/.test(f))
  .map((f) => path.relative(docsDir, f).replace(/\.(md|mdx)$/, ''))
  .sort()

// index is the section root (landing page), not a sidebar item — exempt
const SIDEBAR_EXEMPT = new Set(['index'])
for (const slug of docFiles) {
  if (SIDEBAR_EXEMPT.has(slug)) continue
  if (!navSlugs.has(slug)) {
    report(
      'WARN',
      `doc has no nav entry in astro.config.mjs: ${slug} (add a { label, slug } item — page is unreachable)`
    )
  }
}
for (const slug of navSlugs) {
  if (!docFiles.includes(slug)) {
    report(
      'WARN',
      `nav entry points at missing doc: ${slug} (remove or fix the slug in astro.config.mjs)`
    )
  }
}

// ---- summary ------------------------------------------------------------------
console.log('')
console.log('📋 Doc sync complete.')
if (drift.length) {
  console.log(
    `${drift.length} drift item(s) — prose above needs a human/agent pass before release:`
  )
  drift.forEach((d) => console.log(`  ${d.msg}`))
} else {
  console.log('✅ No drift found.')
}
