import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Save } from 'lucide-react'

interface DiscardChangesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onDiscard: () => void
  onSaveAndClose: () => void
  isSaving: boolean
}

export function DiscardChangesDialog({
  open,
  onOpenChange,
  onDiscard,
  onSaveAndClose,
  isSaving
}: DiscardChangesDialogProps): React.ReactElement {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Discard changes?</DialogTitle>
          <DialogDescription>
            This protocol has unsaved changes. Do you want to discard them?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Keep Editing
          </Button>
          <Button variant="destructive" onClick={onDiscard}>
            Discard
          </Button>
          <Button
            onClick={onSaveAndClose}
            className="bg-accent-highlight hover:opacity-90 text-white"
            disabled={isSaving}
          >
            <Save className="w-4 h-4 mr-2" />
            Save & Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default DiscardChangesDialog
