import React from 'react'

// A crash log's console tail, captured in-memory at crash time. Deliberately
// has no logFilePath: that file is opened with { flags: 'w' } and keyed by
// protocolId (see fileService.ts), so relaunching the same protocol
// overwrites it — a historical notification can never safely point at it.
// The logTail snapshot below is the only part of a crash log that stays
// accurate forever, so it's the only part we persist.
export interface CrashLogActionPayload {
  protocolId?: string
  protocolName?: string
  exitCode: number | null
  sessionSeconds: number
  logTail: string[]
}

export type NotificationAction =
  | { kind: 'view-crash-log'; payload: CrashLogActionPayload }
  | { kind: 'view-update' }
  | { kind: 'restart-update' }

export interface INotification {
  id: string
  title: string
  description: string
  variant: 'default' | 'destructive'
  createdAt: string // ISO timestamp
  read: boolean
  action?: NotificationAction
}

const STORAGE_KEY = 'uac:notifications'
const MAX_NOTIFICATIONS = 50 // ring buffer, oldest evicted first

function loadFromStorage(): INotification[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function persist(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications))
  } catch {
    // localStorage unavailable/full — history just won't persist across reloads
  }
}

let notifications: INotification[] = loadFromStorage()
const listeners: Array<(list: INotification[]) => void> = []

function emit(): void {
  listeners.forEach((l) => l(notifications))
}

// Most of the app's ~96 toast() call sites are routine, in-the-moment
// confirmations (launch/save/hash progress) for actions the user just took
// while looking at the screen — archiving those into history is just noise.
// Only persist toasts worth finding again later: errors, warnings,
// achievement/rank unlocks, and update status — the things that can happen
// while you're not looking (e.g. full-screen in a game).
function shouldRecord(title: string, variant: 'default' | 'destructive'): boolean {
  if (variant === 'destructive') return true
  if (title.startsWith('WARNING:')) return true
  if (title === 'ACHIEVEMENT UNLOCKED' || title === 'RANK ADVANCEMENT') return true
  if (title.startsWith('SYSTEM: Update')) return true
  return false
}

export function recordNotification(input: {
  id?: string
  title?: React.ReactNode
  description?: React.ReactNode
  variant?: 'default' | 'destructive'
  action?: NotificationAction
}): void {
  // 96 existing call sites all pass plain strings today (verified) - this
  // guards the rare/future case of something richer being passed in.
  const title = typeof input.title === 'string' ? input.title : String(input.title ?? '')
  const description =
    typeof input.description === 'string' ? input.description : String(input.description ?? '')
  if (!title && !description) return

  const variant = input.variant ?? 'default'
  if (!shouldRecord(title, variant)) return

  notifications = [
    {
      // Reuse the caller's id (the toast's own id) when provided so the close
      // button's markRead(id) in toaster.tsx can address this exact entry.
      id: input.id ?? crypto.randomUUID(),
      title,
      description,
      variant,
      createdAt: new Date().toISOString(),
      read: false,
      ...(input.action ? { action: input.action } : {})
    },
    ...notifications
  ].slice(0, MAX_NOTIFICATIONS)
  persist()
  emit()
}

export function markRead(id: string): void {
  notifications = notifications.map((n) => (n.id === id ? { ...n, read: true } : n))
  persist()
  emit()
}

export function markAllRead(): void {
  notifications = notifications.map((n) => (n.read ? n : { ...n, read: true }))
  persist()
  emit()
}

export function useNotifications(): { notifications: INotification[]; unreadCount: number } {
  const [state, setState] = React.useState(notifications)
  React.useEffect(() => {
    listeners.push(setState)
    return () => {
      const i = listeners.indexOf(setState)
      if (i > -1) listeners.splice(i, 1)
    }
  }, [])
  return { notifications: state, unreadCount: state.filter((n) => !n.read).length }
}
