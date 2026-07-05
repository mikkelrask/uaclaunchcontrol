import React from 'react'
import type { UseMutationResult } from '@tanstack/react-query'
import type { IModFile, IAppSettings, IDoomVersion, IProtocol } from '@shared/schema'
import { slugify } from '@/lib/utils'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Combobox } from '@/components/ui/combobox'
import { Separator } from '@/components/ui/separator'
import { ModFileSelector } from '@/components/ModFileSelector'
import { LaunchSequenceList } from '@/components/install/LaunchSequenceList'
import { LaunchCommandPreview } from '@/components/install/LaunchCommandPreview'
import { ProtocolConfigControl } from '@/components/ProtocolConfigControl'
import { FolderOpen, FlaskConical, Plus } from 'lucide-react'
import type { UseFormReturn } from 'react-hook-form'
import type { z } from 'zod'
import type { formSchema } from '@/lib/install/schema'
import type { FileReorderHandlers } from '@/lib/install/useFileReorder'

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
  configStatus: { hasConfig: boolean; statusText: string }
  onCreateFreshConfig: () => void
  isCreatingConfig: boolean
}

/**
 * The "Configuration" tab content — the main form for creating a new launch protocol.
 * Includes fields for title, screenshot, description, base WAD, source port, save dir,
 * launch parameters, mod file selection, reorderable sequence list, launch preview, and submit.
 */
export const ConfigurationTab: React.FC<ConfigurationTabProps> = ({
  form,
  versions,
  settings,
  files,
  fileReorder: {
    draggedIndex,
    insertionIndex,
    handleDragStart,
    handleDragOver,
    handleDrop,
    handleDragEnd
  },
  launchCommand,
  createMutation,
  toast,
  onSubmit,
  handleFilesChange,
  configStatus,
  onCreateFreshConfig,
  isCreatingConfig
}) => {
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs uppercase tracking-widest text-app-muted font-mono font-bold">
                    Label
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="I.e. 'Brutal Doom'"
                      className="bg-app-primary border-app"
                      {...field}
                      onChange={(e) => {
                        const currentTitle = e.target.value
                        field.onChange(currentTitle)

                        const currentSaveDir = form.getValues('saveDirectory')
                        const isSaveDirEmpty = !currentSaveDir

                        const wasAutoFilled =
                          settings.savegamesPath &&
                          currentSaveDir &&
                          currentSaveDir.startsWith(settings.savegamesPath + '/') &&
                          currentSaveDir.length > settings.savegamesPath.length + 1

                        if (isSaveDirEmpty || wasAutoFilled) {
                          const sluggedTitle = slugify(currentTitle)
                          const newSaveDir = settings.savegamesPath
                            ? `${settings.savegamesPath}/${sluggedTitle}`
                            : sluggedTitle
                          form.setValue('saveDirectory', newSaveDir, {
                            shouldValidate: true,
                            shouldDirty: true
                          })
                        }
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
                    Screenshot/Cover (Optional)
                  </FormLabel>
                  <FormControl>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Enter screenshot URL"
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
                            title: 'Select Screenshot',
                            properties: ['openFile'],
                            filters: [
                              {
                                name: 'Images',
                                extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp']
                              }
                            ]
                          })
                          if (!result.canceled && result.filePaths.length > 0) {
                            try {
                              const { fileName } = await api.uploadScreenshot(result.filePaths[0])
                              field.onChange(fileName)
                              toast({
                                title: 'SYSTEM: image_ul',
                                description: 'Image added successfully.'
                              })
                            } catch (error) {
                              toast({
                                title: 'FATAL: err_284',
                                description: `Failed to upload image: ${error}`,
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
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs uppercase tracking-widest text-app-muted font-mono font-bold">
                    Description (Optional)
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter a fitting description"
                      className="bg-app-primary border-app h-[126px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="space-y-4">
            <FormField
              control={form.control}
              name="doomVersionId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs uppercase tracking-widest text-app-muted font-mono font-bold">
                    Base WAD
                  </FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="bg-app-primary border-app">
                        <SelectValue placeholder="Select Base Game/Version" />
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
                    Source Port
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
                      placeholder="Select a source port"
                      className="w-full bg-app-primary border-app"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="saveDirectory"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs uppercase tracking-widest text-app-muted font-mono font-bold">
                    Save Directory (Optional)
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
                    Launch Parameters (Optional)
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
        </div>
        <Separator />
        <ProtocolConfigControl
          hasConfig={configStatus.hasConfig}
          statusText={configStatus.statusText}
          onCreateFresh={onCreateFreshConfig}
          isCreating={isCreatingConfig}
          variant="section"
        />
        <div>
          <div className="mb-4">
            <ModFileSelector value={files} onChange={handleFilesChange} />
          </div>

          <LaunchSequenceList
            files={files}
            draggedIndex={draggedIndex}
            insertionIndex={insertionIndex}
            handleDragStart={handleDragStart}
            handleDragOver={handleDragOver}
            handleDrop={handleDrop}
            handleDragEnd={handleDragEnd}
          />
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
                  title: 'SYSTEM: test_launch',
                  description: 'Game launched. Close it to return here.'
                })
              } catch (err) {
                toast({
                  title: 'FATAL: test_failed',
                  description: String(err),
                  variant: 'destructive'
                })
              }
            }}
          >
            <FlaskConical className="w-4 h-4 mr-2" />
            Test
          </Button>
          <Button
            type="submit"
            className="bg-accent-highlight hover:opacity-90"
            disabled={!form.watch('title') || !form.watch('doomVersionId')}
          >
            <Plus className="w-4 h-4 mr-2" />
            {createMutation.isPending ? 'Applying...' : 'Create Protocol'}
          </Button>
        </div>
      </form>
    </Form>
  )
}
