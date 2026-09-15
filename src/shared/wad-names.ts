// WAD filename rules shared by the main process (scanning, catalogue) and the
// renderer (protocol imports), so the `-<md5>` suffix an in-app download
// appends is recognised in exactly one place.

/** `doom2-<md5>` -> `doom2`. Every appended hash is stripped. */
export function stripMd5Suffix(baseName: string): string {
  return baseName.replace(/(-[a-f0-9]{32})+$/i, '')
}

/** How many `-<md5>` groups a name carries (0 = a plain name). */
export function countMd5Suffixes(baseName: string): number {
  return baseName.match(/-[a-f0-9]{32}/gi)?.length ?? 0
}
