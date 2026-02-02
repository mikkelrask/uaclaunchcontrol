# Migration Plan: Tauri to Electron

## Recommendation
**Strategy: Fresh Start (Recommended)**
Instead of trying to surgically remove Rust/Tauri from the current repository, it is cleaner to initialize a standard Electron+Vite boilerplate and migrate your source code into it. This avoids configuration hell with TypeScript, Build scripts, and leftovers.

## Phase 1: Setup New Project
1. **Initialize Electron App**: Use a modern template like `electron-vite` which creates a structure very similar to what you have (separated main/renderer).
   ```bash
   npm create @quick-start/electron my-new-app -- --template react-ts
   ```
2. **Install Dependencies**: Copy the `dependencies` list from your current `client/package.json` and `server/server-package.json` into the new project.

## Phase 2: Migrate Backend (The "Main" Process)
Electron runs Node.js natively in its "Main" process. We don't need to "spawn" a separate server, but since your code is already written as an Express app, we can simply start that Express app *inside* the Electron main process.

1. **Copy Server Code**: Move your `server/` folder to the new project.
2. **Integrate Server**: In Electron's `main.ts` (the entry point), import and start your Express app.
   ```typescript
   // In electron/main.ts
   import appFromYourServer from './server/index' 
   // You might need to slightly adjust server/index.ts to export the start function instead of auto-running.
   ```
   *Benefit*: You don't need to bundle Node executable manually. Electron *is* Node.

## Phase 3: Migrate Frontend (The "Renderer")
1. **Copy Client Code**: Move `client/src` contents to the new project's `renderer/src`.
2. **Update API Calls**: 
   - Since the Express server acts as a local API, your `fetch('/api/...')` calls will still work if you just point them to `http://localhost:7666`. 
   - *Better Approach*: Configure Vite proxy in the new project to forward `/api` to `localhost:7666`, mimicking your current setup.

## Phase 4: Cleaning Up "Weird" Stuff
1. **Remove Custom Protocol**: You no longer need the Rust proxy. The frontend can talk directly to `localhost:7666` (or use Electron IPC later if you want to be fancy).
2. **Remove Node Bundling**: Delete all the `post-build.sh` logic that copies node binaries.
3. **Native Dialogs**: Your `server/api.ts` already has logic for `dialog`. In Electron, we can pass the native `dialog` object to your API router, allowing the backend to open real system file pickers requested by the frontend.

## Step-by-Step Execution Plan

1. **Scaffold**: Create the new folder `electron-version`.
2. **Move**: Copy `client` -> `src/renderer`, `server` -> `src/main/server`.
3. **Refactor Server**: 
   - Modify `server/index.ts` to export a `startServer()` function.
   - Call `startServer()` from Electron's `main.ts`.
4. **Refactor Client**:
   - Updates `api.ts` base URL if necessary (or set up Vite proxy).
5. **Test**: Run `npm run dev` in the new project. It should launch the Electron window and start the Express server internally.
6. **Build**: Run electron-builder. It automatically bundles the Node runtime.

## Advantages of this approach
- **No Rust**: Pure JavaScript/TypeScript stack.
- **Simpler Build**: Standard `npm run build` handles everything.
- **Smaller(ish) Config**: No more `tauri.conf.json`, `Cargo.toml`, etc.
- **Native Node**: Accessing filesystem is native, no need for sidecars.
