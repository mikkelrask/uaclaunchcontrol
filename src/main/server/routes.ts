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
import { debug } from '../../shared/debug'
import { REGISTRY_API_URL } from '../../shared/registry-config'
import { getPortReleases, downloadPortRelease } from './services/portService'

export async function registerRoutes(app: Express): Promise<Server> {
  app.use(express.json())
  const httpServer = createServer(app)

  // Initialize services and load protocols from config
  await gameService.loadProtocolsFromConfig()

  // === API Routes ===

  // === Doom Versions API ===
  app.get('/api/versions', async (_req, res) => {
    const versions = await storage.getDoomVersions()
    return res.json(versions) // Ensure this sends the array directly
  })

  app.put('/api/versions', async (req, res) => {
    const versions = req.body
    if (!Array.isArray(versions)) {
      return res.status(400).json({ message: 'Expected an array of versions' })
    }
    try {
      await storage.saveDoomVersions(versions)
      return res.json({ success: true })
    } catch (error) {
      console.error('Error saving doom versions:', error)
      return res.status(500).json({ message: 'Failed to save doom versions' })
    }
  })

  // === Move the mod file to the mod directory set in settings ===
  app.get('/api/media', (req, res) => {
    try {
      const filePath = req.query.path as string
      if (!filePath) {
        return res.status(400).json({ message: 'Path is required' })
      }
      const resolved = storage.resolvePath(filePath)

      if (!fs.existsSync(resolved)) {
        console.warn(`[DEBUG] Media not found on disk: ${resolved}`)
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
    } catch (error: unknown) {
      console.error('Error serving media:', error)
      const message =
        error instanceof Error
          ? error instanceof Error
            ? error.message
            : 'Failed to serve media'
          : 'Failed to serve media'
      return res.status(500).json({ message })
    }
  })

  app.post('/api/file-read', async (req, res) => {
    try {
      const { filePath } = req.body
      if (!filePath) return res.status(400).json({ message: 'Missing filePath' })
      const resolved = storage.resolvePath(filePath)
      if (!fs.existsSync(resolved)) {
        return res.status(404).json({ message: 'File not found' })
      }
      const content = await fs.readFile(resolved, 'utf-8')
      return res.json({ content })
    } catch (error: unknown) {
      return res
        .status(500)
        .json({ message: error instanceof Error ? error.message : 'Failed to read file' })
    }
  })

  app.post('/api/move-file', async (req, res) => {
    console.log('POST /api/move-file received with body:', req.body)
    const { filePath, newPath } = req.body
    if (!filePath || !newPath) {
      return res.status(400).json({ message: 'Missing file path or new path' })
    }

    try {
      const returnPath = await storage.moveFile(filePath, newPath)
      return res.json({ message: returnPath })
    } catch (error) {
      console.error('Error moving file:', error)
      return res.status(500).json({ message: 'Failed to move file' })
    }
  })

  app.post('/api/wads/import', async (req, res) => {
    try {
      const { sourcePath } = req.body
      if (!sourcePath) {
        return res.status(400).json({ message: 'Missing sourcePath' })
      }

      const result = await storage.importWadFile(sourcePath)
      return res.json(result)
    } catch (error: unknown) {
      console.error('Error importing WAD:', error)
      return res.status(500).json({
        message: error instanceof Error ? error.message : 'Failed to import WAD'
      })
    }
  })

  // Serve mod images dynamically from the images directory
  app.get('/images/:fileName', async (req, res) => {
    try {
      const filePath = path.join(storage.IMAGES_DIR, req.params.fileName)

      debug(`Serving image request: ${req.params.fileName}`)
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
        console.warn(`[DEBUG] Image file NOT FOUND on disk: ${filePath}`)
        return res.status(404).send('Image file not found on disk')
      }
    } catch (error) {
      console.error(`[DEBUG] Exception serving image ${req.params.fileName}:`, error)
      return res.status(500).send('Server error serving image')
    }
  })

  // Download image route
  app.post('/api/protocol/download-image', async (req, res) => {
    const { url, protocolId } = req.body
    if (!url || !protocolId) {
      return res.status(400).json({ message: 'Missing url or protocolId' })
    }
    try {
      const fileName = await storage.downloadImage(url, protocolId)
      return res.json({ fileName })
    } catch (error: unknown) {
      return res
        .status(500)
        .json({ message: error instanceof Error ? error.message : 'Failed to serve media' })
    }
  })

  // Upload screenshot route
  app.post('/api/screenshots/upload', async (req, res) => {
    const { filePath } = req.body
    if (!filePath) {
      return res.status(400).json({ message: 'Missing filePath' })
    }
    try {
      const fileName = await storage.copyImageToImages(filePath)
      return res.json({ fileName })
    } catch (error: unknown) {
      return res
        .status(500)
        .json({ message: error instanceof Error ? error.message : 'Failed to upload screenshot' })
    }
  })

  app.get('/api/versions/:slug', async (req, res) => {
    const version = await storage.getDoomVersionBySlug(req.params.slug)
    if (!version) {
      return res.status(404).json({ message: 'Doom version not found' })
    }
    return res.json(version)
  })

  // === Protocols API ===
  app.get('/api/protocols', async (req, res) => {
    const { version, search } = req.query

    try {
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
    } catch (error) {
      console.error('Error fetching protocols:', error)
      return res.status(500).json({ message: 'Failed to fetch protocols' })
    }
  })

  app.get('/api/protocols/:id', async (req, res) => {
    const id = req.params.id

    try {
      const { protocol, files } = await gameService.getProtocol(id)
      return res.json({ protocol, files })
    } catch (error: unknown) {
      return res.status(404).json({
        message: error instanceof Error ? error.message : 'Protocol not found'
      })
    }
  })

  app.post('/api/protocols', async (req, res) => {
    const { protocol } = req.body
    const files = req.body.files || []

    if (!protocol || !protocol.title) {
      return res.status(400).json({ message: 'Missing required protocol properties' })
    }

    try {
      const saved = await gameService.saveProtocol(protocol, files)
      return res.status(201).json(saved)
    } catch (error: unknown) {
      return res.status(500).json({
        message: error instanceof Error ? error.message : 'Failed to save protocol'
      })
    }
  })

  app.put('/api/protocols/:id', async (req, res) => {
    const id = req.params.id
    const { protocol } = req.body
    const files = req.body.files || []

    if (!protocol) {
      return res.status(400).json({ message: 'Missing protocol data' })
    }

    protocol.id = id
    try {
      const updated = await gameService.saveProtocol(protocol, files)
      return res.json(updated)
    } catch (error: unknown) {
      return res.status(404).json({
        message: error instanceof Error ? error.message : 'Protocol not found or failed to update'
      })
    }
  })

  app.delete('/api/protocols/:id', async (req, res) => {
    const id = req.params.id

    try {
      const success = await gameService.deleteProtocol(id)
      if (!success) {
        throw new Error('Protocol not found or failed to delete')
      }
      return res.status(204).send()
    } catch (error: unknown) {
      return res.status(404).json({
        message: error instanceof Error ? error.message : 'Protocol not found or failed to delete'
      })
    }
  })

  // Launch a protocol
  // Test-launch a protocol from form data without saving
  app.post('/api/protocols/test-launch', async (req, res) => {
    const { protocol, files } = req.body
    if (!protocol) {
      return res.status(400).json({ message: 'Missing protocol data' })
    }
    try {
      const result = await gameService.testLaunch(protocol, files || [])
      if (!result.success) {
        throw new Error(result.message || 'Failed to test-launch')
      }
      return res.json({ success: true })
    } catch (error: unknown) {
      return res.status(500).json({
        message: error instanceof Error ? error.message : 'Failed to test-launch'
      })
    }
  })

  app.post('/api/protocols/:id/launch', async (req, res) => {
    const id = req.params.id
    if (!id) {
      return res.status(400).json({ message: 'Invalid protocol ID' })
    }
    try {
      const result = await gameService.launchProtocol(id)
      if (!result.success) {
        throw new Error(result.message || 'Failed to launch protocol')
      }
      return res.json({ success: true })
    } catch (error: unknown) {
      return res.status(500).json({
        message: error instanceof Error ? error.message : 'Failed to launch protocol'
      })
    }
  })

  // Record playtime for a protocol
  app.post('/api/protocols/:id/playtime', async (req, res) => {
    const { sessionSeconds } = req.body
    const id = req.params.id
    if (!id || typeof sessionSeconds !== 'number' || sessionSeconds <= 0) {
      return res.status(400).json({ message: 'Invalid request' })
    }
    try {
      await storage.addPlaytime(id, sessionSeconds)
      // Also update the total playtime in player stats
      updatePlayerStats({ totalPlaytimeSeconds: sessionSeconds }).catch(() => {})
      return res.json({ success: true })
    } catch (error) {
      console.error('Error recording playtime:', error)
      return res.status(500).json({ message: 'Failed to record playtime' })
    }
  })

  // === Mod Files API === // New Section
  app.get('/api/mod-files/catalog', async (_req, res) => {
    try {
      const catalog = await storage.getModFileCatalog()
      if (!Array.isArray(catalog)) {
        console.warn('routes.ts: getModFileCatalog did not return an array:', catalog)
        return res.json([])
      }
      return res.json(catalog)
    } catch (error) {
      console.error('routes.ts: Error in /api/mod-files/catalog:', error)
      return res.json([])
    }
  })

  app.post('/api/mod-files/catalog', async (req, res) => {
    try {
      console.log('POST /api/mod-files/catalog received with body:', req.body)

      const fileData = req.body

      // Basic validation
      if (!fileData || !fileData.filePath) {
        console.log('Validation failed: Missing required file properties')
        return res.status(400).json({ message: 'Missing required file properties' })
      }

      console.log('Adding file to catalog:', fileData)
      const savedFile = await storage.addModFileToCatalog(fileData)
      console.log('File added to catalog successfully:', savedFile)

      return res.status(201).json(savedFile)
    } catch (error: unknown) {
      console.error('Error in POST /api/mod-files/catalog:', error)
      return res.status(500).json({
        message: error instanceof Error ? error.message : 'Failed to add file to catalog'
      })
    }
  })

  app.post('/api/mod-files/move', async (req, res) => {
    try {
      const { sourcePath } = req.body
      if (!sourcePath) return res.status(400).json({ message: 'Missing sourcePath' })
      const result = await storage.moveToModFolder(sourcePath)
      return res.json(result)
    } catch (error: unknown) {
      return res
        .status(500)
        .json({ message: error instanceof Error ? error.message : 'Failed to serve media' })
    }
  })

  app.post('/api/mod-files/hash', async (req, res) => {
    try {
      const { filePath } = req.body
      if (!filePath) return res.status(400).json({ message: 'Missing filePath' })
      const hash = await storage.computeFileHashOrThrow(filePath)
      return res.json(hash)
    } catch (error: unknown) {
      return res
        .status(500)
        .json({ message: error instanceof Error ? error.message : 'Failed to compute hash' })
    }
  })

  app.put('/api/mod-files/catalog/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10)
      const updates = req.body

      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid file ID' })
      }

      const updatedFile = await storage.updateModFileInCatalog(id, updates)
      return res.json(updatedFile)
    } catch (error: unknown) {
      console.error(`Error in PUT /api/mod-files/catalog/${req.params.id}:`, error)
      return res.status(500).json({
        message: error instanceof Error ? error.message : 'Failed to update file in catalog'
      })
    }
  })

  // Delete a file from the catalog
  app.delete('/api/mod-files/catalog/:id', async (req, res) => {
    try {
      const { id } = req.params
      const fileId = parseInt(id, 10)
      if (isNaN(fileId)) {
        return res.status(400).json({ message: 'Invalid file ID' })
      }
      const deleteFile = req.query.deleteFile === 'true'
      await storage.deleteModFileFromCatalog(fileId, deleteFile)
      return res.json({ success: true })
    } catch (error: unknown) {
      return res.status(500).json({
        message: error instanceof Error ? error.message : 'Failed to delete file from catalog'
      })
    }
  })

  app.post('/api/mod-files/unzip-scan', async (req, res) => {
    try {
      const { zipFilePath } = req.body
      if (!zipFilePath) {
        return res.status(400).json({ message: 'Missing zipFilePath' })
      }
      const result = await storage.unzipAndScan(zipFilePath)
      return res.json(result)
    } catch (error: unknown) {
      console.error('Error in POST /api/mod-files/unzip-scan:', error)
      return res.status(500).json({
        message: error instanceof Error ? error.message : 'Failed to unzip and scan archive'
      })
    }
  })

  app.post('/api/mod-files/unzip-import', async (req, res) => {
    try {
      const { tempDir, filesToImport } = req.body
      if (!tempDir || !Array.isArray(filesToImport)) {
        return res.status(400).json({ message: 'Missing tempDir or filesToImport' })
      }
      const result = await storage.importUnzippedFiles(tempDir, filesToImport)
      return res.json(result)
    } catch (error: unknown) {
      console.error('Error in POST /api/mod-files/unzip-import:', error)
      return res.status(500).json({
        message: error instanceof Error ? error.message : 'Failed to import unzipped files'
      })
    }
  })

  app.post('/api/mod-files/unrar-scan', async (req, res) => {
    try {
      const { rarFilePath } = req.body
      if (!rarFilePath) {
        return res.status(400).json({ message: 'Missing rarFilePath' })
      }
      const result = await storage.unrarAndScan(rarFilePath)
      return res.json(result)
    } catch (error: unknown) {
      console.error('Error in POST /api/mod-files/unrar-scan:', error)
      return res.status(500).json({
        message: error instanceof Error ? error.message : 'Failed to extract and scan RAR archive'
      })
    }
  })

  // === Config File API ===

  /** Create a blank, isolated config for a protocol with no originating template. */
  app.post('/api/configs/blank', async (req, res) => {
    try {
      const { protocolId, ext } = req.body
      if (!protocolId) {
        return res.status(400).json({ message: 'Missing protocolId' })
      }
      const result = await storage.createBlankProtocolConfig(protocolId, ext)
      return res.json(result)
    } catch (error: unknown) {
      return res.status(500).json({
        message: error instanceof Error ? error.message : 'Failed to create blank config'
      })
    }
  })

  /** Copy a config template to a protocol-specific copy. */
  app.post('/api/configs/copy-for-protocol', async (req, res) => {
    try {
      const { templateHash, protocolId } = req.body
      if (!templateHash || !protocolId) {
        return res.status(400).json({ message: 'Missing templateHash or protocolId' })
      }
      const result = await storage.copyConfigForProtocol(templateHash, protocolId)
      return res.json(result)
    } catch (error: unknown) {
      return res.status(500).json({
        message: error instanceof Error ? error.message : 'Failed to copy config for protocol'
      })
    }
  })

  /** Read a config file content by hash or protocolId. */
  app.get('/api/configs/:key', async (req, res) => {
    try {
      const { key } = req.params
      if (!key) return res.status(400).json({ message: 'Missing config key' })
      const content = await storage.readConfigFileContent(key)
      return res.json({ content })
    } catch (error: unknown) {
      return res.status(404).json({
        message: error instanceof Error ? error.message : 'Config file not found'
      })
    }
  })

  /** Hash a file (reused for configs too) */
  app.post('/api/configs/hash', async (req, res) => {
    try {
      const { filePath } = req.body
      if (!filePath) return res.status(400).json({ message: 'Missing filePath' })
      const hash = await storage.computeFileHash(filePath)
      return res.json(hash)
    } catch (error: unknown) {
      return res.status(500).json({
        message: error instanceof Error ? error.message : 'Failed to compute hash'
      })
    }
  })

  /** Upload a config file: hash it, copy to cfgs dir, return the hash. */
  app.post('/api/configs/upload', async (req, res) => {
    try {
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
    } catch (error: unknown) {
      return res.status(500).json({
        message: error instanceof Error ? error.message : 'Failed to upload config file'
      })
    }
  })

  /** Write a config file content (for import reconstruction). Must stay after the
   *  literal /api/configs/hash and /api/configs/upload routes above — Express
   *  matches this :key wildcard against any single path segment, so registering
   *  it first would shadow those literal routes. */
  app.post('/api/configs/:key', async (req, res) => {
    try {
      const { key } = req.params
      const { content } = req.body
      if (!key || !content) {
        return res.status(400).json({ message: 'Missing key or content' })
      }
      await storage.writeConfigFileContent(key, content)
      return res.json({ success: true })
    } catch (error: unknown) {
      return res.status(500).json({
        message: error instanceof Error ? error.message : 'Failed to write config file'
      })
    }
  })

  // Search the mod file catalogue by name
  app.get('/api/mod-files/catalog/search', async (req, res) => {
    const { q } = req.query
    if (!q || typeof q !== 'string') {
      return res.json([])
    }
    try {
      const catalog = await storage.getModFileCatalog()
      const query = q.toLowerCase()
      const results = catalog.filter((f) =>
        (f.name || f.fileName || '').toLowerCase().includes(query)
      )
      return res.json(results)
    } catch (error) {
      console.error('Error searching mod file catalog:', error)
      return res.status(500).json({ message: 'Failed to search mod file catalog' })
    }
  })

  // Search the UAC Registry by query string
  app.get('/api/search/registry', async (req, res) => {
    const { q } = req.query
    if (!q || typeof q !== 'string' || q.trim().length === 0) {
      return res.json([])
    }
    try {
      const registryUrl = REGISTRY_API_URL
      const response = await fetch(`${registryUrl}/api/mods?q=${encodeURIComponent(q)}`, {
        signal: AbortSignal.timeout(5000)
      })
      if (!response.ok) {
        console.warn(`Registry search returned ${response.status}`)
        return res.json([])
      }
      const rows = await response.json()
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
    } catch (error) {
      console.error('Error searching UAC Registry:', error)
      return res.json([]) // Graceful: registry unavailable -> just no results
    }
  })

  // Search idgames Archive by name
  app.get('/api/search/idgames', async (req, res) => {
    const { q } = req.query
    if (!q || typeof q !== 'string' || q.trim().length === 0) {
      return res.json([])
    }
    try {
      const response = await fetch(
        `https://www.doomworld.com/idgames/api/api.php?action=search&query=${encodeURIComponent(q)}&type=name`,
        { signal: AbortSignal.timeout(10000) }
      )
      if (!response.ok) {
        console.warn('idgames API returned', response.status)
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
    } catch (error) {
      console.error('Error searching idgames Archive:', error)
      return res.json([])
    }
  })

  // Download a file from idgames mirror to a temp location (no import — caller decides)
  app.post('/api/search/idgames/download', async (req, res) => {
    const { downloadUrl, title } = req.body
    if (!downloadUrl || typeof downloadUrl !== 'string') {
      return res.status(400).json({ message: 'Missing downloadUrl' })
    }
    try {
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
    } catch (error) {
      console.error('Error downloading from idgames:', error)
      return res.status(500).json({ message: 'Failed to download file' })
    }
  })

  // Import a single file downloaded from idgames into the mods directory
  app.post('/api/search/idgames/import-single', async (req, res) => {
    const { tempPath, fileName, name, hashValue, fileType } = req.body
    if (!tempPath || typeof tempPath !== 'string') {
      return res.status(400).json({ message: 'Missing tempPath' })
    }
    try {
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
    } catch (error) {
      console.error('Error importing idgames file:', error)
      return res.status(500).json({ message: 'Failed to import file' })
    }
  })

  // Update a Doom version (e.g., for ignoring/hiding)
  app.put('/api/versions/:id', async (req, res) => {
    try {
      const { id } = req.params
      const updates = req.body
      console.log(`[API] PUT /api/versions/${id} - Updates:`, updates)
      const updatedVersion = await storage.updateDoomVersion(id, updates)
      res.json({ success: true, data: updatedVersion })
    } catch (error: unknown) {
      console.error(`[API] Error updating version ${req.params.id}:`, error)
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to serve media'
      })
    }
  })

  // === Settings API ===
  app.get('/api/settings', async (_req, res) => {
    try {
      const settings = await storage.getSettings()
      // Return a default empty object if not found
      return res.json(settings || {})
    } catch (error) {
      console.error('Failed to load settings:', error)

      return res.status(500).json({ message: 'Failed to load settings' })
    }
  })

  app.put('/api/settings', async (req, res) => {
    try {
      const newSettings = req.body
      if (!newSettings) {
        return res.status(400).json({ message: 'No settings data provided' })
      }
      const updatedSettings = await storage.saveSettings(newSettings)
      return res.json(updatedSettings)
    } catch (error) {
      console.error('Failed to save settings:', error)

      return res.status(500).json({ message: 'Failed to save settings' })
    }
  })

  // === First Run / Tour API ===
  app.get('/api/first-run', async (_req, res) => {
    try {
      const isFirstRun = storage.getIsFirstRun()
      return res.json({ isFirstRun })
    } catch (error: unknown) {
      return res
        .status(500)
        .json({ message: error instanceof Error ? error.message : 'Failed to check first run' })
    }
  })

  app.post('/api/first-run/dismiss', async (_req, res) => {
    try {
      storage.dismissFirstRun()
      return res.json({ success: true })
    } catch (error: unknown) {
      return res
        .status(500)
        .json({ message: error instanceof Error ? error.message : 'Failed to dismiss first run' })
    }
  })

  app.post('/api/first-run/reenable', async (_req, res) => {
    try {
      storage.reenableFirstRun()
      return res.json({ isFirstRun: true })
    } catch (error: unknown) {
      return res
        .status(500)
        .json({ message: error instanceof Error ? error.message : 'Failed to re-enable first run' })
    }
  })

  // === Source Port Scanner ===
  app.get('/api/settings/scan-ports', async (_req, res) => {
    try {
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
    } catch (error: unknown) {
      console.error('Failed to scan for source ports:', error)
      return res.status(500).json({
        message: error instanceof Error ? error.message : 'Failed to scan for source ports'
      })
    }
  })

  // === Port Download API ===
  app.get('/api/ports/releases', async (_req, res) => {
    try {
      const releases = await getPortReleases()
      return res.json(releases)
    } catch (error) {
      console.error('Failed to fetch port releases:', error)
      return res.status(500).json({ message: 'Failed to fetch port releases' })
    }
  })

  app.post('/api/ports/download', async (req, res) => {
    try {
      const { downloadUrl, assetName, family, version } = req.body
      if (!downloadUrl || !assetName || !family || !version) {
        return res
          .status(400)
          .json({ message: 'Missing required fields: downloadUrl, assetName, family, version' })
      }
      const result = await downloadPortRelease(downloadUrl, assetName, family, version)
      return res.json(result)
    } catch (error) {
      console.error('Failed to download port release:', error)
      return res
        .status(500)
        .json({ message: error instanceof Error ? error.message : 'Failed to download port' })
    }
  })

  // === Player Data / Achievements API ===
  app.get('/api/player-data', async (_req, res) => {
    try {
      const data = await getPlayerData()
      return res.json(data)
    } catch (error) {
      console.error('Failed to get player data:', error)
      return res.status(500).json({ message: 'Failed to get player data' })
    }
  })

  app.put('/api/player-data', async (req, res) => {
    try {
      const partial = req.body
      if (!partial) {
        return res.status(400).json({ message: 'No player data provided' })
      }
      const updated = await savePlayerData(partial)
      return res.json(updated)
    } catch (error) {
      console.error('Failed to save player data:', error)
      return res.status(500).json({ message: 'Failed to save player data' })
    }
  })

  app.post('/api/player-data/stats', async (req, res) => {
    try {
      const delta = req.body
      if (!delta) {
        return res.status(400).json({ message: 'No stats delta provided' })
      }
      const updated = await updatePlayerStats(delta)
      return res.json(updated)
    } catch (error) {
      console.error('Failed to update player stats:', error)
      return res.status(500).json({ message: 'Failed to update player stats' })
    }
  })

  app.post('/api/player-data/achievements/unlock', async (req, res) => {
    try {
      const { id, state } = req.body
      if (!id || !state) {
        return res.status(400).json({ message: 'Missing achievement id or state' })
      }
      const updated = await unlockAchievement(id, state)
      return res.json(updated)
    } catch (error) {
      console.error('Failed to unlock achievement:', error)
      return res.status(500).json({ message: 'Failed to unlock achievement' })
    }
  })

  // === Dialog API (for file/directory selection) ===
  app.post('/api/dialog/open', async (req, res) => {
    try {
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
    } catch (error) {
      console.error('Failed to show open dialog:', error)
      return res.status(500).json({ canceled: true, filePaths: [] })
    }
  })

  return httpServer
}
