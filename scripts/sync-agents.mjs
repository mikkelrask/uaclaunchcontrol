#!/usr/bin/env node
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/**
 * Keeps AGENTS.md honest — regenerates the test/lint stats and the test
 * file list from real tool output.
 *
 * Usage:  node scripts/sync-agents.mjs
 *         (also run automatically by scripts/bump-version.mjs before a release)
 *
 * Exits 1 if lint reports errors (the bump flow aborts) or the suite fails.
 */
import { execFileSync } from 'child_process'
import fs from 'fs'

const AGENTS_PATH = 'AGENTS.md'
const agents = fs.readFileSync(AGENTS_PATH, 'utf-8')

const run = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf-8' })

// ---- Test stats (vitest JSON reporter) ----
const vitestJson = JSON.parse(run('npx', ['vitest', 'run', '--reporter=json']))
const testCount = vitestJson.numTotalTests
const fileCount = vitestJson.testResults.length // numTotalTestSuites counts describe blocks, not files
const durationMs = vitestJson.testResults.reduce(
  (sum, r) => sum + r.assertionResults.reduce((s, a) => s + (a.duration ?? 0), 0),
  0
)
const duration = (durationMs / 1000).toFixed(2)

const rel = (f) => (f.includes('/src/') ? f.slice(f.indexOf('/src/') + 1) : f)
const testFiles = vitestJson.testResults.map((r) => rel(r.name.replace(/\\/g, '/'))).sort()

// ---- Lint stats (oxlint JSON formatter) ----
let lintJson
try {
  lintJson = JSON.parse(run('npx', ['oxlint', '.', '--format', 'json']))
} catch (err) {
  lintJson = JSON.parse(err.stdout) // oxlint exits 1 on errors; JSON still on stdout
}
const diagnostics = lintJson.diagnostics ?? []
const errorCount = diagnostics.filter((d) => d.severity === 'error').length
const warningCount = diagnostics.filter((d) => d.severity === 'warning').length

if (errorCount > 0) {
  console.error(`❌ oxlint reports ${errorCount} error(s) — fix before release.`)
  process.exit(1)
}

// ---- Rewrite AGENTS.md ----
let out = agents

// Commands block
out = out.replace(
  /npm run lint\s+# oxlint \([^\n]*\)/,
  `npm run lint       # oxlint (0 errors, ${warningCount} warnings)`
)
out = out.replace(
  /npm test\s+# Vitest [^\n]*/,
  `npm test           # Vitest (${testCount} tests, ${fileCount} files, ~${duration}s) — includes npm audit as audit.test.ts`
)

// Test Setup block: preserve existing bullets (with their hand-written
// descriptions), drop bullets for files that no longer exist, append new
// ones without descriptions.
const listStart = out.indexOf('- **Test files**: `src/**/*.test.ts` (auto-discovered)')
const totalMatch = out.match(/\n- \*\*Total\*\*: [^\n]*/)
if (listStart === -1 || !totalMatch) {
  console.error('❌ Could not locate the Test Setup block in AGENTS.md')
  process.exit(1)
}
const blockEnd = out.indexOf(totalMatch[0], listStart)

const existing = new Map()
for (const line of out.slice(listStart, blockEnd).split('\n')) {
  const m = line.match(/^ {2}- `(src\/[^`]+\.test\.ts)`(.*)$/)
  if (m) existing.set(m[1], m[2]) // path → description suffix (may be empty)
}

let newBlock = '- **Test files**: `src/**/*.test.ts` (auto-discovered)\n'
for (const f of testFiles) {
  newBlock += `  - \`${f}\`${existing.get(f) ?? ''}\n`
}
out = out.slice(0, listStart) + newBlock + out.slice(blockEnd)

// Totals line
out = out.replace(
  /- \*\*Total\*\*: [^\n]*/,
  `- **Total**: ${testCount} tests, ${fileCount} files, ~${duration}s run time`
)

if (out === agents) {
  console.log(
    `✅ AGENTS.md already up to date (${testCount} tests, ${fileCount} files, lint 0 errors)`
  )
} else {
  fs.writeFileSync(AGENTS_PATH, out)
  console.log(
    `✅ AGENTS.md synced — ${testCount} tests / ${fileCount} files / ~${duration}s, lint 0 errors (${warningCount} warnings)`
  )
}
