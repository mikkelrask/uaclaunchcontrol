import type { Express } from 'express'
import { createServer, type Server } from 'http'
import { gameService } from './services/gameService'
import * as storage from './storage'
import * as express from 'express'
import {
  getPlayerData,
  savePlayerData,
  updatePlayerStats,
  unlockAchievement
} from './services/playerService'
import path from 'path'
import os from 'os'
import fs from 'fs-extra'
import { debug } from '@shared/debug'
import { wrapRoute } from './wrapRoute'
import { REGISTRY_API_URL } from '@shared/registry-config'
import { getPortReleases, downloadPortRelease } from './services/portService'
import {
  getFreedoomManifest,
  downloadFreedoomBundle,
  type FreedoomBundleId
} from './services/freedoomService'
import { createLogger } from '@shared/logger'

const log = createLogger('routes')

export async function registerRoutes(app: Express): Promise<Server> {
  app.use(express.json())
  const httpServer = createServer(app)

  // Initialize services and load protocols from config
  await gameService.loadProtocolsFromConfig()

  // === API Routes ===

  // === Doom Versions API ===
  app.get(
    '/api/versions',
    wrapRoute(async (_req, res) => {
      const versions = await storage.getDoomVersions()
      return res.json(versions) // Ensure this sends the array directly
    }, '/api/versions')
  )

  app.put(
    '/api/versions',
    wrapRoute(async (req, res) => {
      const versions = req.body
      if (!Array.isArray(versions)) {
        return res.status(400).json({ message: 'Expected an array of versions' })
      }
      await storage.saveDoomVersions(versions)
      return res.json({ success: true })
    }, '/api/versions')
  )

  // === Move the mod file to the mod directory set in settings ===
  app.get('/api/media', (req, res) => {
    const filePath = req.query.path as string
    if (!filePath) {
      return res.status(400).json({ message: 'Path is required' })
    }
    const resolved = storage.resolvePath(filePath)

    if (!fs.existsSync(resolved)) {
      log.warn(`[DEBUG] Media not found on disk: ${resolved}`)
      return res.status(404).json({ message: 'File not found' })
    }

    const ext = path.extname(resolved).toLowerCase()
    const mimeTypes: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp'
    }

    res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream')
    return fs.createReadStream(resolved).pipe(res)
  })

  app.post(
    '/api/file-read',
    wrapRoute(async (req, res) => {
      const { filePath } = req.body
      if (!filePath) return res.status(400).json({ message: 'Missing filePath' })
      const resolved = storage.resolvePath(filePath)
      if (!fs.existsSync(resolved)) {
        return res.status(404).json({ message: 'File not found' })
      }
      const content = await fs.readFile(resolved, 'utf-8')
      return res.json({ content })
    }, '/api/file-read')
  )

  app.post(
    '/api/move-file',
    wrapRoute(async (req, res) => {
      debug('POST /api/move-file received with body:', req.body)
      const { filePath, newPath } = req.body
      if (!filePath || !newPath) {
        return res.status(400).json({ message: 'Missing file path or new path' })
      }

      const returnPath = await storage.moveFile(filePath, newPath)
      return res.json({ message: returnPath })
    }, '/api/move-file')
  )

  app.post(
    '/api/wads/import',
    wrapRoute(async (req, res) => {
      const { sourcePath } = req.body
      if (!sourcePath) {
        return res.status(400).json({ message: 'Missing sourcePath' })
      }

      const result = await storage.importWadFile(sourcePath)
      return res.json(result)
    }, '/api/wads/import')
  )

  // Serve mod images dynamically from the images directory
  app.get(
    '/images/:fileName',
    wrapRoute(async (req, res) => {
      const filePath = path.join(storage.IMAGES_DIR, req.params.fileName as string)

      debug(`Serving image request: ${req.params.fileName as string}`)
      debug(`Full disk path: ${filePath}`)

      if (fs.existsSync(filePath)) {
        debug(`File exists, sending...`)
        const stream = fs.createReadStream(filePath)
        // Set content type based on extension
        const ext = path.extname(filePath).toLowerCase()
        const mimeTypes = {
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.png': 'image/png',
          '.webp': 'image/webp',
          '.gif': 'image/gif'
        }
        res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream')
        return stream.pipe(res)
      } else {
        log.warn(`[DEBUG] Image file NOT FOUND on disk: ${filePath}`)
        return res.status(404).send('Image file not found on disk')
      }
    }, '/images/:fileName')
  )

  // Download image route
  app.post(
    '/api/protocol/download-image',
    wrapRoute(async (req, res) => {
      const { url, protocolId } = req.body
      if (!url || !protocolId) {
        return res.status(400).json({ message: 'Missing url or protocolId' })
      }
      const fileName = await storage.downloadImage(url, protocolId)
      return res.json({ fileName })
    }, '/api/protocol/download-image')
  )

  // Upload screenshot route
  app.post(
    '/api/screenshots/upload',
    wrapRoute(async (req, res) => {
      const { filePath } = req.body
      if (!filePath) {
        return res.status(400).json({ message: 'Missing filePath' })
      }
      const fileName = await storage.copyImageToImages(filePath)
      return res.json({ fileName })
    }, '/api/screenshots/upload')
  )

  // Read a screenshot as base64, for embedding in a modpack export
  app.get(
    '/api/screenshots/:fileName/content',
    wrapRoute(async (req, res) => {
      const result = await storage.readScreenshotAsBase64(req.params.fileName as string)
      return res.json(result)
    }, '/api/screenshots/:fileName/content')
  )

  // Write a base64-encoded screenshot from a modpack import
  app.post(
    '/api/screenshots/import',
    wrapRoute(async (req, res) => {
      const { fileName, data } = req.body
      if (!fileName || !data) {
        return res.status(400).json({ message: 'Missing fileName or data' })
      }
      const savedFileName = await storage.writeScreenshotFromBase64(fileName, data)
      return res.json({ fileName: savedFileName })
    }, '/api/screenshots/import')
  )

  app.get(
    '/api/versions/:slug',
    wrapRoute(async (req, res) => {
      const version = await storage.getDoomVersionBySlug(req.params.slug as string)
      if (!version) {
        return res.status(404).json({ message: 'Doom version not found' })
      }
      return res.json(version)
    }, '/api/versions/:slug')
  )

  // === Protocols API ===
  app.get(
    '/api/protocols',
    wrapRoute(async (req, res) => {
      const { version, search } = req.query

      let protocols = await gameService.getAllProtocols()

      if (version && typeof version === 'string') {
        protocols = protocols.filter((p) => p.doomVersionId === version)
      }

      if (search && typeof search === 'string') {
        const q = search.toLowerCase()
        protocols = protocols.filter((p) => {
          // Match protocol title/name
          if ((p.title || p.name || '').toLowerCase().includes(q)) return true
          // Match protocol description
          if ((p.description || '').toLowerCase().includes(q)) return true
          // Match mod file names attached to the protocol
          if (p.files?.some((f) => (f.name || f.fileName || '').toLowerCase().includes(q)))
            return true
          return false
        })
      }

      return res.json(protocols)
    }, '/api/protocols')
  )

  app.get(
    '/api/protocols/:id',
    wrapRoute(async (req, res) => {
      const id = req.params.id as string

      const { protocol, files } = await gameService.getProtocol(id)
      return res.json({ protocol, files })
    }, '/api/protocols/:id')
  )

  app.post(
    '/api/protocols',
    wrapRoute(async (req, res) => {
      const { protocol } = req.body
      const files = req.body.files || []

      if (!protocol || !protocol.title) {
        return res.status(400).json({ message: 'Missing required protocol properties' })
      }

      const saved = await gameService.saveProtocol(protocol, files)
      return res.status(201).json(saved)
    }, '/api/protocols')
  )

  app.put(
    '/api/protocols/:id',
    wrapRoute(async (req, res) => {
      const id = req.params.id as string
      const { protocol } = req.body
      const files = req.body.files || []

      if (!protocol) {
        return res.status(400).json({ message: 'Missing protocol data' })
      }

      protocol.id = id
      const updated = await gameService.saveProtocol(protocol, files)
      return res.json(updated)
    }, '/api/protocols/:id')
  )

  app.delete(
    '/api/protocols/:id',
    wrapRoute(async (req, res) => {
      const id = req.params.id as string

      const success = await gameService.deleteProtocol(id)
      if (!success) {
        throw new Error('Protocol not found or failed to delete')
      }
      return res.status(204).send()
    }, '/api/protocols/:id')
  )

  // Launch a protocol
  // Test-launch a protocol from form data without saving
  app.post(
    '/api/protocols/test-launch',
    wrapRoute(async (req, res) => {
      const { protocol, files } = req.body
      if (!protocol) {
        return res.status(400).json({ message: 'Missing protocol data' })
      }
      const result = await gameService.testLaunch(protocol, files || [])
      if (!result.success) {
        throw new Error(result.message || 'Failed to test-launch')
      }
      return res.json({ success: true })
    }, '/api/protocols/test-launch')
  )

  app.post(
    '/api/protocols/:id/launch',
    wrapRoute(async (req, res) => {
      const id = req.params.id as string
      if (!id) {
        return res.status(400).json({ message: 'Invalid protocol ID' })
      }
      const result = await gameService.launchProtocol(id)
      if (!result.success) {
        throw new Error(result.message || 'Failed to launch protocol')
      }
      return res.json({ success: true })
    }, '/api/protocols/:id/launch')
  )

  // Record playtime for a protocol
  app.post(
    '/api/protocols/:id/playtime',
    wrapRoute(async (req, res) => {
      const { sessionSeconds } = req.body
      const id = req.params.id as string
      if (!id || typeof sessionSeconds !== 'number' || sessionSeconds <= 0) {
        return res.status(400).json({ message: 'Invalid request' })
      }
      await storage.addPlaytime(id, sessionSeconds)
      // Also update the total playtime in player stats
      updatePlayerStats({ totalPlaytimeSeconds: sessionSeconds }).catch((err: unknown) =>
        log.error(err)
      )
      return res.json({ success: true })
    }, '/api/protocols/:id/playtime')
  )

  // === Mod Files API === // New Section
  app.get(
    '/api/mod-files/catalog',
    wrapRoute(async (_req, res) => {
      const catalog = await storage.getModFileCatalog()
      if (!Array.isArray(catalog)) {
        log.warn('routes.ts: getModFileCatalog did not return an array:', catalog)
        return res.json([])
      }
      return res.json(catalog)
    }, '/api/mod-files/catalog')
  )

  app.post(
    '/api/mod-files/catalog',
    wrapRoute(async (req, res) => {
      debug('POST /api/mod-files/catalog received with body:', req.body)

      const fileData = req.body

      // Basic validation
      if (!fileData || !fileData.filePath) {
        debug('Validation failed: Missing required file properties')
        return res.status(400).json({ message: 'Missing required file properties' })
      }

      debug('Adding file to catalog:', fileData)
      const savedFile = await storage.addModFileToCatalog(fileData)
      debug('File added to catalog successfully:', savedFile)

      return res.status(201).json(savedFile)
    }, '/api/mod-files/catalog')
  )

  app.post(
    '/api/mod-files/move',
    wrapRoute(async (req, res) => {
      const { sourcePath } = req.body
      if (!sourcePath) return res.status(400).json({ message: 'Missing sourcePath' })
      const result = await storage.moveToModFolder(sourcePath)
      return res.json(result)
    }, '/api/mod-files/move')
  )

  app.post(
    '/api/mod-files/hash',
    wrapRoute(async (req, res) => {
      const { filePath } = req.body
      if (!filePath) return res.status(400).json({ message: 'Missing filePath' })
      const hash = await storage.computeFileHashOrThrow(filePath)
      return res.json(hash)
    }, '/api/mod-files/hash')
  )

  app.put(
    '/api/mod-files/catalog/:id',
    wrapRoute(async (req, res) => {
      const id = parseInt(req.params.id as string, 10)
      const updates = req.body

      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid file ID' })
      }

      const updatedFile = await storage.updateModFileInCatalog(id, updates)
      return res.json(updatedFile)
    }, '/api/mod-files/catalog/:id')
  )

  // Delete a file from the catalog
  app.delete(
    '/api/mod-files/catalog/:id',
    wrapRoute(async (req, res) => {
      const id: string = req.params.id as string
      const fileId = parseInt(id, 10)
      if (isNaN(fileId)) {
        return res.status(400).json({ message: 'Invalid file ID' })
      }
      const deleteFile = req.query.deleteFile === 'true'
      await storage.deleteModFileFromCatalog(fileId, deleteFile)
      return res.json({ success: true })
    }, '/api/mod-files/catalog/:id')
  )

  app.post(
    '/api/mod-files/unzip-scan',
    wrapRoute(async (req, res) => {
      const { zipFilePath } = req.body
      if (!zipFilePath) {
        return res.status(400).json({ message: 'Missing zipFilePath' })
      }
      const result = await storage.unzipAndScan(zipFilePath)
      return res.json(result)
    }, '/api/mod-files/unzip-scan')
  )

  app.post(
    '/api/mod-files/unzip-import',
    wrapRoute(async (req, res) => {
      const { tempDir, filesToImport } = req.body
      if (!tempDir || !Array.isArray(filesToImport)) {
        return res.status(400).json({ message: 'Missing tempDir or filesToImport' })
      }
      const result = await storage.importUnzippedFiles(tempDir, filesToImport)
      return res.json(result)
    }, '/api/mod-files/unzip-import')
  )

  app.post(
    '/api/mod-files/unrar-scan',
    wrapRoute(async (req, res) => {
      const { rarFilePath } = req.body
      if (!rarFilePath) {
        return res.status(400).json({ message: 'Missing rarFilePath' })
      }
      const result = await storage.unrarAndScan(rarFilePath)
      return res.json(result)
    }, '/api/mod-files/unrar-scan')
  )

  // === Config File API ===

  /** Create a blank, isolated config for a protocol with no originating template. */
  app.post(
    '/api/configs/blank',
    wrapRoute(async (req, res) => {
      const { protocolId, ext } = req.body
      if (!protocolId) {
        return res.status(400).json({ message: 'Missing protocolId' })
      }
      const result = await storage.createBlankProtocolConfig(protocolId, ext)
      return res.json(result)
    }, '/api/configs/blank')
  )

  /** Copy a config template to a protocol-specific copy. */
  app.post(
    '/api/configs/copy-for-protocol',
    wrapRoute(async (req, res) => {
      const { templateHash, protocolId } = req.body
      if (!templateHash || !protocolId) {
        return res.status(400).json({ message: 'Missing templateHash or protocolId' })
      }
      const result = await storage.copyConfigForProtocol(templateHash, protocolId)
      return res.json(result)
    }, '/api/configs/copy-for-protocol')
  )

  /** Read a config file content by hash or protocolId. */
  app.get(
    '/api/configs/:key',
    wrapRoute(async (req, res) => {
      const key: string = req.params.key as string
      if (!key) return res.status(400).json({ message: 'Missing config key' })
      const content = await storage.readConfigFileContent(key)
      return res.json({ content })
    }, '/api/configs/:key')
  )

  /** Hash a file (reused for configs too) */
  app.post(
    '/api/configs/hash',
    wrapRoute(async (req, res) => {
      const { filePath } = req.body
      if (!filePath) return res.status(400).json({ message: 'Missing filePath' })
      const hash = await storage.computeFileHash(filePath)
      return res.json(hash)
    }, '/api/configs/hash')
  )

  /** Upload a config file: hash it, copy to cfgs dir, return the hash. */
  app.post(
    '/api/configs/upload',
    wrapRoute(async (req, res) => {
      const { filePath } = req.body
      if (!filePath) return res.status(400).json({ message: 'Missing filePath' })

      const hash = await storage.computeFileHash(filePath)
      if (!hash) throw new Error('Failed to compute hash')

      // Preserve the source file's actual extension (.cfg, .ini, .conf, ...)
      // rather than forcing .cfg — source ports read these as plain INI-style
      // text regardless of extension, so this is purely about keeping the
      // stored copy honest about what it actually is.
      const ext = path.extname(filePath) || '.cfg'
      const configFile = `${hash}${ext}`
      const destPath = path.join(storage.CFGS_DIR, configFile)
      await fs.ensureDir(storage.CFGS_DIR)

      const resolved = storage.resolvePath(filePath)
      await fs.copy(resolved, destPath, { overwrite: true })

      debug(`Uploaded config file: ${filePath} -> ${destPath} (hash: ${hash})`)

      return res.json({ hash, configFile })
    }, '/api/configs/upload')
  )

  /** Write a config file content (for import reconstruction). Must stay after the
   *  literal /api/configs/hash and /api/configs/upload routes above — Express
   *  matches this :key wildcard against any single path segment, so registering
   *  it first would shadow those literal routes. */
  app.post(
    '/api/configs/:key',
    wrapRoute(async (req, res) => {
      const key: string = req.params.key as string
      const { content } = req.body
      if (!key || !content) {
        return res.status(400).json({ message: 'Missing key or content' })
      }
      await storage.writeConfigFileContent(key, content)
      return res.json({ success: true })
    }, '/api/configs/:key')
  )

  // Search the mod file catalogue by name
  app.get(
    '/api/mod-files/catalog/search',
    wrapRoute(async (req, res) => {
      const { q } = req.query
      if (!q || typeof q !== 'string') {
        return res.json([])
      }
      const catalog = await storage.getModFileCatalog()
      const query = q.toLowerCase()
      const results = catalog.filter((f) =>
        (f.name || f.fileName || '').toLowerCase().includes(query)
      )
      return res.json(results)
    }, '/api/mod-files/catalog/search')
  )

  // Search the UAC Registry by query string
  app.get(
    '/api/search/registry',
    wrapRoute(async (req, res) => {
      const { q } = req.query
      if (!q || typeof q !== 'string' || q.trim().length === 0) {
        return res.json([])
      }
      const registryUrl = REGISTRY_API_URL
      const response = await fetch(`${registryUrl}/api/mods?q=${encodeURIComponent(q)}`, {
        signal: AbortSignal.timeout(5000)
      })
      if (!response.ok) {
        log.warn(`Registry search returned ${response.status}`)
        return res.json([])
      }
      const payload = await response.json()
      // Registry pagination wraps rows in `{ mods, total, limit, offset }`; older
      // deployments return a bare array. Accept both shapes.
      const rows = Array.isArray(payload) ? payload : (payload.mods ?? [])
      // Group rows by hash so each mod has an array of urls
      const grouped = new Map()
      for (const row of rows) {
        if (!grouped.has(row.hash)) {
          grouped.set(row.hash, {
            family_name: row.family_name,
            display_name: row.display_name,
            version: row.version,
            category: row.category,
            is_sidecar: row.is_sidecar || 0,
            load_order: row.load_order
              ? typeof row.load_order === 'string'
                ? JSON.parse(row.load_order)
                : row.load_order
              : {},
            submitted_at: row.submitted_at,
            approved_at: row.approved_at,
            urls: []
          })
        }
        if (row.url) {
          grouped.get(row.hash).urls.push({ url: row.url, domain: row.domain || '' })
        }
      }
      return res.json(Array.from(grouped.values()))
    }, '/api/search/registry')
  )

  // Search idgames Archive by name
  app.get(
    '/api/search/idgames',
    wrapRoute(async (req, res) => {
      const { q } = req.query
      if (!q || typeof q !== 'string' || q.trim().length === 0) {
        return res.json([])
      }
      const response = await fetch(
        `https://www.doomworld.com/idgames/api/api.php?action=search&query=${encodeURIComponent(q)}&type=name`,
        { signal: AbortSignal.timeout(10000) }
      )
      if (!response.ok) {
        log.warn('idgames API returned', response.status)
        return res.json([])
      }
      const xml = await response.text()

      // ponytail: regex-parsing the flat XML instead of a dep
      const tag = (name: string, src: string): string => {
        const m = src.match(new RegExp(`<${name}>([^<]*)<\\/${name}>`))
        return m ? m[1].trim() : ''
      }
      const cdata = (name: string, src: string): string => {
        const m = src.match(
          new RegExp(`<${name}>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*<\\/${name}>`)
        )
        return m ? m[1].trim() : ''
      }

      const results: Array<{
        id: number
        title: string
        dir: string
        filename: string
        size: number
        author: string
        description: string
        rating: number
        votes: number
        urls: { url: string; domain: string }[]
      }> = []

      const fileRe = /<file>([\s\S]*?)<\/file>/g
      let match
      while ((match = fileRe.exec(xml)) !== null) {
        const block = match[1]
        const dir = tag('dir', block)
        const filename = tag('filename', block)
        const mirrorPath = `${dir}${filename}`
        // ponytail: static mirror list from Doomworld's per-file pages; same bases work for all files
        results.push({
          id: parseInt(tag('id', block)) || 0,
          title: tag('title', block),
          dir,
          filename,
          size: parseInt(tag('size', block)) || 0,
          author: tag('author', block),
          description: cdata('description', block) || tag('description', block),
          rating: parseFloat(tag('rating', block)) || 0,
          votes: parseInt(tag('votes', block)) || 0,
          urls: [
            {
              url: `https://ftp.fu-berlin.de/pc/games/idgames/${mirrorPath}`,
              domain: 'Germany',
              type: 'download'
            },
            {
              url: `https://www.gamers.org/pub/idgames/${mirrorPath}`,
              domain: 'USA',
              type: 'download'
            },
            {
              url: `https://ftpmirror1.infania.net/pub/idgames/${mirrorPath}`,
              domain: 'Sweden',
              type: 'download'
            },
            {
              url: `https://mirror.braindrainlan.nu/pub/idgames/${mirrorPath}`,
              domain: 'Sweden',
              type: 'download'
            },
            {
              url: `https://files.xvertigox.com/idgames/${mirrorPath}`,
              domain: 'New Zealand',
              type: 'download'
            },
            { url: tag('url', block), domain: 'Info', type: 'info' }
          ].filter((u) => u.url)
        })
      }

      return res.json(results)
    }, '/api/search/idgames')
  )

  // Download a file from idgames mirror to a temp location (no import — caller decides)
  app.post(
    '/api/search/idgames/download',
    wrapRoute(async (req, res) => {
      const { downloadUrl, title } = req.body
      if (!downloadUrl || typeof downloadUrl !== 'string') {
        return res.status(400).json({ message: 'Missing downloadUrl' })
      }
      const parsedUrl = new URL(downloadUrl)
      const fileName = path.basename(parsedUrl.pathname)
      const ext = path.extname(fileName).toLowerCase()
      const tempDir = path.join(os.tmpdir(), 'uac-idgames')
      await fs.ensureDir(tempDir)
      const tempPath = path.join(tempDir, fileName)

      const response = await fetch(downloadUrl, {
        headers: { 'User-Agent': 'UACLaunchControl/1.0' }
      })
      if (!response.ok) {
        throw new Error(`Download failed: HTTP ${response.status}`)
      }
      const buffer = Buffer.from(await response.arrayBuffer())
      await fs.writeFile(tempPath, buffer)

      // Compute hash so the frontend can do registry lookup before importing
      const hashValue = await storage.computeFileHash(tempPath).catch(() => '')

      return res.json({
        downloadPath: tempPath,
        fileName,
        name: title || path.basename(fileName, ext),
        hash: hashValue || ''
      })
    }, '/api/search/idgames/download')
  )

  // Import a single file downloaded from idgames into the mods directory
  app.post(
    '/api/search/idgames/import-single',
    wrapRoute(async (req, res) => {
      const { tempPath, fileName, name, hashValue, fileType } = req.body
      if (!tempPath || typeof tempPath !== 'string') {
        return res.status(400).json({ message: 'Missing tempPath' })
      }
      const moved = await storage.moveToModFolder(tempPath)
      const catalogEntry = await storage.addModFileToCatalog({
        fileName: fileName || path.basename(tempPath),
        filePath: moved.relativePath,
        hashValue: hashValue || moved.hashValue,
        name: name || '',
        fileType: fileType || ''
      })
      // Clean up the temp file
      await fs.remove(tempPath).catch(() => {})
      return res.json({ file: catalogEntry })
    }, '/api/search/idgames/import-single')
  )

  // Update a Doom version (e.g., for ignoring/hiding)
  app.put(
    '/api/versions/:id',
    wrapRoute(async (req, res) => {
      const id: string = req.params.id as string
      const updates = req.body
      debug(`[API] PUT /api/versions/${id} - Updates:`, updates)
      const updatedVersion = await storage.updateDoomVersion(id, updates)
      res.json({ success: true, data: updatedVersion })
    }, '/api/versions/:id')
  )

  // === Settings API ===
  app.get(
    '/api/settings',
    wrapRoute(async (_req, res) => {
      const settings = await storage.getSettings()
      // Return a default empty object if not found
      return res.json(settings || {})
    }, '/api/settings')
  )

  app.put(
    '/api/settings',
    wrapRoute(async (req, res) => {
      const newSettings = req.body
      if (!newSettings) {
        return res.status(400).json({ message: 'No settings data provided' })
      }
      const updatedSettings = await storage.saveSettings(newSettings)
      return res.json(updatedSettings)
    }, '/api/settings')
  )

  // === First Run / Tour API ===
  app.get(
    '/api/first-run',
    wrapRoute(async (_req, res) => {
      const isFirstRun = storage.getIsFirstRun()
      return res.json({ isFirstRun })
    }, '/api/first-run')
  )

  app.post(
    '/api/first-run/dismiss',
    wrapRoute(async (_req, res) => {
      storage.dismissFirstRun()
      return res.json({ success: true })
    }, '/api/first-run/dismiss')
  )

  app.post(
    '/api/first-run/reenable',
    wrapRoute(async (_req, res) => {
      storage.reenableFirstRun()
      return res.json({ isFirstRun: true })
    }, '/api/first-run/reenable')
  )

  // === Source Port Scanner ===
  app.get(
    '/api/settings/scan-ports',
    wrapRoute(async (_req, res) => {
      const scanResults: {
        path: string
        name: string
        family: string
      }[] = []
      const seen = new Set<string>()

      const knownFamilies: { name: string; family: string }[] = [
        { name: 'gzdoom', family: 'gzdoom' },
        { name: 'uzdoom', family: 'uzdoom' },
        { name: 'zandronum', family: 'zandronum' },
        { name: 'lzdoom', family: 'lzdoom' },
        { name: 'zdoom', family: 'zdoom' },
        { name: 'helion', family: 'helion' }
      ]

      // Collect directories to scan
      const dirs = new Set<string>()

      // PATH entries
      const pathSep = process.platform === 'win32' ? ';' : ':'
      const pathEnv = process.env.PATH || ''
      for (const d of pathEnv.split(pathSep)) {
        const trimmed = d.trim()
        if (trimmed) dirs.add(trimmed)
      }

      // Common directories by platform
      if (process.platform === 'win32') {
        dirs.add('C:\\Program Files')
        dirs.add('C:\\Program Files (x86)')
        const localAppData = process.env.LOCALAPPDATA
        if (localAppData) dirs.add(localAppData)
      } else if (process.platform === 'darwin') {
        dirs.add('/Applications')
        dirs.add(path.join(os.homedir(), 'Applications'))
      } else {
        dirs.add('/usr/local/bin')
        dirs.add('/usr/games')
        dirs.add(path.join(os.homedir(), '.local', 'bin'))
        dirs.add('/opt')
      }

      const isExe = (fullPath: string): boolean => {
        try {
          if (process.platform === 'win32') {
            return fullPath.toLowerCase().endsWith('.exe')
          }
          const stat = fs.statSync(fullPath)
          return (
            stat.isFile() &&
            !!(stat.mode & (fs.constants.S_IXUSR | fs.constants.S_IXGRP | fs.constants.S_IXOTH))
          )
        } catch {
          return false
        }
      }

      for (const dir of dirs) {
        let entries: string[]
        try {
          entries = await fs.readdir(dir)
        } catch {
          continue
        }

        for (const entry of entries) {
          const lower = entry.toLowerCase()

          // macOS: check .app bundles
          if (process.platform === 'darwin' && lower.endsWith('.app')) {
            const baseName = lower.replace('.app', '')
            const match = knownFamilies.find((k) => baseName.includes(k.name))
            if (match) {
              const exePath = path.join(dir, entry, 'Contents', 'MacOS', baseName)
              if (fs.existsSync(exePath)) {
                const key = exePath.toLowerCase()
                if (!seen.has(key)) {
                  seen.add(key)
                  scanResults.push({
                    path: exePath,
                    name: entry.replace('.app', ''),
                    family: match.family
                  })
                }
              }
            }
            continue
          }

          // Regular executables
          const match = knownFamilies.find((k) => lower.includes(k.name))
          if (match) {
            const fullPath = path.join(dir, entry)
            if (isExe(fullPath)) {
              const key = fullPath.toLowerCase()
              if (!seen.has(key)) {
                seen.add(key)
                scanResults.push({
                  path: fullPath,
                  name: entry.replace(/\.(exe|AppImage)$/i, ''),
                  family: match.family
                })
              }
            }
          }
        }
      }

      return res.json(scanResults)
    }, '/api/settings/scan-ports')
  )

  // === Port Download API ===
  app.get(
    '/api/ports/releases',
    wrapRoute(async (_req, res) => {
      const releases = await getPortReleases()
      return res.json(releases)
    }, '/api/ports/releases')
  )

  app.post(
    '/api/ports/download',
    wrapRoute(async (req, res) => {
      const { downloadUrl, assetName, family, version } = req.body
      if (!downloadUrl || !assetName || !family || !version) {
        return res
          .status(400)
          .json({ message: 'Missing required fields: downloadUrl, assetName, family, version' })
      }
      const result = await downloadPortRelease(downloadUrl, assetName, family, version)
      return res.json(result)
    }, '/api/ports/download')
  )

  // === FreeDoom Download API ===
  app.get(
    '/api/freedoom/manifest',
    wrapRoute(async (_req, res) => {
      const manifest = await getFreedoomManifest()
      return res.json(manifest)
    }, '/api/freedoom/manifest')
  )

  app.post(
    '/api/freedoom/download',
    wrapRoute(async (req, res) => {
      const { bundle } = req.body as { bundle?: FreedoomBundleId }
      if (bundle !== 'phase12' && bundle !== 'freedm') {
        return res.status(400).json({ message: "bundle must be 'phase12' or 'freedm'" })
      }
      const settings = await storage.getSettings()
      const wadDir = storage.resolvePath(
        settings.wadFilesDirectory || path.join(os.homedir(), '.config', 'uac', 'wads')
      )
      const result = await downloadFreedoomBundle(wadDir, bundle)
      await storage.syncDoomVersions({ notifyDelta: true })
      const doomVersions = await storage.getDoomVersions()
      return res.json({ ...result, doomVersions })
    }, '/api/freedoom/download')
  )

  // === Player Data / Achievements API ===
  app.get(
    '/api/player-data',
    wrapRoute(async (_req, res) => {
      const data = await getPlayerData()
      return res.json(data)
    }, '/api/player-data')
  )

  app.put(
    '/api/player-data',
    wrapRoute(async (req, res) => {
      const partial = req.body
      if (!partial) {
        return res.status(400).json({ message: 'No player data provided' })
      }
      const updated = await savePlayerData(partial)
      return res.json(updated)
    }, '/api/player-data')
  )

  app.post(
    '/api/player-data/stats',
    wrapRoute(async (req, res) => {
      const delta = req.body
      if (!delta) {
        return res.status(400).json({ message: 'No stats delta provided' })
      }
      const updated = await updatePlayerStats(delta)
      return res.json(updated)
    }, '/api/player-data/stats')
  )

  app.post(
    '/api/player-data/achievements/unlock',
    wrapRoute(async (req, res) => {
      const { id, state } = req.body
      if (!id || !state) {
        return res.status(400).json({ message: 'Missing achievement id or state' })
      }
      const updated = await unlockAchievement(id, state)
      return res.json(updated)
    }, '/api/player-data/achievements/unlock')
  )

  // === Dialog API (for file/directory selection) ===
  app.post(
    '/api/dialog/open',
    wrapRoute(async (req, res) => {
      const { dialog, BrowserWindow } = await import('electron')
      const options = req.body || {}

      if (options.defaultPath) {
        debug(`Dialog open: Raw defaultPath:`, options.defaultPath)
        options.defaultPath = storage.resolvePath(options.defaultPath)
        debug(`Dialog open: Resolved defaultPath:`, options.defaultPath)
      }

      // Get the focused window or the first window
      const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0]

      if (!win) {
        return res.status(500).json({ canceled: true, filePaths: [] })
      }

      const result = await dialog.showOpenDialog(win, options)
      return res.json(result)
    }, '/api/dialog/open')
  )

  return httpServer
}
