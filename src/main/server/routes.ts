import type { Express } from 'express'
import { createServer, type Server } from 'http'
import { gameService } from './services/gameService'
import * as storage from './storage'
import * as express from 'express'
import path from 'path'
import fs from 'fs-extra'

export async function registerRoutes(app: Express): Promise<Server> {
  app.use(express.json())
  const httpServer = createServer(app)

  // Initialize services and load mods from config
  await gameService.loadModsFromConfig()

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
        return res.status(400).json({ error: 'Path is required' })
      }
      const resolved = storage.resolvePath(filePath)

      if (!fs.existsSync(resolved)) {
        console.warn(`[DEBUG] Media not found on disk: ${resolved}`)
        return res.status(404).json({ error: 'File not found' })
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
      return res.status(500).json({ error: message })
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

  // Serve mod images dynamically from the images directory
  app.get('/images/:fileName', async (req, res) => {
    try {
      const filePath = path.join(storage.IMAGES_DIR, req.params.fileName)

      console.log(`[DEBUG] Serving image request: ${req.params.fileName}`)
      console.log(`[DEBUG] Full disk path: ${filePath}`)

      if (fs.existsSync(filePath)) {
        console.log(`[DEBUG] File exists, sending...`)
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
  app.post('/api/mod/download-image', async (req, res) => {
    const { url, modId } = req.body
    if (!url || !modId) {
      return res.status(400).json({ error: 'Missing url or modId' })
    }
    try {
      const fileName = await storage.downloadImage(url, modId)
      return res.json({ fileName })
    } catch (error: unknown) {
      return res
        .status(500)
        .json({ error: error instanceof Error ? error.message : 'Failed to serve media' })
    }
  })

  // Upload screenshot route
  app.post('/api/screenshots/upload', async (req, res) => {
    const { filePath } = req.body
    if (!filePath) {
      return res.status(400).json({ error: 'Missing filePath' })
    }
    try {
      const fileName = await storage.copyImageToImages(filePath)
      return res.json({ fileName })
    } catch (error: unknown) {
      return res
        .status(500)
        .json({ error: error instanceof Error ? error.message : 'Failed to upload screenshot' })
    }
  })

  app.get('/api/versions/:slug', async (req, res) => {
    const version = await storage.getDoomVersionBySlug(req.params.slug)
    if (!version) {
      return res.status(404).json({ message: 'Doom version not found' })
    }
    return res.json(version)
  })

  // === Mods API ===
  app.get('/api/mods', async (req, res) => {
    const { version, search } = req.query

    try {
      let mods = await gameService.getAllMods()

      // Filter by version if provided
      if (version && typeof version === 'string') {
        mods = mods.filter((mod) => mod.doomVersionId === version)
      }

      // Filter by search query if provided
      if (search && typeof search === 'string') {
        mods = mods.filter((mod) =>
          (mod.title || mod.name || '').toLowerCase().includes(search.toLowerCase())
        )
      }

      return res.json(mods)
    } catch (error) {
      console.error('Error fetching mods:', error)
      return res.status(500).json({ error: 'Failed to fetch mods' })
    }
  })

  app.get('/api/mods/:id', async (req, res) => {
    const id = req.params.id // Keep ID as string
    // if (isNaN(id)) {
    // return res.status(400).json({ message: "Invalid mod ID" });
    // }

    try {
      const { mod, files } = await gameService.getMod(id)
      return res.json({ mod, files })
    } catch (error: unknown) {
      return res.status(404).json({
        message: error instanceof Error ? error.message : 'Mod not found'
      })
    }
  })

  app.post('/api/mods', async (req, res) => {
    const { mod, files } = req.body

    // Basic validation - might need more depending on IMod structure
    if (!mod || !mod.title /* || !mod.doomVersionId || !mod.sourcePort */) {
      // Removed version/port checks for now
      return res.status(400).json({ message: 'Missing required mod properties' })
    }

    try {
      const savedMod = await gameService.saveMod(mod, files || [])
      return res.status(201).json(savedMod)
    } catch (error: unknown) {
      return res.status(500).json({
        message: error instanceof Error ? error.message : 'Failed to save mod'
      })
    }
  })

  app.put('/api/mods/:id', async (req, res) => {
    const id = req.params.id // Keep ID as string
    // if (isNaN(id)) {
    // return res.status(400).json({ message: "Invalid mod ID" });
    // }

    const { mod, files } = req.body
    if (!mod) {
      return res.status(400).json({ message: 'Missing mod data' })
    }

    mod.id = id // Assign string ID
    try {
      const updatedMod = await gameService.saveMod(mod, files || [])
      return res.json(updatedMod)
    } catch (error: unknown) {
      return res.status(404).json({
        message: error instanceof Error ? error.message : 'Mod not found or failed to update'
      })
    }
  })

  app.delete('/api/mods/:id', async (req, res) => {
    const id = req.params.id // Keep ID as string
    // if (isNaN(id)) {
    // return res.status(400).json({ message: "Invalid mod ID" });
    // }

    try {
      const success = await gameService.deleteMod(id)
      if (!success) {
        throw new Error('Mod not found or failed to delete')
      }
      return res.status(204).send()
    } catch (error: unknown) {
      return res.status(404).json({
        message: error instanceof Error ? error.message : 'Mod not found or failed to delete'
      })
    }
  })

  // Launch a mod
  app.post('/api/mods/:id/launch', async (req, res) => {
    const id = req.params.id // Use string ID
    if (!id) {
      return res.status(400).json({ message: 'Invalid mod ID' })
    }
    try {
      const result = await gameService.launchMod(id)
      if (!result.success) {
        throw new Error(result.message || 'Failed to launch mod')
      }
      return res.json({ success: true })
    } catch (error: unknown) {
      return res.status(500).json({
        message: error instanceof Error ? error.message : 'Failed to launch mod'
      })
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
      const hash = await storage.computeFileHash(filePath)
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
      await storage.deleteModFileFromCatalog(fileId)
      return res.json({ success: true })
    } catch (error: unknown) {
      return res.status(500).json({
        message: error instanceof Error ? error.message : 'Failed to delete file from catalog'
      })
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
        error: error instanceof Error ? error.message : 'Failed to serve media'
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

  // === Dialog API (for file/directory selection) ===
  app.post('/api/dialog/open', async (req, res) => {
    try {
      const { dialog, BrowserWindow } = await import('electron')
      const options = req.body || {}

      if (options.defaultPath) {
        console.log('[DEBUG] Dialog open: Raw defaultPath:', options.defaultPath)
        options.defaultPath = storage.resolvePath(options.defaultPath)
        console.log('[DEBUG] Dialog open: Resolved defaultPath:', options.defaultPath)
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

  // === Migration API ===
  app.get('/api/migration/check', async (_req, res) => {
    try {
      const info = await storage.checkLegacyConfig()
      return res.json(info)
    } catch (error: unknown) {
      return res
        .status(500)
        .json({ error: error instanceof Error ? error.message : 'Failed to serve media' })
    }
  })

  app.post('/api/migration/execute', async (req, res) => {
    try {
      const { sourcePath } = req.body
      if (!sourcePath) return res.status(400).json({ error: 'Missing sourcePath' })
      const success = await storage.executeMigration(sourcePath)
      return res.json({ success })
    } catch (error: unknown) {
      return res
        .status(500)
        .json({ error: error instanceof Error ? error.message : 'Failed to serve media' })
    }
  })

  return httpServer
}
