import { useTranslate } from '@tolgee/react'
import React, { useEffect, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Cpu,
  Eye,
  EyeOff,
  Info,
  Pencil,
  Trash2,
  FolderOpen,
  Download,
  ScanSearch,
  Plus
} from 'lucide-react'
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
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import {
  SettingsDefaultControl,
  SettingsResourceWorkbench
} from './settings/SettingsResourceWorkbench'

import { createLogger } from '@shared/logger'

const log = createLogger('SourcePortsTabx')
interface SourcePortsTabProps {
  settings: IAppSettings
  setSettings: React.Dispatch<React.SetStateAction<IAppSettings>>
  /** Kick off a scan on mount — used by the onboarding wizard so arriving at
   *  this step starts working immediately instead of waiting on a click. */
  autoScan?: boolean
  /** The settings workbench stages edits in the parent; onboarding keeps its inline form. */
  layout?: 'standard' | 'workbench'
}

export const SourcePortsTab: React.FC<SourcePortsTabProps> = ({
  settings,
  setSettings,
  autoScan,
  layout = 'standard'
}) => {
  const { t } = useTranslate('desktop')
  const [editingPort, setEditingPort] = useState<ISourcePort | null>(null)
  const [showPortForm, setShowPortForm] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [scanResults, setScanResults] = useState<ScannedPort[] | null>(null)
  const [scanSelections, setScanSelections] = useState<boolean[]>([])
  const [showPortDownloadModal, setShowPortDownloadModal] = useState(false)
  const [selectedPortId, setSelectedPortId] = useState<string | undefined>(
    () => settings.defaultSourcePortId ?? settings.sourcePorts[0]?.id
  )
  const [detailOpen, setDetailOpen] = useState(false)
  const [scanError, setScanError] = useState(false)
  const sourcePortsRef = useRef(settings.sourcePorts)
  useEffect(() => {
    sourcePortsRef.current = settings.sourcePorts
  }, [settings.sourcePorts])
  const selectedPort =
    settings.sourcePorts.find((port) => port.id === selectedPortId) ?? settings.sourcePorts[0]

  const selectPort = (id: string): void => {
    setSelectedPortId(id)
    setDetailOpen(true)
  }

  const updatePort = (id: string, change: Partial<ISourcePort>): void => {
    setSettings((prev) => ({
      ...prev,
      sourcePorts: prev.sourcePorts.map((port) => (port.id === id ? { ...port, ...change } : port))
    }))
  }

  const handleScanPorts = async (): Promise<void> => {
    setScanning(true)
    setScanError(false)
    try {
      const results = await api.scanPorts()
      const currentPorts = sourcePortsRef.current
      // Sort: un-configured first, then by family
      results.sort((a, b) => {
        const aExisting = currentPorts.some(
          (p) => p.executablePath.toLowerCase() === a.path.toLowerCase()
        )
        const bExisting = currentPorts.some(
          (p) => p.executablePath.toLowerCase() === b.path.toLowerCase()
        )
        if (aExisting !== bExisting) return aExisting ? 1 : -1
        return a.family.localeCompare(b.family)
      })
      setScanResults(results)
      setScanSelections(
        results.map(
          (r) => !currentPorts.some((p) => p.executablePath.toLowerCase() === r.path.toLowerCase())
        )
      )
    } catch (e: unknown) {
      log.error('Failed to scan for source ports:', e)
      setScanError(true)
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
    const additions: ISourcePort[] = scanResults
      .filter(
        (result, index) =>
          scanSelections[index] &&
          !settings.sourcePorts.some(
            (port) => port.executablePath.toLowerCase() === result.path.toLowerCase()
          )
      )
      .map((result) => ({
        id: crypto.randomUUID(),
        name: result.name,
        executablePath: result.path,
        family: result.family as SourcePortFamily,
        ignored: false
      }))
    setSettings((prev) => {
      const newPorts = [...prev.sourcePorts]
      for (const port of additions) {
        if (
          !newPorts.some(
            (existing) =>
              existing.executablePath.toLowerCase() === port.executablePath.toLowerCase()
          )
        )
          newPorts.push(port)
      }
      return { ...prev, sourcePorts: newPorts }
    })
    if (layout === 'workbench' && additions[0]) selectPort(additions[0].id)
    setScanResults(null)
    setScanSelections([])
  }

  const handleAddPort = async (): Promise<void> => {
    if (layout === 'workbench') {
      const draft: ISourcePort = {
        id: crypto.randomUUID(),
        name: '',
        executablePath: '',
        family: 'other',
        ignored: false
      }
      setSettings((prev) => ({
        ...prev,
        sourcePorts: [...prev.sourcePorts, draft]
      }))
      selectPort(draft.id)
      return
    }
    const result = await api.showOpenDialog({
      properties: ['openFile'],
      filters: [
        {
          name: t('sourcePorts.dialog.executables', 'Executables'),
          extensions: ['*']
        }
      ]
    })

    if (!result.canceled && result.filePaths.length > 0) {
      const exePath = result.filePaths[0]
      const { name, family } = inferPortIdentity(exePath)

      const newPort: ISourcePort = {
        id: crypto.randomUUID(),
        name,
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
    if (selectedPort?.id === id) {
      const remaining = settings.sourcePorts.filter((port) => port.id !== id)
      const index = settings.sourcePorts.findIndex((port) => port.id === id)
      setSelectedPortId(remaining[Math.min(index, remaining.length - 1)]?.id)
      if (remaining.length === 0) setDetailOpen(false)
    }
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

  const portDownloadModal = (
    <PortDownloadModal
      open={showPortDownloadModal}
      onOpenChange={setShowPortDownloadModal}
      onPortDownloaded={(result) => {
        const downloadedPort: ISourcePort = {
          id: crypto.randomUUID(),
          name: result.name,
          executablePath: result.executablePath,
          family: result.family as SourcePortFamily,
          version: result.version,
          ignored: false
        }
        setSettings((prev) => ({
          ...prev,
          sourcePorts: [...prev.sourcePorts, downloadedPort]
        }))
        if (layout === 'workbench') selectPort(downloadedPort.id)
      }}
      existingPorts={settings.sourcePorts.flatMap((port) => [
        `${port.family}:${port.name}`,
        ...(port.version ? [`${port.family}:${port.version}`] : [])
      ])}
    />
  )

  const scanResultsContent = scanResults && scanResults.length > 0 && (
    <div className="mt-2 border border-accent-highlight/20 rounded-lg p-3 bg-app-secondary/50 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-app-muted">
          {t(
            'sourcePorts.scan.found',
            '{count, plural, one {Found # port} other {Found # ports}}',
            {
              count: scanResults.length
            }
          )}
        </span>
        {scanSelections.some(Boolean) && (
          <Button
            size="sm"
            onClick={handleImportScanned}
            className="text-xs h-7 bg-accent-highlight hover:opacity-90 text-white"
          >
            {t('sourcePorts.scan.addSelected', 'Add Selected ({count, number})', {
              count: scanSelections.filter(Boolean).length
            })}
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
                aria-label={t('sourcePorts.scan.select', 'Select {name}', {
                  name: r.name
                })}
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
                {r.family === 'other' ? t('sourcePorts.form.other', 'Other') : r.family}
              </span>
              <span className="flex-1 truncate text-app-primary">{r.name}</span>
              <span className="text-app-muted truncate max-w-56 hidden sm:block">{r.path}</span>
              {alreadyAdded && (
                <span className="text-green-500 shrink-0 text-[0.625rem]">
                  {t('sourcePorts.alreadyAdded', 'already added')}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )

  if (layout === 'workbench') {
    return (
      <section
        className="settings-resource-section"
        aria-label={t('sourcePorts.title', 'Source Ports')}
      >
        <div className="settings-section-heading">
          <div>
            <h2>{t('sourcePorts.title', 'Source Ports')}</h2>
            <p>
              {t('sourcePorts.workbench.description', 'Engines and their launch configuration.')}
            </p>
          </div>
        </div>
        <div className="settings-toolbar">
          <p className="text-xs text-app-muted">
            {t('sourcePorts.workbench.selectHint', 'Select an engine to edit')}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleScanPorts}
              disabled={scanning}
            >
              <ScanSearch className="size-4" aria-hidden="true" />
              {scanning
                ? t('sourcePorts.scanning', 'Scanning…')
                : t('sourcePorts.scanPath', 'Scan Path')}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setShowPortDownloadModal(true)}
            >
              <Download className="size-4" aria-hidden="true" />
              {t('sourcePorts.get', 'Get Port')}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={handleAddPort}>
              <Plus className="size-4" aria-hidden="true" />
              {t('sourcePorts.add', 'Add Port')}
            </Button>
          </div>
        </div>
        <SettingsResourceWorkbench
          listLabel={t('sourcePorts.workbench.installed', 'Installed engines')}
          count={settings.sourcePorts.length}
          detailOpen={detailOpen}
          onBack={() => setDetailOpen(false)}
          list={
            settings.sourcePorts.length === 0 ? (
              <p className="p-4 text-sm text-app-muted">
                {t(
                  'sourcePorts.empty',
                  'No source ports configured. Add at least one to launch games.'
                )}
              </p>
            ) : (
              settings.sourcePorts.map((port) => (
                <button
                  key={port.id}
                  type="button"
                  data-settings-resource-id={port.id}
                  className="settings-resource-row"
                  aria-pressed={selectedPort?.id === port.id}
                  onClick={() => selectPort(port.id)}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {port.name || t('sourcePorts.workbench.unnamed', 'New source port')}
                    </span>
                    <span className="mt-1 block truncate text-xs text-app-muted">
                      {port.family === 'other'
                        ? t('sourcePorts.form.other', 'Other')
                        : port.family.toUpperCase()}
                      {port.version ? ` / ${port.version}` : ''}
                    </span>
                  </span>
                  {port.ignored && (
                    <EyeOff
                      className="size-4 shrink-0 text-app-muted"
                      aria-label={t('sourcePorts.workbench.hidden', 'Hidden from launcher')}
                    />
                  )}
                  <span className="settings-resource-badge-slot">
                    {settings.defaultSourcePortId === port.id && (
                      <span className="settings-resource-badge">
                        {t('settings.resources.default', 'Default')}
                      </span>
                    )}
                  </span>
                </button>
              ))
            )
          }
          editor={
            selectedPort ? (
              <PortWorkbenchEditor
                key={selectedPort.id}
                port={selectedPort}
                isDefault={settings.defaultSourcePortId === selectedPort.id}
                onChange={(change) => updatePort(selectedPort.id, change)}
                onMakeDefault={() => handleSetDefaultPort(selectedPort.id)}
                onRemove={() => handleDeletePort(selectedPort.id)}
              />
            ) : (
              <p className="text-sm text-app-muted">
                {t(
                  'sourcePorts.workbench.emptyEditor',
                  'Add a source port or scan for installed engines to configure one here.'
                )}
              </p>
            )
          }
        />
        <p className="settings-info">
          <Info className="size-4 shrink-0" aria-hidden="true" />
          {t(
            'sourcePorts.workbench.stagedHint',
            'Entry changes are staged. Downloads start separately.'
          )}
        </p>
        {portDownloadModal}
        <Dialog
          open={scanResults !== null || scanError}
          onOpenChange={(open) => {
            if (!open) {
              setScanResults(null)
              setScanSelections([])
              setScanError(false)
            }
          }}
        >
          <DialogContent className="max-h-[85dvh] max-w-2xl overflow-y-auto bg-app-primary border-app">
            <DialogHeader>
              <DialogTitle>
                {t('sourcePorts.workbench.scanTitle', 'Detected source ports')}
              </DialogTitle>
              <DialogDescription>
                {t(
                  'sourcePorts.workbench.scanDescription',
                  'Choose the detected engines to add to your configuration.'
                )}
              </DialogDescription>
            </DialogHeader>
            {scanError ? (
              <p role="alert" className="text-sm text-destructive">
                {t(
                  'sourcePorts.workbench.scanFailed',
                  'The scan failed. Try scanning again, or add an executable manually.'
                )}
              </p>
            ) : scanResults?.length === 0 ? (
              <p className="text-sm text-app-muted">
                {t(
                  'sourcePorts.workbench.scanEmpty',
                  'No supported source ports were detected. Use Add Port to choose an executable manually.'
                )}
              </p>
            ) : (
              scanResultsContent
            )}
          </DialogContent>
        </Dialog>
      </section>
    )
  }

  return (
    <div className="space-y-4">
      <Label className="text-xs uppercase tracking-widest text-app-muted font-mono font-bold block border-b border-app pb-2">
        {t('sourcePorts.infrastructure', 'CORE INFRASTRUCTURE')}
      </Label>

      {/* Source Ports List */}
      <div className="bg-app-secondary p-4 rounded-xl border border-app shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs text-app-muted font-bold uppercase tracking-wider">
            {t('sourcePorts.title', 'Source Ports')}
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
              {scanning
                ? t('sourcePorts.scanning', 'Scanning…')
                : t('sourcePorts.scanPath', 'Scan Path')}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowPortDownloadModal(true)}
              className="text-xs h-8 bg-app-primary hover:bg-app-hover text-app-primary border-app"
            >
              <Download className="w-3 h-3 mr-1" />
              {t('sourcePorts.get', 'Get Port')}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleAddPort}
              className="text-xs h-8 bg-app-primary hover:bg-app-hover text-app-primary border-app"
            >
              <Plus className="w-3 h-3 mr-1" />
              {t('sourcePorts.add', 'Add Port')}
            </Button>
          </div>
        </div>

        {settings.sourcePorts.length === 0 ? (
          <p className="text-xs text-app-muted italic py-2">
            {t(
              'sourcePorts.empty',
              'No source ports configured. Add at least one to launch games.'
            )}
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
                    settings.defaultSourcePortId === port.id
                      ? t('sourcePorts.default', 'Default port')
                      : t('sourcePorts.setDefault', 'Set as default')
                  }
                />

                {/* Family badge */}
                <span className="text-[0.625rem] font-mono uppercase px-1.5 py-0.5 rounded bg-app-secondary border border-app/50 text-app-muted shrink-0">
                  {port.family === 'other' ? t('sourcePorts.form.other', 'Other') : port.family}
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
                      aria-label={
                        port.ignored
                          ? t('sourcePorts.show', 'Show {name}', {
                              name: port.name
                            })
                          : t('sourcePorts.hide', 'Hide {name}', {
                              name: port.name
                            })
                      }
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
                      ? t(
                          'sourcePorts.hiddenHint',
                          'Hidden from protocol/launch selection lists. Click to show it again.'
                        )
                      : t(
                          'sourcePorts.hideHint',
                          'Hide this port from selection lists without deleting it.'
                        )}
                  </TooltipContent>
                </Tooltip>

                {/* Edit */}
                <button
                  onClick={() => {
                    setEditingPort(port)
                    setShowPortForm(true)
                  }}
                  className="shrink-0 p-1.5 text-app-muted hover:text-accent-highlight transition-colors rounded"
                  title={t('sourcePorts.edit', 'Edit port')}
                >
                  <Pencil className="w-4 h-4" />
                </button>

                {/* Delete */}
                <button
                  onClick={() => handleDeletePort(port.id)}
                  className="shrink-0 p-1.5 text-app-muted hover:text-red-400 transition-colors rounded"
                  title={t('sourcePorts.delete', 'Delete port')}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {portDownloadModal}

      {scanResultsContent}

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

function inferPortIdentity(executablePath: string): Pick<ISourcePort, 'name' | 'family'> {
  const fileName = executablePath.split(/[\\/]/).pop() || ''
  const lower = fileName.toLowerCase()
  let family: SourcePortFamily = 'other'
  if (lower.includes('uzdoom')) family = 'uzdoom'
  else if (lower.includes('lzdoom')) family = 'lzdoom'
  else if (lower.includes('helion')) family = 'helion'
  else if (lower.includes('gzdoom')) family = 'gzdoom'
  else if (lower.includes('zdoom')) family = 'zdoom'
  else if (lower.includes('zandronum')) family = 'zandronum'
  return { name: fileName.replace(/\.(exe|AppImage)$/i, ''), family }
}

interface PortWorkbenchEditorProps {
  port: ISourcePort
  isDefault: boolean
  onChange: (change: Partial<ISourcePort>) => void
  onMakeDefault: () => void
  onRemove: () => void
}

const PortWorkbenchEditor: React.FC<PortWorkbenchEditorProps> = ({
  port,
  isDefault,
  onChange,
  onMakeDefault,
  onRemove
}) => {
  const { t } = useTranslate('desktop')
  const fieldId = `source-port-${port.id}`

  return (
    <>
      <div className="settings-editor-heading">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center" aria-hidden="true">
          <Cpu className="size-8 text-app-muted" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="break-words">
            {port.name || t('sourcePorts.workbench.unnamed', 'New source port')}
          </h3>
          <p className="text-xs text-app-muted">
            {port.family === 'other'
              ? t('sourcePorts.form.other', 'Other')
              : port.family.toUpperCase()}
            {port.version ? ` / ${port.version}` : ''}
          </p>
        </div>
      </div>
      <SettingsDefaultControl isDefault={isDefault} onSelect={onMakeDefault} />
      <div className="settings-field">
        <Label htmlFor={`${fieldId}-name`}>{t('sourcePorts.form.name', 'Name')}</Label>
        <Input
          id={`${fieldId}-name`}
          name="name"
          className="settings-control"
          value={port.name}
          required
          onChange={(event) => onChange({ name: event.target.value })}
          placeholder={t('sourcePorts.form.nameExample', 'e.g. {name}', {
            name: 'GZDoom 4.12.2'
          })}
        />
      </div>
      <div className="settings-field">
        <Label htmlFor={`${fieldId}-version`}>
          {t('sourcePorts.form.version', 'Version (optional)')}
        </Label>
        <Input
          id={`${fieldId}-version`}
          name="version"
          className="settings-control"
          value={port.version ?? ''}
          onChange={(event) => onChange({ version: event.target.value || undefined })}
          placeholder={t('sourcePorts.form.versionExample', 'e.g. {version}', {
            version: '4.12.2'
          })}
        />
      </div>
      <div className="settings-field">
        <Label htmlFor={`${fieldId}-family`}>{t('sourcePorts.form.family', 'Family')}</Label>
        <Select
          value={port.family}
          onValueChange={(family) => onChange({ family: family as SourcePortFamily })}
        >
          <SelectTrigger id={`${fieldId}-family`} className="settings-control">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-app-secondary border-app">
            {(['uzdoom', 'gzdoom', 'zdoom', 'zandronum', 'lzdoom', 'helion', 'other'] as const).map(
              (family) => (
                <SelectItem key={family} value={family} className="text-app-primary">
                  {family === 'other' ? t('sourcePorts.form.other', 'Other') : family.toUpperCase()}
                </SelectItem>
              )
            )}
          </SelectContent>
        </Select>
      </div>
      <div className="settings-field">
        <Label htmlFor={`${fieldId}-path`}>{t('sourcePorts.form.path', 'Executable Path')}</Label>
        <Input
          id={`${fieldId}-path`}
          name="executablePath"
          className="settings-control font-mono"
          value={port.executablePath}
          required
          onChange={(event) => onChange({ executablePath: event.target.value })}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-fit"
          onClick={async () => {
            const result = await api.showOpenDialog({
              properties: ['openFile'],
              defaultPath: port.executablePath || undefined,
              filters: [
                {
                  name: t('sourcePorts.dialog.executables', 'Executables'),
                  extensions: ['*']
                }
              ]
            })
            if (!result.canceled && result.filePaths.length > 0) {
              const executablePath = result.filePaths[0]
              onChange({
                ...(!port.name.trim() ? inferPortIdentity(executablePath) : {}),
                executablePath
              })
            }
          }}
        >
          <FolderOpen className="size-4" aria-hidden="true" />
          {t('sourcePorts.workbench.chooseExecutable', 'Choose executable')}
        </Button>
        {(!port.name.trim() || !port.executablePath.trim()) && (
          <p className="text-sm text-app-muted">
            {t(
              'sourcePorts.workbench.requiredFields',
              'Enter a name and executable path before applying changes.'
            )}
          </p>
        )}
      </div>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <Label htmlFor={`${fieldId}-hidden`}>
            {t('sourcePorts.workbench.hideFromLauncher', 'Hide from launcher')}
          </Label>
          <p
            id={`${fieldId}-hidden-description`}
            className="text-xs leading-relaxed text-app-muted"
          >
            {t('sourcePorts.hideHint', 'Hide this port from selection lists without deleting it.')}
          </p>
        </div>
        <Switch
          id={`${fieldId}-hidden`}
          aria-describedby={`${fieldId}-hidden-description`}
          checked={port.ignored ?? false}
          onCheckedChange={(ignored) => onChange({ ignored })}
        />
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-destructive hover:text-destructive"
        onClick={onRemove}
      >
        <Trash2 className="size-4" aria-hidden="true" />
        {t('sourcePorts.workbench.remove', 'Remove entry')}
      </Button>
    </>
  )
}

// ─── Source Port inline form ────────────────────────────────────────────────
interface PortFormProps {
  port: ISourcePort
  onSave: (port: ISourcePort) => void
  onCancel: () => void
}

const PortForm: React.FC<PortFormProps> = ({ port, onSave, onCancel }) => {
  const { t } = useTranslate('desktop')
  const [name, setName] = useState(port.name)
  const [version, setVersion] = useState(port.version || '')
  const [family, setFamily] = useState<SourcePortFamily>(port.family)
  const [executablePath, setExecutablePath] = useState(port.executablePath)

  return (
    <div className="bg-app-secondary p-4 rounded-xl border border-app shadow-xs space-y-3 animate-in slide-in-from-top-2 duration-200">
      <Label className="text-xs uppercase tracking-widest text-app-muted font-mono font-bold">
        {port.id
          ? t('sourcePorts.form.edit', 'Edit Source Port')
          : t('sourcePorts.form.new', 'New Source Port')}
      </Label>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-app-muted">{t('sourcePorts.form.name', 'Name')}</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="bg-app-primary border-app h-9 text-sm"
            placeholder={t('sourcePorts.form.nameExample', 'e.g. {name}', {
              name: 'GZDoom 4.12.2'
            })}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-app-muted">
            {t('sourcePorts.form.version', 'Version (optional)')}
          </Label>
          <Input
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            className="bg-app-primary border-app h-9 text-sm"
            placeholder={t('sourcePorts.form.versionExample', 'e.g. {version}', {
              version: '4.12.2'
            })}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-app-muted">
          {t('sourcePorts.form.path', 'Executable Path')}
        </Label>
        <div className="flex gap-2">
          <Input
            value={executablePath}
            onChange={(e) => setExecutablePath(e.target.value)}
            className="bg-app-primary border-app h-9 text-sm flex-1"
          />
          <Button
            aria-label={t('sourcePorts.form.browse', 'Browse for executable')}
            size="icon"
            variant="ghost"
            className="h-9 w-9 shrink-0 hover:bg-accent-highlight/10 text-accent-highlight border border-app/30"
            onClick={async () => {
              const result = await api.showOpenDialog({
                properties: ['openFile'],
                filters: [
                  {
                    name: t('sourcePorts.dialog.executables', 'Executables'),
                    extensions: ['*']
                  }
                ]
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
        <Label className="text-xs text-app-muted">{t('sourcePorts.form.family', 'Family')}</Label>
        <Select value={family} onValueChange={(v) => setFamily(v as SourcePortFamily)}>
          <SelectTrigger className="bg-app-primary border-app h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-app-secondary border-app">
            {(['uzdoom', 'gzdoom', 'zdoom', 'zandronum', 'lzdoom', 'helion', 'other'] as const).map(
              (f) => (
                <SelectItem key={f} value={f} className="text-app-primary">
                  {f === 'other' ? t('sourcePorts.form.other', 'Other') : f}
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
          {t('sourcePorts.form.cancel', 'Cancel')}
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
          {t('sourcePorts.form.save', 'Save')}
        </Button>
      </div>
    </div>
  )
}

export default SourcePortsTab
