import { api } from '@/api'
import { useToast } from '@/hooks/use-toast'
import { slugify } from '@/lib/utils'
import type { IProtocol, InsertModFile, IDoomVersion, ISourcePort } from '@shared/schema'

/** Builds and downloads a `.uac-modpack` JSON export, inlining referenced config file contents. */
export function useExportModpack(
  protocol: IProtocol,
  files: InsertModFile[],
  doomVersions: IDoomVersion[] | undefined,
  sourcePorts: ISourcePort[]
): { handleExport: () => Promise<void> } {
  const { toast } = useToast()

  const handleExport = async (): Promise<void> => {
    const doomVersion = doomVersions?.find((v) => v.id === protocol.doomVersionId)
    const portName = protocol.sourcePortId
      ? sourcePorts.find((p) => p.id === protocol.sourcePortId)?.name || 'gzdoom'
      : 'gzdoom'

    // Collect config file contents referenced by files and protocol
    const configs: Record<string, { content: string }> = {}

    // From file configTemplates
    for (const f of files) {
      if (f.configTemplate?.md5Hash && !configs[f.configTemplate.md5Hash]) {
        try {
          const content = await api.readConfigContent(f.configTemplate.md5Hash)
          configs[f.configTemplate.md5Hash] = { content }
        } catch {
          console.warn(`Failed to read config ${f.configTemplate.md5Hash} for export`)
        }
      }
    }

    // From protocolConfig (the template it was seeded from)
    if (protocol.protocolConfig?.templateHash && !configs[protocol.protocolConfig.templateHash]) {
      try {
        const content = await api.readConfigContent(protocol.protocolConfig.templateHash)
        configs[protocol.protocolConfig.templateHash] = { content }
      } catch {
        console.warn(
          `Failed to read protocol config ${protocol.protocolConfig.templateHash} for export`
        )
      }
    }

    // Screenshot: a bare filename lives in the local images directory and
    // won't exist on whatever machine imports this JSON, so embed its bytes
    // as base64. A URL is already portable — just carry it through as text,
    // same as everything else in this export.
    const isLocalScreenshot =
      !!protocol.screenshotPath &&
      !protocol.screenshotPath.startsWith('http') &&
      !protocol.screenshotPath.includes('/') &&
      !protocol.screenshotPath.includes('\\')

    let screenshot: { fileName: string; mimeType: string; data: string } | undefined
    if (isLocalScreenshot) {
      try {
        screenshot = await api.readScreenshotContent(protocol.screenshotPath!)
      } catch {
        console.warn('Failed to read screenshot for export')
      }
    }

    const exportData = {
      format: 'uac-modpack',
      version: '1.1',
      game: {
        title: protocol.title || protocol.name,
        description: protocol.description || '',
        doomVersionSlug: doomVersion?.slug || '',
        sourcePort: portName,
        launchParameters: protocol.launchParameters || '',
        ...(protocol.protocolConfig ? { protocolConfig: protocol.protocolConfig } : {}),
        ...(protocol.screenshotPath && !isLocalScreenshot
          ? { screenshotPath: protocol.screenshotPath }
          : {}),
        ...(screenshot ? { screenshot } : {})
      },
      // Load order isn't a per-file field — it's the position of each entry
      // in this array. IModFile.loadOrder is unrelated (catalog-only,
      // relative dependency ordering for the "add required files" combobox),
      // so exporting it here just implied false precision.
      files: files.map((f) => ({
        name: f.name || f.fileName,
        hashValue: f.hashValue || '',
        url: f.url || '',
        ...(f.configTemplate ? { configHash: f.configTemplate.md5Hash } : {})
      })),
      ...(Object.keys(configs).length > 0 ? { configs } : {})
    }

    const jsonStr = JSON.stringify(exportData, null, 2)
    const blob = new Blob([jsonStr], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${slugify(protocol.title || protocol.name || 'modpack')}.json`
    a.click()
    URL.revokeObjectURL(url)

    const extras = [
      Object.keys(configs).length > 0 ? 'configs' : null,
      screenshot ? 'screenshot' : null
    ].filter(Boolean)
    toast({
      title: 'SYSTEM: export_done',
      description: `Modpack downloaded${extras.length > 0 ? ` with ${extras.join(' + ')}` : ''}`
    })
  }

  return { handleExport }
}
