import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { FolderOpen, X } from 'lucide-react'
import type { IModFile } from '@shared/schema'
import { SIDECAR_EXPLANATION } from '@/lib/catalog/types'
import type { RequiredModEntry } from '@/lib/catalog/types'
import { CATEGORIES } from '@shared/categories'
import type { RequiredModsActions } from '@/lib/catalog/useRequiredModsActions'
import { RequiredModsEditor } from '@/components/catalog/RequiredModsEditor'
import { InfoTooltip } from '@/components/ui/info-tooltip'

/** The subset of AddFormState/EditFormState this shared block actually reads and writes. */
export interface ModFileFormFieldsState {
  name: string
  version: string
  url: string
  category: string
  configTemplate: {
    filePath: string
    configFile: string
    md5Hash: string
  } | null
  sidecarOnly: boolean
  loadOrder: RequiredModEntry[]
}

interface ModFileFormFieldsProps<T extends ModFileFormFieldsState> {
  /** Distinguishes element ids between the add/edit dialogs (e.g. "add", "edit"). */
  idPrefix: string
  form: T
  setForm: React.Dispatch<React.SetStateAction<T>>
  selectableFiles: IModFile[]
  requiredModsActions: RequiredModsActions
  onBrowseConfigFile?: () => Promise<void>
  onClearConfigFile?: () => void
  /** Copy under the "Config Template" label — differs between add (forward-looking) and edit (already-linked) framing. */
  configTemplateHelpText: string
  configTemplatePlaceholder: string
  namePlaceholder?: string
  versionPlaceholder?: string
  urlLabel?: string
  urlPlaceholder?: string
}

/**
 * Fields shared by AddFileDialog and EditFileDialog: name/version/url,
 * category, config template linking, required-mods editor, and the sidecar
 * checkbox. Each dialog still owns its own header, footer, and any
 * dialog-specific fields (Add's file-path picker, Edit's hash display).
 */
export function ModFileFormFields<T extends ModFileFormFieldsState>({
  idPrefix,
  form,
  setForm,
  selectableFiles,
  requiredModsActions,
  onBrowseConfigFile,
  onClearConfigFile,
  configTemplateHelpText,
  configTemplatePlaceholder,
  namePlaceholder,
  versionPlaceholder,
  urlLabel = 'URL',
  urlPlaceholder
}: ModFileFormFieldsProps<T>): React.ReactElement {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-name`}>Name</Label>
        <Input
          id={`${idPrefix}-name`}
          value={form.name}
          onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
          placeholder={namePlaceholder}
          className="bg-app-secondary border-app"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-version`}>Version</Label>
        <Input
          id={`${idPrefix}-version`}
          value={form.version}
          onChange={(e) => setForm((prev) => ({ ...prev, version: e.target.value }))}
          placeholder={versionPlaceholder}
          className="bg-app-secondary border-app"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-url`}>{urlLabel}</Label>
        <Input
          id={`${idPrefix}-url`}
          value={form.url}
          onChange={(e) => setForm((prev) => ({ ...prev, url: e.target.value }))}
          placeholder={urlPlaceholder}
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
        <p className="text-xs text-app-muted">{configTemplateHelpText}</p>
        <div className="flex gap-2">
          <Input
            value={form.configTemplate?.filePath || ''}
            readOnly
            placeholder={configTemplatePlaceholder}
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
          id={`${idPrefix}-sidecar`}
          checked={form.sidecarOnly}
          onCheckedChange={(checked) =>
            setForm((prev) => ({ ...prev, sidecarOnly: checked === true }))
          }
        />
        <Label htmlFor={`${idPrefix}-sidecar`} className="text-sm font-normal">
          Sidecar mod
        </Label>
        <InfoTooltip text={SIDECAR_EXPLANATION} />
      </div>
    </>
  )
}

export default ModFileFormFields
