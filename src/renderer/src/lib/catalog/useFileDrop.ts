import { useState, useCallback } from 'react'

export interface FileDropHandlers {
  isDraggingFile: boolean
  handleFileDragOver: (e: React.DragEvent) => void
  handleFileDragLeave: (e: React.DragEvent) => void
  handleFileDrop: (e: React.DragEvent) => Promise<void>
  /** Set both drag state and extract the first dropped file path. Returns null if no file. */
  processDrop: (e: React.DragEvent) => string | null
  setIsDraggingFile: React.Dispatch<React.SetStateAction<boolean>>
}

/**
 * Hook for handling file drag-and-drop onto the catalog area.
 * Tracks drag-over state and extracts the dropped file's path.
 */
export function useFileDrop(): FileDropHandlers {
  const [isDraggingFile, setIsDraggingFile] = useState(false)

  const handleFileDragOver = useCallback((e: React.DragEvent): void => {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingFile(true)
  }, [])

  const handleFileDragLeave = useCallback((e: React.DragEvent): void => {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingFile(false)
  }, [])

  const handleFileDrop = useCallback(async (e: React.DragEvent): Promise<void> => {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingFile(false)
  }, [])

  const processDrop = useCallback((e: React.DragEvent): string | null => {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingFile(false)

    const droppedFiles = e.dataTransfer.files
    if (droppedFiles.length === 0) return null

    const file = droppedFiles[0]
    return window.api.getPathForFile(file) || file.name
  }, [])

  return {
    isDraggingFile,
    handleFileDragOver,
    handleFileDragLeave,
    handleFileDrop,
    processDrop,
    setIsDraggingFile
  }
}
