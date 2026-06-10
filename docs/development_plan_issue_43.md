# Feature Implementation Plan: Config File Templates on Mod Files (Issue #43)

## 📝 Overview
This plan outlines a feature that allows users to link a configuration file (e.g. `settings.cfg`) to individual mod file entries in the catalog. When a **protocol is created** with mod files that have a linked config, that config is **copied into a protocol-specific file** — not referenced directly. This gives every protocol its own isolated config copy, meaning:

- You can use the same mod file in multiple protocols without config collisions
- In-game control changes in one protocol never affect another
- The catalog entry's config serves as a **template / recommended defaults** source
- Future "re-seed from template" can be added to pull in updated defaults

**Core design:** Catalog config link = template. Protocol config = copy.

## 🎯 Goals
1.  Store an optional config template link on catalog `IModFile` entries.
2.  On protocol creation, detect any linked configs among the chosen mod files, pick the primary one, copy its contents to a protocol-specific file, and store a `protocolConfig` reference on the protocol.
3.  At launch time, always use the protocol's own config copy — never the catalog template directly.
4.  Auto-detect config references from `.bat`/`.cmd`/`.cfg` files on import.
5.  Support export/import round-trips with config file contents embedded.
6.  Remain backward-compatible with existing mod files that lack config links.

## 🏗️ Architecture & Data Model

### Schema Changes (`src/shared/schema.ts`)

```typescript
// ── Catalog level: the template source ──
export interface IModFile {
  // ... existing fields ...
  configTemplate?: ModConfigTemplate  // NEW — optional template/recommended defaults
}

export interface ModConfigTemplate {
  configFile: string    // filename in ~/.config/uac/data/cfgs/ (e.g. "a1b2c3...cfg")
  md5Hash: string       // MD5 of the config file content (for change detection)
  // Note: no "enabled" flag — presence IS the enabled state
}

// ── Protocol level: the live copy ──
export interface IProtocol {
  // ... existing fields ...
  protocolConfig?: ModProtocolConfig  // NEW — per-protocol isolated copy
}

export interface ModProtocolConfig {
  configFile: string    // filename in ~/.config/uac/data/cfgs/<protocol-id>.cfg
  templateHash: string  // MD5 of the template it was seeded from (for staleness detection)
}
```

### Data Flow

```
MODPACK/ZIP/BAT IMPORT
       │
       ▼
   catalog entry gets configTemplate
   cfg stored as data/cfgs/<md5hash>.cfg
       │
       ▼
   PROTOCOL CREATION (InstallPage / useJsonDrop / onSubmit)
       │
       ▼
   Scan protocol files for first file with configTemplate
   Copy data/cfgs/<hash>.cfg → data/cfgs/<protocol-id>.cfg
   Set protocol.protocolConfig = {
     configFile: "<protocol-id>.cfg",
     templateHash: "<hash>"
   }
       │
       ▼
   LAUNCH (both preview + execution)
   Use protocol.protocolConfig to inject: -config ~/.config/uac/data/cfgs/<protocol-id>.cfg
       │
       ▼
   USER PLAYS, EDITS CONTROLS IN-GAME
   Only this protocol's copy is modified. All other protocols untouched.
```

### Storage Paths

| Path | Purpose |
|---|---|
| `~/.config/uac/modFileCatalogue.json` | Catalog entries with optional `configTemplate` |
| `~/.config/uac/data/cfgs/<md5hash>.cfg` | Template config files (by content hash) |
| `~/.config/uac/data/cfgs/<protocol-id>.cfg` | Protocol-specific config copies (by protocol ID) |
| `~/.config/uac/data/cfgs/` | Both template and protocol copies live here |

### Affected Files

| File | Role |
|---|---|
| `src/shared/schema.ts` | Add `ModConfigTemplate`, `ModProtocolConfig`, extend `IModFile` and `IProtocol` |
| `src/main/server/storage.ts` | Add `CFGS_DIR`, `ensureDirSync`, `copyConfigForProtocol()` helper |
| `src/main/server/services/gameService.ts` | `launchProtocol()` — inject `-config` from `protocol.protocolConfig` |
| `src/renderer/src/lib/utils.ts` → `buildLaunchCommand()` | Inject `-config` from `protocolConfig` in launch preview |
| `src/renderer/src/components/catalog/AddFileDialog.tsx` | Config file picker for catalog template |
| `src/renderer/src/components/catalog/EditFileDialog.tsx` | Config file picker for editing catalog template |
| `src/renderer/src/components/CatalogManager.tsx` | Display config template status in table |
| `src/pages/InstallPage.tsx` | `onSubmit()` — after saving protocol, copy config if any file has a template |
| `src/renderer/src/components/install/ConfigurationTab.tsx` | Show/hide config seeding status |
| `src/renderer/src/lib/install/parsers.ts` | Extend `parseBatContent()` to extract `-config` / `+exec` |
| `src/renderer/src/lib/install/useJsonDrop.ts` | Import protocol configs from JSON |
| `src/renderer/src/lib/install/types.ts` | Update `UacModpackImport` |
| `src/renderer/src/components/GameSettingsModal.tsx` | `handleExport()` — include protocolConfig in export; future: "Re-seed from template" |
| `src/preload/index.ts` / `.d.ts` | Optional: file I/O IPC |

## ⚙️ Phased Development Breakdown

### Phase 1: Data Model & Backend Foundation

**Goal:** Define the types, set up the CFGS directory, implement the config copy helper.

1.  **Update Schema (`src/shared/schema.ts`):**
    - Add `ModConfigTemplate` interface
    - Add `ModProtocolConfig` interface
    - Add optional `configTemplate` to `IModFile`
    - Add optional `protocolConfig` to `IProtocol`

2.  **Storage Setup (`src/main/server/storage.ts`):**
    - Add `CFGS_DIR = path.join(CONFIG_DIR, 'data', 'cfgs')` constant
    - Add `fs.ensureDirSync(CFGS_DIR)` to `initStorage()`
    - Add server-side helper:
      ```typescript
      export async function copyConfigForProtocol(
        templateHash: string,
        protocolId: string
      ): Promise<ModProtocolConfig> {
        const src = path.join(CFGS_DIR, `${templateHash}.cfg`)
        const dest = path.join(CFGS_DIR, `${protocolId}.cfg`)
        await fs.copy(src, dest, { overwrite: true })
        return {
          configFile: `${protocolId}.cfg`,
          templateHash
        }
      }
      ```

3.  **Backward Compatibility:**
    - `configTemplate` is optional on `IModFile` → absent on older entries
    - `protocolConfig` is optional on `IProtocol` → absent on older protocols
    - No existing protocol will have `protocolConfig`, so no `-config` arg change for them
    - This also means existing protocols keep using their current global defaults — zero regression

### Phase 2: Launch Command Generation (Both Paths)

**Goal:** When a protocol has `protocolConfig`, inject `-config <path>`.

#### Path A: Frontend Preview — `buildLaunchCommand()` in `utils.ts`

```typescript
// NEW: after -file section
const protocolConfig = options.protocolConfig  // pass from calling code
if (protocolConfig?.configFile) {
  // Resolve against CFGS_DIR (passed from settings or hardcoded)
  const cfgPath = path.join(CFGS_DIR, protocolConfig.configFile)
  parts.push('-config', cfgPath)
}
```

The `buildLaunchCommand()` callers need updating to pass `protocolConfig`:
- `ConfigurationTab.tsx` — reads from `form` / state
- `GameSettingsModal.tsx` — reads from `protocol.protocolConfig`

#### Path B: Backend Execution — `launchProtocol()` in `gameService.ts`

```typescript
// NEW: after -file args
if (protocol.protocolConfig?.configFile) {
  const cfgPath = path.join(CFGS_DIR, protocol.protocolConfig.configFile)
  args.push('-config', cfgPath)
}
```

**Conflict question answered:** There is no conflict — only `protocol.protocolConfig` is ever consulted. Catalog templates are never referenced directly at launch time.

### Phase 3: Protocol Creation — Template → Copy

**Goal:** When a user creates a protocol, if any of its mod files has a `configTemplate`, seed the protocol's config.

#### Where it happens: `InstallPage.tsx` → `onSubmit()`

After the protocol is saved successfully (in the `onSuccess` callback or after `saveProtocol()`), but before navigating away:

```typescript
// In onSubmit(), after saveProtocol succeeds:
const templateFile = files.find(f => f.configTemplate)
if (templateFile?.configTemplate) {
  const protocolConfig = await api.copyConfigForProtocol(
    templateFile.configTemplate.md5Hash,
    uniqueId  // protocol.id
  )
  // Save protocol again with protocolConfig set
  await api.saveProtocol({ ...protocol, protocolConfig }, fileData)
}
```

**Which template wins?** The **first mod file** in the files array that has a `configTemplate`. This is almost always the primary mod file (the one the user explicitly added first). Users control ordering — if they want a different template source, they reorder.

Also show a toast: "Seeded config from {fileName} — you can adjust controls in-game without affecting other protocols."

#### UI in `ConfigurationTab.tsx`

Add a small info row below the mod file list when a template is detected:
```
📄 Config auto-seeded from brutalv21.pk3
  (edit controls in-game — this protocol has its own copy)
```

### Phase 4: Catalog UI — Config Template Picker

**Goal:** Allow users to link a config file as a template on catalog entries.

#### `AddFileDialog.tsx` — New section between URL and Required Mods editor

```
┌─────────────────────────────────────────┐
│  Config Template (optional)             │
│  This config will seed new protocols    │
│  that include this mod file.            │
│                                         │
│  ┌──────────────────────────┐ [Browse]  │
│  │ /path/to/settings.cfg    │           │
│  └──────────────────────────┘           │
│  MD5: a1b2c3d4e5f6...       ✓ Ready    │
│  (Will be copied per-protocol)          │
└─────────────────────────────────────────┘
```

- Browse → native dialog filtered to `.cfg`, `.ini`, `.conf`
- On selection: compute MD5, copy to `cfgs/<hash>.cfg`, store `configTemplate` on the form state
- Validation: file must exist and be readable

#### `EditFileDialog.tsx` — Same picker, pre-populated

Allow changing the template or clearing it ("Remove template").

#### `CatalogManager.tsx`

Add a column or icon indicator showing which mod files have a config template. A tooltip shows the filename and hash.

### Phase 5: Auto-Detection on Import

**Goal:** When importing mods, detect `-config`/`+exec` references and link them as templates.

#### 5a. Extend `parseBatContent()` (`src/renderer/src/lib/install/parsers.ts`)

```typescript
export interface BatParseResult {
  sourcePortFamily?: string
  iwad?: string
  modFiles: string[]
  configFile?: string     // NEW: extracted -config <path> or +exec <path>
  extraParams: string[]
}
```

Scan tokens for `-config` or `+exec` flags.

#### 5b. BAT Import Paths (both browse + drop in `CatalogManager.tsx`)

After parsing:
1. If `parsed.configFile` is set, resolve relative to BAT directory
2. If file exists → hash it, copy to `cfgs/<hash>.cfg`, attach `configTemplate` to first mod file
3. If file doesn't exist → toast warning, proceed without template

#### 5c. ZIP Import

- Extend `unzipAndScan()` to identify `.cfg`/`.ini` files in the archive
- In the ZIP import modal, show detected config files with "Use as template" checkbox
- On import, hash and copy to `cfgs/<hash>.cfg`, attach to the primary mod file

### Phase 6: Export / Import Round-Trip

**Goal:** Modpack exports include config file contents; imports reconstruct both templates and protocol configs.

#### 6a. Type Update (`src/renderer/src/lib/install/types.ts`)

```typescript
export interface UacModpackImport {
  format: string
  version: string
  game: {
    title: string
    description?: string
    doomVersionSlug: string
    sourcePort?: string
    launchParameters?: string
    protocolConfig?: {       // NEW
      configFile: string     // will be renamed on import
      templateHash: string
    }
  }
  files: Array<{
    name: string
    hashValue?: string
    url?: string
    configTemplate?: ModConfigTemplate  // NEW
  }>
  configs?: Record<string, { content: string }>  // NEW: keyed by MD5 hash
}
```

#### 6b. Export — `GameSettingsModal.tsx` → `handleExport()`

- Include `protocolConfig` in the `game` object
- Include `configTemplate` on each file entry
- Embed all referenced config file contents in a top-level `configs` Record

```typescript
const configs: Record<string, { content: string }> = {}
// Collect from protocolConfig
if (protocol.protocolConfig) {
  const content = await api.readConfigFile(protocol.protocolConfig.templateHash)
  configs[protocol.protocolConfig.templateHash] = { content }
}
// Collect from file templates
for (const f of files) {
  if (f.configTemplate && !configs[f.configTemplate.md5Hash]) {
    const content = await api.readConfigFile(f.configTemplate.md5Hash)
    configs[f.configTemplate.md5Hash] = { content }
  }
}
```

#### 6c. Import — `useJsonDrop.ts` → `importFromJsonFile()`

1. Write all entries from `importData.configs` to `~/.config/uac/data/cfgs/<hash>.cfg`
2. Set `configTemplate` on catalog entries where present
3. If `importData.game.protocolConfig` exists, after protocol creation:
   - Copy the template to `<protocol-id>.cfg`
   - Set `protocolConfig` on the saved protocol

#### 6d. Preload / Server

May need an endpoint to read config file content by hash or protocol ID:

```
GET /api/configs/:hash  →  { content: string }
```

Or route through the existing `POST /api/file-read` endpoint.

### Phase 7: Future — Re-seed from Template

**Not implemented in this phase, but designed:**

In `GameSettingsModal.tsx`, add a button visible when:
- `protocol.protocolConfig` exists
- `protocol.protocolConfig.templateHash` differs from the current catalog template's hash (staleness detected)

Button: "Re-seed from template" → shows diff, confirms, copies template over protocol copy.

## 🧪 Testing Scenarios

| Test | What to verify |
|---|---|
| **Success flow** | Add file with template → create protocol → `cfgs/<protocol-id>.cfg` exists → launch preview shows `-config` |
| **No template** | Create protocol with files that have no template → no `-config` in launch args |
| **Multiple templates (conflict)** | Two files each with templates → first file's template is used for seeding → console log |
| **Isolation** | Create protocol A and B from same template → edit A's config in-game → B's config unchanged |
| **Auto-detection (BAT)** | Drop `.bat` with `-config MySettings.cfg` → config is hashed, copied, attached as template |
| **Export round-trip** | Export → JSON contains `configs` block → import on fresh install → `<hash>.cfg` written → protocol has `protocolConfig` |
| **Backward compatibility** | Existing protocol without `protocolConfig` → launch has no `-config` → no regression |
| **ZIP import** | ZIP with `.cfg` + mod files → config offered as template → attached on import |
| **Edit template** | Edit catalog entry, change config → hash is updated → old hash remains in `cfgs/` (orphaned, acceptable) |

## 🗺️ Future Phases (Not Implemented Here)

1. **Re-seed from template** — detect staleness, offer to overwrite protocol copy
2. **Create empty config on protocol** — generate a blank `.cfg` for protocols that have no template source
3. **UI indicator of staleness** — show in protocol list when template has been updated since protocol was created
4. **Template library** — manage config templates independently from mod files
