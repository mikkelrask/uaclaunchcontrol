import type { BatParseResult } from './types'

/**
 * Split a shell command string into tokens, respecting quoted strings.
 */
function tokenize(text: string): string[] {
  const tokens: string[] = []
  const regex = /[^\s"']+|"([^"]*)"|'([^']*)'/g
  let match
  while ((match = regex.exec(text)) !== null) {
    tokens.push(match[1] || match[2] || match[0])
  }
  return tokens
}

/**
 * Parse a .bat file's content to extract source port, IWAD, mod files,
 * and extra launch parameters.
 *
 * Scans ALL non-comment lines for `-file` entries, collecting every mod
 * file path found. The first executable line is used to extract the
 * source port family, IWAD, and extra parameters.
 */
export function parseBatContent(content: string): BatParseResult {
  const lines = content.replace(/\r\n/g, '\n').split('\n')
  let commandLine = ''
  let sourcePortFamily: string | undefined
  const allModFiles: string[] = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (
      !trimmed ||
      trimmed.toLowerCase().startsWith('::') ||
      trimmed.toLowerCase().startsWith('@echo') ||
      trimmed.toLowerCase().startsWith('rem ')
    )
      continue

    // Capture the first executable line for metadata
    if (!commandLine) {
      const portMatch = trimmed.match(/(gzdoom|uzdoom|zandronum|lzdoom|zdoom)\.exe/i)
      if (portMatch) {
        commandLine = trimmed
        sourcePortFamily = portMatch[1].toLowerCase()
      }
    }

    // Scan every line for -file entries
    const tokens = tokenize(trimmed)
    const fileIndex = tokens.findIndex((t) => t.toLowerCase() === '-file')
    if (fileIndex >= 0) {
      for (let i = fileIndex + 1; i < tokens.length; i++) {
        const token = tokens[i]
        if (token.startsWith('-')) break
        allModFiles.push(token)
      }
    }
  }

  // Fallback: if no command line found, use first line with -iwad or -file
  if (!commandLine) {
    commandLine = lines.find((l) => /-(iwad|file)/i.test(l)) || ''
  }

  // Extract IWAD and extra params from the command line only
  let iwad: string | undefined
  let extraParams: string[] = []
  if (commandLine) {
    const tokens = tokenize(commandLine)
    const iwadIndex = tokens.findIndex((t) => t.toLowerCase() === '-iwad')
    iwad = iwadIndex >= 0 && tokens[iwadIndex + 1] ? tokens[iwadIndex + 1] : undefined

    const fileIndex = tokens.findIndex((t) => t.toLowerCase() === '-file')
    if (fileIndex >= 0) {
      for (let i = fileIndex + 1; i < tokens.length; i++) {
        const token = tokens[i]
        if (token.startsWith('-')) {
          extraParams = tokens.slice(i)
          break
        }
      }
    }
  }

  return { sourcePortFamily, iwad, modFiles: allModFiles, extraParams }
}

/**
 * Derive a human-readable file type label from a file extension.
 */
export function deriveFileType(ext: string): string {
  const upper = ext.toUpperCase()
  if (upper === 'ZIP') return 'ZIP'
  if (upper === 'PK3' || upper === 'PK7' || upper === 'IPK3') return 'PK3'
  if (upper === 'DEH' || upper === 'BEX') return 'DEH'
  return 'WAD'
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
