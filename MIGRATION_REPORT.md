# Migration Report

## Status
The migration from Tauri to Electron has been executed.

### Actions Taken
1.  **Scaffolded Electron App**: Used `electron-vite` template.
2.  **Migrated Source Code**:
    *   Moved `legacy-app/client/src` to `src/renderer/src`.
    *   Moved `legacy-app/server` to `src/main/server`.
    *   Moved `legacy-app/shared` to `src/shared`.
3.  **Refactored Server**:
    *   Updated `src/main/server/index.ts` to export a `startServer` function.
    *   Refactored `routes.ts` to use explicit returns, fixing strict TypeScript errors.
    *   Cleaned up legacy server files (`src/main/server/src`, `api.ts`, etc.) to reduce noise.
    *   Fixed `storage.ts` imports and unused legacy variables.
4.  **Refactored Client**:
    *   Updated `src/renderer/src/api.ts` to use a fixed `http://localhost:7666` base URL.
    *   Removed Tauri-specific detection scripts from `index.html`.
5.  **Configuration**:
    *   **FIXED**: Added `@` alias to `electron.vite.config.ts` and `tsconfig.web.json` to resolve `Failed to resolve import "@/..."` errors.
    *   Added `@shared` alias to `electron.vite.config.ts` and `tsconfig` files.
    *   Configured window settings (title, maximization) in `src/main/index.ts`.
6.  **Dependencies**:
    *   Installed all dependencies from the legacy project.

### Remaining Tasks / Known Issues
*   **Icons**: The app currently uses the default Electron icon. You should replace `resources/icon.png` with your `legacy-app/src-tauri/icons/icon.png`.
*   **Database Path**: The app continues to use `~/.config/mrdoom`.

### How to Run
1.  `npm run dev`: Starts the Electron app in development mode.
2.  `npm run build`: Builds the application for production.
