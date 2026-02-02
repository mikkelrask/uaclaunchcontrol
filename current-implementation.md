# Current Implementation Analysis

## Overview
The project is a desktop application for managing and launching Doom mods. It uses a "sidecar" architecture where a Rust implementation (Tauri) manages a hidden Node.js server, which in turn acts as the backend for a React frontend.

## Architecture Components

### 1. Frontend (Client)
- **Tech Stack:** Vite, React, TypeScript, TailwindCSS.
- **Location:** `client/` directory.
- **Function:** Provides the user interface.
- **Communication:** It makes standard HTTP requests (e.g., `fetch('/api/settings')`) to a local server. It does not know it is running inside a desktop wrapper; it believes it is a standard web app talking to a backend API.

### 2. Backend (Server)
- **Tech Stack:** Node.js, Express, File System (`fs-extra`).
- **Location:** `server/` directory.
- **Function:** 
    - Serves as the API for the frontend (`/api/*` routes).
    - Manages the filesystem (Settings, Configs, Mod handling) in `~/.config/mrdoom`.
    - Launches the actual game process (GZDoom) via `child_process.spawn`.
- **Execution:** It runs on port `7666`.

### 3. Application Wrapper (Tauri/Rust)
- **Tech Stack:** Rust, Tauri.
- **Location:** `src-tauri/` directory.
- **Function:**
    - **Bootstrapping:** Checks for a bundled Node.js binary in its resources.
    - **Process Management:** Spawns the Node.js server as a background process when the app starts and kills it when the app closes.
    - **Proxying:** It implements a custom protocol handler (`tauri://`) that intercepts requests and proxies them to the local Node.js server (`http://localhost:7666`). This allows the frontend to be served "locally" but fetch data from the background server without CORS issues or exposing the server publicly.

## Data Flow
1. User opens the App.
2. Rust Main Process starts -> Spawns `node server/index.cjs`.
3. Rust Main Process waits for `localhost:7666` to be alive.
4. Rust Window loads the Frontend.
5. Frontend requests `api/mods` -> Rust intercepts -> Proxies to `localhost:7666/api/mods` -> Node Server reads JSON files -> Returns Data.

## Key Observations
- The **Node bundling** is manual and complex.
- The **Communication protocol** is a workaround to bridge the gap between Tauri's webview and the external Node process.
- The **Database** is simply a collection of JSON files in the user's home directory (`~/.config/mrdoom`), meaning migration to a new app structure won't lose user data.
