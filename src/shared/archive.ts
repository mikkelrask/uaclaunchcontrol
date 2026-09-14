/**
 * Archive formats the mod-file import flow can scan and extract.
 *
 * Shared by the main process (download completion + scan dispatch) and the
 * renderer (file pickers, drag/drop validation, download handoff) so every
 * "is this an archive?" decision reads from one list.
 */
export const ARCHIVE_EXTENSIONS = ['zip', 'rar', '7z'] as const

export type ArchiveExtension = (typeof ARCHIVE_EXTENSIONS)[number]

/**
 * Lower-cased archive extension of a file name or path, or null when it is
 * not one of ARCHIVE_EXTENSIONS. Pure string test — never touches disk.
 */
export function getArchiveExtension(fileName: string): ArchiveExtension | null {
  const ext = fileName.slice(fileName.lastIndexOf('.') + 1).toLowerCase()
  return ARCHIVE_EXTENSIONS.find((candidate) => candidate === ext) ?? null
}
