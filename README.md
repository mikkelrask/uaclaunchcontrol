# UAC Launch Control

A modern desktop application for managing and launching Doom mods, built with Electron, React, and TypeScript. It is _very much_ a WIP and early

![UAC Launch Control](https://img.shields.io/badge/Electron-Latest-47848F?logo=electron)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)

![UAC Launch Control is Modded Rip and Tear on Easy Mode!](https://github.com/mikkelrask/uaclaunchcontrol/blob/main/IMG/macos-confirmed.png?raw=true)
## Overview

UAC Launch Control is a mod launcher for **UZDoom/GZDoom/ZDoom** with big ambitions. It provides an intuitive interface for organizing your Doom WADs, managing mod files, and launching games with custom configurations.

No more having to remember the launch order of your mods, or making `.bat` launch scripts for each of your mods.

UAC Launch Control stores your mod-files in a locally stored catalogue, making it easy to mix-and-match different mods, to create your own custom "mod-pack" or "remix".

### Key Features

- 🎮 **Mod Management**: Organize and launch Doom mods with ease
- 📁 **File Catalog**: Maintain a catalog of mod files (WADs, PK3s, DEH patches)
- ⚙️ **Custom Launch Parameters**: Configure launch arguments per mod
- 🎯 **"Bring your own Source port"**: UZDoom, GZDoom, Zandronum, and more to come

## Architecture

### Technology Stack

- **Frontend**: React 18 + TypeScript + TailwindCSS v4
- **Backend**: Express.js API server
- **Desktop**: Electron (main + renderer processes)
- **Build Tool**: electron-vite
- **State Management**: TanStack Query (React Query)
- **UI Components**: Radix UI + shadcn/ui

### Application Structure

```
uaclaunchcontrol-electron/
├── src/
│   ├── main/           # Electron main process
│   │   ├── index.ts    # Main entry point
│   │   └── server/     # Express API server
│   │       ├── index.ts
│   │       ├── routes.ts
│   │       ├── storage.ts
│   │       └── services/
│   ├── preload/        # Electron preload scripts
│   ├── renderer/       # React frontend
│   │   └── src/
│   │       ├── components/
│   │       ├── pages/
│   │       ├── lib/
│   │       └── api.ts
│   └── shared/         # Shared TypeScript types
│       └── schema.ts
├── resources/          # App icons and assets
└── out/               # Build output
```

### Data Flow

1. **Electron Main Process** starts and initializes the Express API server on port `7666`
2. **Express Server** manages:
   - Settings (`~/.config/mrdoom/settings.json`)
   - Doom versions (`~/.config/mrdoom/doomVersions.json`)
   - Mod files (`~/.config/mrdoom/mods/*.json`)
   - File catalog (`~/.config/mrdoom/modFileCatalogue.json`)
3. **Renderer Process** (React app) communicates with the API server via HTTP
4. **CORS enabled** to allow renderer (localhost:5173 in dev) to communicate with API (localhost:7666)

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm, npm or yarn
- UZDoom (or similar source port) installed on your system

# Clone the repository
git clone https://github.com/mikkelrask/uaclaunchcontrol.git
cd uaclaunchcontrol

# Install dependencies
pnpm install

### Development

```bash
# Run in development mode (with hot reload)
pnpm dev
```

This will:
- Start the Vite dev server for the renderer (port 5173)
- Start the Electron app with the Express API server (port 7666)
- Enable hot module replacement for the frontend

# Build for your current platform
```
pnpm build
```
# Platform-specific builds
```
pnpm build:win    # Windows
pnpm build:mac    # macOS
pnpm build:linux  # Linux
```
Built applications will be in the `dist/` directory.

## Configuration
Done via the application settings via the cog icon in the top right corner, but everything is also stored in plain text json files, so you can edit them manually if you want to.

### Storage Location

All application data is stored in `~/.config/mrdoom/`:
```
~/.config/mrdoom/
├── settings.json           # App settings (paths, preferences)
├── doomVersions.json       # Configured Doom versions
├── modFileCatalogue.json   # Catalog of available mod files
├── mods/                   # Individual mod configurations
│   ├── 1.json
│   ├── 2.json
│   └── ...
└── saves/mod-name/                  # Game save files (optional)
```

### Default Settings

```json
{
  "gzDoomPath": "gzdoom",
  "theme": "light",
  "savegamesPath": "~/.config/gzdoom/saves",
  "modsDirectory": "~/.config/mrdoom/mods",
  "screenshotsPath": "~/Pictures/MRDoom/screenshots",
  "defaultSourcePort": "GZDoom"
}
```

## API Endpoints

The Express server exposes the following REST API:

- `GET /api/versions` - List all Doom versions
- `GET /api/versions/:slug` - Get specific Doom version
- `GET /api/mods` - List all mods
- `GET /api/mods/:id` - Get specific mod with files
- `POST /api/mods` - Create new mod
- `PUT /api/mods/:id` - Update mod
- `DELETE /api/mods/:id` - Delete mod
- `GET /api/settings` - Get application settings
- `PUT /api/settings` - Update settings
- `GET /api/mod-files/catalog` - Get mod file catalog
- `POST /api/mod-files/catalog` - Add file to catalog
- `POST /api/dialog/open` - Open native file/directory picker
- `POST /api/move-file` - Move file to mods directory
- `POST /api/launch/:modId` - Launch a mod

## Development Notes

### TypeScript Configuration

The project uses separate TypeScript configurations:
- `tsconfig.node.json` - Main process and server code
- `tsconfig.web.json` - Renderer process (includes `src/shared`)

### Path Aliases

- `@/` - Maps to `src/renderer/src/`
- `@shared/` - Maps to `src/shared/`
- `@renderer/` - Maps to `src/renderer/src/`

### Styling

- TailwindCSS v4 with custom dark theme
- CSS variables for theming in `src/renderer/src/index.css`
- Custom components in `src/renderer/src/components/ui/`

## Recommended IDE Setup

- [VSCode](https://code.visualstudio.com/)
- Extensions:
  - [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint)
  - [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)
  - [Tailwind CSS IntelliSense](https://marketplace.visualstudio.com/items?itemName=bradlc.vscode-tailwindcss)

## License

This is free software.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request or raise issues.

## Acknowledgments

- Built with [electron-vite](https://electron-vite.org/)
- UI components from [shadcn/ui](https://ui.shadcn.com/)
- Icons from [Lucide](https://lucide.dev/)
