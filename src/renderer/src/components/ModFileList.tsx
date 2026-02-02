import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { IModFile } from '@shared/schema'
import { Trash, Plus, ChevronUp, ChevronDown } from 'lucide-react'

interface ModFileListProps {
  files: IModFile[]
  onChange: (files: IModFile[]) => void
}

export const ModFileList: React.FC<ModFileListProps> = ({ files, onChange }) => {
  const [newFilePath, setNewFilePath] = useState('')

  const addFile = () => {
    if (!newFilePath.trim()) return

    const fileName = newFilePath.split(/[\\/]/).pop() || newFilePath
    const extension = fileName.split('.').pop()?.toUpperCase() || ''
    let fileType = 'WAD'

    if (extension === 'PK3' || extension === 'IPK3' || extension === 'ZIP') {
      fileType = 'PK3'
    } else if (extension === 'DEH' || extension === 'BEX') {
      fileType = 'DEH'
    } else if (extension === 'WAD') {
      fileType = 'WAD'
    } else {
      fileType = extension || 'unknown'
    }

    const newFile: IModFile = {
      id: -Math.random(), // Temporary negative ID for new files
      modId: String(files[0]?.modId || 0),
      filePath: newFilePath,
      fileName,
      fileType,
      loadOrder: files.length,
      isRequired: true
    }

    onChange([...files, newFile])
    setNewFilePath('')
  }

  const removeFile = (fileId: number) => {
    onChange(files.filter((f) => f.id !== fileId))
  }

  const moveUp = (index: number) => {
    if (index <= 0) return
    const newFiles = [...files]
      ;[newFiles[index - 1], newFiles[index]] = [newFiles[index], newFiles[index - 1]]

    // Update load order
    newFiles.forEach((file, idx) => {
      file.loadOrder = idx
    })

    onChange(newFiles)
  }

  const moveDown = (index: number) => {
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
    <div className="bg-[#0c1c2a] p-3 rounded h-40 overflow-y-auto">
      {files.length === 0 ? (
        <div className="text-[#e6e6e6] text-center py-2">No mod files added</div>
      ) : (
        files.map((file, index) => (
          <div key={file.id} className="flex justify-between items-center mb-2 text-sm">
            <div className="flex items-center space-x-1">
              <button
                type="button"
                onClick={() => moveUp(index)}
                disabled={index === 0}
                className="p-1 text-[#e6e6e6] hover:text-white disabled:opacity-30"
              >
                <ChevronUp className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => moveDown(index)}
                disabled={index === files.length - 1}
                className="p-1 text-[#e6e6e6] hover:text-white disabled:opacity-30"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
              <span className="text-xs mr-2">{index + 1}.</span>
              <span title={file.filePath}>{file.fileName}</span>
            </div>
            <button
              type="button"
              onClick={() => removeFile(file.id)}
              className="text-xs bg-[#162b3d] p-1 rounded hover:bg-[#0c1c2a]"
            >
              <Trash className="h-3 w-3" />
            </button>
          </div>
        ))
      )}

      <div className="flex mt-3 space-x-2">
        <Input
          value={newFilePath}
          onChange={(e) => setNewFilePath(e.target.value)}
          placeholder="Path to mod file (.wad, .pk3, etc.)"
          className="text-xs bg-[#162b3d] border-[#262626]"
        />
        <Button
          type="button"
          onClick={addFile}
          size="sm"
          variant="outline"
          className="bg-[#162b3d] border-[#262626]"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

export default ModFileList
