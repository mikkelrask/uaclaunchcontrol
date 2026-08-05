# UAC Launch Control

A desktop app for managing and launching Doom mods, built with Electron, React, and TypeScript. Still a work in progress and very early stage.

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/mikkelrask/uaclaunchcontrol)
![Electron](https://img.shields.io/badge/Electron-Latest-47848F?logo=electron)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)

![UAC Launch Control is Modded Rip and Tear on Easy Mode!](https://github.com/mikkelrask/uaclaunchcontrol/blob/main/IMG/0.2.5.png?raw=true)

## Overview

UAC Launch Control is a mod launcher for UZDoom, GZDoom, and ZDoom. It gives you a clean interface for organizing your Doom WADs and mod files, then launching them with custom configurations so you can test how several mods behave together.

No more memorizing launch order or blindly running .bat files to rip and tear.

### What it does

You can build and launch different setups of wads, mods, and modpacks without fuss. Keep a catalog of your mod files with search, per-file flags, and dependency and load-order tracking. If one mod needs another to run, mark it as required and the app pulls it in automatically whenever you start a new game instance.

Set launch arguments per mod. Export your whole configuration as a JSON file to hand to a friend, or just drag a modpack JSON onto the window to import it. The UAC Registry looks up community-sourced mod metadata, and you can submit entries anonymously if you opt in.

It auto-detects your base game WADs and watches those files in real time. Bring your own source port: UZDoom, GZDoom, Zandronum, and others, configured per mod or globally. Global hotkeys keep navigation quick — the full list is on the [keyboard shortcuts wiki](https://uac-soft.online/reference/keyboard-shortcuts/).

Imported JSON files only store references and load orders, not the mods themselves. No mod data leaves your machine, which keeps things square with the original creators.

## Install

UAC Launch Control runs on Windows, macOS, and Linux. Grab the latest release for your system from the [Releases page](https://github.com/mikkelrask/uaclaunchcontrol/releases).

Step-by-step instructions are in the [Install Wiki](https://uac-soft.online/installation/).

## License

Free software. Free as in freedom, FreeDoom and free beer.

## Development

Building from source or want to contribute? The [wiki](https://uac-soft.online/getting-started/) and [DeepWiki](https://deepwiki.com/mikkelrask/uaclaunchcontrol) have the details. Pull requests and issues are welcome.

## Acknowledgments

Built with [electron-vite](https://electron-vite.org/). UI components from [shadcn/ui](https://ui.shadcn.com/). Icons from [Lucide](https://lucide.dev/).

This app has nothing to do with the Doom IP, id Software, or Bethesda. It's a love letter to the Doom universe, borrowing the Union Aerospace Corporation as a gimmick for the evil corporation bit.
