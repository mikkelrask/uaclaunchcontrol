import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import en from './locales/desktop/en.json'
import sharedMessages from '../../../../../tools/i18n/shared-key-migration.json'

// Scan every marked renderer message so new screens cannot bypass catalog validation.
const RENDERER_ROOT = path.resolve(__dirname, '../..')
function sourceFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name)
    if (entry.isDirectory()) return sourceFiles(file)
    return /\.tsx?$/.test(file) && !/\.test\.tsx?$|\.d\.ts$/.test(file) ? [file] : []
  })
}
function literal(node: ts.Node | undefined): string | undefined {
  if (!node) return undefined
  if (ts.isStringLiteral(node)) return node.text
  if (ts.isJsxExpression(node)) return literal(node.expression)
  return undefined
}

describe('English source catalog', () => {
  it('reuses the audited shared vocabulary and keeps documented context exceptions', () => {
    const source: Record<string, string> = en
    for (const group of sharedMessages) {
      expect(source[group.key], group.key).toBe(group.defaultValue)
      for (const retired of group.sources) expect(source, retired).not.toHaveProperty(retired)
      const matches = Object.entries(source)
        .filter(([, value]) => value === group.defaultValue)
        .map(([key]) => key)
        .sort()
      expect(matches, `Reuse ${group.key} or document a distinct meaning`).toEqual(
        [group.key, ...group.separateKeys].sort()
      )
    }
  })
  it('matches every marked message, including messages outside hooks', () => {
    const messages = new Map<string, string>()
    const record = (key: string, value: string): void => {
      if (messages.has(key))
        expect(messages.get(key), `Conflicting defaults for ${key}`).toBe(value)
      messages.set(key, value)
    }
    for (const location of sourceFiles(RENDERER_ROOT)) {
      const file = path.relative(RENDERER_ROOT, location)
      const source = ts.createSourceFile(
        file,
        fs.readFileSync(location, 'utf8'),
        ts.ScriptTarget.Latest,
        true,
        file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
      )
      const visit = (node: ts.Node): void => {
        if (
          ts.isCallExpression(node) &&
          ((ts.isIdentifier(node.expression) && node.expression.text === 't') ||
            (ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 't'))
        ) {
          const [key, value] = node.arguments
          expect(key && ts.isStringLiteral(key), `Dynamic key in ${file}`).toBe(true)
          expect(value && ts.isStringLiteral(value), `Missing English default in ${file}`).toBe(
            true
          )
          if (key && value && ts.isStringLiteral(key) && ts.isStringLiteral(value))
            record(key.text, value.text)
        }
        if (
          (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) &&
          node.tagName.getText(source) === 'T'
        ) {
          const props = new Map(
            node.attributes.properties
              .filter(ts.isJsxAttribute)
              .map((attribute) => [attribute.name.getText(source), attribute.initializer])
          )
          const key = props.get('keyName')
          const value = props.get('defaultValue')
          const keyText = literal(key)
          const defaultText = literal(value)
          expect(keyText, `Dynamic T key in ${file}`).toBeDefined()
          expect(defaultText, `Missing T default in ${file}`).toBeDefined()
          if (keyText !== undefined && defaultText !== undefined) record(keyText, defaultText)
        }
        ts.forEachChild(node, visit)
      }
      visit(source)
    }
    expect(Object.fromEntries(messages)).toEqual(en)
  })
})
