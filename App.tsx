import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Settings, RefreshCcw, Layers, Monitor, RotateCcw, Link, ChevronDown, Palette, SlidersHorizontal, Type, Download, Sparkles } from 'lucide-react';
import FileUpload from './components/FileUpload';
import AsciiPlayer from './components/AsciiPlayer';
import TenorSearch from './components/TenorSearch';
import { AppState } from './types';
import { DEFAULT_CHARS, CHAR_PRESETS, COLOR_PALETTES } from './services/asciiUtils';
import { STYLE_PRESETS } from './services/stylePresets';
import { useAsciiConfig } from './hooks/useAsciiConfig';

const DEFAULT_DENSITY_CELL_WIDTH = 5;

const App: React.FC = () => {
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [urlInput, setUrlInput] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [inputSize, setInputSize] = useState<{ width: number; height: number } | null>(null);
  const userAdjustedRef = useRef(false);
  const controlsRef = useRef<HTMLDivElement | null>(null);
  const [controlsHeight, setControlsHeight] = useState<number | null>(null);

  // All rendering config from the extracted hook
  const cfg = useAsciiConfig(inputSize, userAdjustedRef);

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
  const maxOutputWidth = inputSize ? Math.max(320, inputSize.width * 2) : 2000;
  const maxOutputHeight = inputSize ? Math.max(320, inputSize.height * 2) : 2000;
  const maxDensity = inputSize ? Math.max(300, Math.round(inputSize.width / 2)) : 300;

  const handleFileSelect = (file: File) => {
    const url = URL.createObjectURL(file);
    setFileUrl(url);
    setAppState(AppState.PLAYING);
    userAdjustedRef.current = false;
    cfg.setChars(DEFAULT_CHARS);
    cfg.setColor('#ffffff');
    const img = new Image();
    img.onload = () => {
      const width = img.naturalWidth || img.width;
      const height = img.naturalHeight || img.height;
      if (width > 0 && height > 0) {
        setInputSize({ width, height });
        if (!userAdjustedRef.current) {
          cfg.setOutputWidth(width);
          cfg.setOutputHeight(height);
          cfg.setDensity(Math.max(10, Math.round(width / DEFAULT_DENSITY_CELL_WIDTH)));
        }
      }
    };
    img.src = url;
  };

  const reset = () => {
    setFileUrl(null);
    setAppState(AppState.IDLE);
    setInputSize(null);
    cfg.setOutputWidth(0);
    cfg.setOutputHeight(0);
  };

  const loadFromUrl = useCallback(async () => {
    if (!urlInput.trim()) return;
    setUrlError(null);
    try {
      const url = new URL(urlInput.trim());
      const response = await fetch(url.toString(), { method: 'HEAD', mode: 'cors' }).catch(() => null);
      if (response && !response.ok) {
        throw new Error('URL not accessible');
      }
      setFileUrl(url.toString());
      setAppState(AppState.PLAYING);
      userAdjustedRef.current = false;
      cfg.setChars(DEFAULT_CHARS);
      cfg.setColor('#ffffff');
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const width = img.naturalWidth || img.width;
        const height = img.naturalHeight || img.height;
        if (width > 0 && height > 0) {
          setInputSize({ width, height });
          if (!userAdjustedRef.current) {
            cfg.setOutputWidth(width);
            cfg.setOutputHeight(height);
            cfg.setDensity(Math.max(10, Math.round(width / DEFAULT_DENSITY_CELL_WIDTH)));
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
          <div ref={controlsRef} className="card">
            <div className="settings-header">
              <Settings size={18} className="settings-header__icon" />
              <span className="settings-header__title">Render Settings</span>
            </div>

            <div className="settings-sections">

              {/* OUTPUT SECTION */}
              <div className="section-panel">
                <button onClick={() => toggleSection('output')} className="section-header">
                  <span className="section-header__label"><Monitor size={14} />Output</span>
                  <ChevronDown size={14} className={`section-header__chevron ${expandedSections.output ? 'section-header__chevron--open' : ''}`} />
                </button>
                {expandedSections.output && (
                  <div className="section-body">
                    <div className="slider-group">
                      <div className="slider-label">
                        <span className="slider-label__text">Density</span>
                        <span className="slider-label__value">{cfg.density} cols</span>
                      </div>
                      <input type="range" min="10" max={maxDensity} value={cfg.density} onChange={(e) => cfg.handleDensityChange(Number(e.target.value))} />
                    </div>
                    <div className="slider-group">
                      <div className="slider-label">
                        <span className="slider-label__text">Output Width</span>
                        <div className="inline-row">
                          <input type="number" min="1" max={maxOutputWidth} value={cfg.outputWidthPx > 0 ? cfg.outputWidthPx : ''} onChange={(e) => { const val = parseInt(e.target.value, 10); if (!isNaN(val) && val > 0) cfg.handleOutputWidthChange(Math.min(val, maxOutputWidth)); }} disabled={!inputSize} placeholder="--" />
                          <span className="inline-row__unit">px</span>
                        </div>
                      </div>
                      <input type="range" min="64" max={maxOutputWidth} value={cfg.outputWidthPx > 0 ? cfg.outputWidthPx : 64} onChange={(e) => cfg.handleOutputWidthChange(Number(e.target.value))} disabled={!inputSize} />
                    </div>
                    <div className="slider-group">
                      <div className="slider-label">
                        <span className="slider-label__text">Output Height</span>
                        <div className="inline-row">
                          <input type="number" min="1" max={maxOutputHeight} value={cfg.outputHeightPx > 0 ? cfg.outputHeightPx : ''} onChange={(e) => { const val = parseInt(e.target.value, 10); if (!isNaN(val) && val > 0) cfg.handleOutputHeightChange(Math.min(val, maxOutputHeight)); }} disabled={!inputSize} placeholder="--" />
                          <span className="inline-row__unit">px</span>
                        </div>
                      </div>
                      <input type="range" min="64" max={maxOutputHeight} value={cfg.outputHeightPx > 0 ? cfg.outputHeightPx : 64} onChange={(e) => cfg.handleOutputHeightChange(Number(e.target.value))} disabled={!inputSize} />
                    </div>
                    <div className="toggle">
                      <span className="toggle__label">Lock Output Aspect</span>
                      <button onClick={() => { const next = !cfg.lockOutputAspect; cfg.setLockOutputAspect(next); if (next && inputSize && cfg.outputWidthPx > 0) { cfg.setOutputHeight(Math.max(1, Math.round(cfg.outputWidthPx * inputAspect))); } }} className={`toggle__track ${cfg.lockOutputAspect ? 'toggle__track--on' : ''}`}><div className="toggle__thumb" /></button>
                    </div>
                    <div className="slider-group">
                      <div className="slider-label">
                        <span className="slider-label__text">Aspect Calibration</span>
                        <span className="slider-label__value">{cfg.fontAspectRatio.toFixed(2)}</span>
                      </div>
                      <input type="range" min="0.3" max="0.8" step="0.01" value={cfg.fontAspectRatio} onChange={(e) => cfg.setFontAspectRatio(Number(e.target.value))} />
                    </div>
                  </div>
                )}
              </div>

              {/* COLORS SECTION */}
              <div className="section-panel">
                <button onClick={() => toggleSection('colors')} className="section-header">
                  <span className="section-header__label"><Palette size={14} />Colors</span>
                  <ChevronDown size={14} className={`section-header__chevron ${expandedSections.colors ? 'section-header__chevron--open' : ''}`} />
                </button>
                {expandedSections.colors && (
                  <div className="section-body">
                    <div className="toggle">
                      <span className="toggle__label">Source Color</span>
                      <button onClick={() => cfg.setUseSourceColor(!cfg.useSourceColor)} className={`toggle__track ${cfg.useSourceColor ? 'toggle__track--on' : ''}`}><div className="toggle__thumb" /></button>
                    </div>
                    <div className={`color-grid ${cfg.useSourceColor ? 'section-dimmed' : ''}`}>
                      <div className="color-picker">
                        <label className="color-picker__label">Text Color</label>
                        <div className="color-picker__swatch">
                          <input type="color" value={cfg.color} onChange={(e) => cfg.setColor(e.target.value)} disabled={cfg.useSourceColor} />
                          <span className="color-picker__hex">{cfg.color}</span>
                        </div>
                      </div>
                      <div className="color-picker">
                        <label className="color-picker__label">Bg Color</label>
                        <div className="color-picker__swatch">
                          <input type="color" value={cfg.bgIsTransparent ? '#000000' : cfg.bgColor} onChange={(e) => cfg.setBgColor(e.target.value)} disabled={cfg.bgIsTransparent || cfg.useSourceColor} />
                          <span className="color-picker__hex">{cfg.bgIsTransparent ? 'transparent' : cfg.bgColor}</span>
                        </div>
                      </div>
                    </div>
                    <div className="toggle">
                      <span className="toggle__label">Transparent Bg</span>
                      <button onClick={() => cfg.setBgColor(cfg.bgIsTransparent ? '#000000' : 'transparent')} className={`toggle__track ${cfg.bgIsTransparent ? 'toggle__track--on' : ''}`}><div className="toggle__thumb" /></button>
                    </div>
                    <div className="toggle">
                      <span className="toggle__label">Invert Colors</span>
                      <button onClick={() => cfg.setInvert(!cfg.invert)} className={`toggle__track ${cfg.invert ? 'toggle__track--on' : ''}`}><div className="toggle__thumb" /></button>
                    </div>
                    <div className={!cfg.useSourceColor ? 'section-dimmed' : ''}>
                      <label className="label" style={{ display: 'block', marginBottom: 'var(--space-xs)' }}>Color Palette</label>
                      <select value={cfg.colorPalette} onChange={(e) => cfg.setColorPalette(e.target.value)} disabled={!cfg.useSourceColor}>
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
                <button onClick={() => toggleSection('adjustments')} className="section-header">
                  <span className="section-header__label"><SlidersHorizontal size={14} />Adjustments</span>
                  <ChevronDown size={14} className={`section-header__chevron ${expandedSections.adjustments ? 'section-header__chevron--open' : ''}`} />
                </button>
                {expandedSections.adjustments && (
                  <div className="section-body">
                    <div className="slider-group">
                      <div className="slider-label"><span className="slider-label__text" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Layers size={12} /> Source Overlay</span><span className="slider-label__value">{Math.round(cfg.overlayOpacity * 100)}%</span></div>
                      <input type="range" min="0" max="1" step="0.05" value={cfg.overlayOpacity} onChange={(e) => cfg.setOverlayOpacity(Number(e.target.value))} />
                    </div>
                    <div className="slider-group">
                      <div className="slider-label"><span className="slider-label__text">Brightness</span><span className="slider-label__value">{cfg.brightness > 0 ? `+${cfg.brightness}` : cfg.brightness}</span></div>
                      <input type="range" min="-300" max="300" value={cfg.brightness} onChange={(e) => cfg.setBrightness(Number(e.target.value))} />
                    </div>
                    <div className="slider-group">
                      <div className="slider-label"><span className="slider-label__text">Contrast</span><span className="slider-label__value">{cfg.contrast > 0 ? `+${cfg.contrast}` : cfg.contrast}</span></div>
                      <input type="range" min="-300" max="300" value={cfg.contrast} onChange={(e) => cfg.setContrast(Number(e.target.value))} />
                    </div>
                    <div className="slider-group">
                      <div className="slider-label"><span className="slider-label__text">Saturation</span><span className="slider-label__value">{cfg.saturation > 0 ? `+${cfg.saturation}` : cfg.saturation}</span></div>
                      <input type="range" min="-300" max="300" value={cfg.saturation} onChange={(e) => cfg.setSaturation(Number(e.target.value))} />
                    </div>
                    <div className="slider-group">
                      <div className="slider-label"><span className="slider-label__text">Sharpness</span><span className="slider-label__value">{cfg.sharpness}</span></div>
                      <input type="range" min="0" max="300" value={cfg.sharpness} onChange={(e) => cfg.setSharpness(Number(e.target.value))} />
                    </div>
                    <div className="toggle">
                      <span className="toggle__label">Dithering</span>
                      <button onClick={() => cfg.setDithering(!cfg.dithering)} className={`toggle__track ${cfg.dithering ? 'toggle__track--on' : ''}`}><div className="toggle__thumb" /></button>
                    </div>
                  </div>
                )}
              </div>

              {/* CHARACTERS SECTION */}
              <div className="section-panel">
                <button onClick={() => toggleSection('characters')} className="section-header">
                  <span className="section-header__label"><Type size={14} />Characters</span>
                  <ChevronDown size={14} className={`section-header__chevron ${expandedSections.characters ? 'section-header__chevron--open' : ''}`} />
                </button>
                {expandedSections.characters && (
                  <div className="section-body">
                    <div>
                      <label className="label" style={{ display: 'block', marginBottom: 'var(--space-xs)' }}>Character Preset</label>
                      <select value={CHAR_PRESETS.find(p => p.chars === cfg.chars)?.name || 'Custom'} onChange={(e) => { const preset = CHAR_PRESETS.find(p => p.name === e.target.value); if (preset) cfg.setChars(preset.chars); }}>
                        {CHAR_PRESETS.map(p => (<option key={p.name} value={p.name}>{p.name}</option>))}
                        {!CHAR_PRESETS.find(p => p.chars === cfg.chars) && (<option value="Custom">Custom</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="label" style={{ display: 'block', marginBottom: 'var(--space-xs)' }}>Character Map (Dark → Light)</label>
                      <input type="text" value={cfg.chars} onChange={(e) => cfg.setChars(e.target.value)} />
                    </div>
                  </div>
                )}
              </div>

              {/* EFFECTS SECTION */}
              <div className="section-panel">
                <button onClick={() => toggleSection('effects')} className="section-header">
                  <span className="section-header__label"><Sparkles size={14} />Effects</span>
                  <ChevronDown size={14} className={`section-header__chevron ${expandedSections.effects ? 'section-header__chevron--open' : ''}`} />
                </button>
                {expandedSections.effects && (
                  <div className="section-body">
                    {[
                      { label: 'CRT Scanlines', key: 'scanlines' as const, value: cfg.postProcessing.scanlines },
                      { label: 'Phosphor Glow', key: 'glow' as const, value: cfg.postProcessing.glow },
                      { label: 'RGB Split', key: 'chromaticAberration' as const, value: cfg.postProcessing.chromaticAberration },
                      { label: 'Static Noise', key: 'noise' as const, value: cfg.postProcessing.noise },
                      { label: 'Vignette', key: 'vignette' as const, value: cfg.postProcessing.vignette },
                      { label: 'Flicker', key: 'flicker' as const, value: cfg.postProcessing.flicker },
                    ].map(({ label, key, value }) => (
                      <div key={key} className="slider-group">
                        <div className="slider-label"><span className="slider-label__text">{label}</span><span className="slider-label__value">{value}</span></div>
                        <input type="range" min="0" max="300" value={value} onChange={(e) => cfg.setPostProcessing(p => ({ ...p, [key]: Number(e.target.value) }))} />
                      </div>
                    ))}

                    <div className="section-separator"><span className="section-separator__text">Animation</span></div>

                    <div className="slider-group">
                      <div className="slider-label"><span className="slider-label__text">Matrix Rain</span><span className="slider-label__value">{cfg.animationEffects.matrixRain}</span></div>
                      <input type="range" min="0" max="300" value={cfg.animationEffects.matrixRain} onChange={(e) => cfg.setAnimationEffects(a => ({ ...a, matrixRain: Number(e.target.value) }))} />
                    </div>
                    <div className="slider-group">
                      <div className="slider-label"><span className="slider-label__text">Wave Distortion</span><span className="slider-label__value">{cfg.animationEffects.waveDistortion}</span></div>
                      <input type="range" min="0" max="300" value={cfg.animationEffects.waveDistortion} onChange={(e) => cfg.setAnimationEffects(a => ({ ...a, waveDistortion: Number(e.target.value) }))} />
                    </div>
                    <div className="toggle">
                      <span className="toggle__label">Typing Reveal</span>
                      <button onClick={() => cfg.setAnimationEffects(a => ({ ...a, typingReveal: !a.typingReveal }))} className={`toggle__track ${cfg.animationEffects.typingReveal ? 'toggle__track--on' : ''}`}><div className="toggle__thumb" /></button>
                    </div>
                  </div>
                )}
              </div>

              {/* EXPORT SECTION */}
              <div className="section-panel">
                <button onClick={() => toggleSection('export')} className="section-header">
                  <span className="section-header__label"><Download size={14} />Export</span>
                  <ChevronDown size={14} className={`section-header__chevron ${expandedSections.export ? 'section-header__chevron--open' : ''}`} />
                </button>
                {expandedSections.export && (
                  <div className="section-body">
                    <div className="toggle">
                      <span className="toggle__label">Export 2x Resolution</span>
                      <button onClick={() => cfg.setExport2x(!cfg.export2x)} className={`toggle__track ${cfg.export2x ? 'toggle__track--on' : ''}`}><div className="toggle__thumb" /></button>
                    </div>
                  </div>
                )}
              </div>

            </div>

            {appState === AppState.PLAYING && (
              <button onClick={cfg.resetSettings} className="btn btn--ghost" style={{ width: '100%', marginTop: 'var(--space-md)' }}>
                <RotateCcw size={14} />Reset Settings
              </button>
            )}
          </div>

          {appState === AppState.PLAYING && (
            <button onClick={reset} className="btn btn--destructive" style={{ width: '100%' }}>
              <RefreshCcw size={14} />Reset &amp; Upload New
            </button>
          )}
        </div>

        {/* Center Column: Viewer */}
        <div className="col-canvas">
          {/* Preset Bar */}
          {appState === AppState.PLAYING && (
            <div className="preset-bar">
              {STYLE_PRESETS.map(preset => (
                <button
                  key={preset.id}
                  className={`preset-chip ${cfg.activePresetId === preset.id ? 'preset-chip--active' : ''}`}
                  onClick={() => cfg.applyPreset(preset)}
                  title={preset.description}
                >
                  {preset.name}
                </button>
              ))}
            </div>
          )}

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
                    imageSrc={fileUrl}
                    config={cfg.deferredConfig}
                    outputWidth={cfg.deferredOutputWidth}
                    outputHeight={cfg.deferredOutputHeight}
                    export2x={cfg.export2x}
                  />
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Tenor Search */}
        <div className="col-tenor">
          <div className="card--tenor" style={{ maxHeight: controlsHeight ? `${controlsHeight}px` : undefined }}>
            <TenorSearch onGifSelect={handleFileSelect} compact />
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
