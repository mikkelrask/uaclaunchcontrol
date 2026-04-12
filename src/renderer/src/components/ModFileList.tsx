import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { IModFile } from '@shared/schema'
import { Trash, ChevronUp, ChevronDown, Plus } from 'lucide-react'
import { Combobox } from '@/components/ui/combobox'
import { gameService } from '@/lib/gameService'

interface ModFileListProps {
  files: IModFile[]
  onChange: (files: IModFile[]) => void
}

export const ModFileList: React.FC<ModFileListProps> = ({ files, onChange }) => {
  const [catalogFiles, setCatalogFiles] = useState<IModFile[]>([])

  useEffect(() => {
    gameService.getModFileCatalog().then(setCatalogFiles).catch(console.error)
  }, [])

  const selectableFiles = catalogFiles.filter((f) => !f.sidecarOnly)

  const generateUniqueId = (baseId: number): number => {
    const existingIds = new Set(files.map((f) => f.id))
    if (!existingIds.has(baseId)) return baseId
    let newId = Date.now()
    while (existingIds.has(newId)) {
      newId = Date.now() + Math.floor(Math.random() * 1000)
    }
    return newId
  }

  const removeFile = (fileId: number): void => {
    onChange(files.filter((f) => f.id !== fileId))
  }

  const moveUp = (index: number): void => {
    if (index <= 0) return
    const newFiles = [...files]
    ;[newFiles[index - 1], newFiles[index]] = [newFiles[index], newFiles[index - 1]]

    // Update load order
    newFiles.forEach((file, idx) => {
      file.loadOrder = idx
    })

    onChange(newFiles)
  }

  const moveDown = (index: number): void => {
    if (index >= files.length - 1) return
    const newFiles = [...files]
    ;[newFiles[index], newFiles[index + 1]] = [newFiles[index + 1], newFiles[index]]

    // Update load order
    newFiles.forEach((file, idx) => {
      file.loadOrder = idx
    })

    onChange(newFiles)
  }

  return (
    <div className="bg-app-primary p-3 pb-0 rounded h-56 overflow-y-auto">
      {files.length === 0 ? (
        <div className="text-app-primary text-center py-2">No mod files added</div>
      ) : (
        files.map((file, index) => (
          <div key={file.id} className="flex justify-between items-center mb-2 text-sm">
            <div className="flex items-center space-x-1">
              <button
                type="button"
                onClick={() => moveUp(index)}
                disabled={index === 0}
                className="p-1 text-app-primary hover:text-app-primary disabled:opacity-30"
              >
                <ChevronUp className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => moveDown(index)}
                disabled={index === files.length - 1}
                className="p-1 text-app-primary hover:text-app-primary disabled:opacity-30"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
              <span className="text-xs mr-2">{index + 1}.</span>
              <span title={file.filePath}>{(file.name || file.fileName)?.slice(0, 30)}</span>
            </div>
            <button
              type="button"
              onClick={() => removeFile(file.id)}
              className="text-xs bg-app-secondary p-1 rounded hover:bg-app-hover"
            >
              <Trash className="h-3 w-3" />
            </button>
          </div>
        ))
      )}

      <div className="flex mt-3 space-x-2">
        <Combobox
          value=""
          onValueChange={(value) => {
            if (value) {
              const catalogFile = catalogFiles.find((f) => f.id.toString() === value)
              if (catalogFile && catalogFile.filePath) {
                const fileName = catalogFile.fileName || catalogFile.name || ''
                const extension = fileName.split('.').pop()?.toUpperCase() || ''
                let fileType = 'WAD'
                if (extension === 'PK3' || extension === 'IPK3' || extension === 'ZIP') {
                  fileType = 'PK3'
                } else if (extension === 'DEH' || extension === 'BEX') {
                  fileType = 'DEH'
                }

                const newFile: IModFile = {
                  id: generateUniqueId(catalogFile.id),
                  filePath: catalogFile.filePath,
                  fileName,
                  fileType,
                  loadOrder: files.length,
                  isRequired: true,
                  name: catalogFile.name || ''
                }

                let updatedFiles = [...files, newFile]
                const usedIds = new Set(updatedFiles.map((f) => f.id))

                if (catalogFile.requires && Object.keys(catalogFile.requires).length > 0) {
                  for (const [reqHash, offset] of Object.entries(catalogFile.requires)) {
                    const reqFile = catalogFiles.find((f) => f.hashValue === reqHash)
                    if (reqFile) {
                      const reqFileId = generateUniqueId(reqFile.id)
                      if (!usedIds.has(reqFileId)) {
                        usedIds.add(reqFileId)
                        const reqFileName = reqFile.fileName || reqFile.name || ''
                        const reqExt = reqFileName.split('.').pop()?.toUpperCase() || ''
                        let reqFileType = 'WAD'
                        if (reqExt === 'PK3' || reqExt === 'IPK3' || reqExt === 'ZIP') {
                          reqFileType = 'PK3'
                        } else if (reqExt === 'DEH' || reqExt === 'BEX') {
                          reqFileType = 'DEH'
                        }

                        updatedFiles.splice(files.length + offset, 0, {
                          id: reqFileId,
                          filePath: reqFile.filePath || '',
                          fileName: reqFileName,
                          fileType: reqFileType,
                          loadOrder: files.length + offset,
                          isRequired: true,
                          name: reqFile.name || ''
                        })
                      }
                    }
                  }
                }

                updatedFiles = updatedFiles.map((f, i) => ({ ...f, loadOrder: i }))
                onChange(updatedFiles)
              }
            }
          }}
          options={selectableFiles.map((f) => ({
            value: f.id.toString(),
            label: f.name || f.fileName || 'Unnamed'
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
