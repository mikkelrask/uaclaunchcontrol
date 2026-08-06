import React, { useState, useEffect } from 'react'
import { Download, Loader2, Check, AlertCircle } from 'lucide-react'
import { api, type PortRelease, type PortDownloadResult } from '@/api'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface PortDownloadModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onPortDownloaded: (result: PortDownloadResult) => void
  existingPorts: string[] // family:version strings of already-configured ports
}

export function PortDownloadModal({
  open,
  onOpenChange,
  onPortDownloaded,
  existingPorts
}: PortDownloadModalProps): React.ReactElement | null {
  const [releases, setReleases] = useState<PortRelease[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [downloadingTag, setDownloadingTag] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    setError('')
    api
      .getPortReleases()
      .then(setReleases)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  }, [open])

  const detectFamily = (repo: string): string => {
    if (repo.includes('UZDoom')) return 'uzdoom'
    if (repo.includes('Helion')) return 'helion'
    return 'gzdoom'
  }

  const handleDownload = async (release: PortRelease): Promise<void> => {
    setDownloadingTag(release.tag)
    setError('')
    try {
      const result = await api.downloadPortRelease(
        release.asset.url,
        release.asset.name,
        detectFamily(release.repo),
        release.tag
      )
      onPortDownloaded(result)
      onOpenChange(false)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Download failed')
    } finally {
      setDownloadingTag(null)
    }
  }

  const isInstalled = (release: PortRelease): boolean => {
    const family = detectFamily(release.repo)
    return existingPorts.some(
      (p) =>
        p.toLowerCase() === `${family}:${release.tag.toLowerCase()}` ||
        p.toLowerCase() === `${family}:${release.version.toLowerCase()}`
    )
  }

  const formatSize = (bytes: number): string => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  }

  const formatDate = (iso: string): string => {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  // Group releases by repo (the backend returns UZDoom first, then GZDoom, then Helion)
  const uzdoomReleases = releases.filter((r) => r.repo.includes('UZDoom'))
  const gzdoomReleases = releases.filter((r) => r.repo.includes('gzdoom'))
  const helionReleases = releases.filter((r) => r.repo.includes('Helion'))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-app-primary shadow-2xl border-app max-w-2xl max-h-[80vh] p-0 overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-app bg-app-secondary shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-accent-highlight/10 rounded-md">
              <Download className="w-5 h-5 text-accent-highlight" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold tracking-tight text-app-primary lowercase">
                download source port
              </DialogTitle>
              <DialogDescription className="text-xs font-semibold font-mono text-app-muted uppercase tracking-widest opacity-80">
                fetch releases from github
              </DialogDescription>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-accent-highlight" />
              <span className="ml-2 text-sm text-app-muted">Fetching releases…</span>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 p-3 rounded bg-red-500/10 border border-red-500/20 text-sm text-red-400">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!loading && !error && releases.length === 0 && (
            <p className="text-sm text-app-muted text-center py-8">
              No releases available for your platform.
            </p>
          )}

          {/* UZDoom (first) */}
          {uzdoomReleases.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-app-muted font-mono">
                UZDoom
              </h3>
              {uzdoomReleases.map((rel) => (
                <ReleaseRow
                  key={rel.tag}
                  release={rel}
                  installed={isInstalled(rel)}
                  downloading={downloadingTag === rel.tag}
                  onDownload={() => handleDownload(rel)}
                  formatSize={formatSize}
                  formatDate={formatDate}
                />
              ))}
            </div>
          )}

          {/* GZDoom */}
          {gzdoomReleases.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-app-muted font-mono">
                GZDoom
              </h3>
              {gzdoomReleases.map((rel) => (
                <ReleaseRow
                  key={rel.tag}
                  release={rel}
                  installed={isInstalled(rel)}
                  downloading={downloadingTag === rel.tag}
                  onDownload={() => handleDownload(rel)}
                  formatSize={formatSize}
                  formatDate={formatDate}
                />
              ))}
            </div>
          )}

          {/* Helion */}
          {helionReleases.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-app-muted font-mono">
                Helion
              </h3>
              {helionReleases.map((rel) => (
                <ReleaseRow
                  key={rel.tag}
                  release={rel}
                  installed={isInstalled(rel)}
                  downloading={downloadingTag === rel.tag}
                  onDownload={() => handleDownload(rel)}
                  formatSize={formatSize}
                  formatDate={formatDate}
                />
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="bg-app-secondary border-t border-app p-4 shrink-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={!!downloadingTag}
            className="bg-app-primary hover:bg-app-hover text-app-primary border-app"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Individual release row ────────────────────────────

interface ReleaseRowProps {
  release: PortRelease
  installed: boolean
  downloading: boolean
  onDownload: () => void
  formatSize: (bytes: number) => string
  formatDate: (iso: string) => string
}

function getFormatLabel(name: string): string {
  if (name.endsWith('.AppImage')) return 'AppImage'
  if (name.endsWith('.deb')) return 'deb'
  if (name.endsWith('.dmg')) return 'dmg'
  if (name.endsWith('.zip')) return 'zip'
  return 'bin'
}

function ReleaseRow({
  release,
  installed,
  downloading,
  onDownload,
  formatSize,
  formatDate
}: ReleaseRowProps): React.ReactElement {
  const formatLabel = getFormatLabel(release.asset.name)
  return (
    <div className="flex items-center gap-3 p-3 bg-app-secondary/50 rounded-lg border border-app group hover:border-accent-highlight/30 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-app-primary truncate">{release.version}</span>
          {release.prerelease && (
            <span className="text-[0.625rem] font-mono uppercase px-1 py-0.5 rounded bg-yellow-500/10 text-yellow-500 border border-yellow-500/20">
              preview
            </span>
          )}
          <span className="text-[0.625rem] font-mono uppercase px-1 py-0.5 rounded bg-app-primary border border-app/50 text-app-muted">
            {formatLabel}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-app-muted mt-0.5">
          <span>{formatDate(release.publishedAt)}</span>
          <span>{formatSize(release.asset.size)}</span>
          <span className="font-mono truncate">{release.asset.name}</span>
        </div>
      </div>

      {installed ? (
        <div className="flex items-center gap-1.5 text-green-500 text-xs shrink-0">
          <Check className="w-3.5 h-3.5" />
          <span>installed</span>
        </div>
      ) : (
        <Button
          size="sm"
          onClick={onDownload}
          disabled={downloading}
          className="shrink-0 bg-accent-highlight hover:opacity-90 text-white text-xs h-8"
        >
          {downloading ? (
            <>
              <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
              Downloading…
            </>
          ) : (
            <>
              <Download className="w-3.5 h-3.5 mr-1" />
              Install
            </>
          )}
        </Button>
      )}
    </div>
  )
}
