#!/usr/bin/env node
/* eslint-disable @typescript-eslint/explicit-function-return-type */

import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'

/**
 * Standard Semantic Versioning Bumper
 * Usage: ./scripts/bump-version.mjs 0.2.0
 */

const version = process.argv[2]

if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  console.error('❌ Error: Please provide a valid SemVer (e.g. 0.2.0)')
  process.exit(1)
}

const TAG = `v${version}`
console.log(`🔧 Bumping to version ${version} (Tag: ${TAG})...`)

// Helper to read/write JSON
/**
 * @param {string} filePath
 * @param {(json: any) => void} updater
 * @returns {void}
 */
const updateJSON = (filePath, updater) => {
  const abs = path.resolve(filePath)
  if (!fs.existsSync(abs)) return
  const content = JSON.parse(fs.readFileSync(abs, 'utf-8'))
  updater(content)
  fs.writeFileSync(abs, JSON.stringify(content, null, 2) + '\n')
}

// Generate app icons from SVG with all required sizes
/**
 * @returns {void}
 */
const generateIcons = () => {
  const svgPath = path.resolve('src/renderer/src/assets/uaclaunchcontrol.svg')
  const resourcesDir = path.resolve('resources')

  if (!fs.existsSync(svgPath)) {
    console.warn('⚠️ SVG source not found, skipping icon generation')
    return
  }

  // Ensure resources directory exists
  if (!fs.existsSync(resourcesDir)) fs.mkdirSync(resourcesDir, { recursive: true })

  const sizes = [16, 24, 48, 64, 128, 256, 512, 1024]
  const cmd = process.platform === 'win32' ? 'magick convert' : 'convert'

  sizes.forEach((size) => {
    const outPath = path.join(resourcesDir, `icon-${size}.png`)
    try {
      // Use -background none to preserve SVG transparency
      execSync(`${cmd} -background none "${svgPath}" -resize ${size}x${size} "${outPath}"`, {
        stdio: 'inherit'
      })
    } catch {
      console.warn(`⚠️ Failed to generate ${size}px icon`)
    }
  })

  // Also create simple icon.png for runtime fallback
  fs.copyFileSync(path.join(resourcesDir, 'icon-512.png'), path.join(resourcesDir, 'icon.png'))
  console.log('✅ Generated all icon sizes to resources/')
}

// Generate icons first
console.log('🎨 Generating app icons from SVG...')
generateIcons()

// Update package.json
updateJSON('package.json', (json) => {
  json.version = version
})

// Keep the docs honest before tagging (aborts the bump if lint/tests fail)
console.log('📋 Syncing docs (AGENTS.md, README, website check)...')
execSync('node scripts/sync-docs.mjs', { stdio: 'inherit' })

try {
  execSync(
    'git add package.json README.md scripts/bump-version.mjs scripts/sync-docs.mjs scripts/sync-agents.mjs resources/'
  )
  const status = execSync('git status --porcelain').toString().trim()
  if (status) {
    execSync(`git commit -m "chore: bump version to ${version} 🚀"`)
  }

  // Create tag with v prefix
  execSync(`git tag -a -f ${TAG} -m "Release ${TAG}"`)

  const branch = execSync('git rev-parse --abbrev-ref HEAD').toString().trim()

  console.log(`📡 Pushing to origin ${branch} and tag ${TAG}...`)
  execSync(`git push origin ${branch} --force`)
  execSync(`git push origin ${TAG} --force`)

  console.log(`🚀 Version ${version} committed, tagged as ${TAG}, and pushed.`)

  // Refresh the graphify knowledge graph (best-effort; free — no LLM labels)
  try {
    if (execSync('command -v graphify').toString().trim()) {
      console.log('🧠 Refreshing graphify knowledge graph...')
      execSync('graphify update .', { stdio: 'inherit' })
      execSync('graphify cluster-only . --no-label', { stdio: 'inherit' })
      const graphStatus = execSync('git status --porcelain graphify-out/').toString().trim()
      if (graphStatus) {
        execSync('git add graphify-out/')
        execSync('git commit -m "chore: refresh knowledge graph"')
        execSync(`git push origin ${branch}`)
      } else {
        console.log('🧠 Graph unchanged — nothing to commit')
      }
    }
  } catch (err) {
    console.warn('⚠️ Graphify refresh skipped:', err.message)
  }
} catch (error) {
  console.error('❌ Error during bump:', error.message)
  process.exit(1)
}
