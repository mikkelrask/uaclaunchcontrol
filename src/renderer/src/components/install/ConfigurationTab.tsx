import { getDiagnosticTitle } from '@/lib/i18n/diagnostic-messages'
import { T, useTranslate } from '@tolgee/react'
import React, { useState } from 'react'
import type { UseMutationResult } from '@tanstack/react-query'
import type { IModFile, IAppSettings, IDoomVersion, IProtocol } from '@shared/schema'
import { deriveSaveDirectory } from '@/lib/install/saveDirectory'
import { api } from '@/api'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Combobox } from '@/components/ui/combobox'
import { ModFileSelector } from '@/components/ModFileSelector'
import { LaunchCommandPreview } from '@/components/install/LaunchCommandPreview'
import { FolderOpen, FlaskConical, Plus, ChevronDown } from 'lucide-react'
import type { UseFormReturn } from 'react-hook-form'
import type { z } from 'zod'
import type { formSchema } from '@/lib/install/schema'
import type { FileReorderHandlers } from '@/hooks/useFileReorder'

interface ToastLike {
  (opts: { title: string; description: string; variant?: 'destructive' }): void
  (opts: { title: string; description: string; duration: number }): void
}

export interface ConfigurationTabProps {
  form: UseFormReturn<z.infer<typeof formSchema>>
  versions: IDoomVersion[]
  settings: IAppSettings
  files: IModFile[]
  fileReorder: FileReorderHandlers
  launchCommand: string
  createMutation: UseMutationResult<
    IProtocol,
    Error,
    { protocol: Omit<IProtocol, 'id'>; files: Omit<IModFile, 'id' | 'modId'>[] }
  >
  toast: ToastLike
  onSubmit: (data: z.infer<typeof formSchema>) => Promise<void>
  handleFilesChange: (newFiles: IModFile[]) => void
  /** Name of the mod file that would auto-seed a config, if any — shown as a
   *  note next to the isolated-config checkbox since checking it overrides
   *  that auto-seed. */
  templateSeedName: string | null
}

/**
 * The "Configuration" tab content — the main form for creating a new launch protocol.
 * Grouped into a "Protocol Identity" panel (label, cover, description — the fields
 * that make a protocol recognizable in the library) and a collapsed "Advanced"
 * section (base WAD / source port overrides, save dir, launch parameters, isolated
 * config), plus drag-reorderable mod file selection, launch preview, and submit.
 */
export const ConfigurationTab: React.FC<ConfigurationTabProps> = ({
  form,
  versions,
  settings,
  files,
  fileReorder,
  launchCommand,
  createMutation,
  toast,
  onSubmit,
  handleFilesChange,
  templateSeedName
}) => {
  const { t } = useTranslate('desktop')

  const [advancedOpen, setAdvancedOpen] = useState(false)
  const isolatedConfigChecked = form.watch('isolatedConfig')

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Protocol Identity — what makes this protocol recognizable */}
        <div className="bg-app-secondary p-4 rounded-xl border border-app shadow-sm space-y-4">
          <span className="text-xs uppercase tracking-widest text-app-muted font-mono font-bold">
            {t('install.configuration.protocolIdentity', 'Protocol Identity')}
          </span>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs uppercase tracking-widest text-app-muted font-mono font-bold">
                    {t('install.configuration.label', 'Label')}
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t('install.configuration.iEBrutalDoom', "I.e. 'Brutal Doom'")}
                      className="bg-app-primary border-app"
                      {...field}
                      onChange={(e) => {
                        const currentTitle = e.target.value
                        field.onChange(currentTitle)

                        form.setValue(
                          'saveDirectory',
                          deriveSaveDirectory(
                            currentTitle,
                            form.getValues('saveDirectory') || '',
                            settings.savegamesPath
                          ),
                          { shouldValidate: true, shouldDirty: true }
                        )
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="screenshotPath"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs uppercase tracking-widest text-app-muted font-mono font-bold">
                    {t(
                      'install.configuration.screenshotCoverOptional',
                      'Screenshot/Cover (Optional)'
                    )}
                  </FormLabel>
                  <FormControl>
                    <div className="flex gap-2">
                      <Input
                        placeholder={t(
                          'install.configuration.enterScreenshotUrl',
                          'Enter screenshot URL'
                        )}
                        className="bg-app-primary border-app flex-1"
                        {...field}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="bg-app-primary border-app shrink-0 h-10 w-10"
                        onClick={async () => {
                          const result = await api.showOpenDialog({
                            title: t('install.configuration.selectScreenshot', 'Select Screenshot'),
                            properties: ['openFile'],
                            filters: [
                              {
                                name: t('install.configuration.images', 'Images'),
                                extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp']
                              }
                            ]
                          })
                          if (!result.canceled && result.filePaths.length > 0) {
                            try {
                              const { fileName } = await api.uploadScreenshot(result.filePaths[0])
                              field.onChange(fileName)
                              toast({
                                title: getDiagnosticTitle('system', 'image_ul'),
                                description: t(
                                  'install.configuration.imageAddedSuccessfully',
                                  'Image added successfully.'
                                )
                              })
                            } catch (error: unknown) {
                              toast({
                                title: getDiagnosticTitle('fatal', 'err_284'),
                                description: t(
                                  'install.configuration.failedToUploadImage',
                                  'Failed to upload image: {error}',
                                  { error: String(error) }
                                ),
                                variant: 'destructive'
                              })
                            }
                          }
                        }}
                      >
                        <FolderOpen className="h-4 w-4" />
                      </Button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs uppercase tracking-widest text-app-muted font-mono font-bold">
                  {t('install.configuration.descriptionOptional', 'Description (Optional)')}
                </FormLabel>
                <FormControl>
                  <Textarea
                    placeholder={t(
                      'install.configuration.enterAFittingDescription',
                      'Enter a fitting description'
                    )}
                    className="bg-app-primary border-app"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Advanced — occasional per-protocol overrides, collapsed by default */}
        <div className="border border-app rounded-xl bg-app-secondary overflow-hidden">
          <button
            type="button"
            onClick={() => setAdvancedOpen((open) => !open)}
            className="w-full flex items-center justify-between gap-3 px-4 py-3 text-xs uppercase tracking-widest text-app-muted font-mono font-bold hover:text-app-primary hover:bg-app-hover transition-colors"
          >
            <span>
              {t(
                'install.configuration.advancedBaseWadSourcePortSavePathIsolatedConfig',
                'Advanced — base WAD & source port, save path, isolated config'
              )}
            </span>
            <ChevronDown
              className={`w-4 h-4 shrink-0 transition-transform ${advancedOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {advancedOpen && (
            <div className="p-4 pt-0 space-y-4 border-t border-app">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                <FormField
                  control={form.control}
                  name="doomVersionId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs uppercase tracking-widest text-app-muted font-mono font-bold">
                        {t('install.configuration.baseWad', 'Base WAD')}
                      </FormLabel>
                      {/* key forces a fresh mount the instant a value is first
                          set programmatically (our default-fill effect in
                          InstallPage) — without it, Radix Select's onValueChange
                          spontaneously fires with '' right after a value is set
                          on an already-mounted-empty instance, resetting the
                          pre-fill before the user ever sees it. */}
                      <Select
                        key={field.value ? 'has-value' : 'no-value'}
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger className="bg-app-primary border-app">
                            <SelectValue
                              placeholder={t(
                                'install.configuration.selectBaseGameVersion',
                                'Select Base Game/Version'
                              )}
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-app-secondary border-app text-app-primary">
                          {versions
                            .filter((v) => !v.ignored)
                            .map((version) => (
                              <SelectItem key={version.id} value={version.id.toString()}>
                                {version.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="sourcePortId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs uppercase tracking-widest text-app-muted font-mono font-bold">
                        {t('install.configuration.sourcePort', 'Source Port')}
                      </FormLabel>
                      <FormControl>
                        <Combobox
                          value={field.value}
                          onValueChange={field.onChange}
                          options={(settings?.sourcePorts || [])
                            .filter((p) => !p.ignored)
                            .map((p) => ({
                              value: p.id,
                              label: p.name,
                              description: p.version
                            }))}
                          placeholder={t(
                            'install.configuration.selectASourcePort',
                            'Select a source port'
                          )}
                          className="w-full bg-app-primary border-app"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="saveDirectory"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs uppercase tracking-widest text-app-muted font-mono font-bold">
                        {t(
                          'install.configuration.saveDirectoryOptional',
                          'Save Directory (Optional)'
                        )}
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder={settings?.savegamesPath || ''}
                          className="bg-app-primary border-app"
                          {...field}
                          value={field.value || ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="launchParameters"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs uppercase tracking-widest text-app-muted font-mono font-bold">
                        {t(
                          'install.configuration.launchParametersOptional',
                          'Launch Parameters (Optional)'
                        )}
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="-skill 4 -warp 01"
                          className="bg-app-primary border-app"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="isolatedConfig"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start gap-3 rounded-lg border border-app bg-app-primary p-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        className="mt-0.5"
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel className="text-sm font-normal text-app-primary cursor-pointer">
                        {t(
                          'install.configuration.createAnIsolatedConfigForThisProtocol',
                          'Create an isolated config for this protocol'
                        )}
                      </FormLabel>
                      <p className="text-xs text-app-muted">
                        {t(
                          'install.configuration.aPrivateCopyOfTheSourcePortSCurrent',
                          "A private copy of the source port's current settings, so changes here won't affect other protocols. Created automatically when you save."
                        )}
                      </p>
                    </div>
                  </FormItem>
                )}
              />

              {templateSeedName && !isolatedConfigChecked && (
                <p className="text-xs text-app-muted italic">
                  <T
                    ns="desktop"
                    keyName="install.configuration.thisProtocolWillUseTheSavedConfigFromUnless"
                    defaultValue={
                      'This protocol will use the saved config from "{templateSeedName}" unless you check the box above.'
                    }
                    params={{ templateSeedName: templateSeedName }}
                  />
                </p>
              )}
            </div>
          )}
        </div>

        <div className="bg-app-secondary p-4 rounded-xl border border-app shadow-sm">
          <ModFileSelector value={files} onChange={handleFilesChange} fileReorder={fileReorder} />
        </div>

        <LaunchCommandPreview
          launchCommand={launchCommand}
          showPreview={settings?.showLaunchPreview}
        />

        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            className="border-accent-highlight/40 text-accent-highlight hover:bg-accent-highlight/10"
            disabled={!form.watch('doomVersionId')}
            onClick={async () => {
              const vals = form.getValues()
              try {
                await api.testLaunch(
                  {
                    name: vals.title,
                    doomVersionId: vals.doomVersionId,
                    sourcePortId: vals.sourcePortId,
                    saveDirectory: vals.saveDirectory,
                    launchParameters: vals.launchParameters
                  },
                  files
                )
                toast({
                  title: getDiagnosticTitle('system', 'test_launch'),
                  description: t(
                    'install.configuration.gameLaunchedCloseItToReturnHere',
                    'Game launched. Close it to return here.'
                  )
                })
              } catch (err: unknown) {
                toast({
                  title: getDiagnosticTitle('fatal', 'test_failed'),
                  description: String(err),
                  variant: 'destructive'
                })
              }
            }}
          >
            <FlaskConical className="w-4 h-4 mr-2" />
            {t('install.configuration.test', 'Test')}
          </Button>
          <Button
            type="submit"
            className="bg-accent-highlight hover:opacity-90"
            disabled={!form.watch('title') || !form.watch('doomVersionId')}
          >
            <Plus className="w-4 h-4 mr-2" />
            {createMutation.isPending
              ? t('install.configuration.applying', 'Applying...')
              : t('install.configuration.createProtocol', 'Create Protocol')}
          </Button>
        </div>
      </form>
    </Form>
  )
}
