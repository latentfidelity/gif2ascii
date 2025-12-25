import React, { useEffect, useMemo, useRef, useState, useDeferredValue, useCallback } from 'react';
import { Settings, RefreshCcw, Layers, Monitor, RotateCcw, Link, ChevronDown, Palette, SlidersHorizontal, Type, Download } from 'lucide-react';
import FileUpload from './components/FileUpload';
import AsciiPlayer from './components/AsciiPlayer';
import TenorSearch from './components/TenorSearch';
import { AsciiConfig, AppState } from './types';
import { DEFAULT_CHARS, CHAR_PRESETS } from './services/asciiUtils';

const DEFAULT_DENSITY_CELL_WIDTH = 5;

const App: React.FC = () => {
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  
  // Configuration State
  const [density, setDensity] = useState(60);
  const [chars, setChars] = useState(DEFAULT_CHARS);
  const [color, setColor] = useState('#ffffff'); // White default
  const [invert, setInvert] = useState(false);
  const [bgColor, setBgColor] = useState('#000000');
  const [fontAspectRatio, setFontAspectRatio] = useState(0.55);
  const [overlayOpacity, setOverlayOpacity] = useState(0);
  const [useSourceColor, setUseSourceColor] = useState(false);
  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(0);
  const [saturation, setSaturation] = useState(0);
  const [dithering, setDithering] = useState(false);
  const [sharpness, setSharpness] = useState(50);
  const [export2x, setExport2x] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [inputSize, setInputSize] = useState<{ width: number; height: number } | null>(null);
  const [outputWidth, setOutputWidth] = useState(0);
  const [outputHeight, setOutputHeight] = useState(0);
  const [lockOutputAspect, setLockOutputAspect] = useState(true);
  const userAdjustedRef = useRef(false);
  const controlsRef = useRef<HTMLDivElement | null>(null);
  const [controlsHeight, setControlsHeight] = useState<number | null>(null);

  // Section collapse state
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    output: false,
    colors: false,
    adjustments: false,
    characters: false,
    export: false,
  });

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const inputAspect = inputSize ? (inputSize.height / inputSize.width) : 1;
  const outputWidthPx = outputWidth > 0 ? outputWidth : (inputSize?.width ?? 0);
  const outputHeightPx = outputHeight > 0 ? outputHeight : (inputSize?.height ?? 0);
  const maxOutputWidth = inputSize
    ? Math.max(320, inputSize.width * 2)
    : 2000;
  const maxOutputHeight = inputSize
    ? Math.max(320, inputSize.height * 2)
    : 2000;
  const maxDensity = inputSize
    ? Math.max(300, Math.round(inputSize.width / 2))
    : 300;
  const bgIsTransparent = bgColor === 'transparent';

  const config: AsciiConfig = useMemo(() => ({
    resolution: density,
    chars,
    color,
    backgroundColor: bgColor,
    invert: !invert,
    fontAspectRatio,
    overlayOpacity,
    useSourceColor,
    brightness,
    contrast,
    saturation,
    dithering,
    sharpness
  }), [density, chars, color, bgColor, invert, fontAspectRatio, overlayOpacity, useSourceColor, brightness, contrast, saturation, dithering, sharpness]);

  // Defer expensive config updates to keep sliders responsive
  const deferredConfig = useDeferredValue(config);
  const deferredOutputWidth = useDeferredValue(outputWidthPx);
  const deferredOutputHeight = useDeferredValue(outputHeightPx);

  const handleOutputWidthChange = (value: number) => {
    userAdjustedRef.current = true;
    setOutputWidth(value);
    if (lockOutputAspect && inputSize) {
      setOutputHeight(Math.max(1, Math.round(value * inputAspect)));
    }
  };

  const handleOutputHeightChange = (value: number) => {
    userAdjustedRef.current = true;
    setOutputHeight(value);
    if (lockOutputAspect && inputSize) {
      setOutputWidth(Math.max(1, Math.round(value / inputAspect)));
    }
  };

  const handleDensityChange = (value: number) => {
    userAdjustedRef.current = true;
    setDensity(value);
  };

  const handleFileSelect = (file: File) => {
    const url = URL.createObjectURL(file);
    setFileUrl(url);
    setAppState(AppState.PLAYING);
    userAdjustedRef.current = false;
    // Reset defaults on new file
    setChars(DEFAULT_CHARS);
    setColor('#ffffff');
    const img = new Image();
    img.onload = () => {
      const width = img.naturalWidth || img.width;
      const height = img.naturalHeight || img.height;
      if (width > 0 && height > 0) {
        setInputSize({ width, height });
        if (!userAdjustedRef.current) {
          setOutputWidth(width);
          setOutputHeight(height);
          setDensity(Math.max(10, Math.round(width / DEFAULT_DENSITY_CELL_WIDTH)));
        }
      }
    };
    img.src = url;
  };

  const reset = () => {
    setFileUrl(null);
    setAppState(AppState.IDLE);
    setInputSize(null);
    setOutputWidth(0);
    setOutputHeight(0);
  };

  const resetSettings = useCallback(() => {
    setDensity(60);
    setChars(DEFAULT_CHARS);
    setColor('#ffffff');
    setInvert(false);
    setBgColor('#000000');
    setFontAspectRatio(0.55);
    setOverlayOpacity(0);
    setUseSourceColor(false);
    setBrightness(0);
    setContrast(0);
    setSaturation(0);
    setDithering(false);
    setSharpness(50);
    setExport2x(false);
    setLockOutputAspect(true);
    if (inputSize) {
      setOutputWidth(inputSize.width);
      setOutputHeight(inputSize.height);
      setDensity(Math.max(10, Math.round(inputSize.width / DEFAULT_DENSITY_CELL_WIDTH)));
    }
  }, [inputSize]);

  const loadFromUrl = useCallback(async () => {
    if (!urlInput.trim()) return;
    setUrlError(null);
    try {
      // Validate URL
      const url = new URL(urlInput.trim());
      // Try to fetch to check if it's accessible
      const response = await fetch(url.toString(), { method: 'HEAD', mode: 'cors' }).catch(() => null);
      if (response && !response.ok) {
        throw new Error('URL not accessible');
      }
      setFileUrl(url.toString());
      setAppState(AppState.PLAYING);
      userAdjustedRef.current = false;
      setChars(DEFAULT_CHARS);
      setColor('#ffffff');
      // Load image to get dimensions
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const width = img.naturalWidth || img.width;
        const height = img.naturalHeight || img.height;
        if (width > 0 && height > 0) {
          setInputSize({ width, height });
          if (!userAdjustedRef.current) {
            setOutputWidth(width);
            setOutputHeight(height);
            setDensity(Math.max(10, Math.round(width / DEFAULT_DENSITY_CELL_WIDTH)));
          }
        }
      };
      img.onerror = () => {
        setUrlError('Failed to load image from URL');
      };
      img.src = url.toString();
      setUrlInput('');
    } catch (e) {
      setUrlError('Invalid URL');
    }
  }, [urlInput]);

  useEffect(() => {
    const element = controlsRef.current;
    if (!element) return;

    const updateHeight = () => {
      const nextHeight = Math.round(element.getBoundingClientRect().height);
      setControlsHeight((prev) => (prev === nextHeight ? prev : nextHeight));
    };

    updateHeight();

    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver(() => updateHeight());
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      {/* Header */}
      <header className="border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="font-bold text-xl tracking-tight">gif2ascii</h1>
          </div>
          <div className="flex items-center gap-4" />
        </div>
      </header>

      <main
        className="flex-1 max-w-7xl mx-auto w-full p-6 flex flex-col lg:flex-row gap-8"
        style={{ '--controls-height': controlsHeight ? `${controlsHeight}px` : 'auto' } as React.CSSProperties}
      >
        
        {/* Left Column: Controls */}
        <div className="lg:w-80 flex flex-col gap-6 shrink-0">
          
          {/* Manual Controls */}
          <div
            ref={controlsRef}
            className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex flex-col gap-6"
          >
            <h3 className="text-lg font-bold flex items-center gap-2 text-zinc-300">
              <Settings size={18} />
              Render Settings
            </h3>

            {/* OUTPUT SECTION */}
            <div className="border border-zinc-800 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleSection('output')}
                className="w-full flex items-center justify-between p-3 bg-zinc-800/50 hover:bg-zinc-800 transition-colors"
              >
                <span className="flex items-center gap-2 text-sm font-medium text-zinc-300">
                  <Monitor size={14} />
                  Output
                </span>
                <ChevronDown size={16} className={`text-zinc-400 transition-transform ${expandedSections.output ? 'rotate-180' : ''}`} />
              </button>
              {expandedSections.output && (
                <div className="p-3 space-y-4 border-t border-zinc-800">
                  {/* Density Slider */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-zinc-400">
                      <span>Density</span>
                      <span>{density} cols</span>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max={maxDensity}
                      value={density}
                      onChange={(e) => handleDensityChange(Number(e.target.value))}
                      className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />
                  </div>

                  {/* Output Width Slider */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs text-zinc-400">
                      <span>Output Width</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min="1"
                          max={maxOutputWidth}
                          value={outputWidthPx > 0 ? outputWidthPx : ''}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            if (!isNaN(val) && val > 0) {
                              handleOutputWidthChange(Math.min(val, maxOutputWidth));
                            }
                          }}
                          disabled={!inputSize}
                          className="w-16 bg-zinc-800 border border-zinc-700 rounded px-2 py-0.5 text-zinc-200 text-right focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                          placeholder="--"
                        />
                        <span>px</span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min="64"
                      max={maxOutputWidth}
                      value={outputWidthPx > 0 ? outputWidthPx : 64}
                      onChange={(e) => handleOutputWidthChange(Number(e.target.value))}
                      disabled={!inputSize}
                      className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </div>

                  {/* Output Height Slider */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs text-zinc-400">
                      <span>Output Height</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min="1"
                          max={maxOutputHeight}
                          value={outputHeightPx > 0 ? outputHeightPx : ''}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            if (!isNaN(val) && val > 0) {
                              handleOutputHeightChange(Math.min(val, maxOutputHeight));
                            }
                          }}
                          disabled={!inputSize}
                          className="w-16 bg-zinc-800 border border-zinc-700 rounded px-2 py-0.5 text-zinc-200 text-right focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                          placeholder="--"
                        />
                        <span>px</span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min="64"
                      max={maxOutputHeight}
                      value={outputHeightPx > 0 ? outputHeightPx : 64}
                      onChange={(e) => handleOutputHeightChange(Number(e.target.value))}
                      disabled={!inputSize}
                      className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </div>

                  {/* Lock Aspect */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-zinc-300">Lock Output Aspect</span>
                    <button
                      onClick={() => {
                        const next = !lockOutputAspect;
                        setLockOutputAspect(next);
                        if (next && inputSize && outputWidthPx > 0) {
                          setOutputHeight(Math.max(1, Math.round(outputWidthPx * inputAspect)));
                        }
                      }}
                      className={`w-12 h-6 rounded-full transition-colors relative ${lockOutputAspect ? 'bg-indigo-600' : 'bg-zinc-700'}`}
                    >
                      <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${lockOutputAspect ? 'translate-x-6' : 'translate-x-0'}`} />
                    </button>
                  </div>

                  {/* Font Aspect Ratio Slider (Calibration) */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-zinc-400">
                      <span>Aspect Calibration</span>
                      <span>{fontAspectRatio.toFixed(2)}</span>
                    </div>
                    <input
                      type="range"
                      min="0.3"
                      max="0.8"
                      step="0.01"
                      value={fontAspectRatio}
                      onChange={(e) => setFontAspectRatio(Number(e.target.value))}
                      className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* COLORS SECTION */}
            <div className="border border-zinc-800 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleSection('colors')}
                className="w-full flex items-center justify-between p-3 bg-zinc-800/50 hover:bg-zinc-800 transition-colors"
              >
                <span className="flex items-center gap-2 text-sm font-medium text-zinc-300">
                  <Palette size={14} />
                  Colors
                </span>
                <ChevronDown size={16} className={`text-zinc-400 transition-transform ${expandedSections.colors ? 'rotate-180' : ''}`} />
              </button>
              {expandedSections.colors && (
                <div className="p-3 space-y-4 border-t border-zinc-800">
                  {/* Source Color Toggle */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-zinc-300">Source Color</span>
                    <button
                      onClick={() => setUseSourceColor(!useSourceColor)}
                      className={`w-12 h-6 rounded-full transition-colors relative ${useSourceColor ? 'bg-indigo-600' : 'bg-zinc-700'}`}
                    >
                      <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${useSourceColor ? 'translate-x-6' : 'translate-x-0'}`} />
                    </button>
                  </div>

                  {/* Colors */}
                  <div className={`grid grid-cols-2 gap-4 transition-opacity ${useSourceColor ? 'opacity-40 pointer-events-none' : ''}`}>
                    <div className="space-y-2">
                      <label className="text-xs text-zinc-400 block">Text Color</label>
                      <div className="flex items-center gap-2 bg-zinc-800 p-2 rounded-lg border border-zinc-700">
                        <input
                          type="color"
                          value={color}
                          onChange={(e) => setColor(e.target.value)}
                          disabled={useSourceColor}
                          className="w-6 h-6 rounded bg-transparent cursor-pointer border-none p-0"
                        />
                        <span className="text-xs font-mono text-zinc-400">{color}</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs text-zinc-400 block">Bg Color</label>
                      <div className="flex items-center gap-2 bg-zinc-800 p-2 rounded-lg border border-zinc-700">
                        <input
                          type="color"
                          value={bgIsTransparent ? '#000000' : bgColor}
                          onChange={(e) => setBgColor(e.target.value)}
                          disabled={bgIsTransparent || useSourceColor}
                          className="w-6 h-6 rounded bg-transparent cursor-pointer border-none p-0"
                        />
                        <span className="text-xs font-mono text-zinc-400">{bgIsTransparent ? 'transparent' : bgColor}</span>
                      </div>
                    </div>
                  </div>

                  {/* Transparent */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-zinc-300">Transparent Bg</span>
                    <button
                      onClick={() => setBgColor(bgIsTransparent ? '#000000' : 'transparent')}
                      className={`w-12 h-6 rounded-full transition-colors relative ${bgIsTransparent ? 'bg-indigo-600' : 'bg-zinc-700'}`}
                    >
                      <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${bgIsTransparent ? 'translate-x-6' : 'translate-x-0'}`} />
                    </button>
                  </div>

                  {/* Invert */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-zinc-300">Invert Colors</span>
                    <button
                      onClick={() => setInvert(!invert)}
                      className={`w-12 h-6 rounded-full transition-colors relative ${invert ? 'bg-indigo-600' : 'bg-zinc-700'}`}
                    >
                      <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${invert ? 'translate-x-6' : 'translate-x-0'}`} />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* ADJUSTMENTS SECTION */}
            <div className="border border-zinc-800 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleSection('adjustments')}
                className="w-full flex items-center justify-between p-3 bg-zinc-800/50 hover:bg-zinc-800 transition-colors"
              >
                <span className="flex items-center gap-2 text-sm font-medium text-zinc-300">
                  <SlidersHorizontal size={14} />
                  Adjustments
                </span>
                <ChevronDown size={16} className={`text-zinc-400 transition-transform ${expandedSections.adjustments ? 'rotate-180' : ''}`} />
              </button>
              {expandedSections.adjustments && (
                <div className="p-3 space-y-4 border-t border-zinc-800">
                  {/* Source Overlay */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-zinc-400">
                      <span className="flex items-center gap-1"><Layers size={12}/> Source Overlay</span>
                      <span>{Math.round(overlayOpacity * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={overlayOpacity}
                      onChange={(e) => setOverlayOpacity(Number(e.target.value))}
                      className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />
                  </div>

                  {/* Brightness */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs text-zinc-400">
                      <span>Brightness</span>
                      <span>{brightness > 0 ? `+${brightness}` : brightness}</span>
                    </div>
                    <input
                      type="range"
                      min="-100"
                      max="100"
                      value={brightness}
                      onChange={(e) => setBrightness(Number(e.target.value))}
                      className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />
                  </div>

                  {/* Contrast */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs text-zinc-400">
                      <span>Contrast</span>
                      <span>{contrast > 0 ? `+${contrast}` : contrast}</span>
                    </div>
                    <input
                      type="range"
                      min="-100"
                      max="100"
                      value={contrast}
                      onChange={(e) => setContrast(Number(e.target.value))}
                      className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />
                  </div>

                  {/* Saturation */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs text-zinc-400">
                      <span>Saturation</span>
                      <span>{saturation > 0 ? `+${saturation}` : saturation}</span>
                    </div>
                    <input
                      type="range"
                      min="-100"
                      max="100"
                      value={saturation}
                      onChange={(e) => setSaturation(Number(e.target.value))}
                      className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />
                  </div>

                  {/* Sharpness */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs text-zinc-400">
                      <span>Sharpness</span>
                      <span>{sharpness}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={sharpness}
                      onChange={(e) => setSharpness(Number(e.target.value))}
                      className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />
                  </div>

                  {/* Dithering Toggle */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-zinc-300">Dithering</span>
                    <button
                      onClick={() => setDithering(!dithering)}
                      className={`w-12 h-6 rounded-full transition-colors relative ${dithering ? 'bg-indigo-600' : 'bg-zinc-700'}`}
                    >
                      <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${dithering ? 'translate-x-6' : 'translate-x-0'}`} />
                    </button>
                  </div>

                </div>
              )}
            </div>

            {/* CHARACTERS SECTION */}
            <div className="border border-zinc-800 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleSection('characters')}
                className="w-full flex items-center justify-between p-3 bg-zinc-800/50 hover:bg-zinc-800 transition-colors"
              >
                <span className="flex items-center gap-2 text-sm font-medium text-zinc-300">
                  <Type size={14} />
                  Characters
                </span>
                <ChevronDown size={16} className={`text-zinc-400 transition-transform ${expandedSections.characters ? 'rotate-180' : ''}`} />
              </button>
              {expandedSections.characters && (
                <div className="p-3 space-y-4 border-t border-zinc-800">
                  {/* Character Presets */}
                  <div className="space-y-2">
                    <label className="text-xs text-zinc-400 block">Character Preset</label>
                    <select
                      value={CHAR_PRESETS.find(p => p.chars === chars)?.name || 'Custom'}
                      onChange={(e) => {
                        const preset = CHAR_PRESETS.find(p => p.name === e.target.value);
                        if (preset) setChars(preset.chars);
                      }}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      {CHAR_PRESETS.map(p => (
                        <option key={p.name} value={p.name}>{p.name}</option>
                      ))}
                      {!CHAR_PRESETS.find(p => p.chars === chars) && (
                        <option value="Custom">Custom</option>
                      )}
                    </select>
                  </div>

                  {/* Custom Charset */}
                  <div className="space-y-2">
                    <label className="text-xs text-zinc-400 block">Character Map (Dark → Light)</label>
                    <input
                      type="text"
                      value={chars}
                      onChange={(e) => setChars(e.target.value)}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs font-mono text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* EXPORT SECTION */}
            <div className="border border-zinc-800 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleSection('export')}
                className="w-full flex items-center justify-between p-3 bg-zinc-800/50 hover:bg-zinc-800 transition-colors"
              >
                <span className="flex items-center gap-2 text-sm font-medium text-zinc-300">
                  <Download size={14} />
                  Export
                </span>
                <ChevronDown size={16} className={`text-zinc-400 transition-transform ${expandedSections.export ? 'rotate-180' : ''}`} />
              </button>
              {expandedSections.export && (
                <div className="p-3 space-y-4 border-t border-zinc-800">
                  {/* Export 2x */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-zinc-300">Export 2x Resolution</span>
                    <button
                      onClick={() => setExport2x(!export2x)}
                      className={`w-12 h-6 rounded-full transition-colors relative ${export2x ? 'bg-indigo-600' : 'bg-zinc-700'}`}
                    >
                      <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${export2x ? 'translate-x-6' : 'translate-x-0'}`} />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Reset Settings */}
            {appState === AppState.PLAYING && (
              <button
                onClick={resetSettings}
                className="flex items-center justify-center gap-2 w-full py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors text-zinc-400 hover:text-zinc-200"
              >
                <RotateCcw size={14} />
                Reset Settings
              </button>
            )}

          </div>

          {appState === AppState.PLAYING && (
             <button
               onClick={reset}
               className="flex items-center justify-center gap-2 w-full py-3 rounded-lg border border-zinc-800 hover:bg-zinc-900 transition-colors text-zinc-400 hover:text-red-400"
             >
               <RefreshCcw size={16} />
               Reset & Upload New
             </button>
          )}

        </div>

        {/* Right Column: Viewer */}
        <div className="flex-1 flex flex-col lg:flex-row gap-4 lg:items-start">
          <div className="flex-1 bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4 relative flex flex-col min-h-[360px] lg:min-h-0 justify-center items-center">

            {appState === AppState.IDLE ? (
               <div className="w-full h-full flex flex-col items-center justify-center gap-4">
                  <FileUpload onFileSelect={handleFileSelect} />
                  <div className="w-full max-w-xl">
                    <div className="flex items-center gap-2 text-xs text-zinc-500 mb-2">
                      <div className="flex-1 h-px bg-zinc-800" />
                      <span>or paste URL</span>
                      <div className="flex-1 h-px bg-zinc-800" />
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1 relative">
                        <Link size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                        <input
                          type="text"
                          value={urlInput}
                          onChange={(e) => { setUrlInput(e.target.value); setUrlError(null); }}
                          onKeyDown={(e) => e.key === 'Enter' && loadFromUrl()}
                          placeholder="https://example.com/image.gif"
                          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-9 pr-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-zinc-600"
                        />
                      </div>
                      <button
                        onClick={loadFromUrl}
                        disabled={!urlInput.trim()}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-700 disabled:text-zinc-500 rounded-lg text-sm font-medium transition-colors"
                      >
                        Load
                      </button>
                    </div>
                    {urlError && (
                      <p className="text-red-400 text-xs mt-1">{urlError}</p>
                    )}
                  </div>
               </div>
            ) : (
              <div className="w-full flex justify-center">
                {fileUrl && (
                  <AsciiPlayer
                    imageSrc={fileUrl}
                    config={deferredConfig}
                    outputWidth={deferredOutputWidth}
                    outputHeight={deferredOutputHeight}
                    export2x={export2x}
                  />
                )}
              </div>
            )}

          </div>

          <div
            className="lg:w-72 shrink-0 bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4 overflow-y-auto scrollbar-hide"
            style={{
              maxHeight: controlsHeight ? `${controlsHeight}px` : undefined,
              scrollbarWidth: 'none',
            } as React.CSSProperties}
          >
            <TenorSearch onGifSelect={handleFileSelect} compact />
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
