import React, { useState, useMemo, useRef } from 'react';
import { Settings, RefreshCcw, Layers, Monitor } from 'lucide-react';
import FileUpload from './components/FileUpload';
import AsciiPlayer from './components/AsciiPlayer';
import { AsciiConfig, AppState } from './types';
import { DEFAULT_CHARS } from './services/asciiUtils';

const logoUrl = new URL('./lofilogo.png', import.meta.url).href;
const DEFAULT_DENSITY_CELL_WIDTH = 5;
type CropMode = 'none' | 'output' | '1:1' | '4:3' | '3:4' | '16:9' | '9:16' | '3:2' | '2:3';
const CROP_OPTIONS: { value: CropMode; label: string }[] = [
  { value: 'none', label: 'Off' },
  { value: 'output', label: 'Match Output' },
  { value: '1:1', label: '1:1' },
  { value: '4:3', label: '4:3' },
  { value: '3:4', label: '3:4' },
  { value: '16:9', label: '16:9' },
  { value: '9:16', label: '9:16' },
  { value: '3:2', label: '3:2' },
  { value: '2:3', label: '2:3' }
];

const App: React.FC = () => {
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  
  // Configuration State
  const [density, setDensity] = useState(60);
  const [chars, setChars] = useState(DEFAULT_CHARS);
  const [color, setColor] = useState('#22d3ee'); // Cyan default
  const [invert, setInvert] = useState(false);
  const [bgColor, setBgColor] = useState('#000000');
  const [fontAspectRatio, setFontAspectRatio] = useState(0.55);
  const [overlayOpacity, setOverlayOpacity] = useState(0);
  const [inputSize, setInputSize] = useState<{ width: number; height: number } | null>(null);
  const [outputWidth, setOutputWidth] = useState(0);
  const [outputHeight, setOutputHeight] = useState(0);
  const [lockOutputAspect, setLockOutputAspect] = useState(true);
  const [cropMode, setCropMode] = useState<CropMode>('none');
  const [cropX, setCropX] = useState(0.5);
  const [cropY, setCropY] = useState(0.5);
  const userAdjustedRef = useRef(false);

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
  const cropAspect = useMemo(() => {
    switch (cropMode) {
      case 'output':
        if (outputWidthPx > 0 && outputHeightPx > 0) {
          return outputWidthPx / outputHeightPx;
        }
        return null;
      case '1:1':
        return 1;
      case '4:3':
        return 4 / 3;
      case '3:4':
        return 3 / 4;
      case '16:9':
        return 16 / 9;
      case '9:16':
        return 9 / 16;
      case '3:2':
        return 3 / 2;
      case '2:3':
        return 2 / 3;
      default:
        return null;
    }
  }, [cropMode, outputWidthPx, outputHeightPx]);
  const sourceAspect = cropAspect ?? inputAspect;
  const cropLabel = CROP_OPTIONS.find((option) => option.value === cropMode)?.label ?? 'Off';
  const cropEnabled = cropMode !== 'none';

  const config: AsciiConfig = useMemo(() => ({
    resolution: density,
    chars,
    color,
    backgroundColor: bgColor,
    invert,
    fontAspectRatio,
    overlayOpacity
  }), [density, chars, color, bgColor, invert, fontAspectRatio, overlayOpacity]);

  const handleOutputWidthChange = (value: number) => {
    userAdjustedRef.current = true;
    setOutputWidth(value);
    if (lockOutputAspect && inputSize) {
      setOutputHeight(Math.max(1, Math.round(value * sourceAspect)));
    }
  };

  const handleOutputHeightChange = (value: number) => {
    userAdjustedRef.current = true;
    setOutputHeight(value);
    if (lockOutputAspect && inputSize) {
      setOutputWidth(Math.max(1, Math.round(value / sourceAspect)));
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
    setColor('#22d3ee');
    setCropMode('none');
    setCropX(0.5);
    setCropY(0.5);
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
    setCropMode('none');
    setCropX(0.5);
    setCropY(0.5);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      {/* Header */}
      <header className="border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full overflow-hidden border border-zinc-800 shadow-sm bg-zinc-900">
              <img
                src={logoUrl}
                alt="Gif2Ascii logo"
                className="w-full h-full object-cover"
              />
            </div>
            <h1 className="font-bold text-xl tracking-tight">Gif2Ascii</h1>
          </div>
          <div className="flex items-center gap-4" />
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-6 flex flex-col lg:flex-row gap-8">
        
        {/* Left Column: Controls */}
        <div className="lg:w-80 flex flex-col gap-6 shrink-0">
          
          {/* Manual Controls */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex flex-col gap-6">
            <h3 className="text-lg font-bold flex items-center gap-2 text-zinc-300">
              <Settings size={18} />
              Render Settings
            </h3>

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
              <div className="flex justify-between text-xs text-zinc-400">
                <span>Output Width</span>
                <span>{outputWidthPx > 0 ? `${outputWidthPx}px` : '--'}</span>
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
              <div className="flex justify-between text-xs text-zinc-400">
                <span>Output Height</span>
                <span>{outputHeightPx > 0 ? `${outputHeightPx}px` : '--'}</span>
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
                    setOutputHeight(Math.max(1, Math.round(outputWidthPx * sourceAspect)));
                  }
                }}
                className={`w-12 h-6 rounded-full transition-colors relative ${lockOutputAspect ? 'bg-indigo-600' : 'bg-zinc-700'}`}
              >
                <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${lockOutputAspect ? 'translate-x-6' : 'translate-x-0'}`} />
              </button>
            </div>

            {/* Crop Aspect */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-zinc-400">
                <span>Crop Aspect</span>
                <span>{cropLabel}</span>
              </div>
              <select
                value={cropMode}
                onChange={(e) => setCropMode(e.target.value as CropMode)}
                disabled={!inputSize}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {CROP_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Crop X */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-zinc-400">
                <span>Crop X</span>
                <span>{Math.round(cropX * 100)}%</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="1" 
                step="0.01"
                value={cropX} 
                onChange={(e) => setCropX(Number(e.target.value))}
                disabled={!inputSize || !cropEnabled}
                className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            {/* Crop Y */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-zinc-400">
                <span>Crop Y</span>
                <span>{Math.round(cropY * 100)}%</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="1" 
                step="0.01"
                value={cropY} 
                onChange={(e) => setCropY(Number(e.target.value))}
                disabled={!inputSize || !cropEnabled}
                className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            {/* Font Aspect Ratio Slider (Calibration) */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-zinc-400">
                <span className="flex items-center gap-1"><Monitor size={12}/> Aspect Calibration</span>
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

            {/* Colors */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs text-zinc-400 block">Text Color</label>
                <div className="flex items-center gap-2 bg-zinc-800 p-2 rounded-lg border border-zinc-700">
                   <input 
                    type="color" 
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
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
                    value={bgColor}
                    onChange={(e) => setBgColor(e.target.value)}
                    className="w-6 h-6 rounded bg-transparent cursor-pointer border-none p-0"
                   />
                   <span className="text-xs font-mono text-zinc-400">{bgColor}</span>
                </div>
              </div>
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
        <div className="flex-1 bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4 relative flex flex-col min-h-[500px] justify-center items-center">
          
          {appState === AppState.IDLE ? (
             <div className="w-full h-full flex items-center justify-center">
                <FileUpload onFileSelect={handleFileSelect} />
             </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              {fileUrl && (
                <AsciiPlayer 
                  imageSrc={fileUrl} 
                  config={config}
                  outputWidth={outputWidthPx}
                  outputHeight={outputHeightPx}
                  cropAspect={cropAspect}
                  cropX={cropX}
                  cropY={cropY}
                />
              )}
            </div>
          )}

        </div>
      </main>
    </div>
  );
};

export default App;
