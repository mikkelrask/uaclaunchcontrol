import type { BatParseResult } from './types'

/**
 * Parse a .bat file's content to extract source port, IWAD, mod files,
 * and extra launch parameters.
 */
export function parseBatContent(content: string): BatParseResult {
  const lines = content.replace(/\r\n/g, '\n').split('\n')
  let commandLine = ''
  let sourcePortFamily: string | undefined

  for (const line of lines) {
    const trimmed = line.trim()
    if (
      !trimmed ||
      trimmed.toLowerCase().startsWith('::') ||
      trimmed.toLowerCase().startsWith('@echo') ||
      trimmed.toLowerCase().startsWith('rem ')
    )
      continue

    const portMatch = trimmed.match(/(gzdoom|uzdoom|zandronum|lzdoom|zdoom)\.exe/i)
    if (portMatch) {
      commandLine = trimmed
      sourcePortFamily = portMatch[1].toLowerCase()
      break
    }
  }

  if (!commandLine) {
    commandLine = lines.find((l) => /-(iwad|file)/i.test(l)) || ''
  }

  const tokens: string[] = []
  const regex = /[^\s"']+|"([^"]*)"|'([^']*)'/g
  let match
  while ((match = regex.exec(commandLine)) !== null) {
    tokens.push(match[1] || match[2] || match[0])
  }

  const iwadIndex = tokens.findIndex((t) => t.toLowerCase() === '-iwad')
  const iwad = iwadIndex >= 0 && tokens[iwadIndex + 1] ? tokens[iwadIndex + 1] : undefined

  const modFiles: string[] = []
  const extraParams: string[] = []
  const fileIndex = tokens.findIndex((t) => t.toLowerCase() === '-file')
  if (fileIndex >= 0) {
    for (let i = fileIndex + 1; i < tokens.length; i++) {
      const token = tokens[i]
      if (token.startsWith('-')) {
        extraParams.push(...tokens.slice(i))
        break
      }
      modFiles.push(token)
    }
  }

  return { sourcePortFamily, iwad, modFiles, extraParams }
}

/**
 * Resolve relative file paths against the base directory of a file path.
 */
export function resolveRelativePaths(basePath: string, files: string[]): string[] {
  const lastSep = Math.max(basePath.lastIndexOf('\\'), basePath.lastIndexOf('/'))
  if (lastSep <= 0) return files
  const baseDir = basePath.substring(0, lastSep)
  const sep = basePath.includes('\\') ? '\\' : '/'
  return files.map((file) => {
    if (/^[a-zA-Z]:[\\/]/.test(file) || file.startsWith('/')) return file
    return `${baseDir}${sep}${file}`
  })
}

/**
 * Build a filenames with the MD5 hash appended before the extension.
 */
export function buildHashFileName(fileName: string, hashValue: string): string {
  const extensionIndex = fileName.lastIndexOf('.')
  if (extensionIndex === -1) return `${fileName}-${hashValue}`

  const baseName = fileName.slice(0, extensionIndex).replace(/(-[a-f0-9]{32})+$/i, '')
  const extension = fileName.slice(extensionIndex)
  return `${baseName}-${hashValue}${extension}`
}
