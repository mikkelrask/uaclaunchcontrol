# Localisation: first desktop pilot (issue #78)

The desktop renderer uses Tolgee React with ICU messages and **eager, committed JSON
catalogs**. Normal builds and released applications need no Tolgee account, API key
or translation network connection. The Electron sandbox and production CSP stay
unchanged. This is the first desktop pilot, not the completion of issue #78.

## What is translated

The settings dialog (General, Paths, WAD configuration and custom-theme help),
source-port management/downloads, keyboard shortcuts, header/navigation/drawer,
sidebar loading/accessibility text, complete guided setup, and the library and
installation flows now use **784 English source keys in this branch**. The fourth batch adds 390
messages covering all three library views, protocol settings/delete/discard dialogs,
installation/configuration/WAD tabs, archive/JSON/batch imports, the shared mod
catalog, file selectors, validation, status descriptions and shared controls.
The fifth batch adds 89 English messages for all 23 achievement titles/descriptions,
rank titles, operator profile/category/stat labels, unlock notifications and the
notification tray. Display text resolves at call time; achievement IDs, conditions,
hidden goals, rank grants and persisted player data remain unchanged.

The maintainer's 154 bundled Danish translations are preserved. At the maintainer's
request, this fifth batch also bundles 89 Danish drafts for review, giving 243 local
Danish entries before the sixth batch. Missing older messages still fall back to English. Spanish is
unchanged. The 89 new English messages and translator notes are uploaded to Tolgee.
The initial combined English/Danish import was rejected with
`plan_translation_limit_exceeded` under the legacy plan; the English-only import
succeeded. After the account migration on 2026-10-30, all 89 Danish drafts were
uploaded successfully, filling only missing entries. Existing translations were
verified unchanged.
Existing remote English, Danish and Spanish entries were compared before/after and
preserved; other branches' keys were retained.

The sixth batch adds 38 English messages and 38 Danish drafts for update dialogs,
update notifications/actions, mod download cards, progress, cancellation, known
browser fallbacks and archive-scan notices. These are uploaded to Tolgee; the local
Danish catalog now contains 281 entries. Release-note Markdown, release versions,
filenames, download URLs, raw diagnostics and IPC identifiers remain unchanged.
The Danish achievement title `Knee Deep` is preserved in English because it refers
to `Knee Deep in the Dead`; a translator note records the reference.

The seventh batch adds 37 English messages and 37 Danish drafts for crash logs,
heuristic crash hints, recovery errors, WAD watcher notices, About text, missing
pages and shared pagination. They are uploaded with translator notes. The local
Danish catalog now has 318 entries. Engine-log matching patterns, raw console
snapshots and copied log text remain unchanged; the crash dialog and notification
resolve their presentation in the active language.

The eighth batch adds 13 English keys and 13 Danish drafts for the remaining
90 diagnostic toast headings, renderer-owned API error fallbacks, notification
accessibility text and game-icon descriptions. Shared heading templates preserve
diagnostic tokens such as `archive_scan_failed` and `settings.save()` unchanged.
Game/episode titles and native picker payloads remain canonical. The local Danish
catalog now contains 331 entries. The additive Tolgee upload retains all previous
translations and key metadata; the shared desktop namespace has 874 English keys,
including keys from another branch.

A final source audit reviewed JSX text, accessible labels, placeholders, dialog
options, toast messages and renderer-created errors, including short labels and
icons. No further ordinary hardcoded desktop UI text was found. Remaining literals
are proper names/autonyms, format names and units, command examples, raw server or
engine diagnostics, logging/developer errors and legacy history matching. The old
English date/playtime helpers in `lib/utils.ts` and sidecar explanation constant
have no callers; active screens use the translated replacements. This is source
coverage, not translation completeness or a guarantee that no runtime edge case
remains. The public/embedded registry and release QA remain pending; startup language
choice is implemented below.

Source-port scan counts use ICU plurals; custom-theme instructions use named React
placeholders so translators can move complete code examples and links without
changing their contents. Download dates and sizes follow the selected UI locale.
Native file-picker filter labels are marked; paths, source-port family values,
executable names, commands, CSS examples and shortcut bindings remain unchanged.

The public/embedded registry still needs migration. Native picker titles and filter
labels supplied by the renderer are marked; OS-owned picker chrome follows the
platform. The app does not yet pass its language to the registry iframe. Registry descriptions are separate
database content, as described in #78.

Achievement/rank/update/warning toasts now carry stable `historyKind` metadata through the toast
adapter. Notification history uses this metadata to record their translated titles,
while retaining legacy English-title matching for older/unmigrated callers. Existing
saved history and replay actions are kept as rendered snapshots; switching languages
does not rewrite old entries. Diagnostic headings resolve their language when the event occurs; diagnostic codes
are not translated. Error and routine toasts retain their original variants and
history eligibility. Warning callers use explicit metadata rather than English headings.

## Language behaviour

Settings → General → Language offers System language, English and Dansk.
Spanish is temporarily hidden from frontend choices and system-language detection
until reviewed by a Spanish speaker. Its Tolgee project language, bundled catalog
and stored tag remain valid. A previously saved Spanish preference displays English;
applying Settings normalizes that hidden choice to English.

When settings have no valid language preference, startup stays in English and shows
a language-choice dialog before mounting either the shell or first-run guided setup.
English is selected initially. The user can explicitly keep English, follow System
language (with the supported language shown), or choose Dansk. Continue saves only
the language field, switches the interface and refreshes the settings cache. A save
failure stays in the dialog with a retryable error. Escape and outside clicks do not
silently dismiss the decision. Existing saved choices, including System, skip it.
The first-run sentinel is independent; choosing a language never dismisses setup.

Settings Apply Changes saves and switches language without a restart; Abort leaves
the active/saved language unchanged. Explicit System preferences negotiate supported
browser/device languages and fall back to English. Missing translations also fall
back to English. New and old settings retain an absent language field until a choice
is saved; invalid stored values are treated as unset without rewriting the file on
read, and invalid language writes are rejected. Unrelated partial settings updates
preserve the absence, so they cannot accidentally suppress the startup chooser.

Canonical tags match the existing Tolgee project: `en`, `da-DK`, `es-ES`. Regional
system preferences such as `da` and `da-DK` resolve to Danish; unsupported locales
(including Spanish while it is hidden) fall back to English when no published
preference matches.
The HTML document language follows the selected language.

## Translator workflow

[UAC Launch Control in Tolgee](https://app.tolgee.io/projects/36113/translations)
uses the `desktop` namespace. Namespaces must be enabled in project settings. The
future registry repository owns a separate `registry` namespace in the same project.
English is the base language. The Danish catalog contains the maintainer's
translations for the first 154 messages; synchronization does not generate translations
or change their review state. The fifth batch has additional Danish drafts bundled
locally and available in Tolgee for review, as noted above.
Each migrated key has a translator description in Tolgee, including placeholder context.

For contributors who synchronise catalogs, copy `.env.example` to `.env` and supply
a **project API key**. `TOLGEE_API_KEY` is standard; `TOLGEE_API_TOKEN` is accepted as
an alias. Neither belongs in a Vite-prefixed variable. `.env` is ignored, and the
Node tooling passes the credential to the CLI through its environment, not argv.
Node 22 or newer matches the release workflow.

```sh
npm run i18n:extract   # print marked messages and their source locations; offline
npm run i18n:check     # extraction warnings; offline
npm run i18n:compare   # compare source key inventory to Tolgee; read-only
npm run i18n:push      # upload only English desktop strings; no deletion or forced conflicts
npm run i18n:pull      # export desktop en/da-DK/es-ES catalogs for review in Git
npm test              # source defaults, ICU syntax/placeholders, fallback and storage tests
npm run build         # typecheck and bundle local translations; does not pull Tolgee edits
npm run i18n:smoke    # isolated built-renderer Electron test; needs a display
```

Push is deliberately `NO_FORCE`: conflicting English edits fail instead of silently
overwriting translators' work. Resolve those conflicts deliberately in Tolgee, then
export and review. Pull includes translated and reviewed entries (the CLI default);
it does not machine-translate or approve translations. Empty Spanish data is valid.
Review the catalog diff and run tests before committing an export. The normal build
never pulls from the service, so a server-side edit cannot change an existing release.

The CLI has an upstream empty-project edge case in `compare` (it expects an embedded
key list); the initial additive import works, and comparison works after that import.
Do not add deletion flags such as `sync --remove-unused` or `push --remove-other-keys`.
One repository is not a complete inventory of the shared Tolgee project. When the
shared project has newer English edits or other branches' keys, upload only the new
batch using a temporary `{namespace}/{languageTag}.json` file template and
`NO_FORCE`; preserve existing remote wording and keys. A full export may contain
messages this branch does not yet use. Review language catalogs against the current
branch's English keys before copying an export into the application.

## Adding messages

Use stable semantic keys with complete English defaults, e.g.
`const { t } = useTranslate('desktop')`, then
`t('settings.icon.moved', 'Icon moved to {path}', { path })`.
Use `<T ns="desktop" keyName="..." defaultValue="..." />` for React rich text.
Outside React, use `const { t } = getTranslate('desktop')` from `@/lib/i18n` at call
time. Schema errors use lazy callbacks so switching languages does not freeze the
validation text. Existing visible install errors are revalidated after a language change.
Library dates and playtime follow the selected locale. Catalog category and column
labels are translated only for display; canonical identifiers and custom tags stay intact.
A `{br}` parameter is a React line break; preserve it, but move it when natural.
Translate full sentences; keep placeholders such as `{path}`, `{names}` and ICU
plural variables intact. `#` inside a plural is the locale-formatted number.

Add the English entry to `src/renderer/src/lib/i18n/locales/desktop/en.json`, and add
reviewed translations to the matching language catalogs. Missing translations can
be omitted. The source-catalog test checks the migrated components' marked defaults
against English across the whole renderer. The
CLI extracts marked SDK calls, not arbitrary hardcoded English: migrating a new
screen requires reviewing and replacing its text, accessibility labels and states.

Keep mod names, user content, IDs, hashes, paths, source-port slugs, CLI arguments,
URLs and import/export fields unchanged. Achievement/rank display text lives in `lib/achievements/messages.ts` and resolves
at display time. Add matching entries there when adding achievement definitions.
Crash text also resolves at display time. Do not translate crash-log matching expressions.

## Short glossary and voice

- **Protocol**: a named launch configuration (base WAD, source port and mod load order),
  not a network protocol. Danish draft term: _protokol_.
- **Source port**: a Doom-compatible engine executable. Danish draft: _spilmotor_.
- **IWAD / WAD / PK3**: keep these file-format names and extensions.
- **Mod family**: versions of the same mod grouped in the registry.
- **Registry**: the public UAC mod/protocol catalog; Danish draft: _register_.
- **UAC voice**: concise fictional terminal/corporate language. Preserve proper names
  such as UAC, Phobos, MAYKR, FreeDoom and Plutonia; translate surrounding explanation.
- **Doom references**: keep established game/episode titles, character names and
  intentional references in their original form. `Knee Deep` references
  `Knee Deep in the Dead`; a literal Danish rendering loses the reference. When
  uncertain, preserve the name and ask the maintainer rather than inventing a title.

## Remaining pilot checks

A full registry detail-page pilot, in-context browser translator preview and a
complete translated layout review remain separate steps. No editing tools or
credentials are shipped in this foundation. Use the Tolgee platform editor and
reviewed local exports as the initial translator workflow.

The dependency-audit test currently fails on high-severity advisories already present
in the original checkout (including Electron/Jimp dependency chains). Keep that gate
visible; this change does not exempt or suppress advisories.

## Compatibility verification

The Electron smoke fixture uses the production renderer/preload, sandbox and strict
CSP, a disposable profile, and intercepted localhost API responses. External HTTP(S)
is blocked. It checks all settings tabs, source-port scan/release fixtures, keyboard shortcuts,
rich text, all five onboarding screens and their boot sequence, all three library
views, the protocol editor and cancellation of deletion, installation tabs/form
validation, catalog editing, all achievement category labels/hidden placeholders,
the notification tray, translated update dialogs/actions/history, download
progress/cancellation/fallbacks, crash replay and raw-log copying with a fixture
clipboard, WAD watcher/About/missing-page text, Danish drafts, and English fallback for untranslated messages. Expected translated labels come from the catalogs so wording edits do not
require rewriting the tests. It does not start the backend or touch real application data.

On Linux/Xwayland, run `npm run i18n:smoke -- --ozone-platform=x11` if needed. To test
the renderer inside a Linux directory package, run `npx electron-builder --dir
--publish never`, then set `UAC_I18N_RENDERER` to the absolute
`dist/linux-unpacked/resources/app.asar/out/renderer/index.html` path when running
the smoke test. `UAC_I18N_SCREENSHOT` optionally selects a Danish settings PNG path.

Verified for this pilot: build and Linux directory packaging, actual asar renderer
loading in all three languages under file:// with no external requests/CSP errors,
and no API key or Tolgee editing-tools chunk in the renderer output. Unit tests
cover saved settings round trips, invalid preferences, browser language detection,
fallback, ICU/plural validation and escaping, and React line-break placeholders.
273 tests pass; the existing dependency-audit test fails as described above. Windows
and macOS packaging and a full translated layout pass remain follow-up QA.

The third batch also validates a completion sentence with independent source-port
and WAD counts. Tolgee exports it as nested ICU plurals; source defaults and the
committed English catalog use that canonical form. Preserve both count variables,
all plural branches and the scope of `#` while translating. Onboarding's registry
opt-in, persistence, download URLs, file paths, engine slugs and animation timings
are unchanged. Boot/HUD strings resolve during rendering so language changes do
not leave English cached in module-level arrays.

The fourth batch also checks runtime-language validation, category/column identifiers,
unchanged launch commands and schema payloads, and locale-aware library dates/playtime.
English uploads are additive, with translator descriptions for all new keys. The
remote Danish catalog is compared before/after uploading; the local Danish and
Spanish catalogs remain untouched. No new application-data migrations are needed.

The fifth batch adds regression coverage for language changes without altering
achievement unlock decisions, hidden achievement/compound-condition secrecy,
translated rank/unlock toast history through the real toast adapter, unchanged legacy
history/actions, and locale-aware progress/time formatting. A disposable Electron
screenshot confirms Danish profile/category labels fit the existing layout.

The sixth batch records update history with `historyKind: 'update'`, retaining
legacy callers and the previous quiet/manual-check behavior. Download events add
optional phase/reason metadata for localized presentation without parsing backend
English. Unrecognized legacy events preserve their original text/details. Progress
updates retain the selected release version and release notes. The smoke test
uses mocked install/download/cancel IPC handlers; no actual update or mod transfer
runs, and system-installed builds retain their GitHub-only update behavior.

The seventh batch adds checks for all crash-hint rule outcomes under Danish,
language changes at display time, preserved protocol/exit/log data, escaped raw
error details, the critical fallback without React translation context, and caller
accessibility overrides on pagination. The About/missing-page text is user-facing;
raw engine diagnostics and game/product names remain original data.

The eighth batch verifies language changes for diagnostic severities, untranslated
server error details and canonical API paths, warning history through the real toast
adapter, unchanged game titles/custom icon paths, and notification accessibility
labels with Radix hotkeys and caller overrides. The Electron fixture triggers an
actual catalog validation warning and verifies its translated heading/history,
notification region and close button in all three languages.

The ninth batch adds seven English messages and seven Danish drafts for startup
language selection (784 English keys and 338 Danish entries locally). It verifies
fresh/old/invalid settings, explicit English/System/Dansk choices, partial-update
persistence, hidden Spanish data compatibility, and initial English independently of
the device locale. The production Electron fixture checks the dialog before guided
setup, save failure/retry, unchanged unrelated settings, persistence across reloads,
legacy Spanish fallback and the published options in Settings. Current frontend
smokes cover English and Danish; Spanish catalog fallback remains unit-tested.
