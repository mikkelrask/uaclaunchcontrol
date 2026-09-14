import { Fragment, useEffect, useState, useRef } from 'react'
import { Archive, Upload, GripVertical } from 'lucide-react'
import type { ArchiveScanResult } from '@/types/archiveImport'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { useFileReorder } from '@/hooks/useFileReorder'
import { deriveFileType } from '@/lib/install/parsers'
import { getArchiveExtension } from '@shared/archive'
import { api, type IRegistryMod } from '@/api'
import { formatRegistryName } from '@/lib/registryName'
import { REGISTRY_API_URL } from '@shared/registry-config'
import { CATEGORIES } from '@shared/categories'
import type { ModDownloadRegistryMeta } from '@shared/modDownload'
import type { IModFile } from '@shared/schema'

export interface ArchiveImportModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  scanResult: ArchiveScanResult | null
  onImportComplete: () => void
  archiveFilePath?: string
  /** Registry metadata of the downloaded archive — pre-fills the import fields. */
  registryMeta?: ModDownloadRegistryMeta
}

interface FileMeta {
  tempPath: string
  hashValue: string
  name: string
  version: string
  url: string
  sidecarOnly: boolean
  enabled: boolean
  category: string
}

/**
 * Build the load-order record shared by every file in this archive.
 * Files get offsets 1, 2, 3, … in the order they appear.
 * Every imported file stores this identical record so that whichever
 * file a player picks from the catalog, all archive siblings auto-load.
 */
function buildArchiveLoadOrder(fileMeta: FileMeta[]): Record<string, number> {
  const record: Record<string, number> = {}
  let offset = 1
  for (const m of fileMeta) {
    if (m.enabled && m.hashValue) {
      record[m.hashValue] = offset++
    }
  }
  return record
}

export function ArchiveImportModal({
  open,
  onOpenChange,
  scanResult,
  onImportComplete,
  archiveFilePath,
  registryMeta
}: ArchiveImportModalProps): React.ReactElement | null {
  const { toast } = useToast()
  const [fileMeta, setFileMeta] = useState<FileMeta[]>([])
  const [importing, setImporting] = useState(false)
  const [importAsArchive, setImportAsArchive] = useState(false)
  const [importName, setImportName] = useState('')
  const [importVersion, setImportVersion] = useState('')
  const [importUrl, setImportUrl] = useState('')
  const [importHash, setImportHash] = useState('')
  const [importCategory, setImportCategory] = useState('')
  const registryCache = useRef<Map<string, IRegistryMod | null>>(new Map())

  // ── Registry lookup helpers ──
  const doRegistryLookup = async (
    hash: string
  ): Promise<{ found: boolean; data: IRegistryMod | null }> => {
    const cached = registryCache.current.get(hash)
    if (cached !== undefined) return { found: cached !== null, data: cached }

    try {
      const settings = await api.getSettings()
      if (!settings.registryLookupEnabled) {
        registryCache.current.set(hash, null)
        return { found: false, data: null }
      }
      const data = await api.lookupMod(hash, REGISTRY_API_URL)
      registryCache.current.set(hash, data)
      return { found: data !== null, data }
    } catch {
      registryCache.current.set(hash, null)
      return { found: false, data: null }
    }
  }

  const pickBestUrl = (urls: { url: string; domain: string }[]): string => {
    if (urls.length === 0) return ''
    if (urls.length === 1) return urls[0].url
    const moddb = urls.find((u) => u.domain.includes('moddb.com'))
    if (moddb) return moddb.url
    return urls[0].url
  }

  const submitToRegistry = (
    hash: string,
    name: string,
    version: string,
    url: string,
    sidecarOnly: boolean,
    category?: string,
    loadOrder?: Record<string, number>
  ): void => {
    const cached = registryCache.current.get(hash)
    let shouldSubmit = false
    if (cached === null) {
      // Hash not found in registry → new submission
      shouldSubmit = true
    } else if (cached) {
      // Hash found — submit only if user provided new info
      const urlInRegistry = cached.urls?.some((u) => u.url === url)
      const hasNewUrl = !!url && !urlInRegistry
      const hasNewVersion = !!version && !cached.version
      shouldSubmit = hasNewUrl || hasNewVersion
    }
    if (!shouldSubmit) return

    api
      .getSettings()
      .then((settings) => {
        if (settings?.registryUuid) {
          api.submitToPending(
            {
              hash,
              suggested_name: name,
              url,
              version: version || undefined,
              category: category || undefined,
              is_sidecar: sidecarOnly ? 1 : 0,
              load_order: loadOrder ? JSON.stringify(loadOrder) : undefined
            },
            settings.registryUuid,
            REGISTRY_API_URL
          )
        }
      })
      .catch(() => {
        // fire-and-forget
      })
  }

  // ── Init fileMeta from scan result ──
  useEffect(() => {
    if (scanResult?.supported) {
      const initial = scanResult.supported.map((f) => ({
        tempPath: f.tempPath,
        hashValue: f.hashValue,
        name: f.name || f.fileName.replace(/\.[^.]+$/, ''),
        version: '',
        url: '',
        sidecarOnly: false,
        enabled: true,
        category: ''
      }))

      // The downloaded archive IS the registered mod — carry its metadata
      // onto every extracted file. Per-file lookups below refine any row
      // whose own hash is registered too.
      if (registryMeta) {
        for (const m of initial) {
          m.name = registryMeta.name
          m.version = registryMeta.version || ''
          m.url = registryMeta.url || ''
          m.category = registryMeta.category || ''
        }
      }

      setFileMeta(initial)

      // Registry lookup for each file that has a hash
      const doLookups = async (): Promise<void> => {
        const updates: {
          index: number
          name: string
          version: string
          url: string
          category: string
        }[] = []
        for (let i = 0; i < scanResult.supported.length; i++) {
          const f = scanResult.supported[i]
          if (!f.hashValue) continue
          const { data } = await doRegistryLookup(f.hashValue)
          if (data) {
            updates.push({
              index: i,
              name: formatRegistryName(data.family_name, data.display_name),
              version: data.version || '',
              url: pickBestUrl(data.urls),
              category: data.category || ''
            })
          }
        }
        if (updates.length > 0) {
          setFileMeta((prev) => {
            const copy = [...prev]
            for (const u of updates) {
              copy[u.index] = {
                ...copy[u.index],
                name: u.name,
                version: u.version,
                url: u.url,
                category: u.category
              }
            }
            return copy
          })
        }
      }
      doLookups()
    }
  }, [scanResult, registryMeta])

  // Reset the as-is form when the modal opens with a new scan
  useEffect(() => {
    if (open && scanResult?.supported?.[0]) {
      const pathParts = (archiveFilePath || '').split(/[\\/]/)
      const lastPart = pathParts.pop() || ''
      const defaultName = lastPart.replace(/\.[^.]+$/, '')
      setImportName(registryMeta?.name ?? defaultName)
      setImportVersion(registryMeta?.version ?? '')
      setImportUrl(registryMeta?.url ?? '')
      setImportHash('')
      setImportCategory(registryMeta?.category ?? '')
      setImportAsArchive(false)
    }
  }, [open, scanResult, archiveFilePath, registryMeta])

  // ── Registry lookup for the archive-as-is checkbox when it is toggled ──
  useEffect(() => {
    if (!importAsArchive || !archiveFilePath) return

    const doLookup = async (): Promise<void> => {
      try {
        const hash = await api.computeHash(archiveFilePath)
        setImportHash(hash)
        if (!hash) return
        const { data } = await doRegistryLookup(hash)
        if (data) {
          if (data.family_name) setImportName(formatRegistryName(data.family_name, data.display_name))
          if (data.version) setImportVersion(data.version)
          if (data.category) setImportCategory(data.category)
          const url = pickBestUrl(data.urls)
          if (url) setImportUrl(url)
        }
      } catch {
        // hash computation or lookup failed silently
      }
    }
    doLookup()
  }, [importAsArchive, archiveFilePath])

  const handleMetaChange = (
    index: number,
    field: keyof Omit<FileMeta, 'tempPath' | 'enabled' | 'hashValue'>,
    value: string | boolean
  ): void => {
    setFileMeta((prev) => {
      const copy = [...prev]
      copy[index] = { ...copy[index], [field]: value }
      return copy
    })
  }

  const {
    draggedIndex,
    insertionIndex,
    handleDragStart,
    handleDragOver,
    handleDrop,
    handleDragEnd
  } = useFileReorder(fileMeta, setFileMeta)

  const handleImport = async (): Promise<void> => {
    if (!scanResult) return
    setImporting(true)

    try {
      if (importAsArchive && archiveFilePath) {
        // Import the archive file itself as a single mod
        const fileName = archiveFilePath.split(/[\\/]/).pop() || archiveFilePath
        const importNameValue = importName || fileName.replace(/\.[^.]+$/, '')
        // Server-side getFileType() derives the same label from the extension.
        const fileType = deriveFileType(fileName.split('.').pop() ?? '')

        const created = await api.addToCatalog({
          name: importNameValue,
          filePath: archiveFilePath,
          fileType,
          fileName,
          version: importVersion || '',
          url: importUrl || '',
          hashValue: '', // will be computed server-side
          sidecarOnly: false,
          category: importCategory || undefined
        })

        // Submit to pending registry if appropriate
        const finalHash = created.hashValue || importHash
        if (finalHash && importUrl) {
          submitToRegistry(
            finalHash,
            importNameValue,
            importVersion,
            importUrl,
            false,
            importCategory || undefined
          )
        }

        toast({
          title: 'SYSTEM: archive_accepted',
          description: `"${importNameValue}" added to catalog.`
        })
      } else {
        // Import individual extracted files
        const activeMeta = fileMeta.filter((m) => m.enabled)

        // Compute the shared load order — same for every file in the archive
        const archiveLoadOrder = buildArchiveLoadOrder(activeMeta)

        const filesToImport = activeMeta.map((m) => ({
          tempPath: m.tempPath,
          name: m.name,
          version: m.version,
          url: m.url,
          sidecarOnly: m.sidecarOnly,
          category: m.category || undefined,
          loadOrder: archiveLoadOrder
        }))

        const importedFiles = (await api.archiveImport(
          scanResult.tempDir,
          filesToImport
        )) as IModFile[]

        // Submit each imported file to pending registry with the shared load order
        for (const file of importedFiles) {
          const meta = activeMeta.find(
            (m) => m.name === file.name || m.hashValue === file.hashValue
          )
          if (file.hashValue && meta?.url) {
            submitToRegistry(
              file.hashValue,
              meta.name,
              meta.version,
              meta.url,
              meta.sidecarOnly,
              meta.category || undefined,
              archiveLoadOrder
            )
          }
        }

        toast({
          title: 'SYSTEM: archive_extracted',
          description: `${filesToImport.length} file(s) added to catalog.`
        })
      }

      onImportComplete()
      onOpenChange(false)
    } catch (e: unknown) {
      toast({
        title: 'FATAL: err_586',
        description: (e as Error).message,
        variant: 'destructive'
      })
    } finally {
      setImporting(false)
    }
  }

  const supportedCount = fileMeta.filter((m) => m.enabled).length
  const skippedCount = scanResult?.skipped?.length ?? 0
  const batName = scanResult?.batFiles?.fileName
  const archiveBaseName = (archiveFilePath || '').split(/[\\/]/).pop() || ''
  const archiveExt = getArchiveExtension(archiveFilePath || '')
  // Source ports read .zip and .7z archives directly; .rar is not a loadable
  // mod format, so those downloads can only be unpacked.
  const canImportAsIs = archiveExt === 'zip' || archiveExt === '7z'

  // Guard against render with null scanResult (can happen during close transition)
  if (!scanResult) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-app-primary shadow-2xl border-app max-w-4xl max-h-[85vh] p-0 overflow-hidden flex flex-col">
        {/* ── Header ── */}
        <div className="flex items-center justify-between p-4 border-b border-app bg-app-secondary shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-accent-highlight/10 rounded-md">
              <Archive className="w-5 h-5 text-accent-highlight" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold tracking-tight text-app-primary lowercase">
                {archiveExt ? `import ${archiveExt} archive` : 'import archive'}
              </DialogTitle>
              <DialogDescription className="text-xs font-semibold font-mono text-app-muted uppercase tracking-widest opacity-80">
                {importAsArchive
                  ? 'Import the archive as a single mod file'
                  : `${supportedCount} file${supportedCount !== 1 ? 's' : ''} to import`}
                {!importAsArchive && skippedCount > 0 ? ` · ${skippedCount} skipped` : ''}
                {!importAsArchive && batName ? ` · .bat detected: ${batName}` : ''}
              </DialogDescription>
            </div>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* ── Import-as-is checkbox (hidden for .rar — source ports can't load .rar) ── */}
          {archiveFilePath && canImportAsIs && (
            <label className="flex items-center gap-2 p-2 rounded border border-app bg-app-secondary/50 cursor-pointer hover:bg-app-secondary transition-colors">
              <input
                type="checkbox"
                checked={importAsArchive}
                onChange={(e) => setImportAsArchive(e.target.checked)}
                className="w-4 h-4 accent-accent-highlight"
              />
              <span className="text-sm font-medium text-app-primary">
                Import <span className="font-mono text-accent-highlight">{archiveBaseName}</span> as is
              </span>
              <span className="text-xs text-app-muted ml-auto">
                (source ports load .{archiveExt} files as mods)
              </span>
            </label>
          )}

          {importAsArchive ? (
            /* ── Archive-as-mod form (matches add_mod_file modal style) ── */
            <div className="space-y-4 p-2">
              <div className="space-y-2">
                <Label htmlFor="archive-as-name">Name</Label>
                <Input
                  id="archive-as-name"
                  value={importName}
                  onChange={(e) => setImportName(e.target.value)}
                  placeholder="Pretty name for the mod"
                  className="bg-app-secondary border-app"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="archive-as-version">Version</Label>
                <Input
                  id="archive-as-version"
                  value={importVersion}
                  onChange={(e) => setImportVersion(e.target.value)}
                  placeholder="e.g., 1.0, v2.1"
                  className="bg-app-secondary border-app"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="archive-as-url">URL (ModDB, forum)</Label>
                <Input
                  id="archive-as-url"
                  value={importUrl}
                  onChange={(e) => setImportUrl(e.target.value)}
                  placeholder="https://www.moddb.com/mods/..."
                  className="bg-app-secondary border-app"
                />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={importCategory} onValueChange={setImportCategory}>
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
            </div>
          ) : (
            /* ── Supported files table ── */
            <>
              {fileMeta.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-app-muted italic">
                    Drag the handle to reorder. The order determines each file&apos;s position in
                    the shared load order (shown in the # column). When a player adds any of these
                    files to a protocol, all of them auto-load in this order.
                  </p>
                  <div className="grid grid-cols-[auto_auto_auto_1fr_1fr_auto_auto_auto] gap-2 text-xs font-semibold uppercase text-app-muted tracking-widest font-mono px-1">
                    <span></span>
                    <span>#</span>
                    <span></span>
                    <span>File</span>
                    <span>Display Name</span>
                    <span>Version</span>
                    <span>Cat</span>
                    <span>URL</span>
                  </div>
                  <div onDragOver={handleDragOver} onDrop={handleDrop}>
                    {fileMeta.map((meta, idx) => {
                      const f = scanResult.supported.find((sf) => sf.tempPath === meta.tempPath)
                      if (!f) return null
                      const loadIdx = fileMeta.filter((m) => m.enabled).indexOf(meta)
                      const isDragged = draggedIndex === idx
                      const showPlaceholderBefore = insertionIndex === idx && draggedIndex !== idx

                      return (
                        <Fragment key={meta.tempPath}>
                          {showPlaceholderBefore && (
                            <div className="h-8 mb-2 border-2 border-dashed border-accent-highlight/30 rounded-md flex items-center justify-center bg-accent-highlight/5 animate-in fade-in zoom-in-95 duration-200">
                              <span className="text-accent-highlight text-[10px] tracking-widest uppercase opacity-60">
                                drop here
                              </span>
                            </div>
                          )}
                          <div
                            data-drag-index={idx}
                            className={`grid grid-cols-[auto_auto_auto_1fr_1fr_auto_auto_auto] gap-2 items-center mb-2 ${
                              isDragged ? 'hidden' : meta?.enabled ? '' : 'opacity-50'
                            }`}
                          >
                            <button
                              type="button"
                              draggable
                              onDragStart={(e) => handleDragStart(e, idx)}
                              onDragEnd={handleDragEnd}
                              className="cursor-grab active:cursor-grabbing text-app-muted hover:text-app-primary opacity-40 hover:opacity-100 transition-opacity p-0.5"
                              tabIndex={-1}
                              aria-label="Reorder"
                            >
                              <GripVertical className="w-3.5 h-3.5" />
                            </button>

                            <span className="text-xs font-mono text-app-muted w-5 text-center">
                              {meta?.enabled ? loadIdx + 1 : '-'}
                            </span>

                            <input
                              type="checkbox"
                              checked={meta?.enabled ?? true}
                              onChange={(e) =>
                                setFileMeta((prev) => {
                                  const copy = [...prev]
                                  copy[idx] = { ...copy[idx], enabled: e.target.checked }
                                  return copy
                                })
                              }
                              className="w-4 h-4 accent-accent-highlight"
                            />

                            <div className="text-sm truncate" title={f.fileName}>
                              <span className="font-mono text-xs text-app-muted mr-1">
                                [{f.fileType}]
                              </span>
                              {f.fileName}
                              {f.isReferencedByBat && (
                                <span className="ml-1 text-xs text-yellow-500">.bat</span>
                              )}
                            </div>

                            <input
                              className="border border-app rounded p-1 text-sm bg-app-primary"
                              placeholder="Display name"
                              value={meta?.name ?? ''}
                              onChange={(e) => handleMetaChange(idx, 'name', e.target.value)}
                            />
                            <input
                              className="border border-app rounded p-1 text-sm bg-app-primary w-20"
                              placeholder="Version"
                              value={meta?.version ?? ''}
                              onChange={(e) => handleMetaChange(idx, 'version', e.target.value)}
                            />
                            <select
                              className="border border-app rounded p-1 text-sm bg-app-primary"
                              value={meta?.category ?? ''}
                              onChange={(e) => handleMetaChange(idx, 'category', e.target.value)}
                            >
                              <option value="">—</option>
                              {CATEGORIES.map((cat) => (
                                <option key={cat} value={cat}>
                                  {cat.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                                </option>
                              ))}
                            </select>
                            <input
                              className="border border-app rounded p-1 text-sm bg-app-primary w-40"
                              placeholder="URL"
                              value={meta?.url ?? ''}
                              onChange={(e) => handleMetaChange(idx, 'url', e.target.value)}
                            />
                          </div>
                        </Fragment>
                      )
                    })}

                    {insertionIndex === fileMeta.length && draggedIndex !== fileMeta.length - 1 && (
                      <div className="h-8 mb-2 border-2 border-dashed border-accent-highlight/30 rounded-md flex items-center justify-center bg-accent-highlight/5 animate-in fade-in zoom-in-95 duration-200">
                        <span className="text-accent-highlight text-[10px] tracking-widest uppercase opacity-60">
                          new placement
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Skipped files */}
              {skippedCount > 0 && (
                <div>
                  <p className="text-sm font-semibold text-app-muted mb-1">Skipped files</p>
                  <ul className="text-xs space-y-1">
                    {scanResult.skipped.map((s, i) => (
                      <li key={i} className="text-app-muted">
                        <span className="font-mono">{s.fileName}</span> — {s.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Footer ── */}
        <DialogFooter className="bg-app-secondary border-t border-app p-4 shrink-0">
          <div className="flex justify-between w-full">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={importing}
              className="bg-app-primary hover:bg-app-hover text-app-primary border-app"
            >
              Cancel
            </Button>
            <Button
              onClick={handleImport}
              disabled={importing || (importAsArchive ? false : supportedCount === 0)}
              className="bg-accent-highlight hover:opacity-90 text-white"
            >
              <Upload className="w-4 h-4 mr-2" />
              {importing
                ? 'Importing…'
                : importAsArchive
                  ? `Import ${archiveBaseName}`
                  : `Import ${supportedCount} file${supportedCount !== 1 ? 's' : ''}`}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
