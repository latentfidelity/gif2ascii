import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();

const read = (relativePath: string): string => (
  readFileSync(path.join(root, relativePath), 'utf8')
);

const countMatches = (value: string, pattern: RegExp): number => (
  value.match(pattern)?.length ?? 0
);

const pngDimensions = (relativePath: string): { width: number; height: number } => {
  const buffer = readFileSync(path.join(root, relativePath));
  assert.equal(buffer.toString('ascii', 1, 4), 'PNG', `${relativePath} must be a PNG`);
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
};

const sha256 = (relativePath: string): string => (
  createHash('sha256').update(readFileSync(path.join(root, relativePath))).digest('hex')
);

const referenceHashes = {
  hero: '35bd740d6f3615982cb0ad9b6973539be2b0531fcddddde5b2d3bc43ef29b7e1',
  upload: '44d34bef6104e2aa0394cefd7d5f6867aac145e0d4be842197b695f1d8bb7e16',
  mockupDesktopRightSettings: 'f9d985d1132c10ea44ceb6ca0733bb4b736248573e7ae19817974e53fa402d27',
  mockupDesktopThreeColumn: 'a6c6e53e82b1a1340326f835f9b266a358a37064f5a549b66f49ffabea8105f7',
  mockupMobileEditor: '0b354fb80562f0ca7cc9421f4092833fe7fed2f3e002ac5e59c6b01a1db0d78a',
} as const;

test('desktop layout puts Tenor in the selection rail and settings in the editor flow', () => {
  const app = read('App.tsx');
  const css = read('index.css');
  const editorLiveUpdate = app.slice(
    app.indexOf('const updateLayoutEditorSplitFromClientX'),
    app.indexOf('const updateLayoutPreviewSplitFromClientY')
  );
  const previewLiveUpdate = app.slice(
    app.indexOf('const updateLayoutPreviewSplitFromClientY'),
    app.indexOf('const updateSettingsPanelSplitFromClientX')
  );
  const settingsLiveUpdate = app.slice(
    app.indexOf('const updateSettingsPanelSplitFromClientX'),
    app.indexOf('const handleSettingsPanelResizePointerDown')
  );

  assert.equal(
    countMatches(css, /@media \(min-width: 1200px\)/g),
    1,
    'only one wide-desktop block should own desktop layout'
  );
  assert.match(css, /grid-template-areas:\s*"canvas editor-tenor-resizer tenor"\s*"preview-settings-resizer editor-tenor-resizer tenor"\s*"controls editor-tenor-resizer tenor";/);
  assert.match(css, /grid-template-columns:\s*minmax\(0,\s*var\(--layout-editor-panel\)\)\s+10px\s+minmax\(320px,\s*var\(--layout-tenor-panel\)\);/);
  assert.match(css, /html\s*\{[\s\S]*?overflow:\s*hidden;/);
  assert.match(css, /body\s*\{[\s\S]*?overflow:\s*hidden;/);
  assert.match(css, /\.app-shell\s*\{[\s\S]*?height:\s*100dvh;[\s\S]*?overflow:\s*hidden;/);
  assert.match(css, /@media \(min-width: 1200px\) \{[\s\S]*?\.app-main\s*\{[\s\S]*?row-gap:\s*0;/);
  assert.match(css, /@media \(min-width: 1200px\) \{[\s\S]*?\.app-main\s*\{[\s\S]*?column-gap:\s*0;/);
  assert.match(css, /@media \(min-width: 1200px\) \{[\s\S]*?\.app-main\s*\{[\s\S]*?grid-template-rows:\s*minmax\(0,\s*var\(--layout-preview-panel\)\)\s+10px\s+minmax\(0,\s*var\(--layout-settings-panel\)\);[\s\S]*?height:\s*calc\(100dvh - 78px\);[\s\S]*?overflow:\s*hidden;/);
  assert.match(css, /\.col-canvas,\s*\.col-controls\s*\{[\s\S]*?padding-left:\s*27px;[\s\S]*?padding-right:\s*0;/);
  assert.match(css, /@media \(min-width: 1200px\) \{[\s\S]*?\.card--canvas\s*\{[\s\S]*?height:\s*100%;[\s\S]*?min-height:\s*0;/);
  assert.match(css, /\.card--canvas \.player\s*\{[\s\S]*?height:\s*auto;[\s\S]*?max-height:\s*clamp\(320px,\s*calc\(100dvh - 520px\),\s*460px\);/);
  assert.match(css, /@media \(min-width: 1200px\) \{[\s\S]*?\.col-tenor\s*\{[\s\S]*?position:\s*sticky;[\s\S]*?height:\s*calc\(100dvh - 78px\);[\s\S]*?padding:\s*0 26px 0 0;/);
  assert.match(css, /@media \(min-width: 1200px\) \{[\s\S]*?\.card--tenor\s*\{[\s\S]*?height:\s*100%;[\s\S]*?max-height:\s*none !important;[\s\S]*?border:\s*1px solid var\(--border-visible\);[\s\S]*?border-radius:\s*var\(--radius-md\);/);
  assert.match(css, /@media \(min-width: 1200px\) \{[\s\S]*?\.col-controls \.card\s*\{[\s\S]*?padding:\s*12px 16px 14px;[\s\S]*?border:\s*1px solid var\(--border-visible\);/);
  assert.match(css, /@media \(min-width: 1200px\) \{[\s\S]*?\.col-controls \.card\s*\{[\s\S]*?height:\s*100%;[\s\S]*?overflow-y:\s*auto;[\s\S]*?overscroll-behavior:\s*contain;/);
  assert.match(css, /@media \(min-width: 1200px\) \{[\s\S]*?\.settings-panel-grid\s*\{[\s\S]*?display:\s*grid;[\s\S]*?grid-template-columns:\s*minmax\(0,\s*var\(--settings-render-panel\)\)\s+10px\s+minmax\(0,\s*var\(--settings-image-panel\)\);[\s\S]*?height:\s*100%;[\s\S]*?overflow:\s*hidden;/);
  assert.match(app, /const LAYOUT_EDITOR_SPLIT_STORAGE_KEY = 'gif2ascii-layout-editor-split';/);
  assert.match(app, /const LAYOUT_PREVIEW_SPLIT_STORAGE_KEY = 'gif2ascii-layout-preview-split';/);
  assert.match(app, /className="layout-resizer layout-resizer--preview-settings"[\s\S]*?aria-orientation="horizontal"[\s\S]*?onPointerDown=\{handleLayoutPreviewResizePointerDown\}/);
  assert.match(app, /className="layout-resizer layout-resizer--editor-tenor"[\s\S]*?aria-orientation="vertical"[\s\S]*?onPointerDown=\{handleLayoutEditorResizePointerDown\}/);
  assert.match(app, /className="layout-resizer layout-resizer--intersection"[\s\S]*?aria-label="Resize intersecting layout panels"[\s\S]*?onPointerDown=\{handleLayoutIntersectionResizePointerDown\}[\s\S]*?onKeyDown=\{handleLayoutIntersectionResizeKeyDown\}/);
  assert.match(app, /document\.body\.classList\.add\('layout-panels-resizing-both'\);[\s\S]*?updateLayoutEditorSplitFromClientX\(moveEvent\.clientX\);[\s\S]*?updateLayoutPreviewSplitFromClientY\(moveEvent\.clientY\);/);
  assert.match(app, /'--settings-split-position': `\$\{settingsPanelSplit\}%`,/);
  assert.match(app, /className="layout-resizer layout-resizer--settings-intersection"[\s\S]*?aria-label="Resize preview and bottom settings panels"[\s\S]*?onPointerDown=\{handleSettingsLayoutIntersectionResizePointerDown\}[\s\S]*?onKeyDown=\{handleSettingsLayoutIntersectionResizeKeyDown\}/);
  assert.match(app, /document\.body\.classList\.add\('layout-settings-panels-resizing-both'\);[\s\S]*?updateSettingsPanelSplitFromClientX\(moveEvent\.clientX\);[\s\S]*?updateLayoutPreviewSplitFromClientY\(moveEvent\.clientY\);/);
  assert.match(app, /const applyLayoutEditorSplit = useCallback[\s\S]*?appMain\.style\.setProperty\('--layout-editor-panel'/);
  assert.match(app, /const applyLayoutPreviewSplit = useCallback[\s\S]*?appMain\.style\.setProperty\('--layout-preview-panel'/);
  assert.match(app, /const applySettingsPanelSplit = useCallback[\s\S]*?settingsGrid\.style\.setProperty\('--settings-render-panel'/);
  assert.doesNotMatch(editorLiveUpdate, /setLayoutEditorSplit\(/);
  assert.doesNotMatch(previewLiveUpdate, /setLayoutPreviewSplit\(/);
  assert.doesNotMatch(settingsLiveUpdate, /setSettingsPanelSplit\(/);
  assert.match(css, /@media \(min-width: 1200px\) \{[\s\S]*?\.layout-resizer--editor-tenor\s*\{[\s\S]*?grid-area:\s*editor-tenor-resizer;[\s\S]*?cursor:\s*col-resize;/);
  assert.match(css, /@media \(min-width: 1200px\) \{[\s\S]*?\.layout-resizer--preview-settings\s*\{[\s\S]*?grid-area:\s*preview-settings-resizer;[\s\S]*?cursor:\s*row-resize;/);
  assert.match(css, /@media \(min-width: 1200px\) \{[\s\S]*?\.layout-resizer--intersection\s*\{[\s\S]*?grid-column:\s*2;[\s\S]*?grid-row:\s*2;[\s\S]*?cursor:\s*move;/);
  assert.match(css, /@media \(min-width: 1200px\) \{[\s\S]*?\.layout-resizer--settings-intersection\s*\{[\s\S]*?left:\s*var\(--settings-split-position\);[\s\S]*?cursor:\s*move;/);
  assert.match(css, /body\.layout-panels-resizing-both,\s*body\.layout-panels-resizing-both \*\s*\{[\s\S]*?cursor:\s*move !important;[\s\S]*?user-select:\s*none;/);
  assert.match(css, /body\.layout-settings-panels-resizing-both,\s*body\.layout-settings-panels-resizing-both \*\s*\{[\s\S]*?cursor:\s*move !important;[\s\S]*?user-select:\s*none;/);
  assert.match(css, /\.app-main\s*\{[\s\S]*?--resizer-hover:\s*color-mix\(in srgb,\s*var\(--border-visible\) 42%,\s*var\(--text-display\)\);/);
  assert.match(css, /\.layout-resizer:hover \.layout-resizer__line,[\s\S]*?\.layout-resizer:focus-visible \.layout-resizer__line\s*\{[\s\S]*?background:\s*var\(--resizer-hover\);/);
  assert.match(app, /className="settings-panel-grid"/);
  assert.match(app, /const SETTINGS_PANEL_SPLIT_STORAGE_KEY = 'gif2ascii-settings-panel-split';/);
  assert.match(app, /const SETTINGS_PANEL_SPLIT_MIN = 30;/);
  assert.match(app, /const SETTINGS_PANEL_SPLIT_MAX = 70;/);
  assert.match(app, /onPointerDown=\{handleSettingsPanelResizePointerDown\}/);
  assert.match(app, /onKeyDown=\{handleSettingsPanelResizeKeyDown\}/);
  assert.match(app, /role="separator"[\s\S]*?aria-orientation="vertical"[\s\S]*?aria-valuenow=\{settingsPanelSplit\}/);
  assert.match(css, /\.settings-panel-resizer\s*\{[\s\S]*?display:\s*none;/);
  assert.match(css, /@media \(min-width: 769px\) \{[\s\S]*?\.settings-panel-resizer\s*\{[\s\S]*?display:\s*flex;[\s\S]*?cursor:\s*col-resize;[\s\S]*?touch-action:\s*none;/);
  assert.match(css, /\.settings-panel-resizer:hover \.settings-panel-resizer__line,[\s\S]*?\.settings-panel-resizer:focus-visible \.settings-panel-resizer__line\s*\{[\s\S]*?background:\s*var\(--resizer-hover\);/);
  assert.match(css, /body\.settings-panels-resizing,\s*body\.settings-panels-resizing \*\s*\{[\s\S]*?cursor:\s*col-resize !important;[\s\S]*?user-select:\s*none;/);
  assert.match(app, /className="card settings-card settings-card--render"[\s\S]*?Render Settings/);
  assert.match(app, /className="card settings-card settings-card--image"[\s\S]*?Image &amp; Effects/);
  assert.match(css, /@media \(min-width: 1200px\) \{[\s\S]*?\.settings-header\s*\{[\s\S]*?margin-bottom:\s*0;/);
  assert.match(css, /\.settings-header__title\s*\{[\s\S]*?display:\s*inline-block;[\s\S]*?font-size:\s*16px;[\s\S]*?transform:\s*translateY\(-3px\);/);
  assert.match(css, /\.settings-header__reset\s*\{[\s\S]*?color:\s*var\(--accent\);[\s\S]*?letter-spacing:\s*0;/);
  assert.match(css, /\.settings-header__reset\s*\{[\s\S]*?margin-right:\s*6px;[\s\S]*?transform:\s*translateY\(-3px\);/);
  assert.match(css, /--settings-panel-bg:[\s\S]*?rgba\(255,\s*255,\s*255,\s*0\.038\)[\s\S]*?#101010;/);
  assert.match(css, /@media \(min-width: 1200px\) \{[\s\S]*?\.tenor__results\s*\{\s*padding-top:\s*7px;/);
  assert.match(css, /@media \(min-width: 1200px\) \{[\s\S]*?\.tenor__grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(auto-fill,\s*minmax\(72px,\s*1fr\)\);[\s\S]*?gap:\s*8px;/);
  assert.match(css, /@media \(min-width: 1200px\) \{[\s\S]*?\.section-body\s*\{[\s\S]*?padding:\s*5px 0 0;/);
  assert.match(css, /\.section-panel--output \.section-body\s*\{\s*padding-bottom:\s*12px;/);
  assert.match(css, /\.section-panel--colors \.section-body\s*\{\s*padding-bottom:\s*5px;/);
  assert.match(css, /\.section-panel--adjustments \.section-body\s*\{\s*padding-bottom:\s*3px;/);
  assert.match(css, /\.section-panel--effects \.section-body\s*\{\s*padding-bottom:\s*0;/);
  assert.match(css, /\.settings-row\s*\{[\s\S]*?grid-template-columns:\s*minmax\(136px,\s*1fr\)\s+168px;[\s\S]*?min-height:\s*30px;/);
  assert.match(css, /\.settings-row__label,\s*\.toggle__label,\s*\.slider-label__text\s*\{[\s\S]*?font-size:\s*13px;[\s\S]*?line-height:\s*1\.25;/);
  assert.match(css, /\.settings-row__label,\s*\.toggle__label,\s*\.slider-label__text\s*\{[\s\S]*?color:\s*color-mix\(in srgb,\s*var\(--text-primary\) 64%,\s*var\(--text-secondary\)\);/);
  assert.match(css, /\.settings-row__label,\s*\.toggle__label,\s*\.slider-label__text\s*\{[\s\S]*?white-space:\s*nowrap;/);
  assert.match(css, /\.settings-inline-select,\s*\.settings-row--palette select\s*\{[\s\S]*?height:\s*30px;[\s\S]*?font-size:\s*12px;/);
  assert.match(css, /\.settings-slider-row\s*\{[\s\S]*?grid-template-columns:\s*minmax\(92px,\s*100px\)\s+minmax\(0,\s*1fr\)\s+40px;/);
  assert.match(css, /\.col-controls \.toggle__track\s*\{[\s\S]*?width:\s*42px;[\s\S]*?height:\s*24px;/);
  assert.match(css, /\.col-controls \.toggle__thumb\s*\{[\s\S]*?width:\s*18px;[\s\S]*?height:\s*18px;/);
  assert.match(css, /\.col-controls \.toggle__track--on \.toggle__thumb\s*\{\s*transform:\s*translateX\(18px\);/);
  assert.doesNotMatch(css, /grid-template-areas:\s*"canvas controls"\s*"tenor controls";/);
  assert.doesNotMatch(css, /grid-template-areas:\s*"controls canvas tenor"/);
  assert.doesNotMatch(css, /grid-template-columns:\s*320px\s+minmax/);
  assert.doesNotMatch(css, /body::before/);
  assert.match(css, /\.tenor__header\s*\{\s*display:\s*none;/);
  assert.match(css, /\.section-panel--effects \.effects-compact-grid\s*\{\s*display:\s*none;/);
  assert.match(css, /\.section-panel--effects \.effects-slider-list\s*\{[\s\S]*?display:\s*flex;/);
});

test('compact Tenor results use dense rail pagination', () => {
  const tenor = read('components/TenorSearch.tsx');
  const css = read('index.css');

  assert.match(
    tenor,
    /const SEARCH_LIMIT = compact \? '24' : '18';/,
    'compact Tenor should request enough results to fill the dense selection rail'
  );
  assert.doesNotMatch(
    tenor,
    /IntersectionObserver|loadMoreRef/,
    'compact Tenor should keep pagination under explicit user control'
  );
  assert.match(
    tenor,
    /className="btn btn--secondary tenor__load-more-button"[\s\S]*?'Load More'/,
    'Tenor pagination should be a visible Load More button'
  );
  assert.match(
    css,
    /\.tenor__load-more-button\s*\{[\s\S]*?width:\s*100%;[\s\S]*?min-height:\s*44px;[\s\S]*?letter-spacing:\s*0;[\s\S]*?text-transform:\s*none;/,
    'base Load More button should span the Tenor column and stay touch-friendly'
  );
  assert.match(
    css,
    /@media \(min-width: 1200px\) \{[\s\S]*?\.tenor__load-more\s*\{\s*padding:\s*12px 0 6px;[\s\S]*?\.tenor__load-more-button\s*\{\s*min-height:\s*40px;/,
    'wide desktop Load More spacing should keep the full button visible in the pinned mockup viewport'
  );
});

test('tablet layout stays preview-first instead of reverting to the legacy side rail', () => {
  const css = read('index.css');
  const tabletCss = css.slice(
    css.indexOf('@media (min-width: 769px) and (max-width: 1199px)'),
    css.indexOf('/* --- 17. HIDDEN FILE INPUT --- */')
  );

  assert.match(
    css,
    /@media \(min-width: 769px\) and \(max-width: 1199px\) \{[\s\S]*?grid-template-areas:\s*"canvas"\s*"tenor"\s*"controls";/,
    'tablet breakpoint should stack preview, search, and settings in that order until desktop begins'
  );
  assert.match(
    css,
    /@media \(min-width: 769px\) and \(max-width: 1199px\) \{[\s\S]*?\.app-main\s*\{[\s\S]*?grid-template-rows:\s*auto auto minmax\(0,\s*1fr\);[\s\S]*?height:\s*calc\(100dvh - 72px\);[\s\S]*?overflow:\s*hidden;/,
    'tablet viewport should stay fixed while settings get the remaining scroll area'
  );
  assert.match(
    css,
    /@media \(min-width: 769px\) and \(max-width: 1199px\) \{[\s\S]*?\.col-controls\s*\{[\s\S]*?position:\s*static;/,
    'tablet settings should not stay as a sticky side rail'
  );
  assert.match(
    css,
    /@media \(min-width: 769px\) and \(max-width: 1199px\) \{[\s\S]*?\.col-controls \.card\s*\{[\s\S]*?border:\s*1px solid var\(--border-visible\);/,
    'tablet settings should render as an in-flow editor panel'
  );
  assert.match(
    css,
    /@media \(min-width: 769px\) and \(max-width: 1199px\) \{[\s\S]*?\.col-controls \.card\s*\{[\s\S]*?height:\s*100%;[\s\S]*?overflow-y:\s*auto;[\s\S]*?overscroll-behavior:\s*contain;/,
    'tablet settings should own scrolling instead of the document'
  );
  assert.match(
    css,
    /@media \(min-width: 769px\) and \(max-width: 1199px\) \{[\s\S]*?\.col-controls\s*\{[\s\S]*?min-height:\s*180px;/,
    'tablet settings should keep a visible editing surface at landscape laptop heights'
  );
  assert.match(
    css,
    /@media \(min-width: 769px\) \{[\s\S]*?\.settings-panel-grid\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*var\(--settings-render-panel\)\)\s+10px\s+minmax\(0,\s*var\(--settings-image-panel\)\);/,
    'tablet and desktop settings should use two real side-by-side panels with a draggable resize edge'
  );
  assert.match(
    css,
    /@media \(min-width: 769px\) and \(max-width: 1199px\) \{[\s\S]*?\.settings-sections\s*\{[\s\S]*?display:\s*flex;[\s\S]*?flex-direction:\s*column;/,
    'tablet should stack sections inside each split panel instead of splitting each card internally'
  );
  assert.doesNotMatch(
    css,
    /@media \(min-width: 769px\) and \(max-width: 1199px\) \{[\s\S]*?grid-template-areas:\s*"canvas controls"\s*"tenor controls";/,
    'tablet breakpoint must not reintroduce the cramped side-rail grid'
  );
  assert.match(
    css,
    /@media \(min-width: 769px\) and \(max-width: 1199px\) \{[\s\S]*?\.player\s*\{[\s\S]*?height:\s*auto;[\s\S]*?max-height:\s*clamp\(210px,\s*30dvh,\s*300px\);/,
    'tablet preview should cap scale without stretching the canvas aspect ratio'
  );
  assert.match(
    css,
    /@media \(min-width: 769px\) and \(max-width: 1199px\) \{[\s\S]*?\.card--tenor\s*\{[\s\S]*?max-height:\s*min\(180px,\s*22dvh\) !important;/,
    'tablet Tenor rail should stay compact enough to leave room for settings'
  );
  assert.doesNotMatch(
    tabletCss,
    /\.section-panel--effects \.effects-compact-grid\s*\{[\s\S]*?repeat\(6,\s*minmax\(0,\s*1fr\)\)/,
    'tablet effects grid should not use the mobile six-up tile layout inside the split settings panel'
  );
});

test('player preview fits available chrome without stretching source aspect', () => {
  const css = read('index.css');
  const player = read('components/AsciiPlayer.tsx');

  assert.match(
    player,
    /const getFittedDisplaySize = useCallback/,
    'player should compute a fitted preview size from available chrome bounds'
  );
  assert.match(
    player,
    /const fitScale = Math\.min\(maxWidth \/ baseSize\.width,\s*maxHeight \/ baseSize\.height\);/,
    'preview scale should preserve the base aspect ratio while fitting both axes'
  );
  assert.match(
    player,
    /canvas\.width !== displaySize\.width \|\| canvas\.height !== displaySize\.height/,
    'canvas backing size should match the fitted aspect-preserving preview size'
  );
  assert.doesNotMatch(
    css,
    /aspect-ratio:\s*auto\s*!important/,
    'responsive CSS should not override the player aspect ratio'
  );
  assert.doesNotMatch(
    css,
    /\.card--canvas \.player-shell\s*\{[\s\S]*?max-width:\s*100%\s*!important/,
    'responsive CSS should not override the fitted player-shell width'
  );
});

test('upload reference surface uses the pinned visible border', () => {
  const css = read('index.css');

  assert.match(
    css,
    /\.upload-zone\s*\{[\s\S]*?border:\s*1px solid var\(--border-visible\);/,
    'upload zone border should match the pinned reference screenshot'
  );
  assert.match(
    css,
    /\.upload-zone\s*\{[\s\S]*?background-image:\s*radial-gradient\(circle,\s*var\(--border-visible\) 1px,\s*transparent 1px\);/,
    'upload zone dot grid should match the pinned visible border token'
  );
});

test('mobile search drawer owns the bottom surface without duplicate actions', () => {
  const css = read('index.css');
  const mobileSearchDrawerRule = css.match(/\.app-shell--mobile-search \.col-tenor\s*\{(?<body>[^}]*)\}/)?.groups?.body ?? '';
  assert.notEqual(mobileSearchDrawerRule, '', 'mobile search drawer rule should exist');

  assert.match(
    css,
    /\.app-shell--mobile-search \.col-tenor\s*\{[\s\S]*?bottom:\s*0;/,
    'mobile search drawer should attach to the bottom of the viewport'
  );
  assert.match(
    css,
    /\.app-shell--mobile-search \.mobile-action-bar\s*\{\s*display:\s*none;/,
    'mobile action bar should hide while the search drawer is open'
  );
  assert.match(
    css,
    /\.mobile-action-bar\s*\{[\s\S]*?bottom:\s*calc\(10px \+ env\(safe-area-inset-bottom\)\);/,
    'mobile action bar should use native safe-area spacing instead of mock phone chrome spacing'
  );
  assert.match(
    css,
    /\.mobile-action-bar__button\s*\{[\s\S]*?min-height:\s*44px;/,
    'mobile action bar buttons should keep touch-friendly hit targets'
  );
  assert.doesNotMatch(
    mobileSearchDrawerRule,
    /padding-bottom:\s*calc\(66px \+ env\(safe-area-inset-bottom\)\)/,
    'search drawer should not reserve stale action-bar space'
  );
});

test('mobile settings stays in-flow so the preview remains editable', () => {
  const app = read('App.tsx');
  const css = read('index.css');

  assert.doesNotMatch(
    app,
    /mobile-device-status|mobile-home-indicator/,
    'mobile should not render fake device chrome inside the app'
  );

  assert.match(
    app,
    /const shouldLockBodyScroll = isSearchPanelOpen;/,
    'only the fixed search drawer should lock body scroll'
  );

  const bodyLockEffectStart = app.indexOf('useEffect(() => {\n    if (!shouldLockBodyScroll) return;');
  assert.notEqual(bodyLockEffectStart, -1, 'body-scroll lock should be owned by the drawer-lock effect');
  const bodyLockEffectEnd = app.indexOf('  }, [shouldLockBodyScroll]);', bodyLockEffectStart);
  assert.notEqual(bodyLockEffectEnd, -1, 'body-scroll lock effect should depend on the explicit drawer-lock flag');
  const bodyLockContext = app.slice(bodyLockEffectStart, bodyLockEffectEnd);
  assert.match(
    bodyLockContext,
    /if \(!shouldLockBodyScroll\) return;/,
    'body-scroll locking should be gated by the explicit drawer-lock flag'
  );
  assert.doesNotMatch(
    bodyLockContext,
    /mobilePanel|isSettingsPanelOpen/,
    'mobile settings should not inherit body-scroll locking from drawer state'
  );

  const mobileSettingsCanvasRule = css.match(/\.app-shell--mobile-settings \.col-canvas\s*\{(?<body>[^}]*)\}/)?.groups?.body ?? '';
  const mobileSettingsControlsRule = css.match(/\.app-shell--mobile-settings \.col-controls\s*\{(?<body>[^}]*)\}/)?.groups?.body ?? '';
  const mobileSettingsMainRule = css.match(/\.app-shell--mobile-settings \.app-main\s*\{(?<body>[^}]*)\}/)?.groups?.body ?? '';
  const mobileSettingsGridRule = css.match(/\.app-shell--mobile-settings \.settings-panel-grid\s*\{(?<body>[^}]*)\}/)?.groups?.body ?? '';
  assert.notEqual(mobileSettingsMainRule, '', 'mobile settings app-main rule should exist');
  assert.notEqual(mobileSettingsCanvasRule, '', 'mobile settings canvas rule should exist');
  assert.notEqual(mobileSettingsControlsRule, '', 'mobile settings controls rule should exist');
  assert.notEqual(mobileSettingsGridRule, '', 'mobile settings panel grid rule should exist');
  assert.match(
    mobileSettingsMainRule,
    /height:\s*calc\(100dvh - 52px\);[\s\S]*?overflow:\s*hidden;/,
    'mobile settings should keep the viewport stationary while the panel content scrolls'
  );
  assert.match(
    mobileSettingsMainRule,
    /padding-bottom:\s*calc\(76px \+ env\(safe-area-inset-bottom\)\);/,
    'mobile settings shell should reserve room for the native bottom action bar'
  );
  assert.match(
    mobileSettingsCanvasRule,
    /position:\s*sticky;[\s\S]*?top:\s*0;/,
    'mobile settings should keep the preview visible while editing'
  );
  assert.match(
    mobileSettingsControlsRule,
    /display:\s*flex;[\s\S]*?order:\s*3;/,
    'mobile settings should render as an in-flow editor below the preview'
  );
  assert.match(
    mobileSettingsControlsRule,
    /padding-bottom:\s*0;/,
    'mobile settings should rely on app-main action-bar padding, not duplicate control padding'
  );
  assert.doesNotMatch(
    mobileSettingsControlsRule,
    /position:\s*fixed;/,
    'mobile settings must not become a viewport-covering drawer'
  );

  assert.match(
    css,
    /\.app-shell--mobile-settings \.col-controls \.card\s*\{[\s\S]*?padding:\s*10px;/,
    'mobile settings cards should have enough padding for touch-friendly controls'
  );
  assert.match(
    mobileSettingsGridRule,
    /height:\s*100%;[\s\S]*?flex-direction:\s*column;[\s\S]*?overflow-y:\s*auto;[\s\S]*?overscroll-behavior:\s*contain;/,
    'mobile split settings wrapper should scroll internally without moving the page'
  );
  assert.match(
    css,
    /\.app-shell--mobile-settings \.col-controls \.card\s*\{[\s\S]*?height:\s*auto;[\s\S]*?overflow:\s*visible;/,
    'mobile split settings cards should stack inside the wrapper instead of becoming nested full-height scrollers'
  );
  assert.match(
    css,
    /\.app-shell--mobile-settings \.player\s*\{[\s\S]*?height:\s*auto;[\s\S]*?max-height:\s*clamp\(210px,\s*28dvh,\s*238px\);/,
    'mobile settings preview should preserve media aspect while staying within the sticky editor header'
  );
  assert.match(
    css,
    /\.app-shell--mobile-settings \.section-panel--effects \.section-header\s*\{[\s\S]*?min-height:\s*32px;[\s\S]*?padding-bottom:\s*4px;/,
    'mobile effects header should be large enough to tap comfortably'
  );
  assert.match(
    css,
    /\.app-shell--mobile-settings \.section-panel--effects \.section-header__label\s*\{[\s\S]*?line-height:\s*1;/,
    'mobile effects header label should not add extra vertical slack'
  );
  assert.match(
    css,
    /\.app-shell--mobile-settings \.effects-compact-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/,
    'mobile effects should use two columns instead of cramped six-up toggles'
  );
  assert.match(
    css,
    /\.app-shell--mobile-settings \.effect-tile\s*\{[\s\S]*?min-height:\s*58px;[\s\S]*?padding:\s*7px 8px;/,
    'mobile effects tiles should be touch-friendly'
  );
});

test('app source order follows the preview-first editor layout', () => {
  const app = read('App.tsx');
  const canvasIndex = app.indexOf('className="col-canvas"');
  const controlsIndex = app.indexOf('className="col-controls"');
  const tenorIndex = app.indexOf('className="col-tenor"');

  assert.notEqual(canvasIndex, -1, 'preview column should be present');
  assert.notEqual(controlsIndex, -1, 'settings column should be present');
  assert.notEqual(tenorIndex, -1, 'Tenor column should be present');
  assert.ok(
    canvasIndex < controlsIndex && controlsIndex < tenorIndex,
    'DOM order should be preview, settings, search so mobile and accessibility order match the mockup flow'
  );
});

test('default controls match the accepted editor state', () => {
  const app = read('App.tsx');
  const player = read('components/AsciiPlayer.tsx');
  const hook = read('hooks/useAsciiConfig.ts');
  const presets = read('services/stylePresets.ts');

  assert.match(app, /const DEFAULT_FRAME_RATE = 30;/);
  assert.match(app, /const \[nativeFrameRate,\s*setNativeFrameRate\] = useState<number \| null>\(null\);/);
  assert.match(app, /const mediaDefaultFrameRate = nativeFrameRate \?\? DEFAULT_FRAME_RATE;/);
  assert.match(app, /setFrameRate\(mediaDefaultFrameRate\);/);
  assert.match(app, /const handleNativeFrameRate = useCallback\(\(nextFrameRate: number \| null\) => \{/);
  assert.match(app, /setFrameRate\(normalizedFrameRate \?\? DEFAULT_FRAME_RATE\);/);
  assert.match(app, /const DEFAULT_PLAYBACK_SPEED = 1;/);
  assert.match(app, /Frame Rate \(FPS\)/);
  assert.match(app, /Playback Speed/);
  assert.match(app, /aria-label="Loop playback"/);
  assert.match(app, /frameRate=\{frameRate\}/);
  assert.match(app, /onNativeFrameRate=\{handleNativeFrameRate\}/);
  assert.match(app, /playbackSpeed=\{playbackSpeed\}/);
  assert.match(app, /loopMode=\{loopMode\}/);
  assert.ok(
    countMatches(app, /setNativeFrameRate\(null\);/g) >= 3,
    'new uploads, URL loads, and reset paths should clear stale native FPS'
  );
  assert.match(player, /onNativeFrameRate\?: \(frameRate: number \| null\) => void;/);
  assert.match(player, /const DEFAULT_GIF_FRAME_DELAY_MS = 100;/);
  assert.match(player, /const getNativeFrameRate = \(frames: GifFrame\[\]\): number \| null => \{/);
  assert.match(player, /return 1000 \/ \(totalDelay \/ frames\.length\);/);
  assert.match(player, /onNativeFrameRate\?\.\(getNativeFrameRate\(loadedFrames\)\);/);
  assert.match(player, /onNativeFrameRate\?\.\(null\);/);
  assert.match(app, /effects:\s*true/);
  assert.doesNotMatch(app, /WIDE_DESKTOP_VIEWPORT_QUERY/);

  assert.match(hook, /const \[density, setDensity\] = useState\(64\)/);
  assert.match(hook, /const \[useSourceColor, setUseSourceColor\] = useState\(true\)/);
  assert.match(hook, /const \[invert, setInvert\] = useState\(false\)/);

  assert.match(presets, /id:\s*'default'[\s\S]*?resolution:\s*64/);
  assert.match(presets, /id:\s*'default'[\s\S]*?useSourceColor:\s*true/);
  assert.match(presets, /id:\s*'default'[\s\S]*?invert:\s*false/);
});

test('invert color toggle directly indicates the invert state', () => {
  const app = read('App.tsx');

  assert.equal(
    countMatches(app, /aria-label="Toggle invert colors"/g),
    2,
    'desktop and compact invert controls should both be present'
  );
  assert.equal(
    countMatches(app, /aria-label="Toggle invert colors" aria-pressed=\{cfg\.invert\}/g),
    2,
    'invert aria-pressed should match cfg.invert'
  );
  assert.equal(
    countMatches(app, /className=\{`toggle__track \$\{cfg\.invert \? 'toggle__track--on' : ''\}`\}/g),
    2,
    'invert visual on-state should match cfg.invert'
  );
  assert.doesNotMatch(
    app,
    /Toggle invert colors[\s\S]{0,180}!cfg\.invert/,
    'invert toggle should not render the converse of the actual state'
  );
});

test('source color rendering preserves palette through ASCII negative space', () => {
  const ascii = read('services/asciiUtils.ts');
  const player = read('components/AsciiPlayer.tsx');

  assert.match(
    ascii,
    /underpaintAlphas:\s*number\[\]\[\] \| null;/,
    'ASCII conversion should expose per-cell underpaint alpha for source-colored sparse glyphs'
  );
  assert.match(
    ascii,
    /const getSourceColorUnderpaintAlpha = \([\s\S]*?getCharDensity\(char\)[\s\S]*?getColorChroma\(r, g, b\)[\s\S]*?MAX_UNDERPAINT_ALPHA/,
    'underpaint strength should account for glyph density, source lightness, and chroma'
  );
  assert.match(
    ascii,
    /rowUnderpaintAlphas\.push\(getSourceColorUnderpaintAlpha\(gray, char, adjR, adjG, adjB\)\);/,
    'underpaint alpha should be computed from the adjusted and palette-mapped source color'
  );
  assert.match(
    player,
    /const underpaintAlphas = asciiResult\.underpaintAlphas;/,
    'player should consume the underpaint alpha map from ASCII conversion'
  );
  assert.match(
    player,
    /if \(!hasTransparentBg && underpaintAlphas\) \{[\s\S]*?finalCtx\.globalAlpha = underpaintAlpha;[\s\S]*?finalCtx\.fillRect\(x \* cellWidth, y \* cellHeight, cellWidth \+ 0\.5, cellHeight \+ 0\.5\);/,
    'underpaint should tint non-transparent source-color cells without affecting transparent exports'
  );
  assert.match(
    player,
    /charColor && charColor !== 'transparent' && char !== ' '/,
    'glyph rendering should still skip spaces so the tint remains a color-preserving underlay'
  );
});

test('settings range sliders use compact tracks and correct zero origins', () => {
  const app = read('App.tsx');
  const css = read('index.css');

  assert.match(
    css,
    /input\[type="range"\]\s*\{[\s\S]*?height:\s*2px;[\s\S]*?border-radius:\s*var\(--radius-pill\);/,
    'range tracks should stay slim in the compact settings panel'
  );
  assert.match(
    css,
    /input\[type="range"\]::-webkit-slider-thumb\s*\{[\s\S]*?width:\s*10px;[\s\S]*?height:\s*10px;/,
    'range thumbs should not visually dominate settings rows'
  );
  assert.match(
    app,
    /<input type="range" min="-300" max="300" value=\{cfg\.brightness\}[\s\S]{0,180}aria-label="Brightness"/,
    'signed image adjustment sliders should still allow values below zero'
  );
  assert.match(
    app,
    /<input type="range" min="0" max="300" value=\{cfg\.sharpness\}[\s\S]{0,180}aria-label="Sharpness"/,
    'Sharpness should render zero at the left edge instead of the track midpoint'
  );
  assert.match(
    app,
    /<input type="range" min="0" max="300" value=\{value\}[\s\S]{0,180}setPostProcessingValue/,
    'post-processing effect sliders should use true nonnegative ranges'
  );
  assert.match(
    app,
    /<input type="range" min="0" max="300" value=\{cfg\.animationEffects\.matrixRain\}/,
    'Matrix Rain should render zero at the left edge'
  );
  assert.match(
    app,
    /<input type="range" min="0" max="300" value=\{cfg\.animationEffects\.waveDistortion\}/,
    'Wave Distortion should render zero at the left edge'
  );
  assert.doesNotMatch(
    app,
    /getNonNegativeRangeValue\(e\.target\.value\)[\s\S]{0,120}min="-300"|min="-300" max="300"[\s\S]{0,180}getNonNegativeRangeValue\(e\.target\.value\)/,
    'nonnegative sliders should not advertise a negative half-track that their handlers clamp away'
  );
});

test('player icon tooltips cover the full transport chrome', () => {
  const css = read('index.css');
  const player = read('components/AsciiPlayer.tsx');

  assert.match(
    css,
    /\.player__transport \.btn--icon::after\s*\{[\s\S]*?content:\s*attr\(aria-label\);/,
    'all player transport icon buttons, including fullscreen, should expose CSS tooltips from aria-label'
  );
  assert.doesNotMatch(
    css,
    /\.player__controls \.btn--icon::after\s*\{[\s\S]*?content:\s*attr\(aria-label\);/,
    'tooltip styling should not be scoped only to the control group because fullscreen sits in the frame info area'
  );
  assert.match(
    css,
    /\.player__fullscreen-button::after\s*\{[\s\S]*?right:\s*0;/,
    'fullscreen tooltip should align inward at the right edge of the player'
  );
  assert.match(player, /className="btn btn--icon player__fullscreen-button"[\s\S]*?title="Fullscreen"[\s\S]*?aria-label="Fullscreen"/);
  assert.match(player, /title="Play \(Space\)"[\s\S]*?aria-label="Play"/);
  assert.match(player, /title="Pause \(Space\)"[\s\S]*?aria-label="Pause"/);
  assert.match(player, /title="Export PNG"[\s\S]*?aria-label="Export PNG"/);
});

test('removed UI affordances do not return', () => {
  const app = read('App.tsx');
  const css = read('index.css');
  const filesToScan = [
    'App.tsx',
    'index.css',
    'index.html',
    'README.md',
    'components/AsciiPlayer.tsx',
    'components/TenorSearch.tsx',
    'services/asciiUtils.ts',
    'services/stylePresets.ts',
  ];
  const source = filesToScan.map(file => read(file)).join('\n');

  assert.doesNotMatch(source, /synthwave/i);
  assert.doesNotMatch(source, /Export HTML|HTML export/);
  assert.doesNotMatch(source, /Export ANSI|ANSI export/);
  assert.doesNotMatch(source, /mockup-assets|demo-mobile|demo\.svg|tenor__mock|DefaultSample|previewImageSrc|player__preview-image/);
  assert.doesNotMatch(app, /preset-bar|preset-chip|settings-preset-strip|settings-preset-chip|VISIBLE_STYLE_PRESET_IDS|STYLE_PRESET_LABELS/);
  assert.doesNotMatch(css, /preset-bar|preset-chip|settings-preset-strip|settings-preset-chip|body::before/);
});

test('reference screenshots stay at the verified desktop viewport size', () => {
  assert.deepEqual(pngDimensions('public/docs/hero.png'), { width: 1728, height: 963 });
  assert.deepEqual(pngDimensions('public/docs/upload.png'), { width: 1728, height: 963 });
});

test('recovered UI mockups stay pinned as fidelity source material', () => {
  assert.deepEqual(pngDimensions('public/docs/mockups/desktop-right-settings.png'), { width: 1254, height: 1254 });
  assert.deepEqual(pngDimensions('public/docs/mockups/desktop-three-column.png'), { width: 1586, height: 992 });
  assert.deepEqual(pngDimensions('public/docs/mockups/mobile-editor.png'), { width: 853, height: 1844 });

  assert.equal(
    sha256('public/docs/mockups/desktop-right-settings.png'),
    referenceHashes.mockupDesktopRightSettings,
    'active desktop mockup changed; update only after explicit visual signoff'
  );
  assert.equal(
    sha256('public/docs/mockups/desktop-three-column.png'),
    referenceHashes.mockupDesktopThreeColumn,
    'superseded three-column mockup changed; update only after explicit visual signoff'
  );
  assert.equal(
    sha256('public/docs/mockups/mobile-editor.png'),
    referenceHashes.mockupMobileEditor,
    'active mobile mockup changed; update only after explicit visual signoff'
  );
});

test('desktop reference screenshots stay visually pinned', () => {
  assert.equal(
    sha256('public/docs/hero.png'),
    referenceHashes.hero,
    'hero reference changed; update this only after explicit visual signoff'
  );
  assert.equal(
    sha256('public/docs/upload.png'),
    referenceHashes.upload,
    'upload reference changed; update this only after explicit visual signoff'
  );
});

test('visual reference audit keeps known dynamic regions explicit', () => {
  const docs = read('public/docs/REFERENCE.md');
  const visualDiff = read('scripts/visualDiff.ts');

  assert.match(
    docs,
    /--ignore=33,776,1210,187/,
    'Tenor thumbnails should stay explicitly ignored because they are live network content'
  );
  assert.doesNotMatch(
    docs,
    /--ignore=1638,345,64,52/,
    'Invert should no longer be hidden from visual audits now that its default state matches the active mockups'
  );
  assert.match(
    docs,
    /Invert toggle is intentionally not ignored/,
    'reference docs should keep the Invert toggle covered by visual comparison'
  );
  assert.match(
    docs,
    /--min-bounds-changed-ratio=0\.00005/,
    'bounds gating should ignore only scattered antialias noise after known dynamic regions are excluded'
  );
  assert.match(
    visualDiff,
    /minBoundsChangedRatio/,
    'visual diff script should support a lower changed-pixel floor for changed-bounds gating'
  );
});

test('reference documentation matches pinned screenshot hashes', () => {
  const referenceDoc = read('public/docs/REFERENCE.md');

  Object.values(referenceHashes).forEach(hash => {
    assert.match(referenceDoc, new RegExp(hash));
  });
  assert.match(referenceDoc, /desktop-right-settings\.png[\s\S]*active desktop mockup/i);
  assert.match(referenceDoc, /mobile-editor\.png[\s\S]*active mobile mockup/i);
  assert.match(referenceDoc, /desktop-three-column\.png[\s\S]*superseded/i);
});

test('runtime does not depend on seeded Tenor mock files', () => {
  const mockTenorPath = path.join(root, 'public/mock-tenor');
  const mockTenorFiles = existsSync(mockTenorPath)
    ? readdirSync(mockTenorPath).filter(entry => statSync(path.join(mockTenorPath, entry)).isFile())
    : [];
  const runtimeSource = [
    'App.tsx',
    'components/TenorSearch.tsx',
    'services/tenorUtils.ts',
    'index.css',
  ].map(file => read(file)).join('\n');

  assert.deepEqual(mockTenorFiles, []);
  assert.doesNotMatch(runtimeSource, /mock-tenor|mockTenor|seeded|seed/i);
});
