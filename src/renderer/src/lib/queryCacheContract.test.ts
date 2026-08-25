/**
 * Enforces the query-cache contracts in `queryCacheContracts.ts`:
 *
 * 1. Every state-changing method on `api` (any fetch with a non-GET method)
 *    must be classified in QUERY_CACHE_CONTRACTS or NO_CACHE_CONTRACT —
 *    adding a new mutation without classifying it FAILS the build.
 * 2. Every file that calls a contracted mutation must refresh the contract's
 *    query keys (invalidateQueries / setQueryData with a matching literal
 *    key, a blanket invalidate, or a catalog refetch) — a mutation that
 *    writes server state without refreshing its cache shows stale UI until
 *    restart (staleTime: Infinity), so this is a hard contract.
 * 3. Contract/whitelist entries that no longer exist on `api` and call-site
 *    exceptions that no longer match any call are flagged as dead.
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import {
  QUERY_CACHE_CONTRACTS,
  NO_CACHE_CONTRACT,
  CALL_SITE_EXCEPTIONS
} from './queryCacheContracts'

const RENDERER_ROOT = path.resolve(__dirname, '..')
const API_FILE = path.join(RENDERER_ROOT, 'api.ts')
const SKIP_FILES = new Set(['api.ts', 'queryCacheContracts.ts', 'queryCacheContract.test.ts'])

// ── Source helpers ─────────────────────────────────────────────────────────

function parse(file: string): ts.SourceFile {
  const text = fs.readFileSync(file, 'utf8')
  return ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
}

function collectFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      collectFiles(full, out)
    } else if (
      (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) &&
      !entry.name.endsWith('.test.ts') &&
      !entry.name.endsWith('.test.tsx')
    ) {
      out.push(full)
    }
  }
  return out
}

/** Property names of the `export const api = { … }` object literal. */
function apiMethodNames(source: ts.SourceFile): Set<string> {
  const names = new Set<string>()
  const visit = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === 'api' &&
      node.initializer &&
      ts.isObjectLiteralExpression(node.initializer)
    ) {
      for (const prop of node.initializer.properties) {
        if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name)) {
          names.add(prop.name.text)
        }
      }
      return // stop descending into the object
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return names
}

/** Method name → true when the body issues a fetch with an explicit non-GET method. */
function detectMutations(source: ts.SourceFile, methodNames: Set<string>): Map<string, boolean> {
  const result = new Map<string, boolean>()
  for (const name of methodNames) result.set(name, false)
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'fetch') {
      const options = node.arguments[1]
      if (options && ts.isObjectLiteralExpression(options)) {
        for (const prop of options.properties) {
          if (
            ts.isPropertyAssignment(prop) &&
            ts.isIdentifier(prop.name) &&
            prop.name.text === 'method' &&
            ts.isStringLiteral(prop.initializer) &&
            prop.initializer.text.toUpperCase() !== 'GET'
          ) {
            // Fetch is inside the body of some api method — mark it.
            let cur: ts.Node | undefined = node.parent
            while (cur) {
              if (
                ts.isMethodDeclaration(cur) ||
                ts.isFunctionDeclaration(cur) ||
                ts.isFunctionExpression(cur) ||
                ts.isArrowFunction(cur)
              ) {
                const name = (cur as ts.FunctionLikeDeclaration).name
                if (name && ts.isIdentifier(name)) result.set(name.text, true)
                break
              }
              cur = cur.parent
            }
          }
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return result
}

/** Keys refreshed by one call expression, or null when it refreshes nothing specific. */
function refreshKeys(node: ts.CallExpression): string[] | 'all' | null {
  const callee = node.expression
  if (ts.isPropertyAccessExpression(callee) && callee.expression.getText() === 'queryClient') {
    if (callee.name.text === 'invalidateQueries') {
      const arg = node.arguments[0]
      if (!arg) return 'all' // invalidateQueries() — blanket
      if (ts.isObjectLiteralExpression(arg)) {
        for (const prop of arg.properties) {
          if (
            ts.isPropertyAssignment(prop) &&
            ts.isIdentifier(prop.name) &&
            prop.name.text === 'queryKey'
          ) {
            const keys = stringArrayKeys(prop.initializer)
            return keys === null ? [] : keys
          }
        }
        return [] // options object without queryKey → no specific key
      }
      return []
    }
    if (callee.name.text === 'setQueryData') {
      const keyArg = node.arguments[0]
      if (!keyArg) return []
      const keys = stringArrayKeys(keyArg)
      return keys === null ? [] : keys
    }
    return null
  }
  if (ts.isIdentifier(callee) && (callee.text === 'refetch' || callee.text === 'loadCatalogFiles')) {
    return 'all' // useQuery refetch — refreshes the surrounding query
  }
  return null
}

/** String-literal elements of an array literal; null when not a plain literal array. */
function stringArrayKeys(node: ts.Node): string[] | null {
  if (!ts.isArrayLiteralExpression(node)) return null
  const keys: string[] = []
  for (const el of node.elements) {
    if (!ts.isStringLiteral(el)) return null
    keys.push(el.text)
  }
  return keys
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('query cache contracts', () => {
  const apiSource = parse(API_FILE)
  const methodNames = apiMethodNames(apiSource)
  const mutations = detectMutations(apiSource, methodNames)
  const contractKeys = new Set(Object.keys(QUERY_CACHE_CONTRACTS))
  const whitelistKeys = new Set(Object.keys(NO_CACHE_CONTRACT))

  it('classifies every state-changing api method', () => {
    const unclassified = [...mutations.entries()]
      .filter(([, isMutation]) => isMutation)
      .map(([name]) => name)
      .filter((name) => !contractKeys.has(name) && !whitelistKeys.has(name))
    expect(unclassified, [
      'api methods that write server state MUST be classified in',
      'src/renderer/src/lib/queryCacheContracts.ts:',
      '  - affects cached queries  → add to QUERY_CACHE_CONTRACTS and refresh the keys at every call site',
      '  - no cache impact         → add to NO_CACHE_CONTRACT with a justification',
      'Unclassified: ' + unclassified.join(', ')
    ].join('\n')).toEqual([])
  })

  it('has no dead contract or whitelist entries', () => {
    const missing = [...contractKeys, ...whitelistKeys].filter((name) => !methodNames.has(name))
    expect(missing, [
      'these entries in queryCacheContracts.ts do not exist on `api` anymore — remove them',
      'Dead entries: ' + missing.join(', ')
    ].join('\n')).toEqual([])
  })

  it('refreshes contracted query keys at every call site', () => {
    const files = collectFiles(RENDERER_ROOT)
    const violations: string[] = []

    for (const file of files) {
      if (SKIP_FILES.has(path.basename(file))) continue
      const source = parse(file)

      // Contracted mutations referenced in this file
      const referenced = new Set<string>()
      // Refresh keys present anywhere in the file (blanket = 'all')
      const refreshed: string[] = []

      const visit = (node: ts.Node): void => {
        if (ts.isPropertyAccessExpression(node)) {
          const obj = node.expression
          if (ts.isIdentifier(obj) && obj.text === 'api' && ts.isIdentifier(node.name)) {
            if (contractKeys.has(node.name.text)) referenced.add(node.name.text)
          }
        }
        if (ts.isCallExpression(node)) {
          const keys = refreshKeys(node)
          if (keys === 'all') {
            refreshed.push('*')
          } else if (keys) {
            refreshed.push(...keys)
          }
        }
        ts.forEachChild(node, visit)
      }
      visit(source)

      const rel = path.relative(RENDERER_ROOT, file)
      for (const mutation of referenced) {
        const required = QUERY_CACHE_CONTRACTS[mutation]
        const missingKeys = required.filter(
          (key) => !(refreshed.includes('*') || refreshed.includes(key))
        )
        if (missingKeys.length === 0) continue

        const exception = CALL_SITE_EXCEPTIONS[path.basename(file)]?.[mutation]
        if (exception) continue

        violations.push(
          `${rel} calls api.${mutation} but never refreshes: ${missingKeys.join(', ')}` +
            ` (contract: ${mutation} → ${required.join(', ')})` +
            ` — add queryClient.invalidateQueries({ queryKey: [...] }) / setQueryData / refetch` +
            ` in this file, or justify a NO_CACHE_CONTRACT/CALL_SITE_EXCEPTIONS entry`
        )
      }
    }

    expect(violations, violations.join('\n')).toEqual([])
  })

  it('has no dead call-site exceptions', () => {
    const dead: string[] = []
    for (const [basename, mutations] of Object.entries(CALL_SITE_EXCEPTIONS)) {
      for (const mutation of Object.keys(mutations)) {
        if (!contractKeys.has(mutation)) {
          dead.push(`${basename}: ${mutation} is not a contracted mutation`)
          continue
        }
        const files = collectFiles(RENDERER_ROOT)
        const hit = files.some((file) => {
          if (path.basename(file) !== basename) return false
          const source = parse(file)
          let found = false
          const visit = (node: ts.Node): void => {
            if (
              ts.isPropertyAccessExpression(node) &&
              ts.isIdentifier(node.expression) &&
              node.expression.text === 'api' &&
              ts.isIdentifier(node.name) &&
              node.name.text === mutation
            ) {
              found = true
            }
            ts.forEachChild(node, visit)
          }
          visit(source)
          return found
        })
        if (!hit) dead.push(`${basename}: ${mutation} — exception matches no call site`)
      }
    }
    expect(dead, dead.join('\n')).toEqual([])
  })
})
