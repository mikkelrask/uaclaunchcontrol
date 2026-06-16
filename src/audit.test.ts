import { describe, it, expect } from 'vitest'
import { execSync } from 'node:child_process'

describe('npm audit', () => {
  it('no high-severity vulnerabilities in dependencies', () => {
    const result = execSync('npm audit --audit-level=high --production', {
      encoding: 'utf8',
      timeout: 30_000
    })
    expect(result).toMatch(/found 0 vulnerabilities/)
  })
})
