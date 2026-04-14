# UAC Launch Control

A modern desktop application for managing and launching Doom mods, built with Electron, React, and TypeScript. It is _very much_ a WIP and early

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/mikkelrask/uaclaunchcontrol)
![Electron](https://img.shields.io/badge/Electron-Latest-47848F?logo=electron)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)

![UAC Launch Control is Modded Rip and Tear on Easy Mode!](https://github.com/mikkelrask/uaclaunchcontrol/blob/main/IMG/0.2.4.png?raw=true)

## Overview

**UAC Launch Control** is a mod launcher for **UZDoom/GZDoom/ZDoom** with big ambitions. It provides an intuitive interface for **organizing your Doom WADs and mod files**, and launching games with custom configurations to test mod compatability.

No more having to remember the launch order of your mods, or blindly trusting and launching `.bat` scripts to rip and tear!

#### Key Features

- 🎮 **Game Management**: Organize and launch different configurations of mods and modpacks with ease
- 📁 **File Catalog**: Maintain a catalog of mod files
- 📦 **"Mod-linking"**:  if a mod requires another specific, you can set it as required, and the app will always add additional mods when creating a new game instance
- ⚙️ **Custom Launch Parameters**: Configure launch arguments per mod
- 🔄 **Import and Export**: You can export your favorite configuration and share with your friends with a simple json file, that your friend can import*
- 🎯 **"Bring your own Source port"**: UZDoom, GZDoom, Zandronum, and more - if your source port isn't working, let me know in the [issues](https://github.com/mikkelrask/uaclaunchcontrol/issues)!

_\* they still need the actual modfiles - I don't want to keep users away from the communities, or "steal downloads" from mod-developers, as that metric obviously is used to measure a games popularity and the likes._
## Architecture

### Technology Stack

- **Frontend**: React 18 + TypeScript + TailwindCSS v3
- **Backend**: Express.js API server
- **Desktop**: Electron (main + renderer processes)
- **Build Tool**: electron-vite
- **File Watching**: Chokidar for real-time filesystem synchronization
- **State Management**: TanStack Query (React Query)
- **UI Components**: Radix UI + shadcn/ui

### Application Structure

```
uaclaunchcontrol/
├── src/
├── main/           # Electron main process
│   ├── index.ts    # Main entry point
│   └── server/     # Express API server
│       ├── index.ts
│       ├── routes.ts
│       ├── storage.ts    # Core storage and sync logic
│       └── services/
├── preload/        # Electron preload scripts
├── renderer/       # React frontend
│   └── src/
│       ├── components/
│       ├── pages/
│       ├── lib/
│       └── api.ts
└── shared/         # Shared TypeScript types
    └── schema.ts
```

### Data Flow

1. **Electron Main Process** starts and initializes the Express API server on port `7666`
2. **Express Server** manages:
   - Settings (`~/.config/uac/settings.json`)
   - Doom versions (`~/.config/uac/doomVersions.json`)
   - Mod files (`~/.config/uac/mods/*.json`)
   - File catalog (`~/.config/uac/modFileCatalogue.json`)
3. **Renderer Process** (React app) communicates with the API server via HTTP
4. **Media Proxy**: Local images are served via `/api/media` to bypass Electron's `file://` security restrictions

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm, npm or yarn
- UZDoom (or similar source port) installed on your system

```bash
# Clone the repository
git clone https://github.com/mikkelrask/uaclaunchcontrol.git
cd uaclaunchcontrol

# Install dependencies
pnpm install
```

### Development

```bash
# Run in development mode (with hot reload)
pnpm dev
```

This will:

- Start the Vite dev server for the renderer (port 5173)
- Start the Electron app with the Express API server (port 7666)
- Start a file watcher on your WADs directory for real-time sync

```bash
# Build for your current platform
pnpm build
```

### Platform-specific builds

```bash
pnpm build:win    # Windows
pnpm build:mac    # macOS
pnpm build:linux  # Linux
```

Built applications will be in the `dist/` directory.

## Configuration

Done via the application settings via the cog icon in the top right corner, but everything is also stored in plain text json files, so you can edit them manually if you want to. All paths support tilde (`~`) expansion.

### Storage Location

All application data is stored in `~/.config/uac/`:

```
~/.config/uac/
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
  "theme": "dark",
  "savegamesPath": "~/.config/uac/saves",
  "modsDirectory": "~/.config/uac/mods",
  "screenshotsPath": "~/Pictures/uac/screenshots",
  "wadFilesDirectory": "~/.config/uac/wads"
}
```

## API Endpoints

The Express server exposes the following REST API:

- `GET /api/versions` - List all resolved Doom versions
- `GET /api/versions/:slug` - Get specific Doom version
- `GET /api/mods` - List all mods
- `GET /api/mods/:id` - Get specific mod with files
- `POST /api/mods` - Create new mod
- `PUT /api/mods/:id` - Update mod
- `DELETE /api/mods/:id` - Delete mod
- `GET /api/settings` - Get expanded application settings
- `PUT /api/settings` - Update settings
- `GET /api/mod-files/catalog` - Get mod file catalog
- `POST /api/mod-files/catalog` - Add file to catalog
- `POST /api/dialog/open` - Open native picker (supports tildes)
- `POST /api/move-file` - Move file and return absolute path
- `POST /api/launch/:modId` - Launch a mod
- `GET /api/media?path=...` - Safe media proxy for rendering local files

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

- TailwindCSS v3 with custom dark theme
- CSS variables for theming in `src/renderer/src/index.css`
- Custom components in `src/renderer/src/components/ui/`

## Recommended IDE Setup

- [VSCode](https://code.visualstudio.com/)
- Extensions:
  - [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint)
  - [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)
  - [Tailwind CSS IntelliSense](https://marketplace.visualstudio.com/items?itemName=bradlc.vscode-tailwindcss)

## License

This is free software. Free as in freedom _and_ free beer.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request or raise issues.

## Acknowledgments

- Built with [electron-vite](https://electron-vite.org/)
- UI components from [shadcn/ui](https://ui.shadcn.com/)
- Icons from [Lucide](https://lucide.dev/)
