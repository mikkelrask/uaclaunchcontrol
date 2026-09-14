import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/use-toast'
import { api } from '@/api'
import type { IModFile } from '@shared/schema'
import { getArchiveExtension } from '@shared/archive'
import type { ArchiveScanResult } from '@/types/archiveImport'

import { createLogger } from '@shared/logger'

const log = createLogger('useFileImport')
interface UseFileImportOptions {
  onChange: (files: IModFile[]) => void
}

interface UseFileImportReturn {
  isArchiveModalOpen: boolean
  setIsArchiveModalOpen: (open: boolean) => void
  archiveScanResult: ArchiveScanResult | null
  archiveFilePath: string

  /** Try to handle a file as a zip/rar/7z archive. Returns true if handled. */
  tryArchiveImport: (filePath: string) => Promise<boolean>

  /** Called when ArchiveImportModal completes an import. */
  handleArchiveImportComplete: () => Promise<void>
}

export function useFileImport({ onChange }: UseFileImportOptions): UseFileImportReturn {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false)
  const [archiveScanResult, setArchiveScanResult] = useState<ArchiveScanResult | null>(null)
  const [archiveFilePath, setArchiveFilePath] = useState<string>('')

  const tryArchiveImport = async (filePath: string): Promise<boolean> => {
    const ext = getArchiveExtension(filePath)
    if (!ext) return false

    try {
      toast({ title: 'SYSTEM: decompressing', description: `Analyzing ${ext} contents.` })
      const scan = (await api.archiveScan(filePath)) as ArchiveScanResult
      setArchiveScanResult(scan)
      setArchiveFilePath(filePath)
      setIsArchiveModalOpen(true)
    } catch (error: unknown) {
      log.error(error)
      toast({
        title: 'FATAL: archive_scan_failed',
        description: error instanceof Error ? error.message : `Failed to scan ${ext} file`,
        variant: 'destructive'
      })
    }
    return true
  }

  const handleArchiveImportComplete = async (): Promise<void> => {
    const freshCatalog = await api.getModFileCatalog()
    queryClient.setQueryData(['/api/mod-files/catalog'], freshCatalog)
    queryClient.invalidateQueries({ queryKey: ['/api/mod-files/catalog/search'] })
    onChange(freshCatalog)
    setArchiveScanResult(null)
    setArchiveFilePath('')
  }

  return {
    isArchiveModalOpen,
    setIsArchiveModalOpen,
    archiveScanResult,
    archiveFilePath,
    tryArchiveImport,
    handleArchiveImportComplete
  }
}
