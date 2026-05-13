# UAC Launch Control

A modern desktop application for managing and launching Doom mods, built with Electron, React, and TypeScript. It is a WIP and still very _early stage_!

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/mikkelrask/uaclaunchcontrol)
![Electron](https://img.shields.io/badge/Electron-Latest-47848F?logo=electron)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)

![UAC Launch Control is Modded Rip and Tear on Easy Mode!](https://github.com/mikkelrask/uaclaunchcontrol/blob/main/IMG/0.2.5.png?raw=true)

## Overview

**UAC Launch Control** is a mod launcher for **UZDoom/GZDoom/ZDoom**. It provides an intuitive interface for **organizing your Doom WADs and mod files**, and launching games with custom configurations to test multi mod compatability.

No more having to remember the launch order of your mods, or blindly trusting and launching `.bat` scripts to rip and tear!

#### Key Features

- 🎮 **Game Management**: Organize and launch different configurations of wads, mods and modpacks with ease
- 📁 **File Catalog**: Maintain a catalog of mod files with search, sidecar flags, and dependency/load-order tracking
- 📦 **"Mod-linking"**: if a mod requires another specific, you can set it as required, and the app will always add additional mods when creating a new game instance
- ⚙️ **Custom Launch Parameters**: Configure launch arguments per mod
- 🔄 **Import and Export**: Export your configuration as a JSON file to share with friends, or drag-and-drop a modpack JSON to import\*
- 🌐 **UAC Registry**: Community-sourced mod metadata lookups with anonymous submissions (opt-in)
- 🗺️ **WAD Management**: Import and configure base game WADs with auto-detection and real-time file watching
- 🎯 **Bring your own Source port**: UZDoom, GZDoom, Zandronum, and more — configure per-mod or globally
- ⌨️ **Keyboard Shortcuts**: Quick navigation with global hotkeys — see the [Keyboard Shortcuts wiki](https://github.com/mikkelrask/uaclaunchcontrol/wiki/Keyboard-shortcuts) for the full list
- 🔄 **Auto-Updater**: Automatic update checks with in-app download and install

_\* They still need the actual modfiles — the JSON only stores references and load orders. No mod data is shared, keeping support with the original mod creators._

## Install

**UAC Launch Control** is available for **Windows, MacOS** and **Linux**.
**Download** the latest release for you operating system from the **[Releases page](https://github.com/mikkelrask/uaclaunchcontrol/releases)**

More detailed instructions can be found in the **[Install Wiki](https://github.com/mikkelrask/uaclaunchcontrol/wiki/Install-UAC-Launch-Control)**.

## License

This is free software. Free as in freedom _and_ free beer.

## Development & Contributing

Contributions are welcome! Please feel free to submit a Pull Request or raise issues.

For more developer details refer to the [wiki](https://github.com/mikkelrask/uaclaunchcontrol/wiki) or [DeepWiki](https://deepwiki.com/mikkelrask/uaclaunchcontrol) for a more detailed go-through.

## Acknowledgments

- Built with [electron-vite](https://electron-vite.org/)
- UI components from [shadcn/ui](https://ui.shadcn.com/)
- Icons from [Lucide](https://lucide.dev/)
- This application is in no way related to the **Doom IP**, **ID Software** or **Bethesda** - it's an _homage_ to the **Doom Universe** using the **Union Aerospace Corporation** as a gimmick for the "evil corporation".
