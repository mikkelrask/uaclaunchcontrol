import { slugify } from '@/lib/utils'

/**
 * Save directory for a protocol: `<savegamesPath>/<slug of title>`, exactly as
 * typing the title into the form derives it.
 *
 * The path is only derived while the field is empty or still holds a path we
 * derived earlier — a path the user typed is never overwritten.
 */
export function deriveSaveDirectory(
  title: string,
  currentSaveDir: string,
  savegamesPath: string | undefined
): string {
  const wasAutoFilled =
    !!savegamesPath &&
    currentSaveDir.startsWith(`${savegamesPath}/`) &&
    currentSaveDir.length > savegamesPath.length + 1
  if (currentSaveDir && !wasAutoFilled) return currentSaveDir

  const sluggedTitle = slugify(title)
  if (!sluggedTitle) return currentSaveDir
  return savegamesPath ? `${savegamesPath}/${sluggedTitle}` : sluggedTitle
}
