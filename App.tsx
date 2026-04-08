import React, { useEffect, useMemo, useRef, useState, useDeferredValue, useCallback } from 'react';
import { Settings, RefreshCcw, Layers, Monitor, RotateCcw, Link, ChevronDown, Palette, SlidersHorizontal, Type, Download, Sparkles } from 'lucide-react';
import FileUpload from './components/FileUpload';
import AsciiPlayer from './components/AsciiPlayer';
import TenorSearch from './components/TenorSearch';
import { AsciiConfig, AppState, PostProcessingConfig, AnimationEffectsConfig } from './types';
import { DEFAULT_CHARS, CHAR_PRESETS, COLOR_PALETTES } from './services/asciiUtils';

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
  const [colorPalette, setColorPalette] = useState('none');
  const [postProcessing, setPostProcessing] = useState<PostProcessingConfig>({
    scanlines: 0,
    glow: 0,
    chromaticAberration: 0,
    noise: 0,
    vignette: 0,
    flicker: 0
  });
  const [animationEffects, setAnimationEffects] = useState<AnimationEffectsConfig>({
    matrixRain: 0,
    waveDistortion: 0,
    typingReveal: false
  });
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
    effects: false,
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
    sharpness,
    colorPalette,
    postProcessing,
    animationEffects
  }), [density, chars, color, bgColor, invert, fontAspectRatio, overlayOpacity, useSourceColor, brightness, contrast, saturation, dithering, sharpness, colorPalette, postProcessing, animationEffects]);

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
    setColorPalette('none');
    setPostProcessing({
      scanlines: 0,
      glow: 0,
      chromaticAberration: 0,
      noise: 0,
      vignette: 0,
      flicker: 0
    });
    setAnimationEffects({
      matrixRain: 0,
      waveDistortion: 0,
      typingReveal: false
    });
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
    <div className="app-shell">
      {/* Header */}
      <header className="app-header">
        <h1 className="app-header__title">gif2ascii</h1>
      </header>

      <main className="app-main">
        
        {/* Left Column: Controls */}
        <div className="col-controls">
          
          {/* Settings Panel */}
          <div
            ref={controlsRef}
            className="card"
          >
            <div className="settings-header">
              <Settings size={18} className="settings-header__icon" />
              <span className="settings-header__title">Render Settings</span>
            </div>

            <div className="settings-sections">

              {/* OUTPUT SECTION */}
              <div className="section-panel">
                <button
                  onClick={() => toggleSection('output')}
                  className="section-header"
                >
                  <span className="section-header__label">
                    <Monitor size={14} />
                    Output
                  </span>
                  <ChevronDown size={14} className={`section-header__chevron ${expandedSections.output ? 'section-header__chevron--open' : ''}`} />
                </button>
                {expandedSections.output && (
                  <div className="section-body">
                    {/* Density Slider */}
                    <div className="slider-group">
                      <div className="slider-label">
                        <span className="slider-label__text">Density</span>
                        <span className="slider-label__value">{density} cols</span>
                      </div>
                      <input
                        type="range"
                        min="10"
                        max={maxDensity}
                        value={density}
                        onChange={(e) => handleDensityChange(Number(e.target.value))}
                      />
                    </div>

                    {/* Output Width Slider */}
                    <div className="slider-group">
                      <div className="slider-label">
                        <span className="slider-label__text">Output Width</span>
                        <div className="inline-row">
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
                            placeholder="--"
                          />
                          <span className="inline-row__unit">px</span>
                        </div>
                      </div>
                      <input
                        type="range"
                        min="64"
                        max={maxOutputWidth}
                        value={outputWidthPx > 0 ? outputWidthPx : 64}
                        onChange={(e) => handleOutputWidthChange(Number(e.target.value))}
                        disabled={!inputSize}
                      />
                    </div>

                    {/* Output Height Slider */}
                    <div className="slider-group">
                      <div className="slider-label">
                        <span className="slider-label__text">Output Height</span>
                        <div className="inline-row">
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
                            placeholder="--"
                          />
                          <span className="inline-row__unit">px</span>
                        </div>
                      </div>
                      <input
                        type="range"
                        min="64"
                        max={maxOutputHeight}
                        value={outputHeightPx > 0 ? outputHeightPx : 64}
                        onChange={(e) => handleOutputHeightChange(Number(e.target.value))}
                        disabled={!inputSize}
                      />
                    </div>

                    {/* Lock Aspect */}
                    <div className="toggle">
                      <span className="toggle__label">Lock Output Aspect</span>
                      <button
                        onClick={() => {
                          const next = !lockOutputAspect;
                          setLockOutputAspect(next);
                          if (next && inputSize && outputWidthPx > 0) {
                            setOutputHeight(Math.max(1, Math.round(outputWidthPx * inputAspect)));
                          }
                        }}
                        className={`toggle__track ${lockOutputAspect ? 'toggle__track--on' : ''}`}
                      >
                        <div className="toggle__thumb" />
                      </button>
                    </div>

                    {/* Font Aspect Ratio Slider (Calibration) */}
                    <div className="slider-group">
                      <div className="slider-label">
                        <span className="slider-label__text">Aspect Calibration</span>
                        <span className="slider-label__value">{fontAspectRatio.toFixed(2)}</span>
                      </div>
                      <input
                        type="range"
                        min="0.3"
                        max="0.8"
                        step="0.01"
                        value={fontAspectRatio}
                        onChange={(e) => setFontAspectRatio(Number(e.target.value))}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* COLORS SECTION */}
              <div className="section-panel">
                <button
                  onClick={() => toggleSection('colors')}
                  className="section-header"
                >
                  <span className="section-header__label">
                    <Palette size={14} />
                    Colors
                  </span>
                  <ChevronDown size={14} className={`section-header__chevron ${expandedSections.colors ? 'section-header__chevron--open' : ''}`} />
                </button>
                {expandedSections.colors && (
                  <div className="section-body">
                    {/* Source Color Toggle */}
                    <div className="toggle">
                      <span className="toggle__label">Source Color</span>
                      <button
                        onClick={() => setUseSourceColor(!useSourceColor)}
                        className={`toggle__track ${useSourceColor ? 'toggle__track--on' : ''}`}
                      >
                        <div className="toggle__thumb" />
                      </button>
                    </div>

                    {/* Colors */}
                    <div className={`color-grid ${useSourceColor ? 'section-dimmed' : ''}`}>
                      <div className="color-picker">
                        <label className="color-picker__label">Text Color</label>
                        <div className="color-picker__swatch">
                          <input
                            type="color"
                            value={color}
                            onChange={(e) => setColor(e.target.value)}
                            disabled={useSourceColor}
                          />
                          <span className="color-picker__hex">{color}</span>
                        </div>
                      </div>
                      <div className="color-picker">
                        <label className="color-picker__label">Bg Color</label>
                        <div className="color-picker__swatch">
                          <input
                            type="color"
                            value={bgIsTransparent ? '#000000' : bgColor}
                            onChange={(e) => setBgColor(e.target.value)}
                            disabled={bgIsTransparent || useSourceColor}
                          />
                          <span className="color-picker__hex">{bgIsTransparent ? 'transparent' : bgColor}</span>
                        </div>
                      </div>
                    </div>

                    {/* Transparent */}
                    <div className="toggle">
                      <span className="toggle__label">Transparent Bg</span>
                      <button
                        onClick={() => setBgColor(bgIsTransparent ? '#000000' : 'transparent')}
                        className={`toggle__track ${bgIsTransparent ? 'toggle__track--on' : ''}`}
                      >
                        <div className="toggle__thumb" />
                      </button>
                    </div>

                    {/* Invert */}
                    <div className="toggle">
                      <span className="toggle__label">Invert Colors</span>
                      <button
                        onClick={() => setInvert(!invert)}
                        className={`toggle__track ${invert ? 'toggle__track--on' : ''}`}
                      >
                        <div className="toggle__thumb" />
                      </button>
                    </div>

                    {/* Color Palette */}
                    <div className={!useSourceColor ? 'section-dimmed' : ''}>
                      <label className="label" style={{ display: 'block', marginBottom: 'var(--space-xs)' }}>Color Palette</label>
                      <select
                        value={colorPalette}
                        onChange={(e) => setColorPalette(e.target.value)}
                        disabled={!useSourceColor}
                      >
                        {Object.entries(COLOR_PALETTES).map(([id, palette]) => (
                          <option key={id} value={id}>{palette.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* ADJUSTMENTS SECTION */}
              <div className="section-panel">
                <button
                  onClick={() => toggleSection('adjustments')}
                  className="section-header"
                >
                  <span className="section-header__label">
                    <SlidersHorizontal size={14} />
                    Adjustments
                  </span>
                  <ChevronDown size={14} className={`section-header__chevron ${expandedSections.adjustments ? 'section-header__chevron--open' : ''}`} />
                </button>
                {expandedSections.adjustments && (
                  <div className="section-body">
                    {/* Source Overlay */}
                    <div className="slider-group">
                      <div className="slider-label">
                        <span className="slider-label__text" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Layers size={12} /> Source Overlay
                        </span>
                        <span className="slider-label__value">{Math.round(overlayOpacity * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={overlayOpacity}
                        onChange={(e) => setOverlayOpacity(Number(e.target.value))}
                      />
                    </div>

                    {/* Brightness */}
                    <div className="slider-group">
                      <div className="slider-label">
                        <span className="slider-label__text">Brightness</span>
                        <span className="slider-label__value">{brightness > 0 ? `+${brightness}` : brightness}</span>
                      </div>
                      <input
                        type="range"
                        min="-300"
                        max="300"
                        value={brightness}
                        onChange={(e) => setBrightness(Number(e.target.value))}
                      />
                    </div>

                    {/* Contrast */}
                    <div className="slider-group">
                      <div className="slider-label">
                        <span className="slider-label__text">Contrast</span>
                        <span className="slider-label__value">{contrast > 0 ? `+${contrast}` : contrast}</span>
                      </div>
                      <input
                        type="range"
                        min="-300"
                        max="300"
                        value={contrast}
                        onChange={(e) => setContrast(Number(e.target.value))}
                      />
                    </div>

                    {/* Saturation */}
                    <div className="slider-group">
                      <div className="slider-label">
                        <span className="slider-label__text">Saturation</span>
                        <span className="slider-label__value">{saturation > 0 ? `+${saturation}` : saturation}</span>
                      </div>
                      <input
                        type="range"
                        min="-300"
                        max="300"
                        value={saturation}
                        onChange={(e) => setSaturation(Number(e.target.value))}
                      />
                    </div>

                    {/* Sharpness */}
                    <div className="slider-group">
                      <div className="slider-label">
                        <span className="slider-label__text">Sharpness</span>
                        <span className="slider-label__value">{sharpness}</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="300"
                        value={sharpness}
                        onChange={(e) => setSharpness(Number(e.target.value))}
                      />
                    </div>

                    {/* Dithering Toggle */}
                    <div className="toggle">
                      <span className="toggle__label">Dithering</span>
                      <button
                        onClick={() => setDithering(!dithering)}
                        className={`toggle__track ${dithering ? 'toggle__track--on' : ''}`}
                      >
                        <div className="toggle__thumb" />
                      </button>
                    </div>

                  </div>
                )}
              </div>

              {/* CHARACTERS SECTION */}
              <div className="section-panel">
                <button
                  onClick={() => toggleSection('characters')}
                  className="section-header"
                >
                  <span className="section-header__label">
                    <Type size={14} />
                    Characters
                  </span>
                  <ChevronDown size={14} className={`section-header__chevron ${expandedSections.characters ? 'section-header__chevron--open' : ''}`} />
                </button>
                {expandedSections.characters && (
                  <div className="section-body">
                    {/* Character Presets */}
                    <div>
                      <label className="label" style={{ display: 'block', marginBottom: 'var(--space-xs)' }}>Character Preset</label>
                      <select
                        value={CHAR_PRESETS.find(p => p.chars === chars)?.name || 'Custom'}
                        onChange={(e) => {
                          const preset = CHAR_PRESETS.find(p => p.name === e.target.value);
                          if (preset) setChars(preset.chars);
                        }}
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
                    <div>
                      <label className="label" style={{ display: 'block', marginBottom: 'var(--space-xs)' }}>Character Map (Dark → Light)</label>
                      <input
                        type="text"
                        value={chars}
                        onChange={(e) => setChars(e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* EFFECTS SECTION */}
              <div className="section-panel">
                <button
                  onClick={() => toggleSection('effects')}
                  className="section-header"
                >
                  <span className="section-header__label">
                    <Sparkles size={14} />
                    Effects
                  </span>
                  <ChevronDown size={14} className={`section-header__chevron ${expandedSections.effects ? 'section-header__chevron--open' : ''}`} />
                </button>
                {expandedSections.effects && (
                  <div className="section-body">
                    {/* Scanlines */}
                    <div className="slider-group">
                      <div className="slider-label">
                        <span className="slider-label__text">CRT Scanlines</span>
                        <span className="slider-label__value">{postProcessing.scanlines}</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="300"
                        value={postProcessing.scanlines}
                        onChange={(e) => setPostProcessing(p => ({ ...p, scanlines: Number(e.target.value) }))}
                      />
                    </div>

                    {/* Glow */}
                    <div className="slider-group">
                      <div className="slider-label">
                        <span className="slider-label__text">Phosphor Glow</span>
                        <span className="slider-label__value">{postProcessing.glow}</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="300"
                        value={postProcessing.glow}
                        onChange={(e) => setPostProcessing(p => ({ ...p, glow: Number(e.target.value) }))}
                      />
                    </div>

                    {/* Chromatic Aberration */}
                    <div className="slider-group">
                      <div className="slider-label">
                        <span className="slider-label__text">RGB Split</span>
                        <span className="slider-label__value">{postProcessing.chromaticAberration}</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="300"
                        value={postProcessing.chromaticAberration}
                        onChange={(e) => setPostProcessing(p => ({ ...p, chromaticAberration: Number(e.target.value) }))}
                      />
                    </div>

                    {/* Noise */}
                    <div className="slider-group">
                      <div className="slider-label">
                        <span className="slider-label__text">Static Noise</span>
                        <span className="slider-label__value">{postProcessing.noise}</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="300"
                        value={postProcessing.noise}
                        onChange={(e) => setPostProcessing(p => ({ ...p, noise: Number(e.target.value) }))}
                      />
                    </div>

                    {/* Vignette */}
                    <div className="slider-group">
                      <div className="slider-label">
                        <span className="slider-label__text">Vignette</span>
                        <span className="slider-label__value">{postProcessing.vignette}</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="300"
                        value={postProcessing.vignette}
                        onChange={(e) => setPostProcessing(p => ({ ...p, vignette: Number(e.target.value) }))}
                      />
                    </div>

                    {/* Flicker */}
                    <div className="slider-group">
                      <div className="slider-label">
                        <span className="slider-label__text">Flicker</span>
                        <span className="slider-label__value">{postProcessing.flicker}</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="300"
                        value={postProcessing.flicker}
                        onChange={(e) => setPostProcessing(p => ({ ...p, flicker: Number(e.target.value) }))}
                      />
                    </div>

                    {/* Animation Effects Separator */}
                    <div className="section-separator">
                      <span className="section-separator__text">Animation</span>
                    </div>

                    {/* Matrix Rain */}
                    <div className="slider-group">
                      <div className="slider-label">
                        <span className="slider-label__text">Matrix Rain</span>
                        <span className="slider-label__value">{animationEffects.matrixRain}</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="300"
                        value={animationEffects.matrixRain}
                        onChange={(e) => setAnimationEffects(a => ({ ...a, matrixRain: Number(e.target.value) }))}
                      />
                    </div>

                    {/* Wave Distortion */}
                    <div className="slider-group">
                      <div className="slider-label">
                        <span className="slider-label__text">Wave Distortion</span>
                        <span className="slider-label__value">{animationEffects.waveDistortion}</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="300"
                        value={animationEffects.waveDistortion}
                        onChange={(e) => setAnimationEffects(a => ({ ...a, waveDistortion: Number(e.target.value) }))}
                      />
                    </div>

                    {/* Typing Reveal */}
                    <div className="toggle">
                      <span className="toggle__label">Typing Reveal</span>
                      <button
                        onClick={() => setAnimationEffects(a => ({ ...a, typingReveal: !a.typingReveal }))}
                        className={`toggle__track ${animationEffects.typingReveal ? 'toggle__track--on' : ''}`}
                      >
                        <div className="toggle__thumb" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* EXPORT SECTION */}
              <div className="section-panel">
                <button
                  onClick={() => toggleSection('export')}
                  className="section-header"
                >
                  <span className="section-header__label">
                    <Download size={14} />
                    Export
                  </span>
                  <ChevronDown size={14} className={`section-header__chevron ${expandedSections.export ? 'section-header__chevron--open' : ''}`} />
                </button>
                {expandedSections.export && (
                  <div className="section-body">
                    {/* Export 2x */}
                    <div className="toggle">
                      <span className="toggle__label">Export 2x Resolution</span>
                      <button
                        onClick={() => setExport2x(!export2x)}
                        className={`toggle__track ${export2x ? 'toggle__track--on' : ''}`}
                      >
                        <div className="toggle__thumb" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

            </div>

            {/* Reset Settings */}
            {appState === AppState.PLAYING && (
              <button
                onClick={resetSettings}
                className="btn btn--ghost"
                style={{ width: '100%', marginTop: 'var(--space-md)' }}
              >
                <RotateCcw size={14} />
                Reset Settings
              </button>
            )}

          </div>

          {appState === AppState.PLAYING && (
             <button
               onClick={reset}
               className="btn btn--destructive"
               style={{ width: '100%' }}
             >
               <RefreshCcw size={14} />
               Reset &amp; Upload New
             </button>
          )}

        </div>

        {/* Center Column: Viewer */}
        <div className="col-canvas">
          <div className="card--canvas" style={{ width: '100%' }}>

            {appState === AppState.IDLE ? (
               <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-md)' }}>
                 <FileUpload onFileSelect={handleFileSelect} />
                 <div className="url-input-group">
                   <div className="url-input-group__divider">
                     <span>or paste url</span>
                   </div>
                   <div className="url-input-group__row">
                     <div className="url-input-group__field">
                       <Link size={14} />
                       <input
                         type="text"
                         value={urlInput}
                         onChange={(e) => { setUrlInput(e.target.value); setUrlError(null); }}
                         onKeyDown={(e) => e.key === 'Enter' && loadFromUrl()}
                         placeholder="https://example.com/image.gif"
                         style={{ paddingLeft: '32px' }}
                       />
                     </div>
                     <button
                       onClick={loadFromUrl}
                       disabled={!urlInput.trim()}
                       className="btn btn--primary"
                     >
                       Load
                     </button>
                   </div>
                   {urlError && (
                     <p className="url-input-group__error">[ERROR] {urlError}</p>
                   )}
                 </div>
               </div>
            ) : (
              <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
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
        </div>

        {/* Right Column: Tenor Search */}
        <div className="col-tenor">
          <div
            className="card--tenor"
            style={{
              maxHeight: controlsHeight ? `${controlsHeight}px` : undefined,
            }}
          >
            <TenorSearch onGifSelect={handleFileSelect} compact />
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
