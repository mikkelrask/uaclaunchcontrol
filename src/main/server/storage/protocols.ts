// Protocol management
import fs from 'fs-extra'
import path from 'path'
import type { IProtocol, IModFile, IDoomVersion } from '@shared/schema'
import { debug } from '@shared/debug'
import { MODS_DIR } from './paths'
import { initStorage, getSettings, resolvePath, computeFileHash } from './core'
import { getDoomVersions, saveDoomVersions } from './doom-versions'
import { getModFileCatalog } from './mod-catalog'

/** Enrich each file in a protocol with catalogue metadata (url, name, version). */
async function enrichFilesWithCatalog(files: IModFile[]): Promise<IModFile[]> {
  if (files.length === 0) return files
  try {
    const catalog = await getModFileCatalog()
    const byHash = new Map<string, IModFile>()
    for (const entry of catalog) {
      if (entry.hashValue) {
        byHash.set(entry.hashValue, entry)
      }
    }
    return files.map((f) => {
      if (!f.hashValue) return f
      const catalogEntry = byHash.get(f.hashValue)
      if (!catalogEntry) return f
      return {
        ...f,
        url: f.url || catalogEntry.url || '',
        name: f.name || catalogEntry.name || '',
        version: f.version || catalogEntry.version || ''
      }
    })
  } catch {
    return files
  }
}

export async function saveProtocol(
  protocolData: IProtocol & { files: IModFile[] }
): Promise<IProtocol> {
  // Ensure doomVersionId is always a string
  if (protocolData.doomVersionId !== undefined) {
    protocolData.doomVersionId = String(protocolData.doomVersionId)
  }
  try {
    initStorage()
    const settings = await getSettings()
    const targetDir = settings.modsDirectory ? resolvePath(settings.modsDirectory) : MODS_DIR
    const filePath = path.join(targetDir, `${protocolData.id}.json`)

    for (const file of protocolData.files) {
      if (!file.hashValue && file.filePath) {
        file.hashValue = await computeFileHash(file.filePath)
      }
    }

    await fs.writeJSON(filePath, protocolData, { spaces: 2 })
    const protocol = { ...protocolData }
    delete (protocol as Record<string, unknown>).files
    return protocol as IProtocol
  } catch (error: unknown) {
    console.error('Error saving mod:', error)
    throw new Error(`Failed to save mod: ${error instanceof Error ? error.message : String(error)}`)
  }
}

export async function getProtocols(): Promise<IProtocol[]> {
  try {
    initStorage()
    const settings = await getSettings()
    const targetDir = settings.modsDirectory ? resolvePath(settings.modsDirectory) : MODS_DIR
    const protocols: IProtocol[] = []
    if (!fs.existsSync(targetDir)) {
      return protocols
    }
    const filenames = await fs.readdir(targetDir)

    for (const filename of filenames) {
      if (filename.endsWith('.json')) {
        const filePath = path.join(targetDir, filename)
        try {
          const data = await fs.readJSON(filePath)
          const protocol = { ...data }
          if (!Array.isArray(protocol.files)) {
            protocol.files = []
          }
          protocol.files = await enrichFilesWithCatalog(protocol.files)
          protocols.push(protocol as IProtocol)
        } catch (err: unknown) {
          console.error(`Error reading protocol file ${filename}:`, err)
        }
      }
    }
    return protocols
  } catch (error: unknown) {
    console.error('Error getting protocols:', error)
    return []
  }
}

export async function getProtocol(protocolId: string): Promise<IProtocol & { files: IModFile[] }> {
  try {
    initStorage()
    const settings = await getSettings()
    const targetDir = settings.modsDirectory ? resolvePath(settings.modsDirectory) : MODS_DIR
    const filePath = path.join(targetDir, `${protocolId}.json`)
    if (!fs.existsSync(filePath)) {
      throw new Error(`Protocol ${protocolId} not found`)
    }
    const data = await fs.readJSON(filePath)
    if (!Array.isArray(data.files)) {
      data.files = []
    }
    data.files = await enrichFilesWithCatalog(data.files)
    return data as IProtocol & { files: IModFile[] }
  } catch (error: unknown) {
    console.error(`Error getting protocol ${protocolId}:`, error)
    throw new Error(
      `Failed to get protocol: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

export async function getDoomVersion(id: string): Promise<IDoomVersion | undefined> {
  try {
    const versions = await getDoomVersions()
    return versions.find((v) => v.id === id)
  } catch (error: unknown) {
    console.error(`Error getting Doom version by id ${id}:`, error)
    return undefined
  }
}

export async function updateDoomVersion(
  id: string,
  updates: Partial<IDoomVersion>
): Promise<IDoomVersion> {
  const versions = await getDoomVersions()
  const index = versions.findIndex((v) => v.id === id)
  if (index === -1) {
    throw new Error(`Doom version with ID ${id} not found`)
  }
  const updated = { ...versions[index], ...updates }
  versions[index] = updated
  await saveDoomVersions(versions)
  return updated
}

// Add playtime to a protocol's accumulated playtime
export async function addPlaytime(id: string, sessionSeconds: number): Promise<void> {
  try {
    const settings = await getSettings()
    const targetDir = settings.modsDirectory ? resolvePath(settings.modsDirectory) : MODS_DIR
    const filePath = path.join(targetDir, `${id}.json`)

    if (!fs.existsSync(filePath)) {
      console.warn(`addPlaytime: Protocol ${id} not found`)
      return
    }

    const data = await fs.readJSON(filePath)
    const current = data.playtimeSeconds || 0
    data.playtimeSeconds = current + sessionSeconds
    await fs.writeJSON(filePath, data, { spaces: 2 })

    debug(`Added ${sessionSeconds}s playtime to protocol ${id} (total: ${data.playtimeSeconds}s)`)
  } catch (error: unknown) {
    console.error(`Error adding playtime to protocol ${id}:`, error)
  }
}

export async function deleteProtocol(id: string | number): Promise<boolean | undefined> {
  try {
    const settings = await getSettings()
    const targetDir = settings.modsDirectory ? resolvePath(settings.modsDirectory) : MODS_DIR
    const filePath = path.join(targetDir, `${id}.json`)
    debug('Attempting to delete protocol file:', filePath)
    if (await fs.pathExists(filePath)) {
      await fs.remove(filePath)
      debug('Deleted protocol file:', filePath)
      return true
    } else {
      console.warn('[DEBUG] Protocol file does not exist:', filePath)
      return false
    }
  } catch (error: unknown) {
    console.error('Error deleting protocol:', error)
    return false
  }
}
