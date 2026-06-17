import React from 'react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Upload } from 'lucide-react'
import type { WadImportHandlers } from '@/lib/install/useWadImport'

interface WadImportTabProps {
  wadImport: WadImportHandlers
  wadFilesDirectory?: string
}

/**
 * The "WAD Files" tab content — drag-and-drop zone, import preview with MD5-renamed filename,
 * and confirmation button.
 */
export const WadImportTab: React.FC<WadImportTabProps> = ({
  wadImport: {
    selectedWad,
    isWadDragging,
    isPreparingWad,
    handleBrowseWad,
    handleWadDrop,
    handleWadDragOver,
    handleWadDragLeave,
    importWadMutation,
    clearSelection
  },
  wadFilesDirectory
}) => {
  return (
    <div className="space-y-6">
      <div
        className={`border-2 border-dashed rounded-lg p-8 cursor-pointer transition-all duration-200 ${
          isWadDragging
            ? 'border-accent-highlight bg-accent-highlight/10'
            : 'border-app hover:border-accent-highlight/50 hover:bg-app-primary/50'
        }`}
        onClick={handleBrowseWad}
        onDrop={handleWadDrop}
        onDragOver={handleWadDragOver}
        onDragLeave={handleWadDragLeave}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            void handleBrowseWad()
          }
        }}
      >
        <div className="flex items-center justify-center gap-2 text-app-muted">
          <Upload className="h-5 w-5" />
          <span className="text-sm">
            {isPreparingWad ? 'Scanning WAD...' : 'Drag/drop WAD here, or click to select'}
          </span>
        </div>
      </div>

      <div className="rounded-md border border-app bg-app-primary p-4 space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h4 className="text-xs uppercase tracking-widest text-app-muted font-mono font-bold">
              Target Repository
            </h4>
            <p className="text-sm text-app-secondary break-all mt-1">
              {wadFilesDirectory || '~/.config/uac/wads'}
            </p>
          </div>
        </div>

        {selectedWad ? (
          <>
            <Separator />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="block text-xs uppercase tracking-widest text-app-muted font-mono font-bold mb-1">
                  Source File
                </span>
                <span className="text-app-primary break-all">{selectedWad.fileName}</span>
              </div>
              <div>
                <span className="block text-xs uppercase tracking-widest text-app-muted font-mono font-bold mb-1">
                  Stored As
                </span>
                <span className="text-app-primary break-all">{selectedWad.targetFileName}</span>
              </div>
              <div className="md:col-span-2">
                <span className="block text-xs uppercase tracking-widest text-app-muted font-mono font-bold mb-1">
                  MD5
                </span>
                <code className="text-xs text-app-muted break-all">{selectedWad.hashValue}</code>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                className="bg-transparent border-app"
                onClick={clearSelection}
                disabled={importWadMutation.isPending}
              >
                Clear
              </Button>
              <Button
                type="button"
                className="bg-accent-highlight hover:opacity-90"
                onClick={() => {
                  if (selectedWad) {
                    importWadMutation.mutate(selectedWad.sourcePath)
                  }
                }}
                disabled={importWadMutation.isPending}
              >
                {importWadMutation.isPending ? 'Importing...' : 'Confirm Import'}
              </Button>
            </div>
          </>
        ) : (
          <p className="text-sm text-app-muted">
            Select a .wad file to review the MD5-based filename before importing.
          </p>
        )}
      </div>
    </div>
  )
}
