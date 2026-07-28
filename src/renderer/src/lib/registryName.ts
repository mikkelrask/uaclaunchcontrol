/**
 * A registry family (e.g. "The Abyssal Crown") can bundle several distinct
 * files (e.g. "Abyssal Core", "Abyssal Crown"), each with its own
 * display_name. Using family_name alone as every file's display name makes
 * sibling files indistinguishable in the UI — so whenever a file's
 * display_name differs from its family_name, show both.
 */
export function formatRegistryName(familyName: string, displayName?: string | null): string {
  if (displayName && displayName !== familyName) {
    return `${familyName} (${displayName})`
  }
  return familyName
}
