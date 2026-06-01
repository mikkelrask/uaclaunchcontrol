import { useEffect, useState } from 'react'
import type { ZipScanResult } from '@/types/zipImport'
import {
  Dialog,
  DialogContent,
  DialogHeader,
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
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Import ZIP Archive</DialogTitle>
          <DialogDescription>
            {`${supportedCount} file(s) to import, ${skippedCount} skipped`}
            {batName ? ` — .bat detected: ${batName}` : ''}
          </DialogDescription>
        </DialogHeader>

        {/* Supported files table */}
        {fileMeta.length > 0 && (
          <div className="mt-4 space-y-2">
            <div className="grid grid-cols-[auto_1fr_1fr_1fr_auto] gap-2 text-xs font-semibold uppercase text-muted-foreground px-1">
              <span></span>
              <span>File</span>
              <span>Name</span>
              <span>Version</span>
              <span>URL</span>
            </div>
            {scanResult!.supported.map((f, idx) => (
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
                  className="w-4 h-4"
                />
                <div className="text-sm truncate" title={f.fileName}>
                  <span className="font-mono text-xs text-muted-foreground mr-1">[{f.fileType}]</span>
                  {f.fileName}
                  {f.isReferencedByBat && (
                    <span className="ml-1 text-xs text-yellow-500">.bat</span>
                  )}
                </div>
                <input
                  className="border rounded p-1 text-sm bg-background"
                  placeholder="Display name"
                  value={fileMeta[idx]?.name ?? ''}
                  onChange={(e) => handleMetaChange(idx, 'name', e.target.value)}
                />
                <input
                  className="border rounded p-1 text-sm bg-background"
                  placeholder="Version"
                  value={fileMeta[idx]?.version ?? ''}
                  onChange={(e) => handleMetaChange(idx, 'version', e.target.value)}
                />
                <input
                  className="border rounded p-1 text-sm bg-background w-40"
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
          <div className="mt-4">
            <p className="text-sm font-semibold text-muted-foreground mb-1">Skipped files</p>
            <ul className="text-xs space-y-1">
              {scanResult!.skipped.map((s, i) => (
                <li key={i} className="text-muted-foreground">
                  <span className="font-mono">{s.fileName}</span> — {s.reason}
                </li>
              ))}
            </ul>
          </div>
        )}

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={importing}>
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={importing || supportedCount === 0}>
            {importing ? 'Importing…' : `Import ${supportedCount} file(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
