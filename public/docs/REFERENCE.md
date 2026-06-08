# UI Reference Screenshots

These files are the durable UI reference artifacts for the current redesign pass.

## Recovered Generated Mockups

These mockups were recovered from the Codex generated-image cache for this thread and copied into the repository so fidelity work has a stable source of truth.

| File | Role | Size | SHA-256 |
| --- | --- | --- | --- |
| `mockups/desktop-right-settings.png` | Active desktop mockup: preview and Tenor on the left, render settings rail on the right | `1254x1254` | `f9d985d1132c10ea44ceb6ca0733bb4b736248573e7ae19817974e53fa402d27` |
| `mockups/mobile-editor.png` | Active mobile mockup: preview-first editor with in-flow settings and bottom action bar | `853x1844` | `0b354fb80562f0ca7cc9421f4092833fe7fed2f3e002ac5e59c6b01a1db0d78a` |
| `mockups/desktop-three-column.png` | Superseded desktop concept: preserved for history, not the active desktop target | `1586x992` | `a6c6e53e82b1a1340326f835f9b266a358a37064f5a549b66f49ffabea8105f7` |

## Current Pinned References

These are implementation captures used to catch accidental drift while the app is being brought closer to the active mockups above.

| File | State | Size | SHA-256 |
| --- | --- | --- | --- |
| `hero.png` | Loaded editor preview with right settings rail, using the active desktop mockup as deterministic local input | `1728x963` | `35bd740d6f3615982cb0ad9b6973539be2b0531fcddddde5b2d3bc43ef29b7e1` |
| `upload.png` | Idle upload/search view with right settings rail | `1728x963` | `44d34bef6104e2aa0394cefd7d5f6867aac145e0d4be842197b695f1d8bb7e16` |

The `tests/uiFidelity.test.ts` suite pins these files by dimension and SHA-256 hash. Update the hashes only after explicit visual signoff.

## Rendered Comparison Audit

Use the native reference viewport when comparing a fresh headless/browser screenshot against a pinned reference:

```bash
npm run audit:ui-reference -- public/docs/upload.png /path/to/live-upload.png --ignore=33,776,1210,187 --threshold=0.15 --max-changed-ratio=0.005 --max-changed-bounds-ratio=0.1 --min-bounds-changed-ratio=0.00005 --diff-output=/tmp/gif2ascii-ui-diff.png
```

The ignored region covers live Tenor result thumbnails, which are dynamic. The Invert toggle is intentionally not ignored because toggle affordances should directly indicate their backing state. The audit still compares the header, preset bar, upload panel, URL input, Tenor search field, and settings rail.
When `--diff-output` is provided, changed pixels are highlighted in red and ignored regions are tinted blue. The JSON output includes `changedBounds`, which should stay small and localized for acceptable screenshot antialiasing or focus-state variance. The ratio gates allow at most `0.005` of compared pixels to differ by more than two RGB levels, and the changed-bounds rectangle may cover at most `0.1` of the compared area once at least `0.00005` of compared pixels have changed.

The idle upload surface is expected to use the visible border token for both the rounded border and dot-grid color; this matches the `rgb(51, 51, 51)` border pixels in `upload.png`.

The pinned screenshots are wide desktop references only. The `769px-1199px` tablet breakpoint intentionally uses a preview-first stacked editor: canvas, render settings, then Tenor search. That breakpoint should not preserve the cramped side-rail grid from the wide desktop reference.

On phones, Search remains a fixed bottom drawer, but Settings is an in-flow editing panel under a sticky preview. Opening Settings must not lock body scroll or cover the preview; the user should be able to adjust output while keeping the generated ASCII visible. The app shell owns bottom action-bar clearance, so the settings panel should not add duplicate bottom padding that sits under the fixed action bar.

Toggle affordances should directly indicate their backing state. In particular, the Invert control is visually on and `aria-pressed="true"` only when `cfg.invert` is true; it must not display the converse state.

Runtime must not depend on seeded Tenor mock files. The active mockups show loaded media, but production/local runtime should rely on user uploads, pasted URLs, or Tenor results rather than committed demo GIF assets.
