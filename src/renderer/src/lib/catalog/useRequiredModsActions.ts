import { useCallback } from 'react'
import { api } from '@/api'
import type { IModFile } from '@shared/schema'
import type { RequiredModEntry } from '@/lib/catalog/types'

import { createLogger } from '@shared/logger'

const log = createLogger('catalog/useRequiredModsActions')
export interface RequiredModsActions {
  handleAddFromCatalog: (catalogFileId: number) => void
  handleBrowseFile: () => Promise<void>
  handleRemove: (index: number) => void
  handleMoveUp: (index: number) => void
  handleMoveDown: (index: number) => void
  handleToggleSidecar: (index: number) => void
  handleNameChange: (index: number, name: string) => void
}

interface ToastLike {
  (opts: { title: string; description: string; variant?: 'destructive' }): void
  (opts: { title: string; description: string; duration: number }): void
}

/**
 * Creates a reusable set of handlers for managing a required-mods load order.
 *
 * Instead of duplicating the same handler body for add vs edit forms, this factory
 * accepts the load-order state + setter for one form context and returns all 6 handlers.
 * The CatalogManager calls it twice: once for addForm and once for editForm.
 */
export function useRequiredModsActions(
  loadOrder: RequiredModEntry[],
  setLoadOrder: React.Dispatch<React.SetStateAction<RequiredModEntry[]>>,
  catalogFiles: IModFile[],
  _toast: ToastLike // eslint-disable-line @typescript-eslint/no-unused-vars
): RequiredModsActions {
  const handleAddFromCatalog = useCallback(
    (catalogFileId: number): void => {
      const catalogFile = catalogFiles.find((f) => f.id === catalogFileId)
      if (!catalogFile || !catalogFile.hashValue) return

      const newReq: RequiredModEntry = {
        hash: catalogFile.hashValue,
        name: catalogFile.name || '',
        filePath: catalogFile.filePath || '',
        isNew: false,
        offset: loadOrder.length + 1,
        sidecarOnly: catalogFile.sidecarOnly || false
      }

      setLoadOrder((prev) => [...prev, newReq])
    },
    [catalogFiles, loadOrder.length, setLoadOrder]
  )

  const handleBrowseFile = useCallback(async (): Promise<void> => {
    try {
      const result = await api.showOpenDialog({
        title: 'Select Required Mod File',
        properties: ['openFile'],
        filters: [
          { name: 'DOOM Files', extensions: ['wad', 'pk3', 'pk7', 'ipk3', 'deh', 'bex', 'zip'] }
        ]
      })

      if (!result.canceled && result.filePaths.length > 0) {
        const selectedPath = result.filePaths[0]
        const fileName = selectedPath.split(/[\\/]/).pop() || selectedPath

        const newReq: RequiredModEntry = {
          hash: '',
          name: fileName.replace(/\.[^.]+$/, ''),
          filePath: selectedPath,
          isNew: true,
          offset: loadOrder.length + 1,
          sidecarOnly: false
        }

        setLoadOrder((prev) => [...prev, newReq])
      }
    } catch (error: unknown) {
      log.error('Failed to open file dialog:', error)
    }
  }, [loadOrder.length, setLoadOrder])

  const handleRemove = useCallback(
    (index: number): void => {
      setLoadOrder((prev) => prev.filter((_, i) => i !== index))
    },
    [setLoadOrder]
  )

  const handleMoveUp = useCallback(
    (index: number): void => {
      if (index === 0) return
      setLoadOrder((prev) => {
        const next = [...prev]
        const temp = next[index]
        next[index] = next[index - 1]
        next[index - 1] = temp
        return next
      })
    },
    [setLoadOrder]
  )

  const handleMoveDown = useCallback(
    (index: number): void => {
      setLoadOrder((prev) => {
        if (index >= prev.length - 1) return prev
        const next = [...prev]
        const temp = next[index]
        next[index] = next[index + 1]
        next[index + 1] = temp
        return next
      })
    },
    [setLoadOrder]
  )

  const handleToggleSidecar = useCallback(
    (index: number): void => {
      setLoadOrder((prev) =>
        prev.map((r, i) => (i === index ? { ...r, sidecarOnly: !r.sidecarOnly } : r))
      )
    },
    [setLoadOrder]
  )

  const handleNameChange = useCallback(
    (index: number, name: string): void => {
      setLoadOrder((prev) => prev.map((r, i) => (i === index ? { ...r, name } : r)))
    },
    [setLoadOrder]
  )

  return {
    handleAddFromCatalog,
    handleBrowseFile,
    handleRemove,
    handleMoveUp,
    handleMoveDown,
    handleToggleSidecar,
    handleNameChange
  }
}
