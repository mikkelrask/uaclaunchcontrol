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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Pencil, Check, FolderOpen, X } from 'lucide-react'
import type { IModFile } from '@shared/schema'
import type { EditFormState } from '@/lib/catalog/types'
import { CATEGORIES } from '@shared/categories'
import type { RequiredModsActions } from '@/lib/catalog/useRequiredModsActions'
import { RequiredModsEditor } from '@/components/catalog/RequiredModsEditor'

interface EditFileDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  form: EditFormState
  setForm: React.Dispatch<React.SetStateAction<EditFormState>>
  selectedFile: IModFile | null
  selectableFiles: IModFile[]
  requiredModsActions: RequiredModsActions
  onSaveEdit: () => Promise<void>
  onBrowseConfigFile?: () => Promise<void>
  onClearConfigFile?: () => void
}

export function EditFileDialog({
  open,
  onOpenChange,
  form,
  setForm,
  selectedFile,
  selectableFiles,
  requiredModsActions,
  onSaveEdit,
  onBrowseConfigFile,
  onClearConfigFile
}: EditFileDialogProps): React.ReactElement {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-app-primary shadow-2xl border-app max-w-md max-h-[80vh] flex flex-col p-0 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-app bg-app-secondary">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-accent-highlight/10 rounded-md">
              <Pencil className="w-5 h-5 text-accent-highlight" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold tracking-tight text-app-primary lowercase">
                edit_mod_file
              </DialogTitle>
              <DialogDescription className="text-xs font-semibold font-mono text-app-muted uppercase tracking-widest opacity-80">
                UAC Launch Control // Catalog Management
              </DialogDescription>
            </div>
          </div>
        </div>

        <div className="space-y-4 p-4 overflow-y-auto">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Name</Label>
            <Input
              id="edit-name"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              className="bg-app-secondary border-app"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-version">Version</Label>
            <Input
              id="edit-version"
              value={form.version}
              onChange={(e) => setForm((prev) => ({ ...prev, version: e.target.value }))}
              className="bg-app-secondary border-app"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-url">URL</Label>
            <Input
              id="edit-url"
              value={form.url}
              onChange={(e) => setForm((prev) => ({ ...prev, url: e.target.value }))}
              className="bg-app-secondary border-app"
            />
          </div>

          <div className="space-y-2">
            <Label>Category</Label>
            <Select
              value={form.category}
              onValueChange={(val) => setForm((prev) => ({ ...prev, category: val }))}
            >
              <SelectTrigger className="bg-app-secondary border-app">
                <SelectValue placeholder="Uncategorized" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Config Template Section */}
          <div className="space-y-2">
            <Label>Config Template (optional)</Label>
            <p className="text-xs text-app-muted">
              This config will seed new protocols that include this mod file.
            </p>
            <div className="flex gap-2">
              <Input
                value={form.configTemplate?.filePath || ''}
                readOnly
                placeholder="No config linked"
                className="bg-app-secondary border-app flex-1 text-xs"
              />
              {form.configTemplate ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClearConfigFile}
                  className="bg-app-secondary border-app"
                  title="Remove config template"
                >
                  <X className="h-4 w-4" />
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                onClick={onBrowseConfigFile}
                className="bg-app-secondary border-app"
              >
                <FolderOpen className="h-4 w-4" />
              </Button>
            </div>
            {form.configTemplate ? (
              <p className="text-xs text-green-500 font-mono">
                MD5: {form.configTemplate.md5Hash.slice(0, 16)}...
              </p>
            ) : null}
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
              id="edit-sidecar"
              checked={form.sidecarOnly}
              onCheckedChange={(checked) =>
                setForm((prev) => ({ ...prev, sidecarOnly: checked === true }))
              }
            />
            <Label htmlFor="edit-sidecar" className="text-sm font-normal">
              Sidecar only
            </Label>
          </div>

          {selectedFile?.hashValue && (
            <div className="text-xs text-app-muted">
              <span className="font-semibold">Hash:</span> {selectedFile.hashValue}
            </div>
          )}
        </div>

        <DialogFooter className="bg-app-secondary border-t border-app p-4 shrink-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="bg-app-secondary"
          >
            Cancel
          </Button>
          <Button onClick={onSaveEdit} className="bg-accent-highlight">
            <Check className="h-4 w-4 mr-1" />
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default EditFileDialog
