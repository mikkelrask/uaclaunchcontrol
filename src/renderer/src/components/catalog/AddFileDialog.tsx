import { useTranslate } from '@tolgee/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Plus, FolderOpen, Loader2 } from 'lucide-react'
import type { IModFile } from '@shared/schema'
import type { AddFormState } from '@/lib/catalog/types'
import type { RequiredModsActions } from '@/lib/catalog/useRequiredModsActions'
import { ModFileFormFields } from '@/components/catalog/ModFileFormFields'

interface AddFileDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  form: AddFormState
  setForm: React.Dispatch<React.SetStateAction<AddFormState>>
  selectableFiles: IModFile[]
  requiredModsActions: RequiredModsActions
  onAddFile: () => Promise<void>
  isSubmitting?: boolean
  onBrowseFile: () => Promise<void>
  onCancel: () => void
  onBrowseConfigFile: () => Promise<void>
  onClearConfigFile: () => void
}

export function AddFileDialog({
  open,
  onOpenChange,
  form,
  setForm,
  selectableFiles,
  requiredModsActions,
  onAddFile,
  isSubmitting = false,
  onBrowseFile,
  onCancel,
  onBrowseConfigFile,
  onClearConfigFile
}: AddFileDialogProps): React.ReactElement {
  const { t } = useTranslate('desktop')

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
                {t('catalog.add.addModFile', 'add_mod_file')}
              </DialogTitle>
              <DialogDescription className="text-xs font-semibold font-mono text-app-muted uppercase tracking-widest opacity-80">
                {t(
                  'catalog.add.uacLaunchControlCatalogManagement',
                  'UAC Launch Control // Catalog Management'
                )}
              </DialogDescription>
            </div>
          </div>
        </div>

        <div className="space-y-4 p-4 overflow-y-auto">
          <div className="space-y-2">
            <Label htmlFor="add-file-select">{t('catalog.add.selectFile', 'Select File')}</Label>
            <div className="flex gap-2">
              <Input
                id="add-file-select"
                value={form.filePath}
                onChange={(e) => setForm((prev) => ({ ...prev, filePath: e.target.value }))}
                placeholder={t('catalog.add.pathToModFile', 'Path to mod file')}
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

          <ModFileFormFields
            idPrefix="add"
            form={form}
            setForm={setForm}
            selectableFiles={selectableFiles}
            requiredModsActions={requiredModsActions}
            onBrowseConfigFile={onBrowseConfigFile}
            onClearConfigFile={onClearConfigFile}
            configTemplateHelpText={t(
              'catalog.add.whenThisModIsAddedToAProtocolThe',
              'When this mod is added to a protocol, the config will be copied so each protocol has its own isolated copy.'
            )}
            configTemplatePlaceholder={t(
              'catalog.add.noConfigLinkedGlobalDefaultsApply',
              'No config linked — global defaults apply'
            )}
            namePlaceholder={t('catalog.add.prettyNameForTheMod', 'Pretty name for the mod')}
            versionPlaceholder={t('catalog.add.eG10V21', 'e.g., 1.0, v2.1')}
            urlLabel={t('catalog.add.urlModdbForum', 'URL (ModDB, forum)')}
            urlPlaceholder="https://www.moddb.com/mods/..."
          />
        </div>

        <DialogFooter className="bg-app-secondary border-t border-app p-4 shrink-0">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
            className="bg-app-secondary"
          >
            {t('catalog.add.cancel', 'Cancel')}
          </Button>
          <Button
            onClick={onAddFile}
            disabled={!form.filePath.trim() || isSubmitting}
            className="bg-accent-highlight"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                {t('catalog.add.copyingHashing', 'Copying & hashing…')}
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-1" />
                {t('catalog.add.addToCatalog', 'Add to Catalog')}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default AddFileDialog
