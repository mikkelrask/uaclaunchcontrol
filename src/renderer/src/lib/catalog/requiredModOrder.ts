import type { RequiredModEntry } from './types'

export function normalizeRequiredModOrder(entries: RequiredModEntry[]): RequiredModEntry[] {
  return entries.map((entry, index) => ({ ...entry, offset: index + 1 }))
}

export function sortRequiredModOrder(entries: RequiredModEntry[]): RequiredModEntry[] {
  return normalizeRequiredModOrder([...entries].sort((a, b) => a.offset - b.offset))
}

export function moveRequiredMod(
  entries: RequiredModEntry[],
  index: number,
  direction: -1 | 1
): RequiredModEntry[] {
  const nextIndex = index + direction
  if (index < 0 || nextIndex < 0 || index >= entries.length || nextIndex >= entries.length) {
    return entries
  }

  const next = [...entries]
  const temp = next[index]
  next[index] = next[nextIndex]
  next[nextIndex] = temp
  return normalizeRequiredModOrder(next)
}
