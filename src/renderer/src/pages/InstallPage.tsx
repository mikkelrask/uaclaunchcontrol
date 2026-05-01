import React, { useState, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useLocation } from 'wouter'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
import { useToast } from '@/hooks/use-toast'
import { gameService } from '@/lib/gameService'
import { IMod, IModFile, IAppSettings, IDoomVersion } from '@shared/schema'
import { slugify } from '@/lib/utils'
import { ModFileSelector } from '@/components/ModFileSelector'
import { CatalogManager } from '@/components/CatalogManager'
import { api } from '@/api'

interface UacModpackImport {
  format: string
  version: string
  game: {
    title: string
    description?: string
    doomVersionSlug: string
    sourcePort?: string
    launchParameters?: string
  }
  files: {
    name: string
    hashValue?: string
  }[]
}

const formSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  doomVersionId: z.string().min(1, 'Base game is required'),
  sourcePort: z.string().min(1, 'Source port is required'),
  saveDirectory: z.string().optional(),
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
  const [catalogFiles, setCatalogFiles] = useState<IModFile[]>([])
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [insertionIndex, setInsertionIndex] = useState<number | null>(null)
  const [isJsonDragging, setIsJsonDragging] = useState(false)
  // const [currentFilePath, setCurrentFilePath] = useState<string>('');

  // Fetch doom versions
  const { data: versions = [] } = useQuery<IDoomVersion[]>({
    queryKey: ['/api/versions'],
    queryFn: api.getDoomVersions
  })

  // Fetch settings with proper typing
  const { data: settings = { savegamesPath: '' } as IAppSettings } = useQuery<IAppSettings>({
    queryKey: ['/api/settings'],
    queryFn: gameService.getSettings
  })

  // Fetch catalog files for Add Files tab
  const { data: catalogData } = useQuery<IModFile[]>({
    queryKey: ['/api/mod-files/catalog'],
    queryFn: () => gameService.getModFileCatalog()
  })

  useEffect(() => {
    if (catalogData) {
      setCatalogFiles(catalogData)
    }
  }, [catalogData])

  // Setup form
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      description: '',
      doomVersionId: '',
      sourcePort: settings?.sourcePortPath || '',
      saveDirectory: '',
      launchParameters: ''
    }
  })

  // Update sourcePort default when settings load
  useEffect(() => {
    if (settings?.sourcePortPath && !form.getValues('sourcePort')) {
      form.setValue('sourcePort', settings.sourcePortPath)
    }
  }, [settings?.sourcePortPath])

  // Create mod mutation
  const createMutation = useMutation({
    mutationFn: (data: { mod: Omit<IMod, 'id'>; files: Omit<IModFile, 'id' | 'modId'>[] }) =>
      gameService.createMod(data.mod, data.files),
    onSuccess: () => {
      toast({
        title: 'SYSTEM: params_accepted',
        description: 'Successfully added new launch configuration.'
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

  const handleVersionSelect = (version: string): void => {
    setLocation(`/?version=${encodeURIComponent(version)}`)
  }

  const handleSearch = (query: string): void => {
    // setSearchQuery(query); // Removed unused state
    setLocation(`/?search=${encodeURIComponent(query)}`)
  }

  // const removeFile = (index: number) => {
  //   const newFiles = [...files]
  //   newFiles.splice(index, 1)
  //
  //   // Update load orders to maintain spacing
  //   const updatedFiles = newFiles.map((file, idx) => ({
  //     ...file,
  //     loadOrder: idx * 10
  //   }))
  //
  //   setFiles(updatedFiles)
  // }

  const onSubmit = async (data: z.infer<typeof formSchema>): Promise<void> => {
    const fileData: IModFile[] = files.map((file) => {
      // Strip directory from filePath and saveDirectory for shareability
      const pathValue = file.filePath || ''
      const fileNameOnly = pathValue.split(/[\\/]/).pop() || pathValue

      return {
        ...file,
        filePath: fileNameOnly, // Store only the filename
        hashValue: file.hashValue || ''
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
  const handleFilesChange = (newFiles: IModFile[]): void => {
    setFiles(newFiles)
  }

  // Native Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, index: number): void => {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', index.toString())
    e.dataTransfer.setData('application/x-uac-reorder', 'true') // Mark as internal reorder

    // Wait a tick before hiding the source element so the browser
    // captures the original element's style for the drag ghost.
    setTimeout(() => {
      setDraggedIndex(index)
    }, 0)
  }

  const handleDragOver = (e: React.DragEvent<HTMLElement>): void => {
    // Skip if this is an external file drop - let it bubble to JSON handler
    if (e.dataTransfer.types.includes('Files') && !e.dataTransfer.getData('text/plain')) {
      return
    }

    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'

    const listElement = e.currentTarget

    // Get all items to calculate where we are
    const itemElements = Array.from(listElement.querySelectorAll('[data-drag-index]'))
    if (itemElements.length === 0) {
      setInsertionIndex(0)
      return
    }

    let foundIndex = files.length
    for (let i = 0; i < itemElements.length; i++) {
      const itemRect = itemElements[i].getBoundingClientRect()
      const itemMid = itemRect.top + itemRect.height / 2
      if (e.clientY < itemMid) {
        foundIndex = i
        break
      }
    }

    if (insertionIndex !== foundIndex) {
      setInsertionIndex(foundIndex)
    }
  }

  const handleDrop = (e: React.DragEvent): void => {
    // Skip if this is an external file drop - let it bubble to JSON handler
    if (e.dataTransfer.types.includes('Files') && !e.dataTransfer.getData('text/plain')) {
      return
    }

    e.preventDefault()

    if (draggedIndex === null || insertionIndex === null) {
      handleDragEnd()
      return
    }

    const newFiles = [...files]
    const [draggedItem] = newFiles.splice(draggedIndex, 1)

    // If inserting after the original position, the index shifts by -1 after splice
    const target = insertionIndex > draggedIndex ? insertionIndex - 1 : insertionIndex
    newFiles.splice(target, 0, draggedItem)

    const updatedFiles = newFiles
    setFiles(updatedFiles)
    handleDragEnd()
  }

  const handleDragEnd = (): void => {
    setDraggedIndex(null)
    setInsertionIndex(null)
  }

  const handleJsonDrop = useCallback(
    async (e: React.DragEvent) => {
      const types = Array.from(e.dataTransfer.types || [])

      // If this is NOT an external file drop, skip (it's an internal reorder)
      if (!types.includes('Files') || types.includes('text/plain')) {
        return
      }

      e.preventDefault()
      setIsJsonDragging(false)
      const jsonFile = e.dataTransfer.files[0]
      if (!jsonFile || !jsonFile.name.endsWith('.json')) {
        toast({
          title: 'Invalid file',
          description: 'Please drop a JSON file',
          variant: 'destructive'
        })
        return
      }

      try {
        const text = await jsonFile.text()
        const importData: UacModpackImport = JSON.parse(text)

        if (importData.format !== 'uac-modpack') {
          toast({
            title: 'Invalid format',
            description: 'Not a UAC modpack JSON',
            variant: 'destructive'
          })
          return
        }

        const game = importData.game
        const importFiles = importData.files

        form.setValue('title', game.title || '')
        form.setValue('description', game.description || '')
        form.setValue('launchParameters', game.launchParameters || '')

        // Only import sourcePort if it's a known port name, not a full path
        const knownPorts = ['gzdoom', 'uzdoom', 'zandronum']
        if (game.sourcePort && knownPorts.includes(game.sourcePort.toLowerCase())) {
          form.setValue('sourcePort', game.sourcePort)
        }

        // Trigger saveDirectory slugification
        // (handled by the title onChange in the form)

        if (game.doomVersionSlug && versions.length > 0) {
          const matchedVersion = versions.find((v) => v.slug === game.doomVersionSlug)
          if (matchedVersion) {
            form.setValue('doomVersionId', matchedVersion.id.toString())
          }
        }

        const catalogData = await gameService.getModFileCatalog()
        const matchedFiles: IModFile[] = []
        const missingFiles: IModFile[] = []

        for (const impFile of importFiles) {
          const catalogMatch = catalogData.find((c) => c.hashValue === impFile.hashValue)
          if (catalogMatch) {
            matchedFiles.push({
              ...catalogMatch,
            })
          } else {
            missingFiles.push({
              id: Date.now() + Math.random(),
              name: impFile.name,
              fileName: impFile.name,
              filePath: '',
              fileType: 'PK3',
              isRequired: true,
              hashValue: impFile.hashValue
            })
          }
        }
        setFiles([...matchedFiles, ...missingFiles])

        if (missingFiles.length > 0) {
          toast({
            title: 'Import partially successful',
            description: `${matchedFiles.length} files matched, ${missingFiles.length} missing (shown in red)`
          })
        } else {
          toast({ title: 'Import successful', description: 'All files matched from catalog' })
        }
      } catch (err) {
        toast({
          title: 'Import failed',
          description: 'Invalid JSON format',
          variant: 'destructive'
        })
      }
    },
    [toast, form, versions]
  )

  const handleJsonDragOver = (e: React.DragEvent): void => {
    const types = Array.from(e.dataTransfer.types || [])

    // If this is NOT an external file drop, skip JSON handling
    // Internal reorders have text/plain but no Files
    if (!types.includes('Files') || types.includes('text/plain')) {
      return
    }

    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    setIsJsonDragging(true)
  }

  const handleJsonDragLeave = (e: React.DragEvent): void => {
    // Only clear if leaving the Card entirely (not entering child elements)
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX
    const y = e.clientY

    // Check if we're actually leaving the card bounds
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setIsJsonDragging(false)
    }
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar activeVersion={activeVersion} onVersionSelect={handleVersionSelect} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header onSearch={handleSearch} />

        <div className="flex-1 overflow-y-auto p-4 min-h-0">
          <Card
            className={`bg-app-secondary border-app mb-6 transition-all ${isJsonDragging
                ? 'border-accent-highlight border-4 ring-2 ring-accent-highlight/30'
                : ''
              }`}
            onDrop={handleJsonDrop}
            onDragOver={handleJsonDragOver}
            onDragLeave={handleJsonDragLeave}
          >
            <CardHeader>
              <CardTitle>New Launch Configuration</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="install">
                <TabsList className="mb-4 bg-app-primary border-app p-1">
                  <TabsTrigger
                    value="install"
                    className="data-[state=active]:bg-accent-highlight data-[state=active]:text-foreground data-[state=active]:shadow-sm rounded px-4 text-app-secondary dark:data-[state=active]:text-foreground"
                  >
                    Configuration
                  </TabsTrigger>
                  <TabsTrigger
                    value="files"
                    className="data-[state=active]:bg-accent-highlight data-[state=active]:text-foreground data-[state=active]:shadow-sm rounded px-4 text-app-secondary dark:data-[state=active]:text-foreground"
                  >
                    Mod Files
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="install">
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                          <FormField
                            control={form.control}
                            name="title"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs uppercase tracking-widest text-app-muted font-mono font-bold">Label</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="I.e. 'Brutal Doom'"
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
                            name="screenshotPath"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs uppercase tracking-widest text-app-muted font-mono font-bold">Screenshot/Cover URL (Optional)</FormLabel>
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
                          <FormField
                            control={form.control}
                            name="description"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs uppercase tracking-widest text-app-muted font-mono font-bold">Description (Optional)</FormLabel>
                                <FormControl>
                                  <Textarea
                                    placeholder="Enter a fitting description"
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
                                <FormLabel className="text-xs uppercase tracking-widest text-app-muted font-mono font-bold">Base WAD</FormLabel>
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
                            name="sourcePort"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs uppercase tracking-widest text-app-muted font-mono font-bold">Source Port</FormLabel>
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
                                <FormLabel className="text-xs uppercase tracking-widest text-app-muted font-mono font-bold">Save Directory (Optional)</FormLabel>
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
                                <FormLabel className="text-xs uppercase tracking-widest text-app-muted font-mono font-bold">Launch Parameters (Optional)</FormLabel>
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
                      <div>
                        <div className="mb-4">
                          <ModFileSelector value={files} onChange={handleFilesChange} />
                        </div>

                        {files.length > 0 && (
                          <div className="mb-4 border border-app rounded-md p-2">
                            <h4 className="text-xs mb-3 text-app-muted font-bold tracking-widest uppercase">
                              Launch sequence
                            </h4>
                            <ul
                              className="space-y-2"
                              onDragOver={handleDragOver}
                              onDrop={handleDrop}
                            >
                              {files.map((file, index) => {
                                const isDragged = draggedIndex === index
                                const showPlaceholderBefore =
                                  insertionIndex === index && draggedIndex !== index

                                return (
                                  <React.Fragment key={`${file.id}-${index}`}>
                                    {showPlaceholderBefore && (
                                      <li className="h-12 border-2 border-dashed border-accent-highlight/30 rounded-md flex items-center justify-center bg-accent-highlight/5 animate-in fade-in zoom-in-95 duration-200">
                                        <span className="text-accent-highlight text-sm tracking-widest uppercase opacity-60">
                                          drop here
                                        </span>
                                      </li>
                                    )}

                                    <li
                                      draggable
                                      data-drag-index={index}
                                      onDragStart={(e) => handleDragStart(e, index)}
                                      onDragEnd={handleDragEnd}
                                      className={`flex items-center justify-between bg-app-primary p-2 rounded cursor-grab active:cursor-grabbing transition-all duration-150 border select-none ${isDragged
                                          ? 'hidden'
                                          : 'border-transparent hover:border-accent-highlight/30 group'
                                        }`}
                                    >
                                      <div className="flex items-center gap-3">
                                        <div className="text-app-muted text-xs font-semibold font-mono w-4">
                                          {index + 1}
                                        </div>
                                        <div className="flex flex-col">
                                          <span
                                            className={`text-sm font-medium ${!file.filePath ? 'text-red-400' : ''}`}
                                          >
                                            {file.name || file.fileName}
                                            {!file.filePath && (
                                              <span className="ml-2 text-xs bg-red-900/50 text-red-300 px-1.5 py-0.5 rounded">
                                                missing
                                              </span>
                                            )}
                                          </span>
                                          <span className="text-xs text-app-muted">
                                            ({file.fileType})
                                          </span>
                                        </div>
                                      </div>
                                    </li>
                                  </React.Fragment>
                                )
                              })}

                              {/* Final placeholder if dragging to end */}
                              {insertionIndex === files.length &&
                                draggedIndex !== files.length - 1 && (
                                  <li className="h-12 border-2 border-dashed border-accent-highlight/30 rounded-md flex items-center justify-center bg-accent-highlight/5 animate-in fade-in zoom-in-95 duration-200">
                                    <span className="text-sm text-accent-highlight tracking-widest uppercase opacity-60">
                                      new placement
                                    </span>
                                  </li>
                                )}
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
                </TabsContent>

                <TabsContent value="files">
                  <div className="space-y-4">
                    <p className="text-sm text-app-secondary">
                      Manage your file catalog. Add new files or remove existing ones from the
                      catalog.
                    </p>
                    <CatalogManager
                      files={catalogFiles}
                      onChange={(newFiles) => setCatalogFiles(newFiles)}
                    />
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default InstallPage
