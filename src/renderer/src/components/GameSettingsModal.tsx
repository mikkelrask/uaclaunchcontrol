import React, { useState, useMemo, useEffect, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Combobox } from '@/components/ui/combobox'
import {
  IProtocol,
  IModFile,
  IDoomVersion,
  InsertModFile,
  ISourcePort,
  IAppSettings
} from '@shared/schema'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/api'
import ModFileList from './ModFileList'
import { ProtocolConfigControl } from './ProtocolConfigControl'
import { ProtocolScreenshotPicker } from './ProtocolScreenshotPicker'
import { DiscardChangesDialog } from './DiscardChangesDialog'
import { DeleteProtocolDialog } from './DeleteProtocolDialog'
import { useProtocolActions } from '@/hooks/useProtocolActions'
import { useExportModpack } from '@/hooks/useExportModpack'
import { CopyButton } from '@/components/ui/copy-button'
import { Download, Gamepad2, Trash2, Save, Play } from 'lucide-react'
import { slugify, buildLaunchCommand } from '@/lib/utils'

interface GameSettingsModalProps {
  protocolId: string | null
  isOpen: boolean
  onClose: () => void
  doomVersions: IDoomVersion[] | undefined
}

interface GameSettingsContentProps {
  initialProtocol: IProtocol
  initialFiles: IModFile[]
  protocolId: string
  onClose: () => void
  doomVersions: IDoomVersion[] | undefined
  sourcePorts: ISourcePort[]
  defaultSourcePortId?: string
  showLaunchPreview?: boolean
  /** Lets the outer Dialog's outside-click/Escape handling defer to this component's dirty check. */
  registerAttemptClose: (fn: (event: Event) => void) => void
}

const GameSettingsContent: React.FC<GameSettingsContentProps> = ({
  initialProtocol,
  initialFiles,
  protocolId,
  onClose,
  doomVersions,
  sourcePorts,
  showLaunchPreview = true,
  registerAttemptClose
}) => {
  const [protocol, setProtocol] = useState<IProtocol>(initialProtocol)
  const [files, setFiles] = useState<InsertModFile[]>(initialFiles)
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Unsaved-changes detection — covers every field edit and mod file change
  const isDirty = useMemo(
    () =>
      JSON.stringify(protocol) !== JSON.stringify(initialProtocol) ||
      JSON.stringify(files) !== JSON.stringify(initialFiles),
    [protocol, files, initialProtocol, initialFiles]
  )

  // Guard outside-click/Escape dismissal when there are unsaved changes
  useEffect(() => {
    registerAttemptClose((event: Event) => {
      if (isDirty) {
        event.preventDefault()
        setShowDiscardConfirm(true)
      }
    })
  }, [isDirty, registerAttemptClose])

  const { data: settings } = useQuery<IAppSettings>({
    queryKey: ['/api/settings'],
    queryFn: api.getSettings
  })

  // Compute launch command preview
  const launchCommand = useMemo(() => {
    const sourcePort = sourcePorts.find((p) => p.id === protocol.sourcePortId)
    const doomVersion = doomVersions?.find((v) => v.id === protocol.doomVersionId)

    // Compute config file path for protocol-specific config
    let configPath: string | undefined
    if (protocol.protocolConfig?.configFile && settings?.modsDirectory) {
      const baseDir = settings.modsDirectory.replace(/\/mods$/, '').replace(/\\mods$/, '')
      configPath = `${baseDir}/data/cfgs/${protocol.protocolConfig.configFile}`
    }

    return buildLaunchCommand({
      executable: sourcePort?.executablePath,
      iwad: doomVersion?.defaultIwad,
      doomVersionArgs: doomVersion?.args,
      files,
      saveDirectory: protocol.saveDirectory,
      launchParameters: protocol.launchParameters,
      modsDirectory: settings?.modsDirectory,
      savegamesPath: settings?.savegamesPath,
      configPath
    })
  }, [protocol, files, sourcePorts, doomVersions, settings])

  const {
    handleSave,
    handleDelete,
    handleLaunch,
    handleCreateFreshConfig,
    isSaving,
    isDeleting,
    isLaunching,
    isCreatingConfig
  } = useProtocolActions({
    protocolId,
    protocol,
    files,
    onClose,
    onConfigCreated: (result) => setProtocol((prev) => ({ ...prev, protocolConfig: result }))
  })

  const { handleExport } = useExportModpack(protocol, files, doomVersions, sourcePorts)

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ): void => {
    const { name, value } = e.target
    setProtocol((prev) => ({ ...prev, [name]: value }))
  }

  const handleSelectChange = (name: string, value: string): void => {
    setProtocol((prev) => ({ ...prev, [name]: value }))
  }

  const configStatus = protocol.protocolConfig
    ? {
        hasConfig: true,
        statusText: `Isolated config linked (${protocol.protocolConfig.configFile}).`
      }
    : {
        hasConfig: false,
        statusText:
          "No isolated config yet — this protocol shares the source port's global settings."
      }

  return (
    <div className="flex-1 overflow-y-auto min-h-0">
      <div className="space-y-4 p-4">
        <div className="flex gap-4 mb-4">
          <ProtocolScreenshotPicker
            title={protocol.title || protocol.name || ''}
            screenshotPath={protocol.screenshotPath}
            onScreenshotChange={(fileName) =>
              setProtocol((prev) => ({ ...prev, screenshotPath: fileName }))
            }
          />
          <div className="flex-1 space-y-4">
            <div>
              <Label
                htmlFor="title"
                className="text-xs uppercase tracking-widest text-app-muted font-mono font-bold"
              >
                Label
              </Label>
              <Input
                id="title"
                name="title"
                value={protocol.title || protocol.name || ''}
                onChange={handleInputChange}
                className="bg-app-primary border-app "
              />
            </div>
            <div>
              <Label
                htmlFor="description"
                className="text-xs uppercase tracking-widest text-app-muted font-mono font-bold"
              >
                Description
              </Label>
              <Textarea
                id="description"
                name="description"
                value={protocol.description || ''}
                onChange={handleInputChange}
                className="bg-app-primary border-app"
                rows={3}
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h3 className="text-lg mb-2">Base Configuration</h3>
            <div className="bg-app-primary p-3 rounded space-y-2">
              <div>
                <Label
                  htmlFor="doomVersionId"
                  className="text-xs uppercase tracking-widest text-app-muted font-mono font-bold"
                >
                  Base WAD
                </Label>
                <Select
                  value={protocol.doomVersionId?.toString() || ''}
                  onValueChange={(value) => handleSelectChange('doomVersionId', value)}
                >
                  <SelectTrigger className="bg-app-secondary border-app">
                    <SelectValue placeholder="Select Doom Version" />
                  </SelectTrigger>
                  <SelectContent className="bg-app-secondary border-app text-app-primary">
                    {doomVersions?.map((version) => (
                      <SelectItem key={version.id} value={version.id.toString()}>
                        {version.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label
                  htmlFor="sourcePortId"
                  className="text-xs uppercase tracking-widest text-app-muted font-mono font-bold"
                >
                  Source Port
                </Label>
                <Combobox
                  value={protocol.sourcePortId || ''}
                  onValueChange={(value) => handleSelectChange('sourcePortId', value)}
                  options={sourcePorts
                    .filter((p) => !p.ignored)
                    .map((p) => ({
                      value: p.id,
                      label: p.name,
                      description: p.version
                    }))}
                  placeholder="Select a source port"
                  className="w-full bg-app-secondary border-app"
                />
              </div>

              <div>
                <Label
                  htmlFor="saveDirectory"
                  className="text-xs uppercase tracking-widest text-app-muted font-mono font-bold"
                >
                  Save Directory
                </Label>
                <Input
                  id="saveDirectory"
                  name="saveDirectory"
                  value={protocol.saveDirectory || ''}
                  placeholder={`e.g. ~/saves/${slugify(protocol.title || 'game')}`}
                  onChange={handleInputChange}
                  className="bg-app-secondary border-app"
                />
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg mb-2">Mod Files</h3>
            <ModFileList files={files} onChange={setFiles} />
          </div>
        </div>

        <ProtocolConfigControl
          hasConfig={configStatus.hasConfig}
          statusText={configStatus.statusText}
          onCreateFresh={handleCreateFreshConfig}
          isCreating={isCreatingConfig}
        />

        <div>
          <Label
            htmlFor="launchParameters"
            className="text-xs uppercase tracking-widest text-app-muted font-mono font-bold"
          >
            Launch Parameters
          </Label>
          <Input
            id="launchParameters"
            name="launchParameters"
            value={protocol.launchParameters || ''}
            onChange={handleInputChange}
            placeholder="-skill 4 -warp 01"
            className="bg-app-primary border-app font-mono text-sm"
          />
        </div>
      </div>

      {showLaunchPreview && launchCommand && (
        <div className="px-4 py-2 bg-app-primary border-t border-app shrink-0 group">
          <div className="text-[0.625rem] uppercase tracking-widest text-app-muted font-mono font-bold mb-0.5 opacity-60">
            Launch Preview
          </div>
          <div className="flex items-start gap-2">
            <code className="text-xs text-app-muted font-mono break-all opacity-70 flex-1 min-w-0">
              {launchCommand}
            </code>
            <CopyButton text={launchCommand} className="mt-0.5" />
          </div>
        </div>
      )}
      <DialogFooter className="flex justify-between items-center bg-app-secondary border-t border-app p-4 shrink-0">
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleExport}
            className="bg-app-primary hover:bg-app-hover text-app-primary border-app"
            disabled={files.length === 0}
          >
            <Download className="w-4 h-4 mr-2" />
            Export JSON
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowDeleteConfirm(true)}
            className="bg-app-primary hover:bg-app-hover text-app-primary border-app"
            disabled={isDeleting}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete Instance
          </Button>
        </div>

        <div>
          <Button
            variant="outline"
            onClick={handleSave}
            className="mr-2 bg-app-primary hover:bg-app-hover text-app-primary border-app"
            disabled={isSaving}
          >
            <Save className="w-4 h-4 mr-2" />
            Save Changes
          </Button>
          <Button
            onClick={handleLaunch}
            className="bg-accent-highlight hover:opacity-90 text-white"
            disabled={isLaunching}
          >
            <Play className="w-4 h-4 mr-1.5 fill-current" />
            {isLaunching ? 'LAUNCHING...' : 'LAUNCH'}
          </Button>
        </div>
      </DialogFooter>

      <DiscardChangesDialog
        open={showDiscardConfirm}
        onOpenChange={setShowDiscardConfirm}
        onDiscard={() => {
          setShowDiscardConfirm(false)
          onClose()
        }}
        onSaveAndClose={() => {
          setShowDiscardConfirm(false)
          handleSave()
        }}
        isSaving={isSaving}
      />

      <DeleteProtocolDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        onConfirm={() => {
          setShowDeleteConfirm(false)
          handleDelete()
        }}
        isDeleting={isDeleting}
      />
    </div>
  )
}

export const GameSettingsModal: React.FC<GameSettingsModalProps> = ({
  protocolId,
  isOpen,
  onClose,
  doomVersions
}) => {
  // Fetch protocol details
  const { data, isLoading } = useQuery({
    queryKey: [`/api/protocols/${protocolId}`],
    queryFn: () => (protocolId ? api.getProtocol(protocolId) : Promise.resolve(null)),
    enabled: !!protocolId && isOpen
  })

  // Fetch settings for source ports list
  const { data: settings } = useQuery<IAppSettings>({
    queryKey: ['/api/settings'],
    queryFn: () => api.getSettings(),
    enabled: isOpen
  })

  const sourcePorts: ISourcePort[] = (settings as IAppSettings)?.sourcePorts || []
  const defaultSourcePortId = (settings as IAppSettings)?.defaultSourcePortId
  const showLaunchPreview = (settings as IAppSettings)?.showLaunchPreview ?? true

  // Fetch catalog for hydrating files with hashValue
  const { data: catalogFiles } = useQuery({
    queryKey: ['/api/mod-files/catalog'],
    queryFn: () => api.getModFileCatalog(),
    enabled: isOpen
  })

  const { hydratedProtocol, hydratedFiles } = useMemo(() => {
    if (!data || !('protocol' in data) || !data.protocol)
      return { hydratedProtocol: null, hydratedFiles: [] }

    const proto = data.protocol as IProtocol
    const protoFiles = (data.files || []) as IModFile[]

    if (catalogFiles && catalogFiles.length > 0) {
      const files = protoFiles.map((file) => {
        const catalogMatch = catalogFiles.find(
          (c) => c.hashValue === file.hashValue || c.fileName === file.fileName
        )
        if (catalogMatch) {
          return {
            ...file,
            hashValue: file.hashValue || catalogMatch.hashValue || '',
            filePath: file.filePath || catalogMatch.filePath || '',
            url: file.url || catalogMatch.url || ''
          }
        }
        return file
      })
      return { hydratedProtocol: proto, hydratedFiles: files }
    }

    return { hydratedProtocol: proto, hydratedFiles: protoFiles }
  }, [data, catalogFiles])

  // Lets GameSettingsContent's dirty-check intercept outside-click/Escape
  // dismissal before the outer Dialog actually closes.
  const attemptCloseRef = useRef<(event: Event) => void>(() => {})

  if (!isOpen) return null

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="bg-app-primary shadow-2xl border-app max-w-4xl h-[85vh] flex flex-col p-0 overflow-hidden"
        onPointerDownOutside={(event) => attemptCloseRef.current(event)}
        onEscapeKeyDown={(event) => attemptCloseRef.current(event)}
      >
        <div className="flex items-center justify-between p-4 border-b border-app bg-app-secondary">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-accent-highlight/10 rounded-md">
              <Gamepad2 className="w-5 h-5 text-accent-highlight" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold tracking-tight text-app-primary lowercase">
                {hydratedProtocol?.title || hydratedProtocol?.name || 'mod_settings'}
              </DialogTitle>
              <DialogDescription className="text-xs font-semibold font-mono text-app-muted uppercase tracking-widest opacity-80">
                UAC Launch Control // Mod Configuration
              </DialogDescription>
            </div>
          </div>
        </div>

        {isLoading || !hydratedProtocol ? (
          <div className="p-4 text-center">Loading protocol details...</div>
        ) : (
          <GameSettingsContent
            initialProtocol={hydratedProtocol}
            initialFiles={hydratedFiles}
            protocolId={protocolId!}
            onClose={onClose}
            doomVersions={doomVersions}
            sourcePorts={sourcePorts}
            defaultSourcePortId={defaultSourcePortId}
            showLaunchPreview={showLaunchPreview}
            registerAttemptClose={(fn) => {
              attemptCloseRef.current = fn
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

export default GameSettingsModal
