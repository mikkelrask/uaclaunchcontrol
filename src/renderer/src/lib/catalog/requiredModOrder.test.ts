import { describe, expect, it } from 'vitest'
import {
  moveRequiredMod,
  normalizeRequiredModOrder,
  sortRequiredModOrder
} from './requiredModOrder'
import type { RequiredModEntry } from './types'

const initialOrder: RequiredModEntry[] = [
  { hash: 'parent', name: 'Parent', filePath: '', isNew: false, offset: 1, sidecarOnly: false, isMain: true },
  { hash: 'dependency', name: 'Dependency', filePath: '', isNew: false, offset: 2, sidecarOnly: false }
]

describe('moveRequiredMod', () => {
  it('updates persisted offsets when a dependency moves before its parent and back', () => {
    const dependencyFirst = moveRequiredMod(initialOrder, 0, 1)
    expect(dependencyFirst.map(({ hash, offset }) => [hash, offset])).toEqual([
      ['dependency', 1],
      ['parent', 2]
    ])

    const parentFirst = moveRequiredMod(dependencyFirst, 0, 1)
    expect(parentFirst.map(({ hash, offset }) => [hash, offset])).toEqual([
      ['parent', 1],
      ['dependency', 2]
    ])
  })

  it('does not alter order when moving past either end', () => {
    expect(moveRequiredMod(initialOrder, 0, -1)).toEqual(initialOrder)
    expect(moveRequiredMod(initialOrder, 1, 1)).toEqual(initialOrder)
  })

  it('compacts offsets after a dependency is removed', () => {
    const remaining = normalizeRequiredModOrder([initialOrder[0], { ...initialOrder[1], offset: 3 }])
    expect(remaining.map(({ hash, offset }) => [hash, offset])).toEqual([
      ['parent', 1],
      ['dependency', 2]
    ])
  })

  it('preserves a registry order where the dependency precedes the parent', () => {
    const ordered = sortRequiredModOrder([
      { ...initialOrder[0], offset: 2 },
      { ...initialOrder[1], offset: 1 }
    ])
    expect(ordered.map(({ hash, offset }) => [hash, offset])).toEqual([
      ['dependency', 1],
      ['parent', 2]
    ])
  })
})
