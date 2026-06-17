import React from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Combobox } from '@/components/ui/combobox'
import { Label } from '@/components/ui/label'
import { ChevronUp, ChevronDown, FolderOpen, Trash2 } from 'lucide-react'
import type { IModFile } from '@shared/schema'
import type { RequiredModEntry } from '@/lib/catalog/types'

export interface RequiredModsEditorProps {
  /** The load order entries for this dialog */
  loadOrder: RequiredModEntry[]
  /** Files available to pick from the catalog (filtered: not sidecar-only + has hash) */
  selectableFiles: IModFile[]
  /** Called when user picks a file from the catalog combobox */
  onAddFromCatalog: (catalogFileId: number) => void
  /** Called when user browses filesystem */
  onBrowseFile: () => void
  /** Remove a required mod by index */
  onRemove: (index: number) => void
  /** Move a required mod up by index */
  onMoveUp: (index: number) => void
  /** Move a required mod down by index */
  onMoveDown: (index: number) => void
  /** Toggle sidecar-only flag for a required mod */
  onToggleSidecar: (index: number) => void
  /** Rename a required mod */
  onNameChange: (index: number, name: string) => void
}

/**
 * A reusable UI section for managing a list of required mods (load order).
 * Used inside both the Add File and Edit File dialogs.
 *
 * Shows each required mod as a row with ordering controls, name input,
 * sidecar toggle, and delete button. At the bottom there's a combobox
 * to add from the existing catalog and a browse button for new files.
 */
export const RequiredModsEditor: React.FC<RequiredModsEditorProps> = ({
  loadOrder,
  selectableFiles,
  onAddFromCatalog,
  onBrowseFile,
  onRemove,
  onMoveUp,
  onMoveDown,
  onToggleSidecar,
  onNameChange
}) => {
  return (
    <div className="space-y-2">
      <Label>Load Order</Label>
      <div className="space-y-2">
        {loadOrder.length > 1 &&
          loadOrder.map((req, idx) => (
            <div key={idx} className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onMoveUp(idx)}
                disabled={idx === 0}
                className="text-app-primary hover:text-app-primary disabled:opacity-30 p-1"
              >
                <ChevronUp className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onMoveDown(idx)}
                disabled={idx >= loadOrder.length - 1}
                className="text-app-primary hover:text-app-primary disabled:opacity-30 p-1"
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
              <span className="text-xs mr-2 w-6 text-center">{idx + 1}.</span>
              <Input
                value={req.name}
                onChange={(e) => onNameChange(idx, e.target.value)}
                disabled={req.isMain}
                className={`bg-app-secondary border-app flex-1 ${req.isMain ? 'opacity-70 italic' : ''}`}
              />
              <Checkbox
                checked={req.sidecarOnly}
                onCheckedChange={() => onToggleSidecar(idx)}
                disabled={req.isMain}
                title="Sidecar only"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRemove(idx)}
                disabled={req.isMain}
                className={`text-red-500 hover:text-red-700 ${req.isMain ? 'opacity-30' : ''}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        <div className="flex gap-2">
          <Combobox
            value=""
            onValueChange={(value) => {
              const fileId = parseInt(value, 10)
              if (fileId) onAddFromCatalog(fileId)
            }}
            options={selectableFiles.map((f) => ({
              value: f.id.toString(),
              label: f.name || 'Unnamed'
            }))}
            placeholder="Add from catalog..."
            className="bg-app-secondary border-app flex-1"
            disabled={selectableFiles.length === 0}
          />
          <Button
            type="button"
            variant="outline"
            onClick={onBrowseFile}
            className="bg-app-secondary border-app"
          >
            <FolderOpen className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
