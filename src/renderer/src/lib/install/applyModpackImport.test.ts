import { describe, it, expect, vi } from 'vitest'
import { applyModpackImport, matchDoomVersion } from './applyModpackImport'
import type { IAppSettings, IDoomVersion } from '@shared/schema'
import type { UacModpackImport } from './types'

/** Shape of a real synced list: slugs first, absolute IWAD paths. */
const versions: IDoomVersion[] = [
  {
    id: '1',
    name: 'Ultimate Doom (1.9)',
    slug: 'doom',
    args: '-iwad /wads/doom.wad',
    parameters: '',
    defaultIwad: '/wads/doom.wad',
    icon: ''
  },
  {
    id: '2',
    name: 'Doom II (1.9)',
    slug: 'doom2',
    args: '-iwad /wads/doom2.wad',
    parameters: '',
    defaultIwad: '/wads/doom2.wad',
    icon: ''
  },
  {
    id: '6',
    name: 'FreeDoom: Phase 2',
    slug: 'freedoom2',
    args: '-iwad /wads/FREEDOOM2.WAD',
    parameters: '',
    defaultIwad: '/wads/FREEDOOM2.WAD',
    icon: 'freedoom2.png'
  }
]

describe('matchDoomVersion', () => {
  it('matches a plain slug', () => {
    expect(matchDoomVersion('doom2', versions)?.id).toBe('2')
  })

  it('matches a slug another install generated from the download name', () => {
    // What the registry carries for protocols exported before entries had
    // stable slugs: `wad-<file stem>-<md5>`.
    expect(matchDoomVersion('wad-freedoom2-cd666466759b5e5f63af93c5f0ffd0a1', versions)?.id).toBe(
      '6'
    )
  })

  it('matches an IWAD filename, with or without a path', () => {
    expect(matchDoomVersion('FREEDOOM2.WAD', versions)?.id).toBe('6')
    expect(matchDoomVersion('/some/where/freedoom2.wad', versions)?.id).toBe('6')
  })

  it('matches a local entry whose own slug is still filename-derived', () => {
    const messy: IDoomVersion[] = [
      { ...versions[2], slug: 'wad-freedoom2-cd666466759b5e5f63af93c5f0ffd0a1' }
    ]
    expect(matchDoomVersion('freedoom2', messy)?.id).toBe('6')
  })

  it('prefers an exact slug over a filename that merely looks similar', () => {
    const both: IDoomVersion[] = [
      { ...versions[1], slug: 'wad-doom2-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
      versions[1]
    ]
    expect(matchDoomVersion('doom2', both)?.slug).toBe('doom2')
  })

  it('returns undefined when nothing matches', () => {
    expect(matchDoomVersion('strife1', versions)).toBeUndefined()
    expect(matchDoomVersion('', versions)).toBeUndefined()
    expect(matchDoomVersion('doom2', [])).toBeUndefined()
  })
})

// applyModpackImport reaches the catalog + screenshot APIs; the form and toast
// are the observable surface here.
vi.mock('@/api', () => ({
  api: {
    getModFileCatalog: async () => [],
    writeConfigContent: async () => undefined,
    importScreenshot: async () => ({ fileName: 'poster.png' })
  }
}))

function fakeForm(initial: Record<string, string> = {}): {
  values: Record<string, string>
  setValue: (name: string, value: string) => void
  getValues: (name: string) => string
} {
  const values: Record<string, string> = { ...initial }
  return {
    values,
    setValue: (name, value) => {
      values[name] = value
    },
    getValues: (name) => values[name]
  }
}

const settings = {
  savegamesPath: '/saves',
  sourcePorts: [{ id: 'port1', family: 'gzdoom' }]
} as unknown as IAppSettings

async function apply(game: UacModpackImport['game']): Promise<{
  form: ReturnType<typeof fakeForm>
  toast: ReturnType<typeof vi.fn>
}> {
  const form = fakeForm()
  const toast = vi.fn()
  await applyModpackImport(
    { format: 'uac-modpack', version: '1.1', game, files: [] },
    {
      form: form as never,
      versions,
      settings,
      setFiles: (() => undefined) as never,
      toast: toast as never
    }
  )
  return { form, toast }
}

describe('applyModpackImport', () => {
  it('applies the base WAD a registry export names', async () => {
    const { form } = await apply({
      title: 'Knee-Deep in Brutal FreeDoom',
      doomVersionSlug: 'wad-freedoom2-cd666466759b5e5f63af93c5f0ffd0a1',
      sourcePort: 'gzdoom'
    })

    expect(form.values.doomVersionId).toBe('6')
    expect(form.values.sourcePortId).toBe('port1')
  })

  it('derives the save directory from the imported title', async () => {
    const { form } = await apply({ title: 'Knee-Deep in Brutal FreeDoom', doomVersionSlug: 'doom2' })

    expect(form.values.saveDirectory).toBe('/saves/knee-deep-in-brutal-freedoom')
  })

  it('says so instead of quietly launching a different IWAD', async () => {
    const { form, toast } = await apply({ title: 'Some Protocol', doomVersionSlug: 'strife1' })

    expect(form.values.doomVersionId).toBeUndefined()
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'SYSTEM: base_wad_unmatched', variant: 'destructive' })
    )
  })
})
