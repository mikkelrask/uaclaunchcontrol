import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import en from './locales/desktop/en.json'

// The initial migration boundary. Add screens here when their strings are migrated.
const PILOT_FILES = ['SettingsDialog.tsx', 'Header.tsx', 'Sidebar.tsx']

describe('English source catalog', () => {
  it('matches every marked pilot message, including messages outside hooks', () => {
    const messages = new Map<string, string>()
    const record = (key: string, value: string): void => {
      if (messages.has(key))
        expect(messages.get(key), `Conflicting defaults for ${key}`).toBe(value)
      messages.set(key, value)
    }
    for (const file of PILOT_FILES) {
      const location = path.resolve(__dirname, '../../components', file)
      const source = ts.createSourceFile(
        file,
        fs.readFileSync(location, 'utf8'),
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX
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
          expect(key && ts.isStringLiteral(key), `Dynamic T key in ${file}`).toBe(true)
          expect(value && ts.isStringLiteral(value), `Missing T default in ${file}`).toBe(true)
          if (key && value && ts.isStringLiteral(key) && ts.isStringLiteral(value))
            record(key.text, value.text)
        }
        ts.forEachChild(node, visit)
      }
      visit(source)
    }
    expect(Object.fromEntries(messages)).toEqual(en)
  })
})
