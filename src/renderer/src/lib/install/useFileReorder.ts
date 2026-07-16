import { useState, useCallback } from 'react'
import type { IModFile } from '@shared/schema'

export interface FileReorderHandlers {
  draggedIndex: number | null
  insertionIndex: number | null
  handleDragStart: (e: React.DragEvent, index: number) => void
  handleDragOver: (e: React.DragEvent<HTMLElement>) => void
  handleDrop: (e: React.DragEvent) => void
  handleDragEnd: () => void
}

/**
 * Hook for native drag-to-reorder of mod files in the install page.
 *
 * Distinguishes internal reorder events (text/plain + application/x-uac-reorder)
 * from external file drops so they don't interfere with JSON/WAD import handlers.
 */
export function useFileReorder(
  files: IModFile[],
  setFiles: React.Dispatch<React.SetStateAction<IModFile[]>>
): FileReorderHandlers {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [insertionIndex, setInsertionIndex] = useState<number | null>(null)

  const handleDragStart = useCallback((e: React.DragEvent, index: number): void => {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', index.toString())
    e.dataTransfer.setData('application/x-uac-reorder', 'true')

    // Wait a tick before hiding the source element so the browser
    // captures the original element's style for the drag ghost.
    setTimeout(() => {
      setDraggedIndex(index)
    }, 0)
  }, [])

  const handleDragOver = useCallback(
    (e: React.DragEvent<HTMLElement>): void => {
      // Skip if this is an external file drop — let it bubble to JSON handler
      if (e.dataTransfer.types.includes('Files') && !e.dataTransfer.getData('text/plain')) {
        return
      }

      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'

      const listElement = e.currentTarget

      // Get all items to calculate where we are
      const itemElements = Array.from(listElement.querySelectorAll('[data-drag-index]'))
      if (itemElements.length === 0) {
        setInsertionIndex(0)
        return
      }

      let foundIndex = files.length
      for (let i = 0; i < itemElements.length; i++) {
        const itemRect = itemElements[i].getBoundingClientRect()
        const itemMid = itemRect.top + itemRect.height / 2
        if (e.clientY < itemMid) {
          foundIndex = i
          break
        }
      }

      setInsertionIndex((prev) => (prev !== foundIndex ? foundIndex : prev))
    },
    [files.length]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent): void => {
      // Skip if this is an external file drop — let it bubble to JSON handler
      if (e.dataTransfer.types.includes('Files') && !e.dataTransfer.getData('text/plain')) {
        return
      }

      e.preventDefault()

      setDraggedIndex((currentDragged) => {
        setInsertionIndex((currentInsertion) => {
          if (currentDragged === null || currentInsertion === null) {
            // Reset and bail
            setDraggedIndex(null)
            setInsertionIndex(null)
            return null
          }

          const newFiles = [...files]
          const [draggedItem] = newFiles.splice(currentDragged, 1)

          // If inserting after the original position, the index shifts by -1 after splice
          const target = currentInsertion > currentDragged ? currentInsertion - 1 : currentInsertion
          newFiles.splice(target, 0, draggedItem)

          setFiles(newFiles)

          // Reset both indices
          setDraggedIndex(null)
          return null
        })
        return null
      })
    },
    [files, setFiles]
  )

  const handleDragEnd = useCallback((): void => {
    setDraggedIndex(null)
    setInsertionIndex(null)
  }, [])

  return {
    draggedIndex,
    insertionIndex,
    handleDragStart,
    handleDragOver,
    handleDrop,
    handleDragEnd
  }
}
