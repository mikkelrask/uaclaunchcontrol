import { useTranslate } from '@tolgee/react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Trash2 } from 'lucide-react'

interface DeleteProtocolDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  isDeleting: boolean
}

/**
 * Custom confirm dialog for protocol deletion — replaces a former native
 * confirm() call so both destructive actions in this modal (delete,
 * discard) use the same dialog pattern instead of two different ones.
 */
export function DeleteProtocolDialog({
  open,
  onOpenChange,
  onConfirm,
  isDeleting
}: DeleteProtocolDialogProps): React.ReactElement {
  const { t } = useTranslate('desktop')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {t('library.delete.deleteThisProtocol', 'Delete this protocol?')}
          </DialogTitle>
          <DialogDescription>
            {t(
              'library.delete.thisRemovesTheLaunchProtocolFromYourLibraryThis',
              'This removes the launch protocol from your library. This cannot be undone.'
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t('common.actions.cancel', 'Cancel')}
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isDeleting}>
            <Trash2 className="w-4 h-4 mr-2" />
            {isDeleting
              ? t('library.delete.deleting', 'Deleting...')
              : t('common.actions.delete', 'Delete')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default DeleteProtocolDialog
