import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog'
import { Pencil, Check } from 'lucide-react'
import type { IModFile } from '@shared/schema'
import type { EditFormState } from '@/lib/catalog/types'
import type { RequiredModsActions } from '@/lib/catalog/useRequiredModsActions'
import { ModFileFormFields } from '@/components/catalog/ModFileFormFields'

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
          <ModFileFormFields
            idPrefix="edit"
            form={form}
            setForm={setForm}
            selectableFiles={selectableFiles}
            requiredModsActions={requiredModsActions}
            onBrowseConfigFile={onBrowseConfigFile}
            onClearConfigFile={onClearConfigFile}
            configTemplateHelpText="This config will seed new protocols that include this mod file."
            configTemplatePlaceholder="No config linked"
          />

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
