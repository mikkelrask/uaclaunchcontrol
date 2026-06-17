# E1M1 — Development Plan

**Release**: E1M1 (v1.0.0)
**Post-E1M1**: #19 — Add to Steam

---

## What's Already On Main (Ready To Ship)

Everything below is implemented on `main` and just needs to be merged into `production` for the next release.

| Issue | Feature | Status |
|-------|---------|--------|
| #12 | Sort options: Last Played, Playtime, A–Z, Created with direction toggle | ✅ Done |
| #22 | Mod file categories (`total_conversion`, `expansion`, `weapon`, etc.) in dialogs + sortable data table | ✅ Done |
| #38 | Download GZDoom/UZDoom/Helion from within the app via Github releases | ✅ Done |
| #43 | Config template per mod file — link a `settings.cfg`, auto `-config` on launch, per-protocol isolated copies | ✅ Done |

---

## Feature: Extended Search (#37 + #44 + #45)

### Current State

Search filters protocols by title/name only — client-side filter on the frontend. The app already integrates with the UAC Registry for hash-based mod lookup (`lookupMod`) and submission (`submitToPending`), but has no search-by-name.

### Three Phases

#### Phase 1 — Deep Search (server-side)

~55 lines across 2 files.

**Backend** (`src/main/server/routes.ts`):

1. Enhance protocol search to also match `description` and mod file names:

```typescript
if (search && typeof search === 'string') {
  const q = search.toLowerCase()
  protocols = protocols.filter((p) => {
    if ((p.title || p.name || '').toLowerCase().includes(q)) return true
    if ((p.description || '').toLowerCase().includes(q)) return true
    if (p.files?.some(f =>
      (f.name || f.fileName || '').toLowerCase().includes(q)
    )) return true
    return false
  })
}
```

2. New catalogue search route:

```typescript
app.get('/api/mod-files/catalog/search', async (req, res) => {
  const { q } = req.query
  if (!q || typeof q !== 'string') return res.json([])
  const catalog = await storage.getModFileCatalog()
  const query = q.toLowerCase()
  const results = catalog.filter(f =>
    (f.name || f.fileName || '').toLowerCase().includes(query)
  )
  return res.json(results)
})
```

**Frontend** (`GamesPage.tsx`):
- Parallel query to catalogue search when `searchQuery` is non-empty
- Split results into "Protocols" and "Mod Files in Catalogue" sections
- Catalogue hits get "Add to Protocol" / "Create Protocol" actions

#### Phase 2 — UAC Registry Search (#45)

Search the UAC Registry (`https://db.uac-soft.online`) by mod name. If the Registry server has a search endpoint (`/mod/search?q=X`), proxy through backend. Otherwise batch-lookup known hashes from catalogue against registry data.

Display results in "UAC Registry" section with mod name, description, download links.

#### Phase 3 — idgames Archive Search (#44)

Proxy idgames API: `GET https://www.doomworld.com/idgames/api/api.php?action=search&query=X&type=name`

Results in "idgames Archive" section with filename, description, author. Download option fetches from idgames mirror → user's mods directory.

### Search Results Layout

```
Search: "dragon"
─────────────────────────────────
Protocols (2 matches)          ← Phase 1
  ─ Dragon Sector ────────── Launch
  ─ Co-op Session (from mod file)

Mod Files in Catalogue (3)     ← Phase 1
  ─ dragon_sector_v2.pk3 ── Add to Protocol…

UAC Registry (1 match)         ← Phase 2
  ─ Dragon Sector ────────── Go to Download

idgames Archive (5 matches)    ← Phase 3
  ─ dragon_sector-v1.0.zip ── Download
```

### Files Changed

| File | Change |
|------|--------|
| `src/main/server/routes.ts` | ~25 lines — enhanced protocol search + catalogue search route |
| `src/main/server/services/gameService.ts` | Optionally: add search methods |
| `src/renderer/src/pages/GamesPage.tsx` | ~40 lines — parallel catalogue query, grouped rendering |
| (new) `src/renderer/src/components/SearchResults.tsx` | Grouped results component |

---

## Release Process

1. Merge `main` into `production`
2. `./scripts/bump-version.mjs 1.0.0`
3. Tag `v1.0.0` → triggers `build.yml` → draft release
4. Publish release

### Issue Tracker State

```
E1M1 milestone:
  #12 ✅ done (closed)
  #22 ✅ done (closed)
  #38 ✅ done (closed)
  #43 ✅ done (closed)
  #37  🚧 Extended Search (parent)
  #44  🚧 idgames Archive (nested under #37)
  #45  🚧 UAC Registry (nested under #37)

Post-E1M1:
  #19  📌 Add to Steam
```
