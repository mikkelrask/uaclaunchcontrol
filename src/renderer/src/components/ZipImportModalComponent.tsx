import { useEffect, useState } from 'react'
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
import { useToast } from '@/hooks/use-toast'
import { api } from '@/api'

interface ZipImportModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  scanResult: ZipScanResult | null
  onImportComplete: () => void
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
  onImportComplete
}: ZipImportModalProps) {
  const { toast } = useToast()
  const [fileMeta, setFileMeta] = useState<FileMeta[]>([])
  const [importing, setImporting] = useState(false)

  useEffect(() => {
    if (scanResult?.supported) {
      setFileMeta(
        scanResult.supported.map((f) => ({
          tempPath: f.tempPath,
          name: f.name || f.fileName.replace(/\.[^.]+$/, ''),
          version: '',
          url: '',
          sidecarOnly: false,
          enabled: true
        }))
      )
    }
  }, [scanResult])

  const handleMetaChange = (
    index: number,
    field: keyof Omit<FileMeta, 'tempPath' | 'enabled'>,
    value: string | boolean
  ) => {
    setFileMeta((prev) => {
      const copy = [...prev]
      copy[index] = { ...copy[index], [field]: value }
      return copy
    })
  }

  const handleImport = async () => {
    if (!scanResult) return
    setImporting(true)

    try {
      const filesToImport = fileMeta
        .filter((m) => m.enabled)
        .map((m) => ({
          tempPath: m.tempPath,
          name: m.name,
          version: m.version,
          url: m.url,
          sidecarOnly: m.sidecarOnly,
          loadOrder: {} as Record<string, number>
        }))

      await api.unzipImport(scanResult.tempDir, filesToImport)

      toast({
        title: 'Import complete',
        description: `${filesToImport.length} file(s) added to catalog.`
      })

      onImportComplete()
      onOpenChange(false)
    } catch (e) {
      toast({
        title: 'Import failed',
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
                {supportedCount} file{supportedCount !== 1 ? 's' : ''} to import
                {skippedCount > 0 ? ` · ${skippedCount} skipped` : ''}
                {batName ? ` · .bat detected: ${batName}` : ''}
              </DialogDescription>
            </div>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Supported files table */}
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
                    <span className="font-mono text-xs text-app-muted mr-1">[{f.fileType}]</span>
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
              disabled={importing || supportedCount === 0}
              className="bg-accent-highlight hover:opacity-90 text-white"
            >
              <Upload className="w-4 h-4 mr-2" />
              {importing ? 'Importing…' : `Import ${supportedCount} file${supportedCount !== 1 ? 's' : ''}`}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
