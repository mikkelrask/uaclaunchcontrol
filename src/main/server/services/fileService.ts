import fs from 'fs/promises';
import path from 'path';
import { execFile } from 'child_process';
import util from 'util';
import { Stats } from 'fs';

const execFilePromise = util.promisify(execFile);

// Service to handle file system operations
export class FileService {
  // Check if a file exists
  async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  // Get info about a file
  async getFileInfo(filePath: string): Promise<Stats | null> {
    try {
      return await fs.stat(filePath);
    } catch {
      return null;
    }
  }

  // Read a directory
  async readDirectory(dirPath: string): Promise<string[]> {
    try {
      return await fs.readdir(dirPath);
    } catch {
      return [];
    }
  }

  // Read a file as text
  async readFile(filePath: string): Promise<string | null> {
    try {
      return await fs.readFile(filePath, 'utf8');
    } catch {
      return null;
    }
  }

  // Write a file
  async writeFile(filePath: string, data: string): Promise<boolean> {
    try {
      // Create directories if they don't exist
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, data, 'utf8');
      return true;
    } catch {
      return false;
    }
  }

  // Delete a file
  async deleteFile(filePath: string): Promise<boolean> {
    try {
      await fs.unlink(filePath);
      return true;
    } catch {
      return false;
    }
  }

  // Launch a game with parameters
  async launchGame(executable: string, args: string[]): Promise<boolean> {
    try {
      await execFilePromise(executable, args);
      return true;
    } catch (error) {
      console.error('Error launching game:', error);
      return false;
    }
  }
}

// In your route handler for POST /api/mods/:id/launch, use the unified launchGame
// Example (pseudo-code):
// router.post('/api/mods/:id/launch', async (req, res) => {
//   const modId = req.params.id;
//   try {
//     const result = await launchGame({ modId });
//     if (result.success) {
//       res.json({ success: true });
//     } else {
//       res.status(500).json({ success: false, message: result.message });
//     }
//   } catch (error) {
//     res.status(500).json({ success: false, message: error.message });
//   }
// });

export const fileService = new FileService();
