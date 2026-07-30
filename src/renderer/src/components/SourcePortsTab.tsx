import React, { useEffect, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Eye, EyeOff, Pencil, Trash2, FolderOpen, Download, ScanSearch, Plus } from 'lucide-react'
import { api, type ScannedPort } from '@/api'
import type { IAppSettings, ISourcePort, SourcePortFamily } from '@shared/schema'
import { PortDownloadModal } from '@/components/PortDownloadModal'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

interface SourcePortsTabProps {
  settings: IAppSettings
  setSettings: React.Dispatch<React.SetStateAction<IAppSettings>>
  /** Kick off a scan on mount — used by the onboarding wizard so arriving at
   *  this step starts working immediately instead of waiting on a click. */
  autoScan?: boolean
}

export const SourcePortsTab: React.FC<SourcePortsTabProps> = ({
  settings,
  setSettings,
  autoScan
}) => {
  const [editingPort, setEditingPort] = useState<ISourcePort | null>(null)
  const [showPortForm, setShowPortForm] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [scanResults, setScanResults] = useState<ScannedPort[] | null>(null)
  const [scanSelections, setScanSelections] = useState<boolean[]>([])
  const [showPortDownloadModal, setShowPortDownloadModal] = useState(false)

  const handleScanPorts = async (): Promise<void> => {
    setScanning(true)
    try {
      const results = await api.scanPorts()
      // Sort: un-configured first, then by family
      results.sort((a, b) => {
        const aExisting = settings.sourcePorts.some(
          (p) => p.executablePath.toLowerCase() === a.path.toLowerCase()
        )
        const bExisting = settings.sourcePorts.some(
          (p) => p.executablePath.toLowerCase() === b.path.toLowerCase()
        )
        if (aExisting !== bExisting) return aExisting ? 1 : -1
        return a.family.localeCompare(b.family)
      })
      setScanResults(results)
      setScanSelections(
        results.map(
          (r) =>
            !settings.sourcePorts.some(
              (p) => p.executablePath.toLowerCase() === r.path.toLowerCase()
            )
        )
      )
    } catch (e) {
      console.error('Failed to scan for source ports:', e)
    } finally {
      setScanning(false)
    }
  }

  const hasAutoScannedRef = useRef(false)
  useEffect(() => {
    if (!autoScan || hasAutoScannedRef.current) return
    hasAutoScannedRef.current = true
    handleScanPorts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoScan])

  const handleImportScanned = (): void => {
    if (!scanResults) return
    setSettings((prev) => {
      const newPorts = [...prev.sourcePorts]
      for (let i = 0; i < scanResults.length; i++) {
        if (!scanSelections[i]) continue
        const r = scanResults[i]
        const exists = newPorts.some((p) => p.executablePath.toLowerCase() === r.path.toLowerCase())
        if (!exists) {
          newPorts.push({
            id: crypto.randomUUID(),
            name: r.name,
            executablePath: r.path,
            family: r.family as SourcePortFamily,
            ignored: false
          })
        }
      }
      return { ...prev, sourcePorts: newPorts }
    })
    setScanResults(null)
    setScanSelections([])
  }

  const handleAddPort = async (): Promise<void> => {
    const result = await api.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Executables', extensions: ['*'] }]
    })

    if (!result.canceled && result.filePaths.length > 0) {
      const exePath = result.filePaths[0]
      const fileName = exePath.split(/[\\/]/).pop() || ''
      const lower = fileName.toLowerCase()
      let family: SourcePortFamily = 'other'
      if (lower.includes('uzdoom')) family = 'uzdoom'
      else if (lower.includes('lzdoom')) family = 'lzdoom'
      else if (lower.includes('helion')) family = 'helion'
      else if (lower.includes('gzdoom')) family = 'gzdoom'
      else if (lower.includes('zdoom')) family = 'zdoom'
      else if (lower.includes('zandronum')) family = 'zandronum'

      const newPort: ISourcePort = {
        id: crypto.randomUUID(),
        name: fileName.replace(/\.(exe|AppImage)$/i, ''),
        executablePath: exePath,
        family,
        ignored: false
      }
      setEditingPort(newPort)
      setShowPortForm(true)
    }
  }

  const handleSavePort = (port: ISourcePort): void => {
    setSettings((prev) => {
      const existing = prev.sourcePorts.findIndex((p) => p.id === port.id)
      let updated: ISourcePort[]
      if (existing >= 0) {
        updated = [...prev.sourcePorts]
        updated[existing] = port
      } else {
        updated = [...prev.sourcePorts, port]
      }
      return { ...prev, sourcePorts: updated }
    })
    setShowPortForm(false)
    setEditingPort(null)
  }

  const handleDeletePort = (id: string): void => {
    setSettings((prev) => {
      const updated = prev.sourcePorts.filter((p) => p.id !== id)
      const newDefault =
        prev.defaultSourcePortId === id
          ? updated.length > 0
            ? updated[0].id
            : undefined
          : prev.defaultSourcePortId
      return { ...prev, sourcePorts: updated, defaultSourcePortId: newDefault }
    })
  }

  const handleSetDefaultPort = (id: string): void => {
    setSettings((prev) => ({ ...prev, defaultSourcePortId: id }))
  }

  return (
    <div className="space-y-4">
      <Label className="text-xs uppercase tracking-widest text-app-muted font-mono font-bold block border-b border-app pb-2">
        CORE INFRASTRUCTURE
      </Label>

      {/* Source Ports List */}
      <div className="bg-app-secondary p-4 rounded-xl border border-app shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs text-app-muted font-bold uppercase tracking-wider">
            Source Ports
          </Label>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleScanPorts}
              disabled={scanning}
              className="text-xs h-8 bg-app-primary hover:bg-app-hover text-app-primary border-app"
            >
              <ScanSearch className="w-3 h-3 mr-1" />
              {scanning ? 'Scanning…' : 'Scan Path'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowPortDownloadModal(true)}
              className="text-xs h-8 bg-app-primary hover:bg-app-hover text-app-primary border-app"
            >
              <Download className="w-3 h-3 mr-1" />
              Get Port
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleAddPort}
              className="text-xs h-8 bg-app-primary hover:bg-app-hover text-app-primary border-app"
            >
              <Plus className="w-3 h-3 mr-1" />
              Add Port
            </Button>
          </div>
        </div>

        {settings.sourcePorts.length === 0 ? (
          <p className="text-xs text-app-muted italic py-2">
            No source ports configured. Add at least one to launch games.
          </p>
        ) : (
          <div className="space-y-2 pt-1">
            {settings.sourcePorts.map((port) => (
              <div
                key={port.id}
                className="flex items-center gap-3 p-2.5 bg-app-primary rounded-lg border border-app group hover:border-accent-highlight/30 transition-colors"
              >
                {/* Default indicator */}
                <button
                  onClick={() => handleSetDefaultPort(port.id)}
                  className={`shrink-0 w-4 h-4 rounded-full border-2 transition-colors ${
                    settings.defaultSourcePortId === port.id
                      ? 'border-accent-highlight bg-accent-highlight'
                      : 'border-app-muted/40 hover:border-app-muted'
                  }`}
                  title={
                    settings.defaultSourcePortId === port.id ? 'Default port' : 'Set as default'
                  }
                />

                {/* Family badge */}
                <span className="text-[0.625rem] font-mono uppercase px-1.5 py-0.5 rounded bg-app-secondary border border-app/50 text-app-muted shrink-0">
                  {port.family}
                </span>

                {/* Name + version */}
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-app-primary block truncate">
                    {port.name}
                  </span>
                  <span className="text-xs text-app-muted truncate block">
                    {port.version ? `${port.version} — ` : ''}
                    {port.executablePath}
                  </span>
                </div>

                {/* Ignored toggle */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => handleSavePort({ ...port, ignored: !port.ignored })}
                      className={`shrink-0 p-1.5 rounded transition-colors ${
                        port.ignored
                          ? 'text-red-400 hover:text-red-300'
                          : 'text-app-muted hover:text-app-primary'
                      }`}
                    >
                      {port.ignored ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-xs">
                    {port.ignored
                      ? 'Hidden from protocol/launch selection lists. Click to show it again.'
                      : 'Hide this port from selection lists without deleting it.'}
                  </TooltipContent>
                </Tooltip>

                {/* Edit */}
                <button
                  onClick={() => {
                    setEditingPort(port)
                    setShowPortForm(true)
                  }}
                  className="shrink-0 p-1.5 text-app-muted hover:text-accent-highlight transition-colors rounded"
                  title="Edit port"
                >
                  <Pencil className="w-4 h-4" />
                </button>

                {/* Delete */}
                <button
                  onClick={() => handleDeletePort(port.id)}
                  className="shrink-0 p-1.5 text-app-muted hover:text-red-400 transition-colors rounded"
                  title="Delete port"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Port Download Modal */}
      <PortDownloadModal
        open={showPortDownloadModal}
        onOpenChange={setShowPortDownloadModal}
        onPortDownloaded={(result) => {
          setSettings((prev) => ({
            ...prev,
            sourcePorts: [
              ...prev.sourcePorts,
              {
                id: crypto.randomUUID(),
                name: result.name,
                executablePath: result.executablePath,
                family: result.family as SourcePortFamily,
                version: result.version,
                ignored: false
              }
            ]
          }))
        }}
        existingPorts={settings.sourcePorts.map((p) => `${p.family}:${p.name}`)}
      />

      {/* Scan Results */}
      {scanResults && scanResults.length > 0 && (
        <div className="mt-2 border border-accent-highlight/20 rounded-lg p-3 bg-app-secondary/50 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-app-muted">
              Found {scanResults.length} port{scanResults.length !== 1 ? 's' : ''}
            </span>
            {scanSelections.some(Boolean) && (
              <Button
                size="sm"
                onClick={handleImportScanned}
                className="text-xs h-7 bg-accent-highlight hover:opacity-90 text-white"
              >
                Add Selected ({scanSelections.filter(Boolean).length})
              </Button>
            )}
          </div>
          <div className="space-y-1 max-h-56 overflow-y-auto">
            {scanResults.map((r, i) => {
              const alreadyAdded = settings.sourcePorts.some(
                (p) => p.executablePath.toLowerCase() === r.path.toLowerCase()
              )
              return (
                <div
                  key={r.path}
                  className={`flex items-center gap-2 text-xs py-1 ${alreadyAdded ? 'opacity-60' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={scanSelections[i] ?? false}
                    disabled={alreadyAdded}
                    onChange={() =>
                      setScanSelections((prev) => {
                        const copy = [...prev]
                        copy[i] = !copy[i]
                        return copy
                      })
                    }
                    className="w-3.5 h-3.5 accent-accent-highlight shrink-0"
                  />
                  <span className="font-mono uppercase text-[0.625rem] text-app-muted w-14 shrink-0">
                    {r.family}
                  </span>
                  <span className="flex-1 truncate text-app-primary">{r.name}</span>
                  <span className="text-app-muted truncate max-w-56 hidden sm:block">{r.path}</span>
                  {alreadyAdded && (
                    <span className="text-green-500 shrink-0 text-[0.625rem]">already added</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Inline Port Form (add/edit) */}
      {showPortForm && editingPort && (
        <PortForm
          port={editingPort}
          onSave={handleSavePort}
          onCancel={() => {
            setShowPortForm(false)
            setEditingPort(null)
          }}
        />
      )}
    </div>
  )
}

// ─── Source Port inline form ────────────────────────────────────────────────
interface PortFormProps {
  port: ISourcePort
  onSave: (port: ISourcePort) => void
  onCancel: () => void
}

const PortForm: React.FC<PortFormProps> = ({ port, onSave, onCancel }) => {
  const [name, setName] = useState(port.name)
  const [version, setVersion] = useState(port.version || '')
  const [family, setFamily] = useState<SourcePortFamily>(port.family)
  const [executablePath, setExecutablePath] = useState(port.executablePath)

  return (
    <div className="bg-app-secondary p-4 rounded-xl border border-app shadow-sm space-y-3 animate-in slide-in-from-top-2 duration-200">
      <Label className="text-xs uppercase tracking-widest text-app-muted font-mono font-bold">
        {port.id ? 'Edit Source Port' : 'New Source Port'}
      </Label>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-app-muted">Name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="bg-app-primary border-app h-9 text-sm"
            placeholder="e.g. GZDoom 4.12.2"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-app-muted">Version (optional)</Label>
          <Input
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            className="bg-app-primary border-app h-9 text-sm"
            placeholder="e.g. 4.12.2"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-app-muted">Executable Path</Label>
        <div className="flex gap-2">
          <Input
            value={executablePath}
            onChange={(e) => setExecutablePath(e.target.value)}
            className="bg-app-primary border-app h-9 text-sm flex-1"
          />
          <Button
            size="icon"
            variant="ghost"
            className="h-9 w-9 shrink-0 hover:bg-accent-highlight/10 text-accent-highlight border border-app/30"
            onClick={async () => {
              const result = await api.showOpenDialog({
                properties: ['openFile'],
                filters: [{ name: 'Executables', extensions: ['*'] }]
              })
              if (!result.canceled && result.filePaths.length > 0) {
                setExecutablePath(result.filePaths[0])
              }
            }}
          >
            <FolderOpen className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-app-muted">Family</Label>
        <Select value={family} onValueChange={(v) => setFamily(v as SourcePortFamily)}>
          <SelectTrigger className="bg-app-primary border-app h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-app-secondary border-app">
            {(['uzdoom', 'gzdoom', 'zdoom', 'zandronum', 'lzdoom', 'helion', 'other'] as const).map(
              (f) => (
                <SelectItem key={f} value={f} className="text-app-primary">
                  {f}
                </SelectItem>
              )
            )}
          </SelectContent>
        </Select>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onCancel}
          className="text-xs bg-transparent border-app hover:bg-app-hover text-app-muted h-8"
        >
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={() =>
            onSave({
              ...port,
              name,
              version: version || undefined,
              family,
              executablePath
            })
          }
          disabled={!name.trim() || !executablePath.trim()}
          className="text-xs bg-accent-highlight text-white hover:bg-accent-highlight/90 h-8"
        >
          Save
        </Button>
      </div>
    </div>
  )
}

export default SourcePortsTab
