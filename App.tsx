import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Settings, RefreshCcw, Layers, Monitor, RotateCcw, Link, ChevronDown, Palette, SlidersHorizontal, Type, Download, Sparkles, Moon, Sun, Search, X, Minus, Plus, Menu, Contrast, Droplet, Triangle } from 'lucide-react';
import FileUpload from './components/FileUpload';
import AsciiPlayer, { type AsciiPlayerHandle } from './components/AsciiPlayer';
import TenorSearch from './components/TenorSearch';
import KeyboardShortcuts from './components/KeyboardShortcuts';
import { AppState, type PlaybackLoopMode } from './types';
import { CHAR_PRESETS, COLOR_PALETTES } from './services/asciiUtils';
import { STYLE_PRESETS } from './services/stylePresets';
import { useAsciiConfig } from './hooks/useAsciiConfig';

type ThemeMode = 'dark' | 'light';
type MobilePanel = 'settings' | 'search' | null;

const THEME_STORAGE_KEY = 'gif2ascii-theme';
const LAYOUT_EDITOR_SPLIT_STORAGE_KEY = 'gif2ascii-layout-editor-split';
const LAYOUT_PREVIEW_SPLIT_STORAGE_KEY = 'gif2ascii-layout-preview-split';
const SETTINGS_PANEL_SPLIT_STORAGE_KEY = 'gif2ascii-settings-panel-split';
const COMPACT_VIEWPORT_MAX_WIDTH = 768;
const COMPACT_VIEWPORT_QUERY = `(max-width: ${COMPACT_VIEWPORT_MAX_WIDTH}px)`;
const WIDE_VIEWPORT_QUERY = `(min-width: ${COMPACT_VIEWPORT_MAX_WIDTH + 1}px)`;
const DEFAULT_FRAME_RATE = 30;
const FRAME_RATE_MIN = 1;
const FRAME_RATE_MAX = 60;
const LAYOUT_EDITOR_SPLIT_DEFAULT = 68;
const LAYOUT_EDITOR_SPLIT_MIN = 50;
const LAYOUT_EDITOR_SPLIT_MAX = 82;
const LAYOUT_PREVIEW_SPLIT_DEFAULT = 54;
const LAYOUT_PREVIEW_SPLIT_MIN = 36;
const LAYOUT_PREVIEW_SPLIT_MAX = 76;
const SETTINGS_PANEL_SPLIT_DEFAULT = 48;
const SETTINGS_PANEL_SPLIT_MIN = 30;
const SETTINGS_PANEL_SPLIT_MAX = 70;
const clampFrameRate = (value: number): number => Math.max(
  FRAME_RATE_MIN,
  Math.min(FRAME_RATE_MAX, Math.round(value))
);
const clampSettingsPanelSplit = (value: number): number => Math.max(
  SETTINGS_PANEL_SPLIT_MIN,
  Math.min(SETTINGS_PANEL_SPLIT_MAX, Math.round(value))
);
const clampPanelSplit = (value: number, min: number, max: number): number => Math.max(
  min,
  Math.min(max, Math.round(value))
);
const PLAYBACK_SPEED_PRESETS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
const DEFAULT_PLAYBACK_SPEED = 1;
const LOOP_MODE_OPTIONS: Array<{ value: PlaybackLoopMode; label: string }> = [
  { value: 'forever', label: 'Forever' },
  { value: 'once', label: 'Once' },
];

const formatCharacterPresetOption = (name: string, chars: string): string => (
  name === 'Standard' ? `${name} (${chars})` : name
);

const getStoredTheme = (): ThemeMode => {
  if (typeof window === 'undefined') return 'dark';

  try {
    return window.localStorage.getItem(THEME_STORAGE_KEY) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
};

const getStoredPanelSplit = (
  storageKey: string,
  defaultValue: number,
  minValue: number,
  maxValue: number
): number => {
  if (typeof window === 'undefined') return defaultValue;

  try {
    const storedValueRaw = window.localStorage.getItem(storageKey);
    if (!storedValueRaw) return defaultValue;

    const storedValue = Number(storedValueRaw);
    return Number.isFinite(storedValue)
      ? clampPanelSplit(storedValue, minValue, maxValue)
      : defaultValue;
  } catch {
    return defaultValue;
  }
};

const getStoredSettingsPanelSplit = (): number => {
  if (typeof window === 'undefined') return SETTINGS_PANEL_SPLIT_DEFAULT;

  try {
    const storedValueRaw = window.localStorage.getItem(SETTINGS_PANEL_SPLIT_STORAGE_KEY);
    if (!storedValueRaw) return SETTINGS_PANEL_SPLIT_DEFAULT;

    const storedValue = Number(storedValueRaw);
    return Number.isFinite(storedValue)
      ? clampSettingsPanelSplit(storedValue)
      : SETTINGS_PANEL_SPLIT_DEFAULT;
  } catch {
    return SETTINGS_PANEL_SPLIT_DEFAULT;
  }
};

const getInitialMobilePanel = (): MobilePanel => {
  return null;
};

const getInitialExpandedSections = (): Record<string, boolean> => {
  return {
    output: true,
    colors: true,
    adjustments: true,
    characters: false,
    effects: true,
    export: false,
  };
};

type CompactIconProps = React.SVGProps<SVGSVGElement> & {
  size?: number;
  strokeWidth?: number;
};

const ColumnsDimensionIcon: React.FC<CompactIconProps> = ({
  size = 15,
  strokeWidth = 1.5,
  ...props
}) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...props}
  >
    <path d="M5 12h14" />
    <path d="M5 8v8" />
    <path d="M19 8v8" />
  </svg>
);

const CharacterSetIcon: React.FC<CompactIconProps> = ({
  size = 15,
  strokeWidth = 1.5,
  ...props
}) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...props}
  >
    <path d="m4 18 7-12 7 12" />
    <path d="M7.5 13h7" />
  </svg>
);

const DitherIcon: React.FC<CompactIconProps> = ({ size = 15, ...props }) => (
  <svg viewBox="0 0 16 16" width={size} height={size} fill="currentColor" aria-hidden="true" {...props}>
    <rect x="2" y="2" width="2" height="2" rx="0.35" />
    <rect x="7" y="2" width="2" height="2" rx="0.35" opacity="0.55" />
    <rect x="12" y="2" width="2" height="2" rx="0.35" />
    <rect x="2" y="7" width="2" height="2" rx="0.35" opacity="0.55" />
    <rect x="7" y="7" width="2" height="2" rx="0.35" />
    <rect x="12" y="7" width="2" height="2" rx="0.35" opacity="0.55" />
    <rect x="2" y="12" width="2" height="2" rx="0.35" />
    <rect x="7" y="12" width="2" height="2" rx="0.35" opacity="0.55" />
    <rect x="12" y="12" width="2" height="2" rx="0.35" />
  </svg>
);

const App: React.FC = () => {
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [urlInput, setUrlInput] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [inputSize, setInputSize] = useState<{ width: number; height: number } | null>(null);
  const userAdjustedRef = useRef(false);
  const playerRef = useRef<AsciiPlayerHandle | null>(null);
  const fileObjectUrlRef = useRef<string | null>(null);
  const inputLoadIdRef = useRef(0);
  const [theme, setTheme] = useState<ThemeMode>(() => getStoredTheme());
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>(() => getInitialMobilePanel());
  const [layoutEditorSplit, setLayoutEditorSplitState] = useState(() => getStoredPanelSplit(
    LAYOUT_EDITOR_SPLIT_STORAGE_KEY,
    LAYOUT_EDITOR_SPLIT_DEFAULT,
    LAYOUT_EDITOR_SPLIT_MIN,
    LAYOUT_EDITOR_SPLIT_MAX
  ));
  const [layoutPreviewSplit, setLayoutPreviewSplitState] = useState(() => getStoredPanelSplit(
    LAYOUT_PREVIEW_SPLIT_STORAGE_KEY,
    LAYOUT_PREVIEW_SPLIT_DEFAULT,
    LAYOUT_PREVIEW_SPLIT_MIN,
    LAYOUT_PREVIEW_SPLIT_MAX
  ));
  const [settingsPanelSplit, setSettingsPanelSplitState] = useState(() => getStoredSettingsPanelSplit());
  const [frameRate, setFrameRate] = useState(DEFAULT_FRAME_RATE);
  const [nativeFrameRate, setNativeFrameRate] = useState<number | null>(null);
  const [playbackSpeed, setPlaybackSpeed] = useState(DEFAULT_PLAYBACK_SPEED);
  const [loopMode, setLoopMode] = useState<PlaybackLoopMode>('forever');
  const appMainRef = useRef<HTMLElement | null>(null);
  const settingsPanelGridRef = useRef<HTMLDivElement | null>(null);
  const layoutEditorSplitRef = useRef(layoutEditorSplit);
  const layoutPreviewSplitRef = useRef(layoutPreviewSplit);
  const settingsPanelSplitRef = useRef(settingsPanelSplit);
  const isLightMode = theme === 'light';
  const isPlaying = appState === AppState.PLAYING;
  const isSettingsPanelOpen = mobilePanel === 'settings';
  const isSearchPanelOpen = mobilePanel === 'search';
  const shouldLockBodyScroll = isSearchPanelOpen;

  // All rendering config from the extracted hook
  const cfg = useAsciiConfig(inputSize, userAdjustedRef);
  const applyCustomSetting = (change: () => void) => {
    cfg.markCustomPreset();
    change();
  };

  // Section collapse state
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(() => getInitialExpandedSections());

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const applyLayoutEditorSplit = useCallback((value: number) => {
    const nextValue = clampPanelSplit(value, LAYOUT_EDITOR_SPLIT_MIN, LAYOUT_EDITOR_SPLIT_MAX);
    layoutEditorSplitRef.current = nextValue;

    const appMain = appMainRef.current;
    if (appMain) {
      appMain.style.setProperty('--layout-editor-panel', `${nextValue}fr`);
      appMain.style.setProperty('--layout-tenor-panel', `${100 - nextValue}fr`);
    }

    return nextValue;
  }, []);

  const applyLayoutPreviewSplit = useCallback((value: number) => {
    const nextValue = clampPanelSplit(value, LAYOUT_PREVIEW_SPLIT_MIN, LAYOUT_PREVIEW_SPLIT_MAX);
    layoutPreviewSplitRef.current = nextValue;

    const appMain = appMainRef.current;
    if (appMain) {
      appMain.style.setProperty('--layout-preview-panel', `${nextValue}fr`);
      appMain.style.setProperty('--layout-settings-panel', `${100 - nextValue}fr`);
    }

    return nextValue;
  }, []);

  const applySettingsPanelSplit = useCallback((value: number) => {
    const nextValue = clampSettingsPanelSplit(value);
    settingsPanelSplitRef.current = nextValue;

    const settingsGrid = settingsPanelGridRef.current;
    if (settingsGrid) {
      settingsGrid.style.setProperty('--settings-render-panel', `${nextValue}fr`);
      settingsGrid.style.setProperty('--settings-image-panel', `${100 - nextValue}fr`);
    }

    appMainRef.current?.style.setProperty('--settings-split-position', `${nextValue}%`);

    return nextValue;
  }, []);

  const setLayoutEditorSplit = useCallback((value: number, shouldPersist = false) => {
    const nextValue = applyLayoutEditorSplit(value);
    setLayoutEditorSplitState(nextValue);

    if (shouldPersist && typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(LAYOUT_EDITOR_SPLIT_STORAGE_KEY, String(nextValue));
      } catch {
        // Local storage can be unavailable in private or restricted contexts.
      }
    }
  }, [applyLayoutEditorSplit]);

  const setLayoutPreviewSplit = useCallback((value: number, shouldPersist = false) => {
    const nextValue = applyLayoutPreviewSplit(value);
    setLayoutPreviewSplitState(nextValue);

    if (shouldPersist && typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(LAYOUT_PREVIEW_SPLIT_STORAGE_KEY, String(nextValue));
      } catch {
        // Local storage can be unavailable in private or restricted contexts.
      }
    }
  }, [applyLayoutPreviewSplit]);

  const setSettingsPanelSplit = useCallback((value: number, shouldPersist = false) => {
    const nextValue = applySettingsPanelSplit(value);
    setSettingsPanelSplitState(nextValue);

    if (shouldPersist && typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(SETTINGS_PANEL_SPLIT_STORAGE_KEY, String(nextValue));
      } catch {
        // Local storage can be unavailable in private or restricted contexts.
      }
    }
  }, [applySettingsPanelSplit]);

  const updateLayoutEditorSplitFromClientX = useCallback((clientX: number) => {
    const appMain = appMainRef.current;
    if (!appMain) return;

    const rect = appMain.getBoundingClientRect();
    if (rect.width <= 0) return;

    applyLayoutEditorSplit(((clientX - rect.left) / rect.width) * 100);
  }, [applyLayoutEditorSplit]);

  const updateLayoutPreviewSplitFromClientY = useCallback((clientY: number) => {
    const appMain = appMainRef.current;
    if (!appMain) return;

    const rect = appMain.getBoundingClientRect();
    if (rect.height <= 0) return;

    applyLayoutPreviewSplit(((clientY - rect.top) / rect.height) * 100);
  }, [applyLayoutPreviewSplit]);

  const updateSettingsPanelSplitFromClientX = useCallback((clientX: number) => {
    const grid = settingsPanelGridRef.current;
    if (!grid) return;

    const rect = grid.getBoundingClientRect();
    if (rect.width <= 0) return;

    applySettingsPanelSplit(((clientX - rect.left) / rect.width) * 100);
  }, [applySettingsPanelSplit]);

  const handleSettingsPanelResizePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (typeof window !== 'undefined' && window.matchMedia(COMPACT_VIEWPORT_QUERY).matches) return;

    event.preventDefault();
    const resizeHandle = event.currentTarget;
    resizeHandle.setPointerCapture(event.pointerId);
    updateSettingsPanelSplitFromClientX(event.clientX);
    document.body.classList.add('settings-panels-resizing');

    const handlePointerMove = (moveEvent: PointerEvent) => {
      moveEvent.preventDefault();
      updateSettingsPanelSplitFromClientX(moveEvent.clientX);
    };

    const handlePointerUp = (upEvent: PointerEvent) => {
      updateSettingsPanelSplitFromClientX(upEvent.clientX);
      setSettingsPanelSplit(settingsPanelSplitRef.current, true);
      if (resizeHandle.hasPointerCapture(upEvent.pointerId)) {
        resizeHandle.releasePointerCapture(upEvent.pointerId);
      }
      document.body.classList.remove('settings-panels-resizing');
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
  }, [setSettingsPanelSplit, updateSettingsPanelSplitFromClientX]);

  const handleLayoutEditorResizePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (typeof window !== 'undefined' && window.matchMedia(COMPACT_VIEWPORT_QUERY).matches) return;

    event.preventDefault();
    const resizeHandle = event.currentTarget;
    resizeHandle.setPointerCapture(event.pointerId);
    updateLayoutEditorSplitFromClientX(event.clientX);
    document.body.classList.add('layout-panels-resizing-x');

    const handlePointerMove = (moveEvent: PointerEvent) => {
      moveEvent.preventDefault();
      updateLayoutEditorSplitFromClientX(moveEvent.clientX);
    };

    const handlePointerUp = (upEvent: PointerEvent) => {
      updateLayoutEditorSplitFromClientX(upEvent.clientX);
      setLayoutEditorSplit(layoutEditorSplitRef.current, true);
      if (resizeHandle.hasPointerCapture(upEvent.pointerId)) {
        resizeHandle.releasePointerCapture(upEvent.pointerId);
      }
      document.body.classList.remove('layout-panels-resizing-x');
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
  }, [setLayoutEditorSplit, updateLayoutEditorSplitFromClientX]);

  const handleLayoutPreviewResizePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (typeof window !== 'undefined' && window.matchMedia(COMPACT_VIEWPORT_QUERY).matches) return;

    event.preventDefault();
    const resizeHandle = event.currentTarget;
    resizeHandle.setPointerCapture(event.pointerId);
    updateLayoutPreviewSplitFromClientY(event.clientY);
    document.body.classList.add('layout-panels-resizing-y');

    const handlePointerMove = (moveEvent: PointerEvent) => {
      moveEvent.preventDefault();
      updateLayoutPreviewSplitFromClientY(moveEvent.clientY);
    };

    const handlePointerUp = (upEvent: PointerEvent) => {
      updateLayoutPreviewSplitFromClientY(upEvent.clientY);
      setLayoutPreviewSplit(layoutPreviewSplitRef.current, true);
      if (resizeHandle.hasPointerCapture(upEvent.pointerId)) {
        resizeHandle.releasePointerCapture(upEvent.pointerId);
      }
      document.body.classList.remove('layout-panels-resizing-y');
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
  }, [setLayoutPreviewSplit, updateLayoutPreviewSplitFromClientY]);

  const handleLayoutIntersectionResizePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (typeof window !== 'undefined' && window.matchMedia(COMPACT_VIEWPORT_QUERY).matches) return;

    event.preventDefault();
    event.stopPropagation();
    const resizeHandle = event.currentTarget;
    resizeHandle.setPointerCapture(event.pointerId);
    updateLayoutEditorSplitFromClientX(event.clientX);
    updateLayoutPreviewSplitFromClientY(event.clientY);
    document.body.classList.add('layout-panels-resizing-both');

    const handlePointerMove = (moveEvent: PointerEvent) => {
      moveEvent.preventDefault();
      updateLayoutEditorSplitFromClientX(moveEvent.clientX);
      updateLayoutPreviewSplitFromClientY(moveEvent.clientY);
    };

    const handlePointerUp = (upEvent: PointerEvent) => {
      updateLayoutEditorSplitFromClientX(upEvent.clientX);
      updateLayoutPreviewSplitFromClientY(upEvent.clientY);
      setLayoutEditorSplit(layoutEditorSplitRef.current, true);
      setLayoutPreviewSplit(layoutPreviewSplitRef.current, true);
      if (resizeHandle.hasPointerCapture(upEvent.pointerId)) {
        resizeHandle.releasePointerCapture(upEvent.pointerId);
      }
      document.body.classList.remove('layout-panels-resizing-both');
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
  }, [
    setLayoutEditorSplit,
    setLayoutPreviewSplit,
    updateLayoutEditorSplitFromClientX,
    updateLayoutPreviewSplitFromClientY,
  ]);

  const handleSettingsLayoutIntersectionResizePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (typeof window !== 'undefined' && window.matchMedia(COMPACT_VIEWPORT_QUERY).matches) return;

    event.preventDefault();
    event.stopPropagation();
    const resizeHandle = event.currentTarget;
    resizeHandle.setPointerCapture(event.pointerId);
    updateSettingsPanelSplitFromClientX(event.clientX);
    updateLayoutPreviewSplitFromClientY(event.clientY);
    document.body.classList.add('layout-settings-panels-resizing-both');

    const handlePointerMove = (moveEvent: PointerEvent) => {
      moveEvent.preventDefault();
      updateSettingsPanelSplitFromClientX(moveEvent.clientX);
      updateLayoutPreviewSplitFromClientY(moveEvent.clientY);
    };

    const handlePointerUp = (upEvent: PointerEvent) => {
      updateSettingsPanelSplitFromClientX(upEvent.clientX);
      updateLayoutPreviewSplitFromClientY(upEvent.clientY);
      setSettingsPanelSplit(settingsPanelSplitRef.current, true);
      setLayoutPreviewSplit(layoutPreviewSplitRef.current, true);
      if (resizeHandle.hasPointerCapture(upEvent.pointerId)) {
        resizeHandle.releasePointerCapture(upEvent.pointerId);
      }
      document.body.classList.remove('layout-settings-panels-resizing-both');
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
  }, [
    setLayoutPreviewSplit,
    setSettingsPanelSplit,
    updateLayoutPreviewSplitFromClientY,
    updateSettingsPanelSplitFromClientX,
  ]);

  const handleSettingsPanelResizeKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 10 : 5;
    let nextValue: number | null = null;

    if (event.key === 'ArrowLeft') nextValue = settingsPanelSplitRef.current - step;
    if (event.key === 'ArrowRight') nextValue = settingsPanelSplitRef.current + step;
    if (event.key === 'Home') nextValue = SETTINGS_PANEL_SPLIT_MIN;
    if (event.key === 'End') nextValue = SETTINGS_PANEL_SPLIT_MAX;
    if (event.key === 'Enter') nextValue = SETTINGS_PANEL_SPLIT_DEFAULT;

    if (nextValue === null) return;

    event.preventDefault();
    setSettingsPanelSplit(nextValue, true);
  }, [setSettingsPanelSplit]);

  const handleLayoutEditorResizeKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 10 : 5;
    let nextValue: number | null = null;

    if (event.key === 'ArrowLeft') nextValue = layoutEditorSplitRef.current - step;
    if (event.key === 'ArrowRight') nextValue = layoutEditorSplitRef.current + step;
    if (event.key === 'Home') nextValue = LAYOUT_EDITOR_SPLIT_MIN;
    if (event.key === 'End') nextValue = LAYOUT_EDITOR_SPLIT_MAX;
    if (event.key === 'Enter') nextValue = LAYOUT_EDITOR_SPLIT_DEFAULT;

    if (nextValue === null) return;

    event.preventDefault();
    setLayoutEditorSplit(nextValue, true);
  }, [setLayoutEditorSplit]);

  const handleLayoutPreviewResizeKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 10 : 5;
    let nextValue: number | null = null;

    if (event.key === 'ArrowUp') nextValue = layoutPreviewSplitRef.current - step;
    if (event.key === 'ArrowDown') nextValue = layoutPreviewSplitRef.current + step;
    if (event.key === 'Home') nextValue = LAYOUT_PREVIEW_SPLIT_MIN;
    if (event.key === 'End') nextValue = LAYOUT_PREVIEW_SPLIT_MAX;
    if (event.key === 'Enter') nextValue = LAYOUT_PREVIEW_SPLIT_DEFAULT;

    if (nextValue === null) return;

    event.preventDefault();
    setLayoutPreviewSplit(nextValue, true);
  }, [setLayoutPreviewSplit]);

  const handleLayoutIntersectionResizeKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 10 : 5;
    let handled = true;

    if (event.key === 'ArrowLeft') setLayoutEditorSplit(layoutEditorSplitRef.current - step, true);
    else if (event.key === 'ArrowRight') setLayoutEditorSplit(layoutEditorSplitRef.current + step, true);
    else if (event.key === 'ArrowUp') setLayoutPreviewSplit(layoutPreviewSplitRef.current - step, true);
    else if (event.key === 'ArrowDown') setLayoutPreviewSplit(layoutPreviewSplitRef.current + step, true);
    else if (event.key === 'Enter') {
      setLayoutEditorSplit(LAYOUT_EDITOR_SPLIT_DEFAULT, true);
      setLayoutPreviewSplit(LAYOUT_PREVIEW_SPLIT_DEFAULT, true);
    } else {
      handled = false;
    }

    if (!handled) return;

    event.preventDefault();
  }, [setLayoutEditorSplit, setLayoutPreviewSplit]);

  const handleSettingsLayoutIntersectionResizeKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 10 : 5;
    let handled = true;

    if (event.key === 'ArrowLeft') setSettingsPanelSplit(settingsPanelSplitRef.current - step, true);
    else if (event.key === 'ArrowRight') setSettingsPanelSplit(settingsPanelSplitRef.current + step, true);
    else if (event.key === 'ArrowUp') setLayoutPreviewSplit(layoutPreviewSplitRef.current - step, true);
    else if (event.key === 'ArrowDown') setLayoutPreviewSplit(layoutPreviewSplitRef.current + step, true);
    else if (event.key === 'Enter') {
      setSettingsPanelSplit(SETTINGS_PANEL_SPLIT_DEFAULT, true);
      setLayoutPreviewSplit(LAYOUT_PREVIEW_SPLIT_DEFAULT, true);
    } else {
      handled = false;
    }

    if (!handled) return;

    event.preventDefault();
    event.stopPropagation();
  }, [setLayoutPreviewSplit, setSettingsPanelSplit]);

  const toggleTheme = useCallback(() => {
    setTheme(current => current === 'light' ? 'dark' : 'light');
  }, []);

  const closeMobilePanel = useCallback(() => {
    setMobilePanel(null);
  }, []);

  const exportCurrentPng = useCallback(() => {
    playerRef.current?.exportPng();
  }, []);

  const inputAspect = inputSize ? (inputSize.height / inputSize.width) : 1;
  const maxOutputWidth = inputSize ? Math.max(320, inputSize.width * 2) : 2000;
  const maxOutputHeight = inputSize ? Math.max(320, inputSize.height * 2) : 2000;
  const maxDensity = inputSize ? Math.max(300, Math.round(inputSize.width / 2)) : 300;
  const defaultDensity = STYLE_PRESETS.find(p => p.id === 'default')?.config.resolution;
  const selectedCharPresetName = CHAR_PRESETS.find(preset => preset.chars === cfg.chars)?.name || 'Custom';
  const clampValue = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
  const mediaDefaultFrameRate = nativeFrameRate ?? DEFAULT_FRAME_RATE;
  const resetEditorSettings = () => {
    cfg.resetSettings();
    setFrameRate(mediaDefaultFrameRate);
    setPlaybackSpeed(DEFAULT_PLAYBACK_SPEED);
    setLoopMode('forever');
  };
  const stepDensity = (delta: number) => {
    cfg.handleDensityChange(clampValue(cfg.density + delta, 10, maxDensity));
  };
  const stepFontAspect = (delta: number) => {
    const next = clampValue(Number((cfg.fontAspectRatio + delta).toFixed(2)), 0.3, 0.8);
    applyCustomSetting(() => cfg.setFontAspectRatio(next));
  };
  const stepFrameRate = (delta: number) => {
    setFrameRate(value => clampValue(value + delta, FRAME_RATE_MIN, FRAME_RATE_MAX));
  };
  const handleNativeFrameRate = useCallback((nextFrameRate: number | null) => {
    const normalizedFrameRate = nextFrameRate && Number.isFinite(nextFrameRate)
      ? clampFrameRate(nextFrameRate)
      : null;
    setNativeFrameRate(normalizedFrameRate);
    setFrameRate(normalizedFrameRate ?? DEFAULT_FRAME_RATE);
  }, []);
  const stepPlaybackSpeed = (delta: number) => {
    setPlaybackSpeed(value => {
      const currentIndex = PLAYBACK_SPEED_PRESETS.reduce((closestIndex, speed, index) => {
        const closestDistance = Math.abs(PLAYBACK_SPEED_PRESETS[closestIndex] - value);
        const distance = Math.abs(speed - value);
        return distance < closestDistance ? index : closestIndex;
      }, 0);
      const nextIndex = clampValue(currentIndex + delta, 0, PLAYBACK_SPEED_PRESETS.length - 1);
      return PLAYBACK_SPEED_PRESETS[nextIndex];
    });
  };
  const setPostProcessingValue = (
    key: keyof typeof cfg.postProcessing,
    value: number
  ) => {
    applyCustomSetting(() => cfg.setPostProcessing(p => ({ ...p, [key]: value })));
  };
  const getNonNegativeRangeValue = (value: string) => Math.max(0, Number(value));
  const effectControls = [
    { label: 'CRT Scanlines', shortLabel: 'CRT', key: 'scanlines' as const, value: cfg.postProcessing.scanlines, icon: <Monitor size={15} />, enabledValue: 120 },
    { label: 'Phosphor Glow', shortLabel: 'Glow', key: 'glow' as const, value: cfg.postProcessing.glow, icon: <Sparkles size={15} />, enabledValue: 80 },
    { label: 'RGB Split', shortLabel: 'RGB', key: 'chromaticAberration' as const, value: cfg.postProcessing.chromaticAberration, icon: <Palette size={15} />, enabledValue: 60 },
    { label: 'Static Noise', shortLabel: 'Noise', key: 'noise' as const, value: cfg.postProcessing.noise, icon: <Layers size={15} />, enabledValue: 80 },
    { label: 'Vignette', shortLabel: 'Vignette', key: 'vignette' as const, value: cfg.postProcessing.vignette, icon: <Moon size={15} />, enabledValue: 90 },
    { label: 'Flicker', shortLabel: 'Flicker', key: 'flicker' as const, value: cfg.postProcessing.flicker, icon: <Sparkles size={15} />, enabledValue: 45 },
  ];
  const renderStepper = (
    label: string,
    value: string,
    onDecrease: () => void,
    onIncrease: () => void
  ) => (
    <div className="settings-stepper" aria-label={label}>
      <button type="button" onClick={onDecrease} className="settings-stepper__button" aria-label={`Decrease ${label}`}>
        <Minus size={14} strokeWidth={1.6} />
      </button>
      <span className="settings-stepper__value">{value}</span>
      <button type="button" onClick={onIncrease} className="settings-stepper__button" aria-label={`Increase ${label}`}>
        <Plus size={14} strokeWidth={1.6} />
      </button>
    </div>
  );

  const applyLoadedInputSize = useCallback((loadId: number, width: number, height: number) => {
    if (loadId !== inputLoadIdRef.current || width <= 0 || height <= 0) return;

    setInputSize({ width, height });
    if (!userAdjustedRef.current) {
      cfg.setOutputWidth(width);
      cfg.setOutputHeight(height);
      if (typeof defaultDensity === 'number') {
        cfg.setDensity(defaultDensity);
      }
    }
  }, [cfg.setDensity, cfg.setOutputHeight, cfg.setOutputWidth, defaultDensity]);

  const handleFileSelect = useCallback((file: File) => {
    const loadId = ++inputLoadIdRef.current;
    if (fileObjectUrlRef.current) {
      URL.revokeObjectURL(fileObjectUrlRef.current);
    }
    const url = URL.createObjectURL(file);
    fileObjectUrlRef.current = url;
    setFileUrl(url);
    setAppState(AppState.PLAYING);
    setMobilePanel(null);
    setNativeFrameRate(null);
    setFrameRate(DEFAULT_FRAME_RATE);
    userAdjustedRef.current = false;
    setUrlInput('');
    setUrlError(null);
    const img = new Image();
    img.onload = () => {
      const width = img.naturalWidth || img.width;
      const height = img.naturalHeight || img.height;
      applyLoadedInputSize(loadId, width, height);
    };
    img.src = url;
  }, [applyLoadedInputSize]);

  const reset = useCallback(() => {
    inputLoadIdRef.current += 1;
    if (fileObjectUrlRef.current) {
      URL.revokeObjectURL(fileObjectUrlRef.current);
      fileObjectUrlRef.current = null;
    }
    setFileUrl(null);
    setAppState(AppState.IDLE);
    setMobilePanel(null);
    setNativeFrameRate(null);
    setFrameRate(DEFAULT_FRAME_RATE);
    setInputSize(null);
    setUrlInput('');
    setUrlError(null);
    cfg.setOutputWidth(0);
    cfg.setOutputHeight(0);
  }, [cfg.setOutputHeight, cfg.setOutputWidth]);

  const handleOutputAspectLockToggle = useCallback(() => {
    const next = !cfg.lockOutputAspect;
    cfg.setLockOutputAspect(next);

    if (!next || !inputSize || cfg.outputWidthPx <= 0) return;

    let width = Math.max(1, Math.min(maxOutputWidth, Math.round(cfg.outputWidthPx)));
    let height = Math.max(1, Math.min(maxOutputHeight, Math.round(width * inputAspect)));

    if (height >= maxOutputHeight) {
      height = maxOutputHeight;
      width = Math.max(1, Math.min(maxOutputWidth, Math.round(height / inputAspect)));
    }

    cfg.setOutputWidth(width);
    cfg.setOutputHeight(height);
  }, [
    cfg.lockOutputAspect,
    cfg.outputWidthPx,
    cfg.setLockOutputAspect,
    cfg.setOutputHeight,
    cfg.setOutputWidth,
    inputAspect,
    inputSize,
    maxOutputHeight,
    maxOutputWidth
  ]);

  const loadFromUrl = useCallback(async () => {
    const trimmedUrl = urlInput.trim();
    if (!trimmedUrl) return;

    const loadId = ++inputLoadIdRef.current;
    setUrlError(null);
    try {
      const url = new URL(trimmedUrl);
      const img = new Image();
      img.crossOrigin = 'anonymous';

      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to load image from URL'));
        img.src = url.toString();
      });

      if (loadId !== inputLoadIdRef.current) return;

      const width = img.naturalWidth || img.width;
      const height = img.naturalHeight || img.height;
      if (width <= 0 || height <= 0) {
        throw new Error('Failed to read image dimensions');
      }

      if (fileObjectUrlRef.current) {
        URL.revokeObjectURL(fileObjectUrlRef.current);
        fileObjectUrlRef.current = null;
      }

      setFileUrl(url.toString());
      setAppState(AppState.PLAYING);
      setMobilePanel(null);
      setNativeFrameRate(null);
      setFrameRate(DEFAULT_FRAME_RATE);
      userAdjustedRef.current = false;
      applyLoadedInputSize(loadId, width, height);
      setUrlInput('');
    } catch (e) {
      if (loadId !== inputLoadIdRef.current) return;
      setFileUrl(null);
      setAppState(AppState.IDLE);
      setInputSize(null);
      setNativeFrameRate(null);
      setFrameRate(DEFAULT_FRAME_RATE);
      setUrlError(e instanceof TypeError ? 'Invalid URL' : 'Failed to load image from URL');
    }
  }, [applyLoadedInputSize, urlInput]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = isLightMode ? 'light' : 'dark';

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {}
  }, [isLightMode, theme]);

  useEffect(() => {
    if (!mobilePanel) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setMobilePanel(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [mobilePanel]);

  useEffect(() => {
    if (!shouldLockBodyScroll) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [shouldLockBodyScroll]);

  useEffect(() => {
    if (!mobilePanel || typeof window.matchMedia !== 'function') return;

    const query = window.matchMedia(WIDE_VIEWPORT_QUERY);
    if (query.matches) {
      setMobilePanel(null);
      return;
    }

    const handleChange = (event: MediaQueryListEvent) => {
      if (event.matches) {
        setMobilePanel(null);
      }
    };

    query.addEventListener('change', handleChange);
    return () => query.removeEventListener('change', handleChange);
  }, [mobilePanel]);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;

    const query = window.matchMedia(COMPACT_VIEWPORT_QUERY);
    const handleChange = (event: MediaQueryListEvent) => {
      if (event.matches) {
        setMobilePanel(current => current ?? (appState === AppState.PLAYING ? 'settings' : null));
      }
    };

    query.addEventListener('change', handleChange);
    return () => query.removeEventListener('change', handleChange);
  }, [appState]);

  useEffect(() => {
    if (appState !== AppState.PLAYING || typeof window.matchMedia !== 'function') return;
    if (!window.matchMedia(COMPACT_VIEWPORT_QUERY).matches) return;

    setMobilePanel(current => current ?? 'settings');
    setExpandedSections(current => ({
      ...current,
      output: true,
      colors: true,
      adjustments: true,
      effects: true,
    }));
  }, [appState]);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;

    const query = window.matchMedia(`(max-width: 1199px)`);
    const syncSectionsForNarrowLayout = (matches: boolean) => {
      if (!matches) return;
      setExpandedSections(current => ({
        ...current,
        output: true,
        colors: true,
        adjustments: true,
        effects: true,
      }));
    };

    syncSectionsForNarrowLayout(query.matches);
    const handleChange = (event: MediaQueryListEvent) => syncSectionsForNarrowLayout(event.matches);
    query.addEventListener('change', handleChange);
    return () => query.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    return () => {
      if (fileObjectUrlRef.current) {
        URL.revokeObjectURL(fileObjectUrlRef.current);
        fileObjectUrlRef.current = null;
      }
    };
  }, []);

  return (
    <div className={`app-shell ${isPlaying ? 'app-shell--playing' : ''} ${mobilePanel ? 'app-shell--mobile-panel-open' : ''} ${isSettingsPanelOpen ? 'app-shell--mobile-settings' : ''} ${isSearchPanelOpen ? 'app-shell--mobile-search' : ''}`}>
      <KeyboardShortcuts />
      {/* Header */}
      <header className="app-header">
        {isPlaying && (
          <button
            type="button"
            onClick={() => setMobilePanel(current => current === 'settings' ? null : 'settings')}
            className="btn btn--icon mobile-header-menu"
            aria-label="Toggle settings"
            aria-expanded={isSettingsPanelOpen}
          >
            <Menu size={23} strokeWidth={1.7} />
          </button>
        )}
        <h1 className="app-header__title">gif2ascii</h1>
        <button
          type="button"
          onClick={toggleTheme}
          className={`btn btn--icon theme-toggle ${isLightMode ? 'theme-toggle--light' : ''}`}
          title={isLightMode ? 'Switch to dark mode' : 'Switch to light mode'}
          aria-label={isLightMode ? 'Switch to dark mode' : 'Switch to light mode'}
          aria-pressed={isLightMode}
        >
          {isLightMode ? <Moon size={16} strokeWidth={1.5} /> : <Sun size={16} strokeWidth={1.5} />}
        </button>
        <button
          type="button"
          onClick={exportCurrentPng}
          className="btn btn--icon mobile-header-download"
          title="Export PNG"
          aria-label="Export PNG"
          disabled={appState !== AppState.PLAYING || !fileUrl}
        >
          <Download size={25} strokeWidth={1.7} />
        </button>
      </header>

      <main
        className="app-main"
        ref={appMainRef}
        style={{
          '--layout-editor-panel': `${layoutEditorSplit}fr`,
          '--layout-tenor-panel': `${100 - layoutEditorSplit}fr`,
          '--layout-preview-panel': `${layoutPreviewSplit}fr`,
          '--layout-settings-panel': `${100 - layoutPreviewSplit}fr`,
          '--settings-split-position': `${settingsPanelSplit}%`,
        } as React.CSSProperties}
      >
        {/* Primary Preview */}
        <div className="col-canvas">
            <div className="card--canvas" style={{ width: '100%' }}>
              {appState === AppState.IDLE ? (
                 <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-md)' }}>
                   <FileUpload onFileSelect={handleFileSelect} />
                   <div className="url-input-group">
                     <div className="url-input-group__divider"><span>or paste url</span></div>
                     <div className="url-input-group__row">
                       <div className="url-input-group__field">
                         <Link size={14} />
                         <input type="text" value={urlInput} onChange={(e) => { setUrlInput(e.target.value); setUrlError(null); }} onKeyDown={(e) => e.key === 'Enter' && loadFromUrl()} placeholder="https://example.com/image.gif" style={{ paddingLeft: '32px' }} />
                       </div>
                       <button onClick={loadFromUrl} disabled={!urlInput.trim()} className="btn btn--primary">Load</button>
                     </div>
                     {urlError && (<p className="url-input-group__error">[ERROR] {urlError}</p>)}
                   </div>
                 </div>
              ) : (
                <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
                  {fileUrl && (
                    <AsciiPlayer
                      ref={playerRef}
                      imageSrc={fileUrl}
                      config={cfg.deferredConfig}
                      outputWidth={cfg.deferredOutputWidth}
                      outputHeight={cfg.deferredOutputHeight}
                      export2x={cfg.export2x}
                      frameRate={frameRate}
                      playbackSpeed={playbackSpeed}
                      loopMode={loopMode}
                      onPlaybackSpeedChange={setPlaybackSpeed}
                      onNativeFrameRate={handleNativeFrameRate}
                    />
                  )}
                </div>
              )}
            </div>
          </div>

        <div
          className="layout-resizer layout-resizer--preview-settings"
          role="separator"
          aria-label="Resize preview and settings panels"
          aria-orientation="horizontal"
          aria-valuemin={LAYOUT_PREVIEW_SPLIT_MIN}
          aria-valuemax={LAYOUT_PREVIEW_SPLIT_MAX}
          aria-valuenow={layoutPreviewSplit}
          aria-valuetext={`${layoutPreviewSplit}% preview`}
          tabIndex={0}
          onPointerDown={handleLayoutPreviewResizePointerDown}
          onKeyDown={handleLayoutPreviewResizeKeyDown}
        >
          <span className="layout-resizer__line" aria-hidden="true" />
          <div
            className="layout-resizer layout-resizer--settings-intersection"
            role="separator"
            aria-label="Resize preview and bottom settings panels"
            aria-valuetext={`${settingsPanelSplit}% render settings, ${layoutPreviewSplit}% preview`}
            aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown Enter"
            tabIndex={0}
            onPointerDown={handleSettingsLayoutIntersectionResizePointerDown}
            onKeyDown={handleSettingsLayoutIntersectionResizeKeyDown}
          >
            <span className="layout-resizer__line layout-resizer__line--vertical" aria-hidden="true" />
            <span className="layout-resizer__line layout-resizer__line--horizontal" aria-hidden="true" />
          </div>
        </div>

        {/* Render Settings */}
        <div
          className="col-controls"
          role={isSettingsPanelOpen ? 'region' : undefined}
          aria-label={isSettingsPanelOpen ? 'Mobile render settings' : undefined}
        >
          <div className="mobile-drawer-header">
            <span className="mobile-drawer-title"><Settings size={16} />Settings</span>
            <button
              type="button"
              onClick={closeMobilePanel}
              className="btn btn--icon mobile-drawer-close"
              aria-label="Close settings"
            >
              <X size={16} strokeWidth={1.5} />
            </button>
          </div>
          
          {/* Settings Panels */}
          <div
            className="settings-panel-grid"
            ref={settingsPanelGridRef}
            style={{
              '--settings-render-panel': `${settingsPanelSplit}fr`,
              '--settings-image-panel': `${100 - settingsPanelSplit}fr`,
            } as React.CSSProperties}
          >
          <div className="card settings-card settings-card--render">
            <div className="settings-header">
              <span className="settings-header__identity">
                <Settings size={18} className="settings-header__icon" />
                <span className="settings-header__title">Render Settings</span>
              </span>
              {isPlaying && (
                <button onClick={resetEditorSettings} className="settings-header__reset">
                  <RotateCcw size={14} />Reset Settings
                </button>
              )}
            </div>

            <div className="settings-sections">

              {/* OUTPUT SECTION */}
              <div className="section-panel section-panel--output">
                <button onClick={() => toggleSection('output')} className="section-header" aria-expanded={expandedSections.output}>
                  <span className="section-header__label"><Monitor size={14} />Output</span>
                  <ChevronDown size={14} className={`section-header__chevron ${expandedSections.output ? 'section-header__chevron--open' : ''}`} />
                </button>
                {expandedSections.output && (
                  <div className="section-body">
                    <div className="settings-row-grid settings-row-grid--output">
                      <div className="settings-row">
                        <span className="settings-row__label">
                          <ColumnsDimensionIcon size={15} />
                          <span className="label-desktop">Columns</span>
                          <span className="label-mobile">Cols</span>
                        </span>
                        {renderStepper('Columns', String(cfg.density), () => stepDensity(-1), () => stepDensity(1))}
                      </div>
                      <div className="settings-row">
                        <span className="settings-row__label">
                          <span className="settings-row__icon-box" />
                          <span className="label-desktop">Font Aspect Ratio</span>
                          <span className="label-mobile">Aspect</span>
                        </span>
                        {renderStepper('Font aspect ratio', cfg.fontAspectRatio.toFixed(2), () => stepFontAspect(-0.01), () => stepFontAspect(0.01))}
                      </div>
                      <div className="settings-row settings-row--desktop-only">
                        <span className="settings-row__label">Frame Rate (FPS)</span>
                        {renderStepper('Frame Rate (FPS)', String(frameRate), () => stepFrameRate(-1), () => stepFrameRate(1))}
                      </div>
                      <div className="settings-row settings-row--desktop-only">
                        <span className="settings-row__label">Playback Speed</span>
                        {renderStepper('Playback Speed', `${playbackSpeed.toFixed(2)}x`, () => stepPlaybackSpeed(-1), () => stepPlaybackSpeed(1))}
                      </div>
                      <div className="settings-row settings-row--desktop-only">
                        <span className="settings-row__label">Loop</span>
                        <select
                          className="settings-inline-select"
                          value={loopMode}
                          onChange={(e) => setLoopMode(e.target.value as PlaybackLoopMode)}
                          aria-label="Loop playback"
                        >
                          {LOOP_MODE_OPTIONS.map(option => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="settings-row settings-row--wide settings-row--mobile-only">
                        <span className="settings-row__label"><CharacterSetIcon size={15} />Char Set</span>
                        <select
                          value={selectedCharPresetName}
                          onChange={(e) => {
                            const preset = CHAR_PRESETS.find(p => p.name === e.target.value);
                            if (preset) applyCustomSetting(() => cfg.setChars(preset.chars));
                          }}
                          aria-label="Character Preset"
                        >
                          {CHAR_PRESETS.map(p => (<option key={p.name} value={p.name}>{formatCharacterPresetOption(p.name, p.chars)}</option>))}
                          {!CHAR_PRESETS.find(p => p.chars === cfg.chars) && (<option value="Custom">Custom</option>)}
                        </select>
                      </div>
                      <div className="settings-row settings-row--wide settings-row--mobile-only settings-row--toggle-pair">
                        <div className="settings-row__toggle">
                          <span className="settings-row__label"><Palette size={15} />Source Color</span>
                          <button onClick={() => applyCustomSetting(() => cfg.setUseSourceColor(!cfg.useSourceColor))} className={`toggle__track ${cfg.useSourceColor ? 'toggle__track--on' : ''}`} aria-label="Toggle source color" aria-pressed={cfg.useSourceColor}><div className="toggle__thumb" /></button>
                        </div>
                        <div className="settings-row__toggle">
                          <span className="settings-row__label">Invert</span>
                          <button onClick={() => applyCustomSetting(() => cfg.setInvert(!cfg.invert))} className={`toggle__track ${cfg.invert ? 'toggle__track--on' : ''}`} aria-label="Toggle invert colors" aria-pressed={cfg.invert}><div className="toggle__thumb" /></button>
                        </div>
                      </div>
                    </div>
                    <div className="slider-group settings-advanced-output">
                      <div className="slider-label">
                        <span className="slider-label__text">Output Width</span>
                        <div className="inline-row">
                            <input type="number" min="1" max={maxOutputWidth} value={cfg.outputWidthPx > 0 ? cfg.outputWidthPx : ''} onChange={(e) => { const val = parseInt(e.target.value, 10); if (!isNaN(val) && val > 0) cfg.handleOutputWidthChange(Math.min(val, maxOutputWidth)); }} disabled={!inputSize} placeholder="--" aria-label="Output Width" />
                          <span className="inline-row__unit">px</span>
                        </div>
                      </div>
                        <input type="range" min="64" max={maxOutputWidth} value={cfg.outputWidthPx > 0 ? cfg.outputWidthPx : 64} onChange={(e) => cfg.handleOutputWidthChange(Number(e.target.value))} disabled={!inputSize} aria-label="Output Width" />
                    </div>
                    <div className="slider-group settings-advanced-output">
                      <div className="slider-label">
                        <span className="slider-label__text">Output Height</span>
                        <div className="inline-row">
                            <input type="number" min="1" max={maxOutputHeight} value={cfg.outputHeightPx > 0 ? cfg.outputHeightPx : ''} onChange={(e) => { const val = parseInt(e.target.value, 10); if (!isNaN(val) && val > 0) cfg.handleOutputHeightChange(Math.min(val, maxOutputHeight)); }} disabled={!inputSize} placeholder="--" aria-label="Output Height" />
                          <span className="inline-row__unit">px</span>
                        </div>
                      </div>
                        <input type="range" min="64" max={maxOutputHeight} value={cfg.outputHeightPx > 0 ? cfg.outputHeightPx : 64} onChange={(e) => cfg.handleOutputHeightChange(Number(e.target.value))} disabled={!inputSize} aria-label="Output Height" />
                    </div>
                    <div className="toggle settings-advanced-output">
                      <span className="toggle__label">Lock Output Aspect</span>
                        <button onClick={handleOutputAspectLockToggle} className={`toggle__track ${cfg.lockOutputAspect ? 'toggle__track--on' : ''}`} aria-label="Toggle output aspect lock" aria-pressed={cfg.lockOutputAspect}><div className="toggle__thumb" /></button>
                    </div>
                  </div>
                )}
              </div>

              {/* COLORS SECTION */}
              <div className="section-panel section-panel--colors">
                <button onClick={() => toggleSection('colors')} className="section-header" aria-expanded={expandedSections.colors}>
                  <span className="section-header__label"><Palette size={14} />Colors</span>
                  <ChevronDown size={14} className={`section-header__chevron ${expandedSections.colors ? 'section-header__chevron--open' : ''}`} />
                </button>
                {expandedSections.colors && (
                  <div className="section-body">
                    <div className="toggle color-source-toggle">
                      <span className="toggle__label">
                        <span className="label-desktop">Use Source Color</span>
                        <span className="label-mobile">Source Color</span>
                      </span>
                        <button onClick={() => applyCustomSetting(() => cfg.setUseSourceColor(!cfg.useSourceColor))} className={`toggle__track ${cfg.useSourceColor ? 'toggle__track--on' : ''}`} aria-label="Toggle source color" aria-pressed={cfg.useSourceColor}><div className="toggle__thumb" /></button>
                    </div>
                    <div className="color-grid settings-color-advanced">
                      <div className={`color-picker ${cfg.useSourceColor ? 'section-dimmed' : ''}`}>
                        <label className="color-picker__label">Text Color</label>
                        <div className="color-picker__swatch">
                            <input type="color" value={cfg.color} onChange={(e) => applyCustomSetting(() => cfg.setColor(e.target.value))} disabled={cfg.useSourceColor} aria-label="Text Color" />
                          <span className="color-picker__hex">{cfg.color}</span>
                        </div>
                      </div>
                      <div className="color-picker">
                        <label className="color-picker__label">Bg Color</label>
                        <div className="color-picker__swatch">
                            <input type="color" value={cfg.bgIsTransparent ? '#000000' : cfg.bgColor} onChange={(e) => applyCustomSetting(() => cfg.setBgColor(e.target.value))} disabled={cfg.bgIsTransparent} aria-label="Background Color" />
                          <span className="color-picker__hex">{cfg.bgIsTransparent ? 'transparent' : cfg.bgColor}</span>
                        </div>
                      </div>
                    </div>
                    <div className="toggle settings-color-advanced">
                      <span className="toggle__label">Transparent Bg</span>
                        <button onClick={() => applyCustomSetting(() => cfg.setBgColor(cfg.bgIsTransparent ? '#000000' : 'transparent'))} className={`toggle__track ${cfg.bgIsTransparent ? 'toggle__track--on' : ''}`} aria-label="Toggle transparent background" aria-pressed={cfg.bgIsTransparent}><div className="toggle__thumb" /></button>
                    </div>
                    <div className="toggle color-invert-toggle">
                      <span className="toggle__label">Invert</span>
                        <button onClick={() => applyCustomSetting(() => cfg.setInvert(!cfg.invert))} className={`toggle__track ${cfg.invert ? 'toggle__track--on' : ''}`} aria-label="Toggle invert colors" aria-pressed={cfg.invert}><div className="toggle__thumb" /></button>
                    </div>
                    <div className={`settings-row settings-row--palette ${!cfg.useSourceColor ? 'section-dimmed' : ''}`}>
                      <span className="settings-row__label">
                        <Palette size={15} />
                        <span className="label-desktop">Color Palette</span>
                        <span className="label-mobile">Palette</span>
                      </span>
                        <select value={cfg.colorPalette} onChange={(e) => applyCustomSetting(() => cfg.setColorPalette(e.target.value))} disabled={!cfg.useSourceColor} aria-label="Color Palette">
                        {Object.entries(COLOR_PALETTES).map(([id, palette]) => (
                          <option key={id} value={id}>{palette.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>

            </div>
          </div>

          <div
            className="settings-panel-resizer"
            role="separator"
            aria-label="Resize settings panels"
            aria-orientation="vertical"
            aria-valuemin={SETTINGS_PANEL_SPLIT_MIN}
            aria-valuemax={SETTINGS_PANEL_SPLIT_MAX}
            aria-valuenow={settingsPanelSplit}
            aria-valuetext={`${settingsPanelSplit}% render settings`}
            tabIndex={0}
            onPointerDown={handleSettingsPanelResizePointerDown}
            onKeyDown={handleSettingsPanelResizeKeyDown}
          >
            <span className="settings-panel-resizer__line" aria-hidden="true" />
          </div>

          <div className="card settings-card settings-card--image">
            <div className="settings-header settings-header--secondary">
              <span className="settings-header__identity">
                <SlidersHorizontal size={18} className="settings-header__icon" />
                <span className="settings-header__title">Image &amp; Effects</span>
              </span>
            </div>

            <div className="settings-sections">

              {/* ADJUSTMENTS SECTION */}
              <div className="section-panel section-panel--adjustments">
                <button onClick={() => toggleSection('adjustments')} className="section-header" aria-expanded={expandedSections.adjustments}>
                  <span className="section-header__label"><SlidersHorizontal size={14} />Adjustments</span>
                  <ChevronDown size={14} className={`section-header__chevron ${expandedSections.adjustments ? 'section-header__chevron--open' : ''}`} />
                </button>
                {expandedSections.adjustments && (
                  <div className="section-body">
                    <div className="slider-group settings-source-overlay">
                      <div className="slider-label"><span className="slider-label__text" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Layers size={12} /> Source Overlay</span><span className="slider-label__value">{Math.round(cfg.overlayOpacity * 100)}%</span></div>
                        <input type="range" min="0" max="1" step="0.05" value={cfg.overlayOpacity} onChange={(e) => applyCustomSetting(() => cfg.setOverlayOpacity(Number(e.target.value)))} aria-label="Source Overlay" />
                    </div>
                    <div className="slider-group settings-slider-row">
                      <div className="slider-label">
                        <span className="slider-label__text"><Sun size={15} className="settings-slider-row__mobile-icon" />Brightness</span>
                        <span className="slider-label__value">{cfg.brightness > 0 ? `+${cfg.brightness}` : cfg.brightness}</span>
                      </div>
                      <span className="settings-slider-row__bound" aria-hidden="true">-300</span>
                        <input type="range" min="-300" max="300" value={cfg.brightness} onChange={(e) => applyCustomSetting(() => cfg.setBrightness(Number(e.target.value)))} aria-label="Brightness" />
                      <span className="settings-slider-row__bound settings-slider-row__bound--max" aria-hidden="true">+300</span>
                    </div>
                    <div className="slider-group settings-slider-row">
                      <div className="slider-label">
                        <span className="slider-label__text"><Contrast size={15} className="settings-slider-row__mobile-icon" />Contrast</span>
                        <span className="slider-label__value">{cfg.contrast > 0 ? `+${cfg.contrast}` : cfg.contrast}</span>
                      </div>
                      <span className="settings-slider-row__bound" aria-hidden="true">-300</span>
                        <input type="range" min="-300" max="300" value={cfg.contrast} onChange={(e) => applyCustomSetting(() => cfg.setContrast(Number(e.target.value)))} aria-label="Contrast" />
                      <span className="settings-slider-row__bound settings-slider-row__bound--max" aria-hidden="true">+300</span>
                    </div>
                    <div className="slider-group settings-slider-row">
                      <div className="slider-label">
                        <span className="slider-label__text"><Droplet size={15} className="settings-slider-row__mobile-icon" />Saturation</span>
                        <span className="slider-label__value">{cfg.saturation > 0 ? `+${cfg.saturation}` : cfg.saturation}</span>
                      </div>
                      <span className="settings-slider-row__bound" aria-hidden="true">-300</span>
                        <input type="range" min="-300" max="300" value={cfg.saturation} onChange={(e) => applyCustomSetting(() => cfg.setSaturation(Number(e.target.value)))} aria-label="Saturation" />
                      <span className="settings-slider-row__bound settings-slider-row__bound--max" aria-hidden="true">+300</span>
                    </div>
                    <div className="slider-group settings-slider-row">
                      <div className="slider-label">
                        <span className="slider-label__text"><Triangle size={15} className="settings-slider-row__mobile-icon" />Sharpness</span>
                        <span className="slider-label__value">{cfg.sharpness}</span>
                      </div>
                      <span className="settings-slider-row__bound" aria-hidden="true">0</span>
                        <input type="range" min="0" max="300" value={cfg.sharpness} onChange={(e) => applyCustomSetting(() => cfg.setSharpness(getNonNegativeRangeValue(e.target.value)))} aria-label="Sharpness" />
                      <span className="settings-slider-row__bound settings-slider-row__bound--max" aria-hidden="true">300</span>
                    </div>
                    <div className="toggle settings-toggle-row">
                      <span className="toggle__label"><DitherIcon className="settings-slider-row__mobile-icon" />Dithering</span>
                        <button onClick={() => applyCustomSetting(() => cfg.setDithering(!cfg.dithering))} className={`toggle__track ${cfg.dithering ? 'toggle__track--on' : ''}`} aria-label="Toggle dithering" aria-pressed={cfg.dithering}><div className="toggle__thumb" /></button>
                    </div>
                  </div>
                )}
              </div>

              {/* CHARACTERS SECTION */}
              <div className="section-panel section-panel--characters settings-legacy-section">
                <button onClick={() => toggleSection('characters')} className="section-header" aria-expanded={expandedSections.characters}>
                  <span className="section-header__label"><Type size={14} />Characters</span>
                  <ChevronDown size={14} className={`section-header__chevron ${expandedSections.characters ? 'section-header__chevron--open' : ''}`} />
                </button>
                {expandedSections.characters && (
                  <div className="section-body">
                    <div>
                      <label className="label" style={{ display: 'block', marginBottom: 'var(--space-xs)' }}>Character Preset</label>
                        <select value={CHAR_PRESETS.find(p => p.chars === cfg.chars)?.name || 'Custom'} onChange={(e) => { const preset = CHAR_PRESETS.find(p => p.name === e.target.value); if (preset) applyCustomSetting(() => cfg.setChars(preset.chars)); }} aria-label="Character Preset">
                        {CHAR_PRESETS.map(p => (<option key={p.name} value={p.name}>{p.name}</option>))}
                        {!CHAR_PRESETS.find(p => p.chars === cfg.chars) && (<option value="Custom">Custom</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="label" style={{ display: 'block', marginBottom: 'var(--space-xs)' }}>Character Map (Dark → Light)</label>
                        <input type="text" value={cfg.chars} onChange={(e) => applyCustomSetting(() => cfg.setChars(e.target.value))} aria-label="Character Map" />
                    </div>
                  </div>
                )}
              </div>

              {/* EFFECTS SECTION */}
              <div className="section-panel section-panel--effects">
                <button onClick={() => toggleSection('effects')} className="section-header" aria-expanded={expandedSections.effects}>
                  <span className="section-header__label"><Sparkles size={14} />Effects</span>
                  <ChevronDown size={14} className={`section-header__chevron ${expandedSections.effects ? 'section-header__chevron--open' : ''}`} />
                </button>
                {expandedSections.effects && (
                  <div className="section-body">
                    <div className="effects-compact-grid">
                      {effectControls.map(({ label, shortLabel, key, value, icon, enabledValue }) => (
                        <div key={key} className="effect-tile">
                          <span className="effect-tile__label">{icon}{shortLabel}</span>
                          <span className="effect-tile__value">{value}</span>
                          <button
                            type="button"
                            onClick={() => setPostProcessingValue(key, value > 0 ? 0 : enabledValue)}
                            className={`toggle__track ${value > 0 ? 'toggle__track--on' : ''}`}
                            aria-label={`Toggle ${label}`}
                            aria-pressed={value > 0}
                          >
                            <div className="toggle__thumb" />
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="effects-slider-list">
                      {effectControls.map(({ label, key, value }) => (
                        <div key={key} className="slider-group settings-slider-row">
                          <div className="slider-label"><span className="slider-label__text">{label}</span><span className="slider-label__value">{value}</span></div>
                            <input type="range" min="0" max="300" value={value} onChange={(e) => setPostProcessingValue(key, getNonNegativeRangeValue(e.target.value))} aria-label={label} />
                        </div>
                      ))}

                      <div className="section-separator" aria-hidden="true" />

                      <div className="slider-group settings-slider-row">
                        <div className="slider-label"><span className="slider-label__text">Matrix Rain</span><span className="slider-label__value">{cfg.animationEffects.matrixRain}</span></div>
                          <input type="range" min="0" max="300" value={cfg.animationEffects.matrixRain} onChange={(e) => applyCustomSetting(() => cfg.setAnimationEffects(a => ({ ...a, matrixRain: getNonNegativeRangeValue(e.target.value) })))} aria-label="Matrix Rain" />
                      </div>
                      <div className="slider-group settings-slider-row">
                        <div className="slider-label"><span className="slider-label__text">Wave Distortion</span><span className="slider-label__value">{cfg.animationEffects.waveDistortion}</span></div>
                          <input type="range" min="0" max="300" value={cfg.animationEffects.waveDistortion} onChange={(e) => applyCustomSetting(() => cfg.setAnimationEffects(a => ({ ...a, waveDistortion: getNonNegativeRangeValue(e.target.value) })))} aria-label="Wave Distortion" />
                      </div>
                      <div className="toggle settings-toggle-row">
                        <span className="toggle__label">Typing Reveal</span>
                          <button onClick={() => applyCustomSetting(() => cfg.setAnimationEffects(a => ({ ...a, typingReveal: !a.typingReveal })))} className={`toggle__track ${cfg.animationEffects.typingReveal ? 'toggle__track--on' : ''}`} aria-label="Toggle typing reveal" aria-pressed={cfg.animationEffects.typingReveal}><div className="toggle__thumb" /></button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* EXPORT SECTION */}
              <div className="section-panel section-panel--export settings-legacy-section">
                <button onClick={() => toggleSection('export')} className="section-header" aria-expanded={expandedSections.export}>
                  <span className="section-header__label"><Download size={14} />Export</span>
                  <ChevronDown size={14} className={`section-header__chevron ${expandedSections.export ? 'section-header__chevron--open' : ''}`} />
                </button>
                {expandedSections.export && (
                  <div className="section-body">
                    <div className="toggle">
                      <span className="toggle__label">Export 2x Resolution</span>
                        <button onClick={() => cfg.setExport2x(!cfg.export2x)} className={`toggle__track ${cfg.export2x ? 'toggle__track--on' : ''}`} aria-label="Toggle export 2x resolution" aria-pressed={cfg.export2x}><div className="toggle__thumb" /></button>
                    </div>
                  </div>
                )}
              </div>

            </div>
          </div>
          </div>

          {isPlaying && (
            <button onClick={reset} className="btn btn--destructive" style={{ width: '100%' }}>
              <RefreshCcw size={14} />Reset &amp; Upload New
            </button>
          )}
        </div>

        <div
          className="layout-resizer layout-resizer--editor-tenor"
          role="separator"
          aria-label="Resize editor and Tenor panels"
          aria-orientation="vertical"
          aria-valuemin={LAYOUT_EDITOR_SPLIT_MIN}
          aria-valuemax={LAYOUT_EDITOR_SPLIT_MAX}
          aria-valuenow={layoutEditorSplit}
          aria-valuetext={`${layoutEditorSplit}% editor`}
          tabIndex={0}
          onPointerDown={handleLayoutEditorResizePointerDown}
          onKeyDown={handleLayoutEditorResizeKeyDown}
        >
          <span className="layout-resizer__line" aria-hidden="true" />
        </div>

        <div
          className="layout-resizer layout-resizer--intersection"
          role="separator"
          aria-label="Resize intersecting layout panels"
          aria-valuetext={`${layoutEditorSplit}% editor, ${layoutPreviewSplit}% preview`}
          aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown Enter"
          tabIndex={0}
          onPointerDown={handleLayoutIntersectionResizePointerDown}
          onKeyDown={handleLayoutIntersectionResizeKeyDown}
        >
          <span className="layout-resizer__line layout-resizer__line--vertical" aria-hidden="true" />
          <span className="layout-resizer__line layout-resizer__line--horizontal" aria-hidden="true" />
        </div>

        {/* Tenor Search */}
        <div
          className="col-tenor"
          role={isSearchPanelOpen ? 'dialog' : undefined}
          aria-modal={isSearchPanelOpen ? true : undefined}
          aria-label={isSearchPanelOpen ? 'Mobile Tenor GIF search' : undefined}
        >
          <div className="mobile-drawer-header">
            <span className="mobile-drawer-title"><Search size={16} />Search GIFs</span>
            <button
              type="button"
              onClick={closeMobilePanel}
              className="btn btn--icon mobile-drawer-close"
              aria-label="Close search"
            >
              <X size={16} strokeWidth={1.5} />
            </button>
          </div>
          <div className="card--tenor">
            <TenorSearch onGifSelect={handleFileSelect} compact />
          </div>
        </div>
      </main>

      <div className="mobile-action-bar" aria-label="Mobile actions">
        {isPlaying && (
          <button
            type="button"
            onClick={() => setMobilePanel(current => current === 'settings' ? null : 'settings')}
            className="btn btn--secondary mobile-action-bar__button"
            aria-expanded={isSettingsPanelOpen}
          >
            <Settings size={16} strokeWidth={1.5} />Settings
          </button>
        )}
        <button
          type="button"
          onClick={() => setMobilePanel(current => current === 'search' ? null : 'search')}
          className="btn btn--secondary mobile-action-bar__button"
          aria-expanded={isSearchPanelOpen}
        >
          <Search size={16} strokeWidth={1.5} />Search
        </button>
      </div>

      {isSearchPanelOpen && (
        <button
          type="button"
          className="mobile-drawer-backdrop"
          onClick={closeMobilePanel}
          aria-label="Close mobile panel"
        />
      )}
    </div>
  );
};

export default App;
