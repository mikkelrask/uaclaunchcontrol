import { useState, useCallback } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import type { z } from 'zod'
import type { IModFile, IAppSettings, IDoomVersion, ISourcePort } from '@shared/schema'
import { api } from '@/api'
import { createLogger } from '@shared/logger'
const log = createLogger('install/useJsonDrop')
import { parseBatContent, resolveRelativePaths, deriveFileType } from '@/lib/install/parsers'
import type { formSchema } from '@/lib/install/schema'
import type { UacModpackImport } from '@/lib/install/types'
import {
  applyModpackImport,
  matchSourcePort,
  matchDoomVersion,
  type ToastLike
} from './applyModpackImport'

type DragEvent = React.DragEvent

export interface JsonDropHandlers {
  isJsonDragging: boolean
  handleJsonDrop: (e: DragEvent) => Promise<void>
  handleJsonDragOver: (e: DragEvent) => void
  handleJsonDragLeave: (e: DragEvent) => void
}

interface UseJsonDropOptions {
  form: UseFormReturn<z.infer<typeof formSchema>>
  versions: IDoomVersion[]
  settings: IAppSettings
  toast: ToastLike
  setFiles: React.Dispatch<React.SetStateAction<IModFile[]>>
}

// ── Helpers ─────────────────────────────────────────────

/**
 * Determine whether a DragEvent represents an external file drop
 * (as opposed to an internal reorder event).
 */
function isExternalFileDrop(e: DragEvent): boolean {
  const types = Array.from(e.dataTransfer.types || [])
  return types.includes('Files') && !types.includes('text/plain')
}

/**
 * Build a temporary IModFile for a file path, computing its hash and
 * checking against the existing catalog.
 */
async function buildFileFromPath(filePath: string, catalogData: IModFile[]): Promise<IModFile> {
  const fileName = filePath.split(/[\\/]/).pop() || filePath
  const ext = fileName.split('.').pop() || ''
  const fileType = deriveFileType(ext)

  let hashValue = ''
  try {
    hashValue = await api.computeHash(filePath)
  } catch {
    log.warn(`Failed to compute hash for ${filePath}`)
  }

  if (hashValue) {
    const catalogMatch = catalogData.find((c) => c.hashValue === hashValue)
    if (catalogMatch) {
      return { ...catalogMatch, isRequired: true }
    }
  }

  return {
    id: Date.now() + Math.random(),
    name: fileName.replace(/\.[^.]+$/, ''),
    fileName,
    filePath,
    fileType,
    isRequired: true,
    hashValue
  }
}

// ── BAT Import ──────────────────────────────────────────

async function importFromBatFile(
  droppedFile: File,
  form: UseFormReturn<z.infer<typeof formSchema>>,
  versions: IDoomVersion[],
  settings: IAppSettings,
  setFiles: React.Dispatch<React.SetStateAction<IModFile[]>>,
  toast: ToastLike
): Promise<void> {
  const text = await droppedFile.text()
  const parsed = parseBatContent(text)

  // Populate form
  form.setValue('title', droppedFile.name.replace(/\.bat$/i, ''))

  const ports: ISourcePort[] = settings?.sourcePorts || []
  const matchedPort = matchSourcePort(parsed.sourcePortFamily, ports)
  if (matchedPort) form.setValue('sourcePortId', matchedPort.id)

  const matchedVersion = matchDoomVersion(parsed.iwad, versions)
  if (matchedVersion) form.setValue('doomVersionId', matchedVersion.id.toString())

  if (parsed.extraParams.length > 0) {
    form.setValue('launchParameters', parsed.extraParams.join(' '))
  }

  // Resolve paths and build file list
  const batPath = window.api.getPathForFile(droppedFile) || droppedFile.name
  const resolvedFiles = resolveRelativePaths(batPath, parsed.modFiles)
  const catalogData = await api.getModFileCatalog()

  const finalFiles = await Promise.all(
    resolvedFiles.map((fp) => buildFileFromPath(fp, catalogData))
  )
  setFiles(finalFiles)

  if (parsed.modFiles.length === 0) {
    toast({
      title: 'SYSTEM: bat_parsed',
      description: 'No -file entries found in .bat file.'
    })
  } else {
    toast({
      title: 'SYSTEM: bat_parsed',
      description: `Prepopulated from .bat: ${finalFiles.length} mod file(s).`
    })
  }
}

// ── JSON Modpack Import ─────────────────────────────────

async function importFromJsonFile(
  droppedFile: File,
  form: UseFormReturn<z.infer<typeof formSchema>>,
  versions: IDoomVersion[],
  settings: IAppSettings,
  setFiles: React.Dispatch<React.SetStateAction<IModFile[]>>,
  toast: ToastLike
): Promise<void> {
  const text = await droppedFile.text()
  const importData: UacModpackImport = JSON.parse(text)

  if (importData.format !== 'uac-modpack') {
    toast({
      title: 'FATAL: format_unknown',
      description: 'Provided file is not a UAC Export JSON',
      variant: 'destructive'
    })
    return
  }

  await applyModpackImport(importData, { form, versions, settings, setFiles, toast })
}

// ── Hook ────────────────────────────────────────────────

/**
 * Hook that handles JSON / .bat drop-import logic for the install page.
 *
 * Detects external file drops, distinguishes .bat from .json (UAC modpack),
 * parses the file, populates form fields, resolves mod file paths, computes
 * hashes, and matches against the existing mod catalog.
 */
export function useJsonDrop({
  form,
  versions,
  settings,
  toast,
  setFiles
}: UseJsonDropOptions): JsonDropHandlers {
  const [isJsonDragging, setIsJsonDragging] = useState(false)

  const handleJsonDrop = useCallback(
    async (e: DragEvent): Promise<void> => {
      if (!isExternalFileDrop(e)) return

      e.preventDefault()
      setIsJsonDragging(false)

      const droppedFile = e.dataTransfer.files[0]
      if (!droppedFile) return

      const fileName = droppedFile.name.toLowerCase()

      try {
        if (fileName.endsWith('.bat')) {
          await importFromBatFile(droppedFile, form, versions, settings, setFiles, toast)
          return
        }

        if (!fileName.endsWith('.json')) {
          toast({
            title: 'FATAL: corrupt_file',
            description: 'Please drop a valid JSON or .bat file',
            variant: 'destructive'
          })
          return
        }

        await importFromJsonFile(droppedFile, form, versions, settings, setFiles, toast)
      } catch (error: unknown) {
        const isJson = fileName.endsWith('.json')
        log.error(`Failed to parse ${isJson ? 'JSON' : '.bat'}:`, error)
        toast({
          title: isJson ? 'FATAL: import_failed' : 'FATAL: bat_parse_failed',
          description: isJson
            ? 'Invalid JSON format — please check for errors.'
            : 'Failed to parse .bat file.',
          variant: 'destructive'
        })
      }
    },
    [form, versions, settings, toast, setFiles]
  )

  const handleJsonDragOver = useCallback((e: DragEvent): void => {
    if (!isExternalFileDrop(e)) return

    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    setIsJsonDragging(true)
  }, [])

  const handleJsonDragLeave = useCallback((e: DragEvent): void => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX
    const y = e.clientY

    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setIsJsonDragging(false)
    }
  }, [])

  return {
    isJsonDragging,
    handleJsonDrop,
    handleJsonDragOver,
    handleJsonDragLeave
  }
}
