import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export function toFileUrl(filePath: string): string {
  if (!filePath) return ''
  // Use our backend media API to bypass file:// security restrictions
  return `http://localhost:7666/api/media?path=${encodeURIComponent(filePath)}`
}

function looksAbsolute(filePath: string): boolean {
  return filePath.startsWith('/') || filePath.startsWith('~') || /^[a-zA-Z]:[\\/]/.test(filePath)
}

export function buildLaunchCommand(options: {
  executable?: string
  iwad?: string
  doomVersionArgs?: string
  files?: { filePath?: string; fileName?: string; name?: string }[]
  saveDirectory?: string
  launchParameters?: string
  modsDirectory?: string
  savegamesPath?: string
}): string {
  const parts: string[] = []

  // Source port executable
  if (options.executable) {
    const escaped = options.executable.includes(' ')
      ? `"${options.executable}"`
      : options.executable
    parts.push(escaped)
  } else {
    parts.push('[source-port]')
  }

  // IWAD / base args
  if (options.doomVersionArgs) {
    parts.push(options.doomVersionArgs)
  } else if (options.iwad) {
    const escaped = options.iwad.includes(' ') ? `"${options.iwad}"` : options.iwad
    parts.push(`-iwad ${escaped}`)
  } else {
    parts.push('-iwad [base-wad]')
  }

  // Mod files (-file)
  const filePaths =
    options.files
      ?.map((f) => {
        let fp = f.filePath || f.name || f.fileName || ''
        if (fp && options.modsDirectory && !looksAbsolute(fp)) {
          if (fp.startsWith('files/') || fp.startsWith('files\\')) {
            fp = `${options.modsDirectory}/${fp}`
          } else {
            fp = `${options.modsDirectory}/files/${fp}`
          }
        }
        return fp
      })
      .filter(Boolean) || []
  if (filePaths.length > 0) {
    parts.push('-file')
    filePaths.forEach((fp) => {
      const escaped = fp!.includes(' ') ? `"${fp}"` : fp!
      parts.push(escaped!)
    })
  }

  // Save directory
  if (options.saveDirectory || options.savegamesPath) {
    let saveDir = options.saveDirectory || options.savegamesPath || ''
    if (saveDir && !looksAbsolute(saveDir) && options.savegamesPath) {
      saveDir = `${options.savegamesPath}/${saveDir}`
    }
    const escaped = saveDir.includes(' ') ? `"${saveDir}"` : saveDir
    parts.push('-savedir', escaped)
  }

  // Custom launch parameters
  if (options.launchParameters) {
    parts.push(options.launchParameters)
  }

  return parts.join(' ')
}

/** Format accumulated playtime as "Total: X.X hrs" (Steam-style guilt trip). */
export function formatPlaytime(seconds?: number): string | null {
  if (!seconds || seconds <= 0) return null
  const hours = seconds / 3600
  return `Total: ${hours.toFixed(1)} hrs`
}
