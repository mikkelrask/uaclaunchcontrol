import { describe, it, expect, vi, afterEach } from 'vitest'

interface StoredNotification {
  id: string
  title: string
  description: string
  variant: 'default' | 'destructive'
  createdAt: string
  read: boolean
}

const STORAGE_KEY = 'uac:notifications'

function createMemoryStorage(): Storage {
  const store = new Map<string, string>()
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value)
    },
    removeItem: (key: string) => {
      store.delete(key)
    },
    clear: () => store.clear(),
    key: () => null,
    get length() {
      return store.size
    }
  } as Storage
}

function readStored(): StoredNotification[] {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as StoredNotification[]
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('recordNotification', () => {
  it('records a new notification as unread', async () => {
    vi.stubGlobal('localStorage', createMemoryStorage())
    vi.resetModules()
    const { recordNotification } = await import('./notifications')

    recordNotification({
      id: 'a',
      title: 'WARNING: import_partial',
      description: 'done'
    })

    const stored = readStored()
    expect(stored).toHaveLength(1)
    expect(stored[0].read).toBe(false)
  })

  it('ignores calls with neither title nor description', async () => {
    vi.stubGlobal('localStorage', createMemoryStorage())
    vi.resetModules()
    const { recordNotification } = await import('./notifications')

    recordNotification({})

    expect(readStored()).toHaveLength(0)
  })

  it('caps the ring buffer at 50 entries, evicting the oldest first', async () => {
    vi.stubGlobal('localStorage', createMemoryStorage())
    vi.resetModules()
    const { recordNotification } = await import('./notifications')

    for (let i = 0; i < 55; i++) {
      recordNotification({ id: `n${i}`, title: `WARNING: toast_${i}`, description: '' })
    }

    const stored = readStored()
    expect(stored).toHaveLength(50)
    // Newest first — most recent recording at index 0.
    expect(stored[0].title).toBe('WARNING: toast_54')
    // Oldest 5 (n0..n4) evicted; n5 is now the oldest surviving entry.
    expect(stored[49].title).toBe('WARNING: toast_5')
  })
})

describe('recordNotification filtering', () => {
  // Most of the app's toast() calls are routine in-the-moment confirmations
  // (launch/save/hash progress) for actions the user just watched happen —
  // only errors, warnings, achievement/rank unlocks, and update status are
  // worth surfacing again later, so only those get archived into history.
  it.each([
    [
      'destructive variant (any title)',
      { title: 'FATAL: process_died', variant: 'destructive' as const }
    ],
    ['a WARNING: title', { title: 'WARNING: name_required' }],
    ['an achievement unlock', { title: 'ACHIEVEMENT UNLOCKED' }],
    ['a rank advancement', { title: 'RANK ADVANCEMENT' }],
    ['an update status toast', { title: 'SYSTEM: Update Ready' }]
  ])('records %s', async (_label, props) => {
    vi.stubGlobal('localStorage', createMemoryStorage())
    vi.resetModules()
    const { recordNotification } = await import('./notifications')

    recordNotification({ id: 'x', description: 'desc', ...props })

    expect(readStored()).toHaveLength(1)
  })

  it.each([
    ['a routine launch confirmation', { title: 'SYSTEM: launch_protocol' }],
    ['a routine save confirmation', { title: 'SYSTEM: params_accepted' }],
    ['a progress toast', { title: 'SYSTEM: hashing' }],
    ['an unrelated SYSTEM toast', { title: 'SYSTEM: wad_watcher' }]
  ])('does not record %s', async (_label, props) => {
    vi.stubGlobal('localStorage', createMemoryStorage())
    vi.resetModules()
    const { recordNotification } = await import('./notifications')

    recordNotification({ id: 'x', description: 'desc', ...props })

    expect(readStored()).toHaveLength(0)
  })
})

describe('markRead / markAllRead', () => {
  it('markRead flips only the matching notification to read', async () => {
    vi.stubGlobal('localStorage', createMemoryStorage())
    vi.resetModules()
    const { recordNotification, markRead } = await import('./notifications')

    recordNotification({ id: 'a', title: 'WARNING: a', description: '' })
    recordNotification({ id: 'b', title: 'WARNING: b', description: '' })
    markRead('a')

    const stored = readStored()
    expect(stored.find((n) => n.id === 'a')?.read).toBe(true)
    expect(stored.find((n) => n.id === 'b')?.read).toBe(false)
  })

  it('markAllRead flips every notification to read', async () => {
    vi.stubGlobal('localStorage', createMemoryStorage())
    vi.resetModules()
    const { recordNotification, markAllRead } = await import('./notifications')

    recordNotification({ id: 'a', title: 'WARNING: a', description: '' })
    recordNotification({ id: 'b', title: 'WARNING: b', description: '' })
    markAllRead()

    expect(readStored().every((n) => n.read)).toBe(true)
  })

  it('a notification that is never explicitly marked read (e.g. an auto-expired toast) stays unread', async () => {
    vi.stubGlobal('localStorage', createMemoryStorage())
    vi.resetModules()
    const { recordNotification } = await import('./notifications')

    // Nothing here ever calls markRead — this simulates a toast that timed
    // out on its own rather than being closed via its close button. The
    // store must not mark it read on its own.
    recordNotification({ id: 'expired', title: 'WARNING: expired', description: '' })

    expect(readStored().find((n) => n.id === 'expired')?.read).toBe(false)
  })
})
