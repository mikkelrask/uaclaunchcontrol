import { useCallback, useEffect, useRef, useState } from 'react'
import type { ModDownloadEvent } from '@shared/modDownload'

const TERMINAL_DISMISS_MS = 4000

interface UseModDownloadsReturn {
  /** Latest event per active download id. */
  downloads: Record<string, ModDownloadEvent>
  /** File names captured from `started` events — progress events don't carry them. */
  fileNames: Record<string, string>
  cancel: (id: string) => void
  dismiss: (id: string) => void
}

export type { UseModDownloadsReturn }

/**
 * Tracks in-app mod downloads (main-process `mod-download-status` events).
 * Events merge by id; terminal states (completed/cancelled/error) auto-dismiss
 * after 4s unless dismissed earlier.
 */
export function useModDownloads(): UseModDownloadsReturn {
  const [downloads, setDownloads] = useState<Record<string, ModDownloadEvent>>({})
  const [fileNames, setFileNames] = useState<Record<string, string>>({})
  const dismissTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  useEffect(() => {
    const timers = dismissTimers.current

    window.api.onModDownloadStatus((event) => {
      setDownloads((prev) => ({ ...prev, [event.id]: event }))
      if (event.state === 'started') {
        setFileNames((prev) => ({ ...prev, [event.id]: event.fileName }))
      }

      if (event.state === 'completed' || event.state === 'cancelled' || event.state === 'error') {
        clearTimeout(dismissTimers.current.get(event.id))
        dismissTimers.current.set(
          event.id,
          setTimeout(() => {
            dismissTimers.current.delete(event.id)
            setDownloads((prev) => {
              if (!(event.id in prev)) return prev
              const next = { ...prev }
              delete next[event.id]
              return next
            })
            setFileNames((prev) => {
              if (!(event.id in prev)) return prev
              const next = { ...prev }
              delete next[event.id]
              return next
            })
          }, TERMINAL_DISMISS_MS)
        )
      }
    })

    return () => {
      for (const timer of timers.values()) clearTimeout(timer)
      timers.clear()
    }
  }, [])

  const cancel = useCallback((id: string) => {
    void window.api.cancelModDownload(id)
  }, [])

  const dismiss = useCallback((id: string) => {
    const timer = dismissTimers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      dismissTimers.current.delete(id)
    }
    setDownloads((prev) => {
      if (!(id in prev)) return prev
      const next = { ...prev }
      delete next[id]
      return next
    })
    setFileNames((prev) => {
      if (!(id in prev)) return prev
      const next = { ...prev }
      delete next[id]
      return next
    })
  }, [])

  return { downloads, fileNames, cancel, dismiss }
}
