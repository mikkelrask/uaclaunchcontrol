import React from 'react'
import type { IModFile } from '@shared/schema'

interface LaunchSequenceListProps {
  files: IModFile[]
  draggedIndex: number | null
  insertionIndex: number | null
  handleDragStart: (e: React.DragEvent, index: number) => void
  handleDragOver: (e: React.DragEvent<HTMLElement>) => void
  handleDrop: (e: React.DragEvent) => void
  handleDragEnd: () => void
}

/**
 * A reorderable list of mod files showing the launch sequence order.
 * Supports native drag-and-drop reordering with visual placeholders.
 */
export const LaunchSequenceList: React.FC<LaunchSequenceListProps> = ({
  files,
  draggedIndex,
  insertionIndex,
  handleDragStart,
  handleDragOver,
  handleDrop,
  handleDragEnd
}) => {
  if (files.length === 0) return null

  return (
    <div className="mb-4 border border-app rounded-md p-2">
      <h4 className="text-xs mb-3 text-app-muted font-bold tracking-widest uppercase">
        Launch sequence
      </h4>
      <ul className="space-y-2" onDragOver={handleDragOver} onDrop={handleDrop}>
        {files.map((file, index): React.ReactNode => {
          const isDragged = draggedIndex === index
          const showPlaceholderBefore = insertionIndex === index && draggedIndex !== index

          return (
            <React.Fragment key={`${file.id}-${index}`}>
              {showPlaceholderBefore && (
                <li className="h-12 border-2 border-dashed border-accent-highlight/30 rounded-md flex items-center justify-center bg-accent-highlight/5 animate-in fade-in zoom-in-95 duration-200">
                  <span className="text-accent-highlight text-sm tracking-widest uppercase opacity-60">
                    drop here
                  </span>
                </li>
              )}

              <li
                draggable
                data-drag-index={index}
                onDragStart={(e) => handleDragStart(e, index)}
                onDragEnd={handleDragEnd}
                className={`flex items-center justify-between bg-app-primary p-2 rounded cursor-grab active:cursor-grabbing transition-all duration-150 border select-none ${
                  isDragged ? 'hidden' : 'border-transparent hover:border-accent-highlight/30 group'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="text-app-muted text-xs font-semibold font-mono w-4">
                    {index + 1}
                  </div>
                  <div className="flex flex-col">
                    <span className={`text-sm font-medium ${!file.filePath ? 'text-red-400' : ''}`}>
                      {file.name || file.fileName}
                      {!file.filePath && (
                        <span className="ml-2 text-xs bg-red-900/50 text-red-300 px-1.5 py-0.5 rounded">
                          missing
                        </span>
                      )}
                    </span>
                    <span className="text-xs text-app-muted">({file.fileType})</span>
                  </div>
                </div>
              </li>
            </React.Fragment>
          )
        })}

        {/* Final placeholder if dragging to end */}
        {insertionIndex === files.length && draggedIndex !== files.length - 1 && (
          <li className="h-12 border-2 border-dashed border-accent-highlight/30 rounded-md flex items-center justify-center bg-accent-highlight/5 animate-in fade-in zoom-in-95 duration-200">
            <span className="text-sm text-accent-highlight tracking-widest uppercase opacity-60">
              new placement
            </span>
          </li>
        )}
      </ul>
    </div>
  )
}
