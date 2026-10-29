import { T, useTranslate } from '@tolgee/react'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { IModFile } from '@shared/schema'

interface DeleteConfirmDialogProps {
  target: IModFile | null
  deleteFromDisk: boolean
  onDeleteFromDiskChange: (checked: boolean) => void
  onCancel: () => void
  onConfirm: () => void
}

export function DeleteConfirmDialog({
  target,
  deleteFromDisk,
  onDeleteFromDiskChange,
  onCancel,
  onConfirm
}: DeleteConfirmDialogProps): React.ReactElement {
  const { t } = useTranslate('desktop')

  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('catalog.delete.removeFromCatalog', 'Remove from catalog')}</DialogTitle>
          <DialogDescription>
            <T
              ns="desktop"
              keyName="catalog.delete.areYouSureYouWantToRemoveFromYour"
              defaultValue={'Are you sure you want to remove {strong} from your mod file catalog?'}
              params={{ strong: <strong>{target ? target.name || target.fileName : ''}</strong> }}
            />
          </DialogDescription>
        </DialogHeader>
        <label className="flex items-center gap-2 text-sm cursor-pointer py-2">
          <Checkbox
            checked={deleteFromDisk}
            onCheckedChange={(checked) => onDeleteFromDiskChange(checked === true)}
          />
          <span>
            {t('catalog.delete.alsoDeleteTheFileFromDisk', 'Also delete the file from disk')}
          </span>
        </label>
        <DialogFooter>
          <Button variant="ghost" onClick={onCancel}>
            {t('catalog.delete.cancel', 'Cancel')}
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            {t('catalog.delete.delete', 'Delete')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
