import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/use-toast'
import { api } from '@/api'
import type { IModFile } from '@shared/schema'
import type { ZipScanResult } from '@/types/zipImport'

interface UseFileImportOptions {
  onChange: (files: IModFile[]) => void
}

interface UseFileImportReturn {
  isZipModalOpen: boolean
  setIsZipModalOpen: (open: boolean) => void
  zipScanResult: ZipScanResult | null
  zipFilePath: string

  /** Try to handle a file as a ZIP or RAR archive. Returns true if handled. */
  tryZipImport: (filePath: string, ext: string) => Promise<boolean>

  /** Called when ZipImportModal completes an import. */
  handleZipImportComplete: () => Promise<void>
}

export function useFileImport({ onChange }: UseFileImportOptions): UseFileImportReturn {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [isZipModalOpen, setIsZipModalOpen] = useState(false)
  const [zipScanResult, setZipScanResult] = useState<ZipScanResult | null>(null)
  const [zipFilePath, setZipFilePath] = useState<string>('')

  const tryZipImport = async (filePath: string, ext: string): Promise<boolean> => {
    if (ext === 'ZIP') {
      try {
        toast({ title: 'SYSTEM: decompressing', description: 'Analyzing zip contents.' })
        const scan = (await api.unzipScan(filePath)) as ZipScanResult
        setZipScanResult(scan)
        setZipFilePath(filePath)
        setIsZipModalOpen(true)
      } catch (error: unknown) {
        console.error(error)
        toast({
          title: 'FATAL: zip_scan_failed',
          description: error instanceof Error ? error.message : 'Failed to scan zip file',
          variant: 'destructive'
        })
      }
      return true
    }

    if (ext === 'RAR') {
      try {
        toast({ title: 'SYSTEM: decompressing', description: 'Analyzing rar contents.' })
        const scan = (await api.unrarScan(filePath)) as ZipScanResult
        setZipScanResult(scan)
        setZipFilePath(filePath)
        setIsZipModalOpen(true)
      } catch (error: unknown) {
        console.error(error)
        toast({
          title: 'FATAL: decompress_failed',
          description: error instanceof Error ? error.message : 'Failed to scan rar file',
          variant: 'destructive'
        })
      }
      return true
    }

    return false
  }

  const handleZipImportComplete = async (): Promise<void> => {
    const freshCatalog = await api.getModFileCatalog()
    queryClient.setQueryData(['/api/mod-files/catalog'], freshCatalog)
    queryClient.invalidateQueries({ queryKey: ['/api/mod-files/catalog/search'] })
    onChange(freshCatalog)
    setZipScanResult(null)
    setZipFilePath('')
  }

  return {
    isZipModalOpen,
    setIsZipModalOpen,
    zipScanResult,
    zipFilePath,
    tryZipImport,
    handleZipImportComplete
  }
}
