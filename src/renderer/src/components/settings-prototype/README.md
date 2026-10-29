# UAC settings design study

Approved direction: **revised Maintenance workbench**, incorporating the user's review of the initial three variants. The standalone files in this folder remain the original throwaway prototype. The production implementation now lives in `SettingsDialog.tsx`, `SourcePortsTab.tsx`, and `../settings/`, with the localization foundation merged into this branch and existing translation entries retained.

Run `node preview.mjs`, then open http://127.0.0.1:8347. The preview begins on Source ports so the inventory/editor behaviour can be inspected immediately. All five sections work with in-memory sample state; no launcher API, real downloads, file pickers, or settings writes are used.

## Production validation

Run `npm run build`, `npm run lint`, `npm test`, and `npm run i18n:check`. The built-renderer checks use disposable Electron profiles and fixture APIs:

- `npm run settings:smoke -- --ozone-platform=x11`: long inventories, stable default controls, draft Apply/Cancel, narrow list/editor navigation, keyboard focus, path actions, live themes, 120%/150% zoom, and partial-save recovery.
- `npm run i18n:smoke -- --ozone-platform=x11`: English, Danish, Spanish fallback, settings, onboarding, and the localized library/install flows. The check runs all three fixture locales.

Set `UAC_SETTINGS_SCREENSHOT_DIR` when running the settings check to capture its screens. Neither check reads or modifies the user's launcher configuration.

## Revision decisions

- Remove all coloured left-edge selection and information markers. Selected records use a neutral background; keyboard focus retains an accessible full outline.
- Use the same bounded list/editor layout for Source ports and Base games. Both have matching pane headers, selected-record heading, default control, fields and fixed outer footer. The inventory and editor scroll independently; adding records never pushes the editor below the list.
- At widths below 621px, selecting a record replaces the list with its editor. Back to list restores the selection and scroll position. The editor is never stacked after the inventory.
- Remove the General theme-preview panel. General uses the full content width. Choosing an example theme recolours the mockup, and Cancel restores the saved palette. The real app should retain its existing whole-app live theme preview.
- Restore consistent Lucide icon + label treatments for Scan PATH, Get port and Add port.
- Make paths Browse-first: selectable/copyable path text, Default location or Custom location status, and a visible Edit path action. Manual editing supports Enter to stage, Escape to cancel, and Use default for changed paths. No claim is made about how often real users use either input method.
- Keep the same fixed 139px × 36px default control in both states. Default is current-state feedback and cannot be unset by clicking it. Every list row reserves badge space, avoiding text reflow when the default changes.
- Preserve the established UAC identity, bundled Aldrich headings, game icons and restricted-access gag. The original three variants remain in study.html and Git history.

## Files

- `revised.html`: editable source for the current preview.
- `index.html`: self-contained rendered browser preview of revised.html.
- `study.html`: original three-variant exploration, retained as a design reference.
- `preview.mjs`: local-only server that serves index.html.

## Validation

Checked all five sections at viewport widths 1120, 736, 621, 620, 390 and 320px with no horizontal overflow or JavaScript errors. Visually inspected the General, Paths, Source ports and Base games sections. Tested long inventories (including 20 extra rows), verified both editor bounds remain unchanged during list scrolling, and measured zero geometry change in default controls and subsequent fields when changing defaults. Checked narrow detail/back scroll restoration and draft retention, manual path editing/reset, a 620px-high dialog, and live sample-theme preview/cancel.

## Implementation boundaries

This is a layout and interaction study, not production code or a complete accessibility audit. The sample has 12 engines and 14 base games, combining screenshot entries and illustrative local entries. Add, download, browse, hide and remove actions explain the intended operation but do not execute it. The CSS textarea stages text without executing arbitrary custom CSS. The scale slider stages its value without resizing the preview.

Production implementation should retain the existing shadcn/Radix Dialog focus trap, keyboard handling and focus return; integrate the current theme tokens and translations; preserve real draft/apply/cancel semantics; and distinguish immediate downloads and file operations from reversible drafts. Existing WAD-folder rescanning and its interaction with draft WAD metadata must be addressed during implementation. No direction is promoted to main by this study.
