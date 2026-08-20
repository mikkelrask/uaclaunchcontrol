import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { useModDownloads } from '@/hooks/useModDownloads'
import { useToast } from '@/hooks/use-toast'
import { api } from '@/api'
import type { ModDownloadEvent } from '@shared/modDownload'
import type { ZipScanResult } from '@/types/zipImport'
import { ZipImportModal } from '@/components/ZipImportModal'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'

import { createLogger } from '@shared/logger'

const log = createLogger('ModDownloadManager')

interface ZipImportState {
  scanResult: ZipScanResult
  filePath: string
}

const ARCHIVE_EXT_RE = /\.(zip|rar)$/i

/**
 * Global overlay for in-app mod downloads: fixed top-right card stack, one
 * card per active download (progress + cancel), error/completed summaries.
 * Downloaded .zip/.rar archives hand off to the ZipImportModal; catalog
 * additions invalidate the catalog queries so existing UI refetches.
 */
export function ModDownloadManager(): React.ReactElement {
  const { downloads, fileNames, cancel, dismiss } = useModDownloads()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [zipImport, setZipImport] = useState<ZipImportState | null>(null)
  const scannedZipIds = useRef<Set<string>>(new Set())
  const invalidatedIds = useRef<Set<string>>(new Set())

  // Hand off completed .zip/.rar downloads to the ZipImportModal. The card is
  // dismissed since the modal takes over; a cancelled modal leaves the file in
  // the downloads dir (same as an OS downloads folder).
  useEffect(() => {
    for (const event of Object.values(downloads)) {
      if (event.state !== 'completed' || !event.filePath) continue
      if (!ARCHIVE_EXT_RE.test(event.filePath)) continue
      if (scannedZipIds.current.has(event.id)) continue
      scannedZipIds.current.add(event.id)
      dismiss(event.id)
      void openZipImport(event.filePath)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [downloads, dismiss])

  // Refresh catalog-backed UI whenever a download lands in the catalog.
  useEffect(() => {
    let changed = false
    for (const event of Object.values(downloads)) {
      if (event.state !== 'completed') continue
      if (!event.catalogEntry) continue
      if (invalidatedIds.current.has(event.id)) continue
      invalidatedIds.current.add(event.id)
      changed = true
    }
    if (changed) {
      void queryClient.invalidateQueries({ queryKey: ['/api/mod-files/catalog'] })
      void queryClient.invalidateQueries({ queryKey: ['/api/mod-files/catalog/search'] })
      // Protocol detail/list queries — a downloaded file may restore a
      // previously-missing entry in an open protocol's file list.
      void queryClient.invalidateQueries({ queryKey: ['/api/protocols'] })
    }
  }, [downloads, queryClient])

  const openZipImport = async (filePath: string): Promise<void> => {
    const isRar = filePath.toLowerCase().endsWith('.rar')
    try {
      toast({ title: 'SYSTEM: decompressing', description: 'Analyzing archive contents.' })
      const scan = (
        isRar ? await api.unrarScan(filePath) : await api.unzipScan(filePath)
      ) as ZipScanResult
      setZipImport({ scanResult: scan, filePath })
    } catch (error: unknown) {
      log.error(error)
      toast({
        title: isRar ? 'FATAL: decompress_failed' : 'FATAL: zip_scan_failed',
        description: error instanceof Error ? error.message : 'Failed to scan archive',
        variant: 'destructive'
      })
    }
  }

  const handleZipImportComplete = async (): Promise<void> => {
    await queryClient.invalidateQueries({ queryKey: ['/api/mod-files/catalog'] })
    await queryClient.invalidateQueries({ queryKey: ['/api/mod-files/catalog/search'] })
    setZipImport(null)
  }

  const events = Object.values(downloads)

  return (
    <>
      {events.length > 0 && (
        <div className="fixed right-4 bottom-4 z-[120] flex w-80 flex-col gap-2">
          {events.map((event) => (
            <DownloadCard
              key={event.id}
              event={event}
              fileName={fileNames[event.id]}
              onCancel={() => cancel(event.id)}
              onDismiss={() => dismiss(event.id)}
            />
          ))}
        </div>
      )}
      {zipImport && (
        <ZipImportModal
          open
          scanResult={zipImport.scanResult}
          zipFilePath={zipImport.filePath}
          onOpenChange={(open) => {
            if (!open) setZipImport(null)
          }}
          onImportComplete={() => void handleZipImportComplete()}
        />
      )}
    </>
  )
}

function DownloadCard({
  event,
  fileName,
  onCancel,
  onDismiss
}: {
  event: ModDownloadEvent
  fileName?: string
  onCancel: () => void
  onDismiss: () => void
}): React.ReactElement {
  const active =
    event.state === 'preparing' || event.state === 'started' || event.state === 'progress'
  const transferring = event.state === 'started' || event.state === 'progress'

  let title: string
  if (event.state === 'preparing') {
    title = event.message
  } else if (event.state === 'completed') {
    if (event.filePath) title = 'Download complete'
    else title = event.alreadyInCatalog ? 'Already in catalog' : 'Added to catalog'
  } else if (event.state === 'cancelled') {
    title = 'Download cancelled'
  } else if (event.state === 'error') {
    title = 'Download failed'
  } else {
    title = fileName || 'Downloading…'
  }

  return (
    <Card className="shadow-lg">
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{title}</p>
            {event.state === 'error' && (
              <p className="mt-0.5 text-xs text-destructive">{event.message}</p>
            )}
            {event.state === 'completed' && event.catalogEntry?.name && (
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {event.catalogEntry.name}
              </p>
            )}
            {transferring && (
              <div className="mt-2 flex items-center gap-2">
                <Progress
                  value={event.state === 'progress' ? event.percent : 0}
                  className="h-2 flex-1"
                />
                {event.state === 'progress' && (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {Math.round(event.percent)}%
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {active && (
              <Button variant="outline" size="sm" onClick={onCancel}>
                Cancel
              </Button>
            )}
            {!active && (
              <Button variant="ghost" size="icon" onClick={onDismiss} aria-label="Dismiss">
                <X />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
