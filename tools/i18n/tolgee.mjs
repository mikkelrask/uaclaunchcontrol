import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../../', import.meta.url))
process.chdir(root)
try {
  process.loadEnvFile('.env')
} catch (error) {
  if (error.code !== 'ENOENT') throw error
}
const token = process.env.TOLGEE_API_KEY || process.env.TOLGEE_API_TOKEN
const require = createRequire(import.meta.url)
const cli = resolve(dirname(require.resolve('@tolgee/cli/package.json')), 'dist/cli.js')
// Fixed operations intentionally expose no deletion/force/namespace override flags.
const commands = {
  extract: ['extract', 'print'],
  check: ['extract', 'check'],
  compare: ['compare'],
  push: ['push', '--force-mode', 'NO_FORCE'],
  pull: ['pull']
}
const operation = process.argv[2]
if (!Object.hasOwn(commands, operation) || process.argv.length !== 3) {
  throw new Error('Usage: node tools/i18n/tolgee.mjs extract|check|compare|push|pull')
}
if (!['extract', 'check'].includes(operation) && !token) {
  throw new Error('Set TOLGEE_API_KEY (or TOLGEE_API_TOKEN) in .env or the environment.')
}
const result = spawnSync(process.execPath, [cli, ...commands[operation]], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, ...(token ? { TOLGEE_API_KEY: token } : {}) }
})
if (result.error) throw result.error
process.exitCode = result.status ?? 1
