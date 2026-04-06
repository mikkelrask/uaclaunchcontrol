import React, { useState, useEffect } from 'react'
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
  const [files, setFiles] = useState<IModFile[]>([])
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
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
      sourcePort: settings?.gzDoomPath || '',
      saveDirectory: '',
      launchParameters: ''
    }
  })

  // Update sourcePort default when settings load
  useEffect(() => {
    if (settings?.gzDoomPath && !form.getValues('sourcePort')) {
      form.setValue('sourcePort', settings.gzDoomPath)
    }
  }, [settings?.gzDoomPath])

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
    const fileData: IModFile[] = files.map((file, idx) => {
      // Strip directory from filePath and saveDirectory for shareability
      const pathValue = file.filePath || ''
      const fileNameOnly = pathValue.split(/[\\/]/).pop() || pathValue

      return {
        ...file,
        filePath: fileNameOnly, // Store only the filename
        loadOrder: idx
      }
    })

    const finalSaveDir = data.saveDirectory || settings?.savegamesPath || ''
    // Strip parent directory from saveDirectory if it starts with the default path
    let relativeSaveDir = finalSaveDir
    if (settings?.savegamesPath && finalSaveDir.startsWith(settings.savegamesPath)) {
      relativeSaveDir = finalSaveDir.replace(settings.savegamesPath, '').replace(/^[\\/]/, '')
    }

    // Use a single timestamp for both mod and image naming consistency
    const uniqueId = Date.now().toString()

    // Download screenshot if it's a URL
    let localScreenshotPath = data.screenshotPath
    if (data.screenshotPath && data.screenshotPath.startsWith('http')) {
      try {
        console.log(`[DEBUG] Downloading screenshot for mod: ${data.screenshotPath}`)
        const result = await api.downloadImage(data.screenshotPath, uniqueId)
        localScreenshotPath = result.fileName
        console.log(`[DEBUG] Screenshot saved as: ${localScreenshotPath}`)
      } catch (error) {
        console.error('Failed to download screenshot, following with original URL:', error)
      }
    }

    const mod: Omit<IMod, 'id'> & { id?: string } = {
      id: uniqueId,
      name: data.title,
      title: data.title,
      description: data.description || '',
      doomVersionId: data.doomVersionId,
      sourcePort: data.sourcePort,
      saveDirectory: relativeSaveDir,
      moddbId: data.moddbId ? parseInt(data.moddbId) : undefined,
      screenshotPath: localScreenshotPath,
      launchParameters: data.launchParameters,
      files: fileData
    }

    console.log('[DEBUG] Final mod object for submission:', mod)
    console.log('[DEBUG] files state at submit:', files)
    console.log('[DEBUG] fileData to process:', fileData)

    // Update catalog entries with any name changes
    try {
      console.log(`[DEBUG] Attempting to update catalog for ${files.length} files`)
      for (const file of files) {
        if (file.id && Number(file.id) > 0) {
          console.log(`[DEBUG] Updating catalog entry ${file.id} with name: ${file.name}`)
          // Update the catalog title/pretty name
          await api.updateInCatalog(file.id, {
            name: file.name,
            fileType: file.fileType
          })
        } else {
          console.log(`[DEBUG] Skipping catalog update for file with ID: ${file.id}`)
        }
      }
    } catch (err) {
      console.warn('[DEBUG] Failed to update some catalog entries:', err)
    }

    createMutation.mutate({ mod, files: fileData })
  }

  // Wrapper to update file list
  const handleFilesChange = (newFiles: IModFile[]) => {
    setFiles(newFiles)
  }

  // Native Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = 'move'
    // Still set data for compatibility
    e.dataTransfer.setData('text/plain', index.toString())
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault()
    if (draggedIndex === null || draggedIndex === targetIndex) {
      setDraggedIndex(null)
      return
    }

    const newFiles = [...files]
    const [draggedItem] = newFiles.splice(draggedIndex, 1)
    newFiles.splice(targetIndex, 0, draggedItem)

    // Update load orders based on new positions explicitly
    const updatedFiles = newFiles.map((file, idx) => ({
      ...file,
      loadOrder: idx
    }))

    console.log('[DEBUG] Files reordered via DnD:', updatedFiles)
    setFiles(updatedFiles)
    setDraggedIndex(null)
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar activeVersion={activeVersion} onVersionSelect={handleVersionSelect} />

      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <Header onSearch={handleSearch} />

        <div className="flex-1 overflow-y-auto p-4">
          <Card className="bg-app-secondary border-app mb-6">
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
                                className="bg-app-primary border-app"
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
                                className="bg-app-primary border-app"
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
                                className="bg-app-primary border-app"
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
                                <SelectTrigger className="bg-app-primary border-app">
                                  <SelectValue placeholder="Select Doom Version" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent className="bg-app-secondary border-app text-app-primary">
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
                              <Input className="bg-app-primary border-app" {...field} />
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
                            <FormLabel>Launch Parameters (Optional)</FormLabel>
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

                  <div>
                    <h3 className="text-lg font-sans mb-2">Mod Files</h3>
                    <p className="text-sm text-app-secondary mb-2">
                      Add the mod files in the order they should be loaded.
                    </p>
                    <div className="mb-4">
                      <ModFileSelector value={files} onChange={handleFilesChange} />
                    </div>

                    {files.length > 0 && (
                      <div className="mb-4 border border-app rounded-md p-2">
                        <h4 className="font-sans text-sm mb-2">Selected Files:</h4>
                        <ul className="space-y-2">
                          {files.map((file, index) => (
                            <li
                              key={`${file.id}-${index}`}
                              draggable
                              onDragStart={(e) => handleDragStart(e, index)}
                              onDragOver={handleDragOver}
                              onDrop={(e) => handleDrop(e, index)}
                              onDragEnd={() => setDraggedIndex(null)}
                              onDragEnter={(e) => e.preventDefault()}
                              className={`flex items-center justify-between bg-app-primary p-2 rounded cursor-move transition-all duration-200 border border-transparent hover:border-accent-highlight/30 group select-none ${draggedIndex === index ? 'opacity-40 scale-95' : ''}`}
                            >
                              <div className="flex items-center gap-3">
                                <div className="text-app-muted text-xs font-semibold font-mono w-4">
                                  {index + 1}
                                </div>
                                <div>
                                  <span className="text-sm font-medium">{file.name || file.fileName}</span>
                                  <span className="text-xs text-app-muted ml-2">
                                    ({file.fileType})
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 text-red-400 hover:text-red-300 opacity-0 group-hover:opacity-100 transition-opacity"
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
                      className="bg-accent-highlight hover:opacity-90"
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
