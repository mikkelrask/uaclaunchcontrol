import { describe, it, expect } from 'vitest'
import { spawnSync } from 'node:child_process'

// Advisories accepted as risk, with the reason recorded at acceptance time.
// GHSA-jmr9-qjv8-65gv: extract-zip unvalidated symlink path traversal.
// Upstream has NO patched release (every version is affected). In this app it
// is only reachable through electron's install script (dev-time download of a
// trusted artifact); the attacker-controlled path — extracting mod archives —
// was migrated to yauzl with explicit symlink/path-traversal rejection in
// archive-io.ts. Revisit when upstream publishes a fix or electron drops
// extract-zip.
const ACCEPTED_ADVISORY_IDS: Record<string, true> = {
  'GHSA-jmr9-qjv8-65gv': true
}

interface AuditVuln {
  severity?: string
  via?: (string | { url?: string })[]
}

describe('npm audit', () => {
  it('no high-severity vulnerabilities in dependencies (except accepted unpatched advisories)', () => {
    // On Windows npm is npm.cmd; spawnSync('npm') fails to launch (EINVAL)
    // because Node cannot execute a bare .cmd without the extension.
    const npmExecutable = process.platform === 'win32' ? 'npm.cmd' : 'npm'
    const result = spawnSync(npmExecutable, ['audit', '--json', '--omit=dev'], {
      encoding: 'utf8',
      timeout: 30_000
    })
    expect(
      result.status,
      result.error?.message || result.stderr || 'npm audit failed to run'
    ).not.toBeNull()

    const audit = JSON.parse(result.stdout) as { vulnerabilities?: Record<string, AuditVuln> }
    const entries = Object.entries(audit.vulnerabilities ?? {})

    // Packages whose advisory (or a dependency chain through them) is accepted.
    const acceptedPackages = new Set(
      entries
        .filter(([, vuln]) =>
          (vuln.via ?? []).some((item) => {
            if (typeof item !== 'object' || item === null) return false
            const ghsa = item.url?.match(/GHSA-[a-z0-9-]+/i)?.[0]
            return ghsa ? ACCEPTED_ADVISORY_IDS[ghsa] === true : false
          })
        )
        .map(([name]) => name)
    )

    const unacceptable = entries
      .filter(([, vuln]) => vuln.severity === 'high' || vuln.severity === 'critical')
      .filter(([name, vuln]) => {
        if (acceptedPackages.has(name)) return false
        const dependsOnAccepted = (vuln.via ?? []).some(
          (item) => typeof item === 'string' && acceptedPackages.has(item)
        )
        return !dependsOnAccepted
      })
      .map(([name]) => name)

    expect(unacceptable).toEqual([])
  })
})
