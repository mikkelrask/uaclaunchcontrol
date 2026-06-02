import { useEffect, useState, useRef } from 'react'
import { Archive, Upload } from 'lucide-react'
import type { ZipScanResult } from '@/types/zipImport'
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
import { useToast } from '@/hooks/use-toast'
import { api, type IRegistryMod } from '@/api'
import { REGISTRY_API_URL } from '@shared/registry-config'
import type { IModFile } from '@shared/schema'

export interface ZipImportModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  scanResult: ZipScanResult | null
  onImportComplete: () => void
  zipFilePath?: string
}

interface FileMeta {
  tempPath: string
  name: string
  version: string
  url: string
  sidecarOnly: boolean
  enabled: boolean
}

export function ZipImportModal({
  open,
  onOpenChange,
  scanResult,
  onImportComplete,
  zipFilePath
}: ZipImportModalProps): React.ReactElement | null {
  const { toast } = useToast()
  const [fileMeta, setFileMeta] = useState<FileMeta[]>([])
  const [importing, setImporting] = useState(false)
  const [importAsZip, setImportAsZip] = useState(false)
  const [zipName, setZipName] = useState('')
  const [zipVersion, setZipVersion] = useState('')
  const [zipUrl, setZipUrl] = useState('')
  const [zipHash, setZipHash] = useState('')
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
    sidecarOnly: boolean
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
              is_sidecar: sidecarOnly ? 1 : 0
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
        name: f.name || f.fileName.replace(/\.[^.]+$/, ''),
        version: '',
        url: '',
        sidecarOnly: false,
        enabled: true
      }))
      setFileMeta(initial)

      // Registry lookup for each file that has a hash
      const doLookups = async (): Promise<void> => {
        const updates: { index: number; name: string; version: string; url: string }[] = []
        for (let i = 0; i < scanResult.supported.length; i++) {
          const f = scanResult.supported[i]
          if (!f.hashValue) continue
          const { data } = await doRegistryLookup(f.hashValue)
          if (data) {
            updates.push({
              index: i,
              name: data.family_name,
              version: data.version || '',
              url: pickBestUrl(data.urls)
            })
          }
        }
        if (updates.length > 0) {
          setFileMeta((prev) => {
            const copy = [...prev]
            for (const u of updates) {
              copy[u.index] = { ...copy[u.index], name: u.name, version: u.version, url: u.url }
            }
            return copy
          })
        }
      }
      doLookups()
    }
  }, [scanResult])

  // Reset zip-as-mod form when modal opens with a new scan
  useEffect(() => {
    if (open && scanResult?.supported?.[0]) {
      const pathParts = (zipFilePath || '').split(/[\\/]/)
      const lastPart = pathParts.pop() || ''
      const defaultName = lastPart.replace(/\.zip$/i, '')
      setZipName(defaultName)
      setZipVersion('')
      setZipUrl('')
      setZipHash('')
      setImportAsZip(false)
    }
  }, [open, scanResult, zipFilePath])

  // ── Registry lookup for zip-as-is when checkbox is toggled ──
  useEffect(() => {
    if (!importAsZip || !zipFilePath) return

    const doLookup = async (): Promise<void> => {
      try {
        const hash = await api.computeHash(zipFilePath)
        setZipHash(hash)
        if (!hash) return
        const { data } = await doRegistryLookup(hash)
        if (data) {
          if (data.family_name) setZipName(data.family_name)
          if (data.version) setZipVersion(data.version)
          const url = pickBestUrl(data.urls)
          if (url) setZipUrl(url)
        }
      } catch {
        // hash computation or lookup failed silently
      }
    }
    doLookup()
  }, [importAsZip, zipFilePath])

  const handleMetaChange = (
    index: number,
    field: keyof Omit<FileMeta, 'tempPath' | 'enabled'>,
    value: string | boolean
  ): void => {
    setFileMeta((prev) => {
      const copy = [...prev]
      copy[index] = { ...copy[index], [field]: value }
      return copy
    })
  }

  const handleImport = async (): Promise<void> => {
    if (!scanResult) return
    setImporting(true)

    try {
      if (importAsZip && zipFilePath) {
        // Import the zip file itself as a single mod
        const fileName = zipFilePath.split(/[\\/]/).pop() || zipFilePath
        const zipNameValue = zipName || fileName.replace(/\.zip$/i, '')
        const fileType = 'ZIP'

        const created = await api.addToCatalog({
          name: zipNameValue,
          filePath: zipFilePath,
          fileType,
          fileName,
          version: zipVersion || '',
          url: zipUrl || '',
          hashValue: '', // will be computed server-side
          sidecarOnly: false
        })

        // Submit to pending registry if appropriate
        const finalHash = created.hashValue || zipHash
        if (finalHash && zipUrl) {
          submitToRegistry(finalHash, zipNameValue, zipVersion, zipUrl, false)
        }

        toast({
          title: 'SYSTEM: archive_accepted',
          description: `"${zipNameValue}" added to catalog.`
        })
      } else {
        // Import individual extracted files
        const filesToImport = fileMeta
          .filter((m) => m.enabled)
          .map(
            (
              m
            ): {
              tempPath: string
              name: string
              version: string
              url: string
              sidecarOnly: boolean
              loadOrder: Record<string, number>
            } => ({
              tempPath: m.tempPath,
              name: m.name,
              version: m.version,
              url: m.url,
              sidecarOnly: m.sidecarOnly,
              loadOrder: {} as Record<string, number>
            })
          )

        const importedFiles = (await api.unzipImport(
          scanResult.tempDir,
          filesToImport
        )) as IModFile[]

        // Submit each imported file to pending registry if appropriate
        for (const file of importedFiles) {
          const meta = filesToImport.find((m) => m.name === file.name)
          if (file.hashValue && meta?.url) {
            submitToRegistry(file.hashValue, meta.name, meta.version, meta.url, meta.sidecarOnly)
          }
        }

        toast({
          title: 'SYSTEM: archive_extracted',
          description: `${filesToImport.length} file(s) added to catalog.`
        })
      }

      onImportComplete()
      onOpenChange(false)
    } catch (e) {
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
  const zipBaseName = (zipFilePath || '').split(/[\\/]/).pop() || ''

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
                import zip archive
              </DialogTitle>
              <DialogDescription className="text-xs font-semibold font-mono text-app-muted uppercase tracking-widest opacity-80">
                {importAsZip
                  ? 'Import zip as a single mod file'
                  : `${supportedCount} file${supportedCount !== 1 ? 's' : ''} to import`}
                {!importAsZip && skippedCount > 0 ? ` · ${skippedCount} skipped` : ''}
                {!importAsZip && batName ? ` · .bat detected: ${batName}` : ''}
              </DialogDescription>
            </div>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* ── Import-as-zip checkbox ── */}
          {zipFilePath && (
            <label className="flex items-center gap-2 p-2 rounded border border-app bg-app-secondary/50 cursor-pointer hover:bg-app-secondary transition-colors">
              <input
                type="checkbox"
                checked={importAsZip}
                onChange={(e) => setImportAsZip(e.target.checked)}
                className="w-4 h-4 accent-accent-highlight"
              />
              <span className="text-sm font-medium text-app-primary">
                Import <span className="font-mono text-accent-highlight">{zipBaseName}</span> as is
              </span>
              <span className="text-xs text-app-muted ml-auto">
                (source ports support .zip files as mods)
              </span>
            </label>
          )}

          {importAsZip ? (
            /* ── Zip-as-mod form (matches add_mod_file modal style) ── */
            <div className="space-y-4 p-2">
              <div className="space-y-2">
                <Label htmlFor="zip-as-name">Name</Label>
                <Input
                  id="zip-as-name"
                  value={zipName}
                  onChange={(e) => setZipName(e.target.value)}
                  placeholder="Pretty name for the mod"
                  className="bg-app-secondary border-app"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="zip-as-version">Version</Label>
                <Input
                  id="zip-as-version"
                  value={zipVersion}
                  onChange={(e) => setZipVersion(e.target.value)}
                  placeholder="e.g., 1.0, v2.1"
                  className="bg-app-secondary border-app"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="zip-as-url">URL (ModDB, forum)</Label>
                <Input
                  id="zip-as-url"
                  value={zipUrl}
                  onChange={(e) => setZipUrl(e.target.value)}
                  placeholder="https://www.moddb.com/mods/..."
                  className="bg-app-secondary border-app"
                />
              </div>
            </div>
          ) : (
            /* ── Supported files table ── */
            <>
              {fileMeta.length > 0 && (
                <div className="space-y-2">
                  <div className="grid grid-cols-[auto_1fr_1fr_1fr_auto] gap-2 text-xs font-semibold uppercase text-app-muted tracking-widest font-mono px-1">
                    <span></span>
                    <span>File</span>
                    <span>Display Name</span>
                    <span>Version</span>
                    <span>URL</span>
                  </div>
                  {scanResult.supported.map((f, idx) => (
                    <div
                      key={f.tempPath}
                      className="grid grid-cols-[auto_1fr_1fr_1fr_auto] gap-2 items-center"
                    >
                      <input
                        type="checkbox"
                        checked={fileMeta[idx]?.enabled ?? true}
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
                        value={fileMeta[idx]?.name ?? ''}
                        onChange={(e) => handleMetaChange(idx, 'name', e.target.value)}
                      />
                      <input
                        className="border border-app rounded p-1 text-sm bg-app-primary"
                        placeholder="Version"
                        value={fileMeta[idx]?.version ?? ''}
                        onChange={(e) => handleMetaChange(idx, 'version', e.target.value)}
                      />
                      <input
                        className="border border-app rounded p-1 text-sm bg-app-primary w-40"
                        placeholder="URL"
                        value={fileMeta[idx]?.url ?? ''}
                        onChange={(e) => handleMetaChange(idx, 'url', e.target.value)}
                      />
                    </div>
                  ))}
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
              disabled={importing || (importAsZip ? false : supportedCount === 0)}
              className="bg-accent-highlight hover:opacity-90 text-white"
            >
              <Upload className="w-4 h-4 mr-2" />
              {importing
                ? 'Importing…'
                : importAsZip
                  ? `Import ${zipBaseName}`
                  : `Import ${supportedCount} file${supportedCount !== 1 ? 's' : ''}`}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
