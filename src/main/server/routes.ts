import type { Express } from "express";
import { createServer, type Server } from "http";
import { gameService } from "./services/gameService";
import * as storage from "./storage";
import * as express from "express";

export async function registerRoutes(app: Express): Promise<Server> {
  app.use(express.json());
  const httpServer = createServer(app);

  // Initialize services and load mods from config
  await gameService.loadModsFromConfig();

  // === API Routes ===
  
  // === Doom Versions API ===
  app.get("/api/versions", async (_req, res) => {
    const versions = await storage.getDoomVersions();
    return res.json(versions); // Ensure this sends the array directly
  });



  // === Move the mod file to the mod directory set in settings ===
  app.post("/api/move-file", async (req, res) => {
    console.log("POST /api/move-file received with body:", req.body);
    const { filePath, newPath } = req.body;
    if (!filePath || !newPath) {
      return res.status(400).json({ message: "Missing file path or new path" });
    }

    try {
      const returnPath = await storage.moveFile(filePath, newPath);
      return res.json({ message: returnPath });
    } catch (error) {
      console.error("Error moving file:", error);
      return res.status(500).json({ message: "Failed to move file" });
    }
  });

  app.get("/api/versions/:slug", async (req, res) => {
    const version = await storage.getDoomVersionBySlug(req.params.slug);
    if (!version) {
      return res.status(404).json({ message: "Doom version not found" });
    }
    return res.json(version);
  });

  // === Mods API ===
  app.get("/api/mods", async (req, res) => {
    const { version, search } = req.query;

    try {
      let mods = await gameService.getAllMods();

      // Filter by version if provided
      if (version && typeof version === "string") {
        mods = mods.filter((mod) => mod.doomVersionId === version);
      }

      // Filter by search query if provided
      if (search && typeof search === "string") {
        mods = mods.filter((mod) =>
          (mod.title || mod.name || "").toLowerCase().includes(search.toLowerCase())
        );
      }

      return res.json(mods);
    } catch (error) {
      console.error("Error fetching mods:", error);
      return res.status(500).json({ error: "Failed to fetch mods" });
    }
  });

  app.get("/api/mods/:id", async (req, res) => {
    const id = req.params.id; // Keep ID as string
    // if (isNaN(id)) {
      // return res.status(400).json({ message: "Invalid mod ID" });
    // }
    
    try {
      const { mod, files } = await gameService.getMod(id);
      return res.json({ mod, files });
    } catch (error: any) {
      return res.status(404).json({ message: error.message || "Mod not found" });
    }
  });

  app.post("/api/mods", async (req, res) => {
    const { mod, files } = req.body;
    
    // Basic validation - might need more depending on IMod structure
    if (!mod || !mod.title /* || !mod.doomVersionId || !mod.sourcePort */) { // Removed version/port checks for now
      return res.status(400).json({ message: "Missing required mod properties" });
    }
    
    try {
      const savedMod = await gameService.saveMod(mod, files || []);
      return res.status(201).json(savedMod);
    } catch (error: any) {
      return res.status(500).json({ message: error.message || "Failed to save mod" });
    }
  });

  app.put("/api/mods/:id", async (req, res) => {
    const id = req.params.id; // Keep ID as string
    // if (isNaN(id)) {
      // return res.status(400).json({ message: "Invalid mod ID" });
    // }
    
    const { mod, files } = req.body;
    if (!mod) {
      return res.status(400).json({ message: "Missing mod data" });
    }
    
    mod.id = id; // Assign string ID
    try {
      const updatedMod = await gameService.saveMod(mod, files || []);
      return res.json(updatedMod);
    } catch (error: any) {
       return res.status(404).json({ message: error.message || "Mod not found or failed to update" });
    }
  });

  app.delete("/api/mods/:id", async (req, res) => {
    const id = req.params.id; // Keep ID as string
    // if (isNaN(id)) {
      // return res.status(400).json({ message: "Invalid mod ID" });
    // }
    
    try {
      const success = await gameService.deleteMod(id);
      if (!success) {
         throw new Error("Mod not found or failed to delete");
      }
      return res.status(204).send();
    } catch (error: any) {
       return res.status(404).json({ message: error.message || "Mod not found or failed to delete" });
    }
  });

  // Launch a mod
  app.post("/api/mods/:id/launch", async (req, res) => {
    const id = req.params.id; // Use string ID
    if (!id) {
      return res.status(400).json({ message: "Invalid mod ID" });
    }
    try {
       const result = await gameService.launchMod(id);
       if (!result.success) {
         throw new Error(result.message || "Failed to launch mod");
       }
       return res.json({ success: true });
    } catch (error: any) {
       return res.status(500).json({ message: error.message || "Failed to launch mod" });
    }
  });

  // === Mod Files API === // New Section
  app.get("/api/mod-files/catalog", async (_req, res) => {
    try {
      const catalog = await storage.getModFileCatalog();
      if (!Array.isArray(catalog)) {
        console.warn('routes.ts: getModFileCatalog did not return an array:', catalog);
        return res.json([]);
      }
      return res.json(catalog);
    } catch (error) {
      console.error('routes.ts: Error in /api/mod-files/catalog:', error);
      return res.json([]);
    }
  });

  app.post("/api/mod-files/catalog", async (req, res) => {
    try {
      console.log("POST /api/mod-files/catalog received with body:", req.body);
      
      const fileData = req.body;
      
      // Basic validation
      if (!fileData || !fileData.filePath) {
        console.log("Validation failed: Missing required file properties");
        return res.status(400).json({ message: "Missing required file properties" });
      }

      console.log("Adding file to catalog:", fileData);
      const savedFile = await storage.addModFileToCatalog(fileData);
      console.log("File added to catalog successfully:", savedFile);
      
      return res.status(201).json(savedFile);
    } catch (error: any) {
      console.error("Error in POST /api/mod-files/catalog:", error);
      return res.status(500).json({ message: error.message || "Failed to add file to catalog" });
    }
  });

  // === Settings API ===
  app.get("/api/settings", async (_req, res) => {
    try {
      const settings = await storage.getSettings();
      // Return a default empty object if not found
      return res.json(settings || {});
    } catch (error) {
      console.error("Failed to load settings:", error);

      return res.status(500).json({ message: "Failed to load settings" });
    }
  });

  app.put("/api/settings", async (req, res) => {
    try {
      const newSettings = req.body;
      if (!newSettings) {
        return res.status(400).json({ message: "No settings data provided" });
      }
      const updatedSettings = await storage.saveSettings(newSettings);
      return res.json(updatedSettings);
    } catch (error) {
      console.error("Failed to save settings:", error);

      return res.status(500).json({ message: "Failed to save settings" });
    }

  });

  // === Dialog API (for file/directory selection) ===
  app.post("/api/dialog/open", async (req, res) => {
    try {
      const { dialog, BrowserWindow } = await import('electron');
      const options = req.body || {};
      
      // Get the focused window or the first window
      const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
      
      if (!win) {
        return res.status(500).json({ canceled: true, filePaths: [] });
      }
      
      const result = await dialog.showOpenDialog(win, options);
      return res.json(result);
    } catch (error) {
      console.error("Failed to show open dialog:", error);
      return res.status(500).json({ canceled: true, filePaths: [] });
    }
  });


  return httpServer;
}
