import React, { Fragment, useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { IModFile, InsertModFile } from '@shared/schema'
import { Trash, GripVertical, Plus, ExternalLink } from 'lucide-react'
import { Combobox } from '@/components/ui/combobox'
import { api } from '@/api'
import { useFileReorder } from '@/hooks/useFileReorder'
import { useToast } from '@/hooks/use-toast'

interface ModFileListProps {
  files: IModFile[] | InsertModFile[]
  onChange: (files: IModFile[] | InsertModFile[]) => void
}

export const ModFileList: React.FC<ModFileListProps> = ({ files, onChange }) => {
  const [catalogFiles, setCatalogFiles] = useState<IModFile[]>([])
  const { toast } = useToast()
  const {
    draggedIndex,
    insertionIndex,
    handleDragStart,
    handleDragOver,
    handleDrop,
    handleDragEnd
  } = useFileReorder(files, onChange)

  useEffect(() => {
    api
      .getModFileCatalog()
      .then(setCatalogFiles)
      .catch((err: unknown) => console.error(err))
  }, [])

  const selectableFiles = catalogFiles.filter((f) => !f.sidecarOnly)

  // Files without a hash (e.g. manually browsed with no computed hash yet)
  // still need a stable React key — mint one only in that case, never as a
  // way to dodge a real duplicate.
  const generateFallbackId = (): string => `${Date.now()}-${Math.floor(Math.random() * 1000)}`

  const removeFile = (fileHash: string): void => {
    onChange(files.filter((f) => f.hashValue !== fileHash))
  }

  return (
    <div
      className="bg-app-primary p-3 pb-0 rounded h-56 overflow-y-auto"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {files.length === 0 ? (
        <div className="text-app-primary text-center py-2">No mod files added</div>
      ) : (
        files.map((file, index) => {
          const isDragged = draggedIndex === index
          const showPlaceholderBefore = insertionIndex === index && draggedIndex !== index

          return (
            <Fragment key={file.hashValue}>
              {showPlaceholderBefore && (
                <div className="h-8 mb-2 border-2 border-dashed border-accent-highlight/30 rounded-md flex items-center justify-center bg-accent-highlight/5 animate-in fade-in zoom-in-95 duration-200">
                  <span className="text-accent-highlight text-[10px] tracking-widest uppercase opacity-60">
                    drop here
                  </span>
                </div>
              )}

              <div
                data-drag-index={index}
                className={`flex justify-between items-center mb-2 text-sm p-2 rounded bg-app-secondary border transition-all duration-150 select-none ${
                  isDragged ? 'hidden' : 'border-transparent hover:border-accent-highlight/30 group'
                }`}
              >
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    draggable
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragEnd={handleDragEnd}
                    className="shrink-0 cursor-grab active:cursor-grabbing text-app-muted opacity-40 group-hover:opacity-100 transition-opacity"
                    tabIndex={-1}
                    aria-label="Reorder"
                  >
                    <GripVertical className="h-4 w-4" />
                  </button>
                  <span className="text-xs text-app-muted font-mono w-4 text-center shrink-0">
                    {index + 1}
                  </span>
                  <span title={file.filePath}>
                    {(file.name || file.fileName)?.slice(0, 30)}
                    {file.version && ` (${file.version})`}
                  </span>
                  {!file.filePath && (
                    <span className="text-xs bg-red-900/50 text-red-300 px-1.5 py-0.5 rounded">
                      missing
                    </span>
                  )}
                  {file.url && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        window.open(file.url, '_blank')
                      }}
                      className="p-1 h-6 w-6 shrink-0 text-app-muted hover:text-app-primary opacity-40 group-hover:opacity-100 transition-opacity"
                      title={file.url}
                    >
                      <ExternalLink className="h-3 w-3" />
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => removeFile(file.hashValue || '')}
                  className="text-xs bg-app-primary p-1 rounded hover:bg-app-hover opacity-40 group-hover:opacity-100 transition-opacity"
                >
                  <Trash className="h-3 w-3" />
                </button>
              </div>
            </Fragment>
          )
        })
      )}

      {insertionIndex === files.length && draggedIndex !== files.length - 1 && (
        <div className="h-8 mb-2 border-2 border-dashed border-accent-highlight/30 rounded-md flex items-center justify-center bg-accent-highlight/5 animate-in fade-in zoom-in-95 duration-200">
          <span className="text-accent-highlight text-[10px] tracking-widest uppercase opacity-60">
            new placement
          </span>
        </div>
      )}

      <div className="flex mt-3 space-x-2">
        <Combobox
          value=""
          onValueChange={(value) => {
            if (value) {
              const catalogFile = catalogFiles.find((f) => f.id?.toString() === value)
              if (catalogFile && catalogFile.filePath) {
                const updatedFiles = [...files]
                const usedHashes = new Set(
                  updatedFiles.map((f) => f.hashValue).filter((h): h is string => !!h)
                )
                let skippedDupes = false

                if (catalogFile.loadOrder && Object.keys(catalogFile.loadOrder).length > 0) {
                  const entries = Object.entries(catalogFile.loadOrder).sort((a, b) => a[1] - b[1])
                  for (const [hash] of entries) {
                    const reqFile = catalogFiles.find((f) => f.hashValue === hash)
                    if (reqFile) {
                      if (reqFile.hashValue && usedHashes.has(reqFile.hashValue)) {
                        skippedDupes = true
                        continue
                      }
                      if (reqFile.hashValue) usedHashes.add(reqFile.hashValue)
                      const reqFileName = reqFile.fileName || reqFile.name || ''
                      const reqExt = reqFileName.split('.').pop()?.toUpperCase() || ''
                      let reqFileType = 'WAD'
                      if (reqExt === 'PK3' || reqExt === 'IPK3' || reqExt === 'ZIP') {
                        reqFileType = 'PK3'
                      } else if (reqExt === 'DEH' || reqExt === 'BEX') {
                        reqFileType = 'DEH'
                      }

                      updatedFiles.push({
                        filePath: reqFile.filePath || '',
                        fileName: reqFileName,
                        fileType: reqFileType,
                        isRequired: true,
                        name: reqFile.name || '',
                        hashValue: reqFile.hashValue || generateFallbackId(),
                        url: reqFile.url || ''
                      } as InsertModFile)
                    }
                  }
                } else if (catalogFile.hashValue && usedHashes.has(catalogFile.hashValue)) {
                  skippedDupes = true
                } else {
                  const fileName = catalogFile.fileName || catalogFile.name || ''
                  const extension = fileName.split('.').pop()?.toUpperCase() || ''
                  let fileType = 'WAD'
                  if (extension === 'PK3' || extension === 'IPK3' || extension === 'ZIP') {
                    fileType = 'PK3'
                  } else if (extension === 'DEH' || extension === 'BEX') {
                    fileType = 'DEH'
                  }

                  updatedFiles.push({
                    filePath: catalogFile.filePath,
                    fileName,
                    fileType,
                    isRequired: true,
                    name: catalogFile.name || '',
                    hashValue: catalogFile.hashValue || generateFallbackId(),
                    url: catalogFile.url || ''
                  } as InsertModFile)
                }

                if (skippedDupes) {
                  toast({
                    title: 'SYSTEM: dupe_skipped',
                    description:
                      updatedFiles.length === files.length
                        ? 'That file is already in this protocol.'
                        : 'Skipped one or more files already in this protocol.',
                    variant: 'default'
                  })
                }

                onChange(updatedFiles)
              }
            }
          }}
          options={selectableFiles.map((f) => ({
            value: f.id?.toString() || '',
            label: (f.name || f.fileName || 'Unnamed') + (f.version ? ` (${f.version})` : '')
          }))}
          placeholder="Select from catalog..."
          className="flex-1 bg-app-secondary border-app text-xs"
          disabled={selectableFiles.length === 0}
        />
        <Button
          type="button"
          onClick={() => {}}
          size="sm"
          variant="outline"
          className="bg-app-secondary border-app"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

export default ModFileList
