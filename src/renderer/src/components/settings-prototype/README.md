# UAC settings design study

Three throwaway visual proposals for the existing settings modal. The question is how to give preferences, engine inventory and base-game editing a coherent layout while retaining the UAC industrial identity. No direction has been approved for implementation.

Start with `node preview.mjs`, then open http://127.0.0.1:8347. Use the bottom picker to compare Control console, Terminal refit and Maintenance workbench. All five sections work in each direction. Inputs, default selection, draft Apply/Cancel, and the restricted-access gag are local demonstrations. No launcher API or settings files are accessed.

## Recommendation

Start from **Control console**: a quiet left navigation rail, a single content surface, aligned preference rows, and matching list/detail editors for Source ports and Base games. The restrained Terminal refit is the smaller change; Maintenance workbench is better suited to a wider, dedicated configuration window.

- Use Aldrich for identity and section headings; offer the all-Aldrich treatment for comparison. Use a readable body face and monospace for paths/commands.
- Carbon `#171b1e`, panel `#20262a`, structure `#374149`, text `#edf0eb`, secondary `#a4afb6`, cyan `#48c9e9`; amber `#efb556` is reserved for pending changes and caution.
- Keep one control height/radius and aligned label/control tracks. Group ordinary settings with whitespace and separators. Use panels for editors and previews rather than every individual field.
- Call the WAD section Base games, with IWAD terminology in its description. Highlight the selected record; show the default as a labelled badge and a separate Make default action.
- Rename Advanced to Theme lab and link it directly from App theme. A later implementation could nest it under Appearance instead.
- Collapse installed FreeDoom into a secondary strip. A not-installed or downloading state would need visible acquisition/progress actions.
- Preserve core_settings, UAC branding, technical status feedback and the BLUE KEYCARD REQUIRED easter egg. Use plain names for consequential controls.

## Prototype scope and limitations

`study.html` is the editable inline source. `index.html` is the self-contained browser preview generated from it. The prototype is deliberately isolated from the Electron route and backend so all data writes, downloads and launches are inert. This is a design study, not an implementation of the settings modal or a complete accessibility audit.

The sample contains five engines and six games, rather than every entry from the screenshots. Theme CSS preview is illustrative; changing the textarea stages text but does not evaluate CSS. Browse, scan, download and add actions describe the intended next step. The records' family/version and destructive-action flows are not fleshed out. General, Paths and editor layouts are the deliverable.

Before implementing:

1. Retain Radix/shadcn Dialog and its focus trap, Escape handling and focus return. Retain accessible tab/section navigation semantics. WAI references: https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/ and https://www.w3.org/WAI/ARIA/apg/patterns/tabs/.
2. Make draft changes distinct from immediate operations. Current downloads, update checks and WAD icon relocation happen immediately; Cancel must not promise to undo those operations.
3. Resolve or explicitly disclose the existing interaction where changing WAD folder rescans on Apply and supersedes draft WAD metadata edits.
4. Use the current theme tokens and bundled fonts, not hardcoded production colours from this exploration. Keep live theme/scale preview and revert-on-close behaviour.
5. Support a bounded dialog with a fixed footer and one content scroll region in the actual Electron viewport. The conversation preview grows naturally so every section can be inspected.
6. Check the largest supported UI scale, keyboard operation, contrast, long paths/names and translations before shipping. This branch does not alter the app's translation setup.

## Validation

Checked all 15 variant/section combinations at 1140, 736, 390 and 320px viewport widths in Chromium, with no detected horizontal overflow or JavaScript errors. Verified draft state, Apply enabled state, Cancel reset and independent default selection. Visually inspected the desktop layouts. No production sources changed; the app's build/test suite was not required for this standalone prototype.
