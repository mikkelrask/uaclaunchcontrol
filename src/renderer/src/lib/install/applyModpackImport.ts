// Shared "apply a uac-modpack JSON to the install form" logic — used both by
// the install page's JSON drop (useJsonDrop) and by the registry handoff
// (registryInstall), so a registry "Install Protocol" click behaves exactly
// like dragging an exported protocol JSON onto the install page.
import type { UseFormReturn } from 'react-hook-form'
import type { z } from 'zod'
import type { IModFile, IAppSettings, IDoomVersion, ISourcePort } from '@shared/schema'
import { api } from '@/api'
import { createLogger } from '@shared/logger'
import type { formSchema } from '@/lib/install/schema'
import type { UacModpackImport } from '@/lib/install/types'

const log = createLogger('install/applyModpackImport')

export interface ToastLike {
  (opts: { title: string; description: string; variant?: 'destructive' }): void
  (opts: { title: string; description: string; duration: number }): void
}

export interface ApplyModpackImportOptions {
  form: UseFormReturn<z.infer<typeof formSchema>>
  versions: IDoomVersion[]
  settings: IAppSettings
  setFiles: React.Dispatch<React.SetStateAction<IModFile[]>>
  toast: ToastLike
}

/**
 * Try to match an imported source port name/family against the configured ports.
 * Falls back to the first non-ignored port.
 */
export function matchSourcePort(
  sourcePortHint: string | undefined,
  ports: ISourcePort[]
): ISourcePort | undefined {
  if (!sourcePortHint || ports.length === 0) return ports.find((p) => !p.ignored) || ports[0]

  const lower = sourcePortHint.toLowerCase()
  return (
    ports.find((p) => p.family === lower || p.name.toLowerCase().includes(lower)) ||
    ports.find((p) => !p.ignored) ||
    ports[0]
  )
}

/**
 * Try to match a doom version slug or IWAD filename against known versions.
 */
export function matchDoomVersion(
  slugOrIwad: string | undefined,
  versions: IDoomVersion[]
): IDoomVersion | undefined {
  if (!slugOrIwad || versions.length === 0) return undefined

  // Try slug first
  const bySlug = versions.find((v) => v.slug === slugOrIwad)
  if (bySlug) return bySlug

  // Try IWAD filename (case-insensitive)
  const iwadLower = slugOrIwad.toLowerCase()
  return versions.find((v) => v.defaultIwad && v.defaultIwad.toLowerCase() === iwadLower)
}

/**
 * Merge a modpack's imported file list against the local catalog, preserving
 * the JSON array's order (that order *is* the load order — see
 * useExportModpack.ts). Matched and missing files must stay interleaved
 * exactly as exported; sorting them into separate buckets first would
 * silently reorder anything that mixed the two.
 */
export function matchImportFiles(
  importFiles: UacModpackImport['files'],
  catalogData: IModFile[],
  importConfigs: UacModpackImport['configs']
): { files: IModFile[]; missingCount: number } {
  const files: IModFile[] = []
  let missingCount = 0

  for (const impFile of importFiles) {
    const catalogMatch = catalogData.find((c) => c.hashValue === impFile.hashValue)

    // Attach configTemplate if configHash is present and config content was written
    const configTemplate =
      impFile.configHash && importConfigs?.[impFile.configHash]
        ? { configFile: `${impFile.configHash}.cfg`, md5Hash: impFile.configHash }
        : undefined

    if (catalogMatch) {
      files.push({
        ...catalogMatch,
        // Preserve existing template or set from import
        configTemplate: catalogMatch.configTemplate || configTemplate
      })
    } else {
      missingCount++
      files.push({
        id: Date.now() + Math.random(),
        name: impFile.name,
        fileName: impFile.name,
        filePath: '',
        fileType: 'PK3',
        isRequired: true,
        hashValue: impFile.hashValue || '',
        url: impFile.url || '',
        configTemplate
      })
    }
  }

  return { files, missingCount }
}

/**
 * Populate the install form from a parsed uac-modpack import: write embedded
 * configs to disk, import the screenshot, match source port / doom version,
 * and match the file list against the catalog.
 */
export async function applyModpackImport(
  importData: UacModpackImport,
  { form, versions, settings, setFiles, toast }: ApplyModpackImportOptions
): Promise<void> {
  const { game, files: importFiles, configs: importConfigs } = importData

  // Write embedded config files to disk
  if (importConfigs) {
    const entries = Object.entries(importConfigs)
    for (const [hash, cfg] of entries) {
      try {
        await api.writeConfigContent(hash, cfg.content)
      } catch (err: unknown) {
        log.warn(`Failed to write config ${hash}:`, err)
      }
    }
    if (entries.length > 0) {
      toast({
        title: 'SYSTEM: configs_imported',
        description: `${entries.length} config file(s) written.`
      })
    }
  }

  // Populate form
  form.setValue('title', game.title || '')
  form.setValue('description', game.description || '')
  form.setValue('launchParameters', game.launchParameters || '')

  // Screenshot: an embedded base64 image gets written back to disk under a
  // fresh filename; a plain URL is already portable and just passes through
  // (the existing submit flow in InstallPage re-downloads http(s) URLs).
  if (game.screenshot) {
    try {
      const { fileName } = await api.importScreenshot(
        game.screenshot.fileName,
        game.screenshot.data
      )
      form.setValue('screenshotPath', fileName)
    } catch (err: unknown) {
      log.warn('Failed to import screenshot:', err)
    }
  } else if (game.screenshotPath) {
    form.setValue('screenshotPath', game.screenshotPath)
  }

  const ports: ISourcePort[] = settings?.sourcePorts || []
  const matchedPort = matchSourcePort(game.sourcePort, ports)
  if (matchedPort) form.setValue('sourcePortId', matchedPort.id)

  const matchedVersion = matchDoomVersion(game.doomVersionSlug, versions)
  if (matchedVersion) form.setValue('doomVersionId', matchedVersion.id.toString())

  // Match import files against catalog
  const catalogData = await api.getModFileCatalog()
  const { files: orderedFiles, missingCount } = matchImportFiles(
    importFiles,
    catalogData,
    importConfigs
  )

  setFiles(orderedFiles)

  if (missingCount > 0) {
    toast({
      title: 'SYSTEM: failed_successfully',
      description: `${orderedFiles.length - missingCount} files matched, ${missingCount} missing (shown in red)`
    })
  } else {
    toast({
      title: 'SYSTEM: import_success',
      description: 'All files matched from catalog'
    })
  }
}
