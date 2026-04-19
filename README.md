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

## Install

**UAC Launch Control** is available for **Windows, MacOS** and **Linux**.

**Download** the latest release for you operating system from the **[Releases page](https://github.com/mikkelrask/uaclaunchcontrol/releases)**

Detailed instructions can be found in the **[Install Wiki](https://github.com/mikkelrask/uaclaunchcontrol/wiki/Install-UAC-Launch-Control)**.

## License

This is free software. Free as in freedom _and_ free beer.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request or raise issues.

## Acknowledgments

- Built with [electron-vite](https://electron-vite.org/)
- UI components from [shadcn/ui](https://ui.shadcn.com/)
- Icons from [Lucide](https://lucide.dev/)
