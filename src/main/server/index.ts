import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
const log = console.log;
import * as storage from './storage';
import { IModFile } from '../../shared/schema';
import { spawn } from 'child_process'; // Import spawn
import cors from 'cors';

const expressApp = express();
expressApp.use(cors()); // Enable CORS for all routes
expressApp.use(express.json());
expressApp.use(express.urlencoded({ extended: false }));

expressApp.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson: any) {
    capturedJsonResponse = bodyJson;
    return originalResJson.call(res, bodyJson);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// Make launchMod available for import
export async function launchMod(modId: number) {
  try {
    const mod = await storage.getMod(modId.toString());
    if (!mod) {
      throw new Error(`Mod with ID ${modId} not found`);
    }

    const modFiles: IModFile[] = (await storage.getModFiles(modId.toString())) || [];
    if (!modFiles.length) {
      throw new Error(`No mod files found for mod with ID ${modId}`);
    }

    const settings = await storage.getSettings();
    console.log("Retrieved settings for launch:", settings);

    if (!settings?.gzDoomPath) {
      throw new Error('GZDoom executable path not set in settings. Please set it in Settings.');
    }

    const executable = storage.resolvePath(settings.gzDoomPath);
    const args: string[] = [];

    for (const file of modFiles.sort((a, b) => (a.loadOrder ?? 0) - (b.loadOrder ?? 0))) {
      if (!file.filePath) {
        console.warn(`Mod file ${file.id} has no file path, skipping`);
        continue;
      }
      args.push('-file', storage.resolvePath(file.filePath));
    }

    if (mod.launchParameters) {
      const customParams = mod.launchParameters.split(' ');
      args.push(...customParams);
    }

    console.log(`Launching ${executable} with args:`, args);

    const process = spawn(executable, args, {
      detached: true,
      stdio: 'inherit' // Change from 'ignore' to 'inherit' temporarily to debug if needed, or stick to 'ignore'
    });

    process.unref();

    return { success: true, message: 'Mod launched' };
  } catch (error: any) {
    console.error('Failed to launch mod:', error);
    return { success: false, message: error.message };
  }
}

export async function startServer() {
  console.log("Starting Production Server...");
  console.log("Current working directory:", process.cwd());

  const server = await registerRoutes(expressApp);

  expressApp.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // Use serveStatic directly for production
  console.log("Starting static server...");
  // serveStatic(expressApp); // In Electron we don't serve static files from Express typically

  const port = 7666;
  server.listen(port, '0.0.0.0', () => {
    log(`Production server is running on port ${port}`);
  });
}
