import { useTranslate } from '@tolgee/react'
import { getTranslate } from '@/lib/i18n'
import { useState, useCallback } from 'react'
import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query'
import type { IAppSettings } from '@shared/schema'
import { api } from '@/api'
import { createLogger } from '@shared/logger'
import { dispatchAchievementEvent, buildUnlockToasts } from '@/lib/achievements'
import type { NotificationKind } from '@/lib/notifications'
import { buildHashFileName } from '@/lib/install/parsers'

const log = createLogger('install/useWadImport')
import type { WadImportSelection } from '@/lib/install/types'

export interface WadImportHandlers {
  selectedWad: WadImportSelection | null
  isWadDragging: boolean
  isPreparingWad: boolean
  prepareWadImport: (sourcePath: string) => Promise<void>
  handleBrowseWad: () => Promise<void>
  handleWadDrop: (e: React.DragEvent) => Promise<void>
  handleWadDragOver: (e: React.DragEvent) => void
  handleWadDragLeave: (e: React.DragEvent) => void
  importWadMutation: UseMutationResult<
    { fileName: string; fullPath: string; hashValue: string; alreadyExists: boolean },
    Error,
    string
  >
  clearSelection: () => void
}

interface ToastLike {
  (opts: { title: string; description: string; variant?: 'destructive' }): void
  (opts: {
    title: string
    description: string
    duration: number
    historyKind?: NotificationKind
  }): void
}

/**
 * Hook encapsulating all WAD file import logic: file selection, drag-and-drop,
 * hash computation, MD5-rename preview, and the actual import mutation.
 */
export function useWadImport(settings: IAppSettings, toast: ToastLike): WadImportHandlers {
  const { t } = useTranslate('desktop')

  const queryClient = useQueryClient()
  const [selectedWad, setSelectedWad] = useState<WadImportSelection | null>(null)
  const [isWadDragging, setIsWadDragging] = useState(false)
  const [isPreparingWad, setIsPreparingWad] = useState(false)

  const prepareWadImport = useCallback(
    async (sourcePath: string): Promise<void> => {
      const { t } = getTranslate('desktop')

      const fileName = sourcePath.split(/[\\/]/).pop() || sourcePath

      if (!fileName.toLowerCase().endsWith('.wad')) {
        toast({
          title: 'WARNING: invalid_file',
          description: t(
            'install.wadImport.notAUacSupportedFileWad',
            'Not a UAC supported file (.wad)'
          ),
          variant: 'destructive'
        })
        return
      }

      setIsPreparingWad(true)
      try {
        const hashValue = await api.computeHash(sourcePath)
        if (!hashValue) {
          throw new Error(t('install.wadImport.failedHash', 'Failed to compute MD5 hash'))
        }

        setSelectedWad({
          sourcePath,
          fileName,
          hashValue,
          targetFileName: buildHashFileName(fileName, hashValue)
        })
      } catch (error: unknown) {
        toast({
          title: 'FATAL: err_139',
          description: t(
            'install.wadImport.failedToPrepareWadImport',
            'Failed to prepare WAD import: {error}',
            { error: String(error) }
          ),
          variant: 'destructive'
        })
      } finally {
        setIsPreparingWad(false)
      }
    },
    [toast]
  )

  const handleBrowseWad = useCallback(async (): Promise<void> => {
    const { t } = getTranslate('desktop')

    const result = await api.showOpenDialog({
      title: t('install.wadImport.selectWadFile', 'Select WAD File'),
      properties: ['openFile'],
      filters: [{ name: t('install.wadImport.wadFiles', 'WAD Files'), extensions: ['wad'] }],
      defaultPath: settings?.wadFilesDirectory || undefined
    })

    if (!result.canceled && result.filePaths.length > 0) {
      await prepareWadImport(result.filePaths[0])
    }
  }, [prepareWadImport, settings])

  const importWadMutation = useMutation({
    mutationFn: (sourcePath: string) => api.importWadFile(sourcePath),
    onSuccess: (result) => {
      toast({
        title: result.alreadyExists ? 'SYSTEM: wad_exists' : 'SYSTEM: wad_imported',
        description: result.alreadyExists
          ? t(
              'install.wadImport.isAlreadyInYourWadLibraryYouCanMake',
              '"{fileName}" is already in your WAD library. You can make changes in core_settings -> Wad Config.',
              { fileName: String(result.fileName) }
            )
          : t(
              'install.wadImport.wasAddedYouCanMakeChangesInCoreSettings',
              '"{fileName}" was added. You can make changes in core_settings -> Wad Config.',
              { fileName: String(result.fileName) }
            )
      })
      setSelectedWad(null)
      queryClient.invalidateQueries({ queryKey: ['/api/versions'] })

      // Dispatch WAD_IMPORTED achievement event (only for new imports)
      if (!result.alreadyExists) {
        dispatchAchievementEvent({
          type: 'WAD_IMPORTED',
          count: 1
        })
          .then((wadResult) => {
            const unlockToasts = buildUnlockToasts(wadResult)
            for (const t of unlockToasts) {
              toast({
                title: t.title,
                description: t.description,
                duration: t.duration as 6000 | 8000,
                historyKind: t.historyKind
              })
            }
          })
          .catch((err: unknown) => {
            log.error('Achievement dispatch failed:', err)
          })
      }
    },
    onError: (error) => {
      toast({
        title: 'FATAL: err_482',
        description: t('install.wadImport.failedToImportWad', 'Failed to import WAD: {error}', {
          error: String(error)
        }),
        variant: 'destructive'
      })
    }
  })

  const handleWadDrop = useCallback(
    async (e: React.DragEvent): Promise<void> => {
      e.preventDefault()
      e.stopPropagation()
      setIsWadDragging(false)

      const file = e.dataTransfer.files[0]
      if (!file) return

      const filePath = window.api.getPathForFile(file) || file.name
      await prepareWadImport(filePath)
    },
    [prepareWadImport]
  )

  const handleWadDragOver = useCallback((e: React.DragEvent): void => {
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'copy'
    setIsWadDragging(true)
  }, [])

  const handleWadDragLeave = useCallback((e: React.DragEvent): void => {
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX
    const y = e.clientY

    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setIsWadDragging(false)
    }
  }, [])

  const clearSelection = useCallback((): void => {
    setSelectedWad(null)
  }, [])

  return {
    selectedWad,
    isWadDragging,
    isPreparingWad,
    prepareWadImport,
    handleBrowseWad,
    handleWadDrop,
    handleWadDragOver,
    handleWadDragLeave,
    importWadMutation,
    clearSelection
  }
}
