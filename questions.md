# Questions / Unknowns

1. **Database Path Consistency**: The current app uses `~/.config/mrdoom` for storage. Do you want to keep this, or should we move to Electron's standard `app.getPath('userData')`? keeping it allows users to switch apps without losing data, so keeping it is probably best.
**A: I don't know that that electron standard, or what resolves, but it is important that we use a directory that is somewhat accessible to the user, since that is where mods are getting installed, and the json configurations, that the application creates per modded game are stored.**  

2. **Window Management**: Currently, the Rust app sets a specific window size and title. We'll need to replicate these settings in the Electron `BrowserWindow` configuration.
**A: The window should prob just be maximized like any other app, if possible, and the title should be "UAC Launch Control"**

3. **GZDoom Path**: The app relies on `gzdoom` being available or configured. Does the new installer need to bundle GZDoom, or do we assume the user has it installed? (Current app seems to assume user has it).
**A: -GZDoom should be installed by the user as it is now - currently it expects it to be GZDoom and that it is in the users PATH, however I will make it configurable via the settings, since GZDoom is abandonned and is getting replaced by UZDoom. This change is seperate from this migration though.** 

4. **Static Assets**: The current server serves static assets. In development, Vite serves them. In production Electron, we need to ensure the `dist` files are loaded correctly from the `file://` protocol or served via the local Express server. Using the local Express server to serve the frontend is actually the easiest way to ensure identical behavior to your current setup.
**A: Is this a question? I'm unsure what is asked here, at least.**