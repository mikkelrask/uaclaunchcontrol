import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useLocation } from 'wouter'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
// import ModFileList from '@/components/ModFileList';
import { useToast } from '@/hooks/use-toast'
import { gameService } from '@/lib/gameService'
import { IMod, IModFile, IAppSettings } from '@shared/schema'
import { slugify } from '@/lib/utils'
import { ModFileSelector } from '@/components/ModFileSelector'
// import path from 'path';
import { api } from '@/api'

const formSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  doomVersionId: z.string().min(1, 'Base game is required'),
  sourcePort: z.string().min(1, 'Source port is required'),
  saveDirectory: z.string().optional(),
  moddbId: z.string().optional(),
  screenshotPath: z.string().optional(),
  launchParameters: z.string().optional()
})

export const InstallPage: React.FC = () => {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [, setLocation] = useLocation()

  const [activeVersion] = useState<string | null>(null)
  // const [searchQuery] = useState('');
  const [files, setFiles] = useState<Omit<IModFile, 'id' | 'modId'>[]>([])
  // const [currentFilePath, setCurrentFilePath] = useState<string>('');

  // Fetch doom versions
  const { data: versions = [] } = useQuery<any[]>({
    queryKey: ['/api/versions'],
    queryFn: api.getDoomVersions
  })

  // Fetch settings with proper typing
  const { data: settings = { savegamesPath: '' } as IAppSettings } = useQuery<IAppSettings>({
    queryKey: ['/api/settings'],
    queryFn: gameService.getSettings
  })

  // Setup form
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      description: '',
      doomVersionId: '',
      sourcePort: '',
      saveDirectory: '',
      launchParameters: ''
    }
  })

  // Create mod mutation
  const createMutation = useMutation({
    mutationFn: (data: { mod: Omit<IMod, 'id'>; files: Omit<IModFile, 'id' | 'modId'>[] }) =>
      gameService.createMod(data.mod, data.files),
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Mod installed successfully'
      })
      queryClient.invalidateQueries({ queryKey: ['/api/mods'] })
      form.reset()
      setFiles([])
      // Navigate to the Games page
      setLocation('/')
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to install mod: ${error}`,
        variant: 'destructive'
      })
    }
  })

  const handleVersionSelect = (version: string) => {
    setLocation(`/?version=${encodeURIComponent(version)}`)
  }

  const handleSearch = (query: string) => {
    // setSearchQuery(query); // Removed unused state
    setLocation(`/?search=${encodeURIComponent(query)}`)
  }

  const removeFile = (index: number) => {
    const newFiles = [...files]
    newFiles.splice(index, 1)

    // Update load orders to maintain spacing
    const updatedFiles = newFiles.map((file, idx) => ({
      ...file,
      loadOrder: idx * 10
    }))

    setFiles(updatedFiles)
  }

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    const fileData: IModFile[] = files.map((file, idx) => ({
      ...file,
      id: Date.now() + idx,
      modId: 'temp' // Replace 'temp' with the actual mod id after creation if needed
    }))

    const mod: Omit<IMod, 'id'> = {
      name: data.title,
      title: data.title,
      description: data.description || '',
      doomVersionId: data.doomVersionId,
      sourcePort: data.sourcePort,
      saveDirectory: data.saveDirectory || settings?.savegamesPath || '',
      moddbId: data.moddbId ? parseInt(data.moddbId) : undefined,
      screenshotPath: data.screenshotPath,
      launchParameters: data.launchParameters,
      files: fileData
    }

    console.log('[DEBUG] files state at submit:', files)
    console.log('[DEBUG] fileData to process:', fileData)

    // Add new files to the mod file catalog before creating the mod
    try {
      // Fetch current catalog
      const catalog = await api.getAvailableModFiles()
      console.log('[DEBUG] Current catalog:', catalog)
      console.log('[DEBUG] Files to process:', fileData)
      for (const file of fileData) {
        const exists = catalog.some((f) => f.filePath === file.filePath)
        console.log(`[DEBUG] Checking file: ${file.filePath}, exists:`, exists)
        if (!exists) {
          console.log('[DEBUG] Adding to catalog:', file)
          await api.addToCatalog({
            name: file.fileName,
            filePath: file.filePath,
            fileType: file.fileType,
            loadOrder: file.loadOrder,
            isRequired: file.isRequired
          })
        }
      }
    } catch (err) {
      toast({
        title: 'Warning',
        description: 'Some mod files could not be added to the catalog.',
        variant: 'destructive'
      })
    }

    createMutation.mutate({ mod, files: fileData })
  }

  // Wrapper to map Omit<IModFile, 'id' | 'modId'>[] to IModFile[]
  const handleFilesChange = (files: Omit<IModFile, 'id' | 'modId'>[]) => {
    setFiles(files)
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar activeVersion={activeVersion} onVersionSelect={handleVersionSelect} />

      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <Header onSearch={handleSearch} />

        <div className="flex-1 overflow-y-auto p-4">
          <Card className="bg-[#162b3d] border-[#262626] mb-6">
            <CardHeader>
              <CardTitle>Install New Mod</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <FormField
                        control={form.control}
                        name="title"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Mod Title</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Enter mod title"
                                className="bg-[#0c1c2a] border-[#262626]"
                                {...field} // Spread field props here
                                onChange={(e) => {
                                  const currentTitle = e.target.value // Get full value from event
                                  field.onChange(currentTitle) // Update title field state

                                  // Check if saveDirectory is empty or was auto-filled
                                  const currentSaveDir = form.getValues('saveDirectory')
                                  const isSaveDirEmpty = !currentSaveDir

                                  // Fix: Ensure currentSaveDir exists before calling startsWith
                                  const wasAutoFilled =
                                    settings.savegamesPath &&
                                    currentSaveDir && // Check if currentSaveDir is truthy
                                    currentSaveDir.startsWith(settings.savegamesPath + '/') &&
                                    currentSaveDir.length > settings.savegamesPath.length + 1

                                  // Only update if empty or previously auto-filled
                                  if (isSaveDirEmpty || wasAutoFilled) {
                                    const sluggedTitle = slugify(currentTitle)
                                    const newSaveDir = settings.savegamesPath
                                      ? `${settings.savegamesPath}/${sluggedTitle}`
                                      : sluggedTitle
                                    // Update saveDirectory state
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
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Description (Optional)</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="Enter mod description"
                                className="bg-[#0c1c2a] border-[#262626]"
                                {...field}
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
                            <FormLabel>Screenshot URL (Optional)</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Enter screenshot URL"
                                className="bg-[#0c1c2a] border-[#262626]"
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
                            <FormLabel>Base Game</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger className="bg-[#0c1c2a] border-[#262626]">
                                  <SelectValue placeholder="Select Doom Version" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent className="bg-[#162b3d] border-[#262626] text-white">
                                {versions.map((version) => (
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
                        name="sourcePort"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Source Port</FormLabel>
                            <FormControl>
                              <Input
                                placeholder={settings.gzDoomPath || ''}
                                className="bg-[#0c1c2a] border-[#262626]"
                                {...field}
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
                            <FormLabel>Save Directory (Optional)</FormLabel>
                            <FormControl>
                              <Input
                                placeholder={settings.savegamesPath || ''}
                                className="bg-[#0c1c2a] border-[#262626]"
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
                            <FormLabel>Launch Parameters (Optional)</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="-skill 4 -warp 01"
                                className="bg-[#0c1c2a] border-[#262626]"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-mono mb-2">Mod Files</h3>
                    <p className="text-sm text-[#e6e6e6] mb-2">
                      Add the mod files in the order they should be loaded.
                    </p>
                    <div className="mb-4">
                      <ModFileSelector value={files} onChange={handleFilesChange} />
                    </div>

                    {files.length > 0 && (
                      <div className="mb-4 border border-[#262626] rounded-md p-2">
                        <h4 className="font-mono text-sm mb-2">Selected Files:</h4>
                        <ul className="space-y-2">
                          {files.map((file, index) => (
                            <li
                              key={index}
                              className="flex items-center justify-between bg-[#0c1c2a] p-2 rounded"
                            >
                              <div>
                                <span className="text-sm font-medium">{file.fileName}</span>
                                <span className="text-xs text-[#a0a0a0] ml-2">
                                  ({file.fileType})
                                </span>
                              </div>
                              <div className="flex items-center">
                                <span className="text-xs text-[#a0a0a0] mr-3">
                                  Load order: {file.loadOrder}
                                </span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 text-red-400 hover:text-red-300"
                                  onClick={() => removeFile(index)}
                                >
                                  Remove
                                </Button>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end">
                    <Button
                      type="submit"
                      className="bg-[#d41c1c] hover:bg-[#b21616]"
                      disabled={!form.watch('title') || !form.watch('doomVersionId')}
                    >
                      {createMutation.isPending ? 'Installing...' : 'Install Mod'}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default InstallPage
