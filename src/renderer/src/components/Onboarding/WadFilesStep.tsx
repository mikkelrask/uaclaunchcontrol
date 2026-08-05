import React, { useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, FolderOpen, Download, Check } from 'lucide-react'
import { api } from '@/api'
import type { IAppSettings, IDoomVersion } from '@shared/schema'
import { DoomVersionIcon } from '@/icons/DoomIcons'

interface WadFilesStepProps {
  settings: IAppSettings
  setSettings: React.Dispatch<React.SetStateAction<IAppSettings>>
  onNext: () => void
  onBack: () => void
}

const FREEDOOM_BUNDLES = [
  {
    bundle: 'phase12' as const,
    label: 'FreeDoom (Phase 1 + 2)',
    slugs: ['freedoom1', 'freedoom2']
  },
  { bundle: 'freedm' as const, label: 'FreeDM', slugs: ['freedm'] }
]

export const WadFilesStep: React.FC<WadFilesStepProps> = ({
  settings,
  setSettings,
  onNext,
  onBack
}) => {
  const [doomVersions, setDoomVersions] = useState<IDoomVersion[]>([])
  const [isLoadingVersions, setIsLoadingVersions] = useState(true)
  const [freedoomDownloading, setFreedoomDownloading] = useState<'phase12' | 'freedm' | null>(null)
  const [freedoomError, setFreedoomError] = useState('')

  useEffect(() => {
    let cancelled = false
    api
      .getDoomVersions()
      .then((versions) => {
        if (!cancelled) setDoomVersions(versions)
      })
      .catch(console.error)
      .finally(() => {
        if (!cancelled) setIsLoadingVersions(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const persistDirectory = async (dir: string): Promise<void> => {
    try {
      await api.updateSettings({ wadFilesDirectory: dir })
      const versions = await api.getDoomVersions()
      setDoomVersions(versions)
    } catch {
      // Directory persistence is best-effort here — the field itself already
      // reflects the user's intent, and the main Settings dialog remains the
      // fallback if this silently fails.
    }
  }

  const handleBrowse = async (): Promise<void> => {
    const result = await api.showOpenDialog({
      properties: ['openDirectory'],
      defaultPath: settings.wadFilesDirectory
    })
    if (!result.canceled && result.filePaths.length > 0) {
      const dir = result.filePaths[0]
      setSettings((prev) => ({ ...prev, wadFilesDirectory: dir }))
      await persistDirectory(dir)
    }
  }

  const handleDownloadFreedoom = async (bundle: 'phase12' | 'freedm'): Promise<void> => {
    setFreedoomDownloading(bundle)
    setFreedoomError('')
    try {
      const result = await api.downloadFreedoom(bundle)
      setDoomVersions(result.doomVersions)
    } catch (e) {
      setFreedoomError(e instanceof Error ? e.message : 'Download failed')
    } finally {
      setFreedoomDownloading(null)
    }
  }

  const hasAnyIwad = doomVersions.length > 0

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <span className="font-mono text-xs uppercase tracking-[0.3em] text-accent-highlight/70">
          UAC-7 // Data Repositories
        </span>
        <h2 className="text-2xl font-bold tracking-tight text-app-primary">WAD Files</h2>
        <p className="text-sm text-app-secondary max-w-lg mx-auto">
          Point at a folder with your Doom WAD files, or drop them into the folder below.
          <br /> <br />
          Don&apos;t own DOOM or DOOM II? Grab FreeDoom — free and legally redistributable, or{' '}
          <a
            href="https://uac-soft.online/guides/acquiring-doom/"
            target="_blank"
            rel="noreferrer"
            className="underline font-bold"
          >
            click here
          </a>{' '}
          to see how to acquire them.
        </p>
      </div>

      <div className="bg-app-secondary p-4 rounded-xl border border-app shadow-sm space-y-3">
        <Label className="text-xs text-app-muted font-bold uppercase tracking-wider">
          WAD Files Directory
        </Label>
        <div className="flex gap-2">
          <Input
            value={settings.wadFilesDirectory ?? ''}
            onChange={(e) =>
              setSettings((prev) => ({ ...prev, wadFilesDirectory: e.target.value }))
            }
            onBlur={(e) => persistDirectory(e.target.value)}
            className="bg-app-primary border-app h-10 text-sm flex-1 focus-visible:ring-2 focus-visible:ring-accent-highlight/40"
          />
          <Button
            size="icon"
            variant="ghost"
            className="h-10 w-10 shrink-0 hover:bg-app-primary/50 text-app-primary border border-app/30"
            onClick={handleBrowse}
          >
            <FolderOpen className="w-5 h-5" />
          </Button>
        </div>
      </div>

      <div className="bg-app-secondary p-4 rounded-xl border border-app shadow-sm space-y-3">
        <Label className="text-xs uppercase tracking-widest text-app-muted font-mono font-bold">
          FreeDoom
        </Label>
        <p className="text-xs text-app-muted leading-tight">
          Free, legally redistributable IWADs — no commercial Doom purchase required.
        </p>
        <div className="flex flex-col gap-2">
          {FREEDOOM_BUNDLES.map(({ bundle, label, slugs }) => {
            const installed = slugs.every((slug) => doomVersions.some((v) => v.slug === slug))
            return (
              <div
                key={bundle}
                className="flex items-center justify-between gap-4 bg-app-primary p-2.5 rounded-lg border border-app"
              >
                <span className="text-sm text-app-primary">{label}</span>
                {installed ? (
                  <span className="flex items-center gap-1 text-xs text-green-500 shrink-0">
                    <Check className="w-3.5 h-3.5" />
                    Installed
                  </span>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDownloadFreedoom(bundle)}
                    disabled={freedoomDownloading !== null}
                    className="text-xs h-7 bg-app-secondary hover:bg-app-hover text-app-primary border-app shrink-0"
                  >
                    <Download className="w-3 h-3 mr-1" />
                    {freedoomDownloading === bundle ? 'Downloading…' : 'Download'}
                  </Button>
                )}
              </div>
            )
          })}
        </div>
        {freedoomError && <p className="text-xs text-red-400">{freedoomError}</p>}
      </div>

      <div className="bg-app-secondary p-4 rounded-xl border border-app shadow-sm space-y-3">
        <Label className="text-xs text-app-muted font-bold uppercase tracking-wider">
          Detected IWADs
        </Label>
        {isLoadingVersions ? (
          <p className="text-xs text-app-muted italic py-2">Scanning…</p>
        ) : !hasAnyIwad ? (
          <p className="text-xs text-app-muted italic py-2">
            No WAD files detected yet. Point at a folder above or download FreeDoom.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2 pt-1">
              {doomVersions.map((version) => (
                <div
                  key={version.id}
                  className="flex items-center gap-2 bg-app-primary pl-2 pr-2.5 py-1.5 rounded-lg border border-app"
                >
                  <button
                    onClick={() =>
                      setSettings((prev) => ({ ...prev, defaultDoomVersionId: version.id }))
                    }
                    className={`shrink-0 w-3.5 h-3.5 rounded-full border-2 transition-colors ${
                      settings.defaultDoomVersionId === version.id
                        ? 'border-accent-highlight bg-accent-highlight'
                        : 'border-app-muted/40 hover:border-app-muted'
                    }`}
                    title={
                      settings.defaultDoomVersionId === version.id
                        ? 'Default WAD — pre-fills Base WAD on new protocols'
                        : 'Set as default WAD'
                    }
                  />
                  <div className="w-5 h-5 shrink-0 flex items-center justify-center overflow-hidden rounded bg-black/20">
                    <DoomVersionIcon
                      version={version.slug}
                      customIcon={version.icon}
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <span className="text-xs text-app-primary">{version.name}</span>
                </div>
              ))}
            </div>
            <p className=" text-app-muted italic opacity-70">
              Click the dot next to a WAD to make it your default — it&apos;ll be pre-selected as
              the Base WAD when you create a new protocol.
            </p>
          </>
        )}
      </div>

      {!hasAnyIwad && (
        <p className="text-xs text-app-muted italic text-center">
          You can also do this later in Settings — this step isn&apos;t required to continue.
        </p>
      )}

      <div className="flex items-center justify-between pt-2">
        <Button
          variant="ghost"
          onClick={onBack}
          className="text-app-muted hover:text-app-primary gap-1"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </Button>
        <Button
          onClick={onNext}
          className="bg-accent-highlight text-white hover:bg-accent-highlight/90 gap-1 px-6"
        >
          Next
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}
