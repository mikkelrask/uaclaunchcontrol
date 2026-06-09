import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Plus, FolderOpen } from 'lucide-react'
import type { IModFile } from '@shared/schema'
import type { AddFormState } from '@/lib/catalog/types'
import type { RequiredModsActions } from '@/lib/catalog/useRequiredModsActions'
import { RequiredModsEditor } from '@/components/catalog/RequiredModsEditor'

interface AddFileDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  form: AddFormState
  setForm: React.Dispatch<React.SetStateAction<AddFormState>>
  selectableFiles: IModFile[]
  requiredModsActions: RequiredModsActions
  onAddFile: () => Promise<void>
  onBrowseFile: () => Promise<void>
  onCancel: () => void
}

export function AddFileDialog({
  open,
  onOpenChange,
  form,
  setForm,
  selectableFiles,
  requiredModsActions,
  onAddFile,
  onBrowseFile,
  onCancel
}: AddFileDialogProps): React.ReactElement {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-app-primary shadow-2xl border-app max-w-md max-h-[80vh] flex flex-col p-0 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-app bg-app-secondary">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-accent-highlight/10 rounded-md">
              <Plus className="w-5 h-5 text-accent-highlight" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold tracking-tight text-app-primary lowercase">
                add_mod_file
              </DialogTitle>
              <DialogDescription className="text-xs font-semibold font-mono text-app-muted uppercase tracking-widest opacity-80">
                UAC Launch Control // Catalog Management
              </DialogDescription>
            </div>
          </div>
        </div>

        <div className="space-y-4 p-4 overflow-y-auto">
          <div className="space-y-2">
            <Label htmlFor="add-file-select">Select File</Label>
            <div className="flex gap-2">
              <Input
                id="add-file-select"
                value={form.filePath}
                onChange={(e) => setForm((prev) => ({ ...prev, filePath: e.target.value }))}
                placeholder="Path to mod file"
                className="bg-app-secondary border-app flex-1"
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

          <div className="space-y-2">
            <Label htmlFor="add-name">Name</Label>
            <Input
              id="add-name"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Pretty name for the mod"
              className="bg-app-secondary border-app"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="add-version">Version</Label>
            <Input
              id="add-version"
              value={form.version}
              onChange={(e) => setForm((prev) => ({ ...prev, version: e.target.value }))}
              placeholder="e.g., 1.0, v2.1"
              className="bg-app-secondary border-app"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="add-url">URL (ModDB, forum)</Label>
            <Input
              id="add-url"
              value={form.url}
              onChange={(e) => setForm((prev) => ({ ...prev, url: e.target.value }))}
              placeholder="https://www.moddb.com/mods/..."
              className="bg-app-secondary border-app"
            />
          </div>

          <RequiredModsEditor
            loadOrder={form.loadOrder}
            selectableFiles={selectableFiles}
            onAddFromCatalog={requiredModsActions.handleAddFromCatalog}
            onBrowseFile={requiredModsActions.handleBrowseFile}
            onRemove={requiredModsActions.handleRemove}
            onMoveUp={requiredModsActions.handleMoveUp}
            onMoveDown={requiredModsActions.handleMoveDown}
            onToggleSidecar={requiredModsActions.handleToggleSidecar}
            onNameChange={requiredModsActions.handleNameChange}
          />

          <div className="flex items-center gap-2">
            <Checkbox
              id="add-sidecar"
              checked={form.sidecarOnly}
              onCheckedChange={(checked) =>
                setForm((prev) => ({ ...prev, sidecarOnly: checked === true }))
              }
            />
            <Label htmlFor="add-sidecar" className="text-sm font-normal">
              Sidecar mod (Check if this mod doesn&apos;t work without other mod files)
            </Label>
          </div>
        </div>

        <DialogFooter className="bg-app-secondary border-t border-app p-4 shrink-0">
          <Button
            variant="outline"
            onClick={onCancel}
            className="bg-app-secondary"
          >
            Cancel
          </Button>
          <Button
            onClick={onAddFile}
            disabled={!form.filePath.trim()}
            className="bg-accent-highlight"
          >
            <Plus className="h-4 w-4 mr-1" />
            Add to Catalog
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default AddFileDialog
