import { useState, useMemo, useCallback, useDeferredValue } from 'react';
import { AsciiConfig, PostProcessingConfig, AnimationEffectsConfig } from '../types';
import { DEFAULT_CHARS } from '../services/asciiUtils';
import { STYLE_PRESETS, StylePreset } from '../services/stylePresets';

const DEFAULT_DENSITY_CELL_WIDTH = 5;

export interface AsciiConfigState {
  // Individual values
  density: number;
  chars: string;
  color: string;
  invert: boolean;
  bgColor: string;
  fontAspectRatio: number;
  overlayOpacity: number;
  useSourceColor: boolean;
  brightness: number;
  contrast: number;
  saturation: number;
  dithering: boolean;
  sharpness: number;
  colorPalette: string;
  postProcessing: PostProcessingConfig;
  animationEffects: AnimationEffectsConfig;
  export2x: boolean;
  lockOutputAspect: boolean;
  activePresetId: string;
  outputWidth: number;
  outputHeight: number;

  // Setters
  setDensity: (v: number) => void;
  setChars: (v: string) => void;
  setColor: (v: string) => void;
  setInvert: (v: boolean) => void;
  setBgColor: (v: string) => void;
  setFontAspectRatio: (v: number) => void;
  setOverlayOpacity: (v: number) => void;
  setUseSourceColor: (v: boolean) => void;
  setBrightness: (v: number) => void;
  setContrast: (v: number) => void;
  setSaturation: (v: number) => void;
  setDithering: (v: boolean) => void;
  setSharpness: (v: number) => void;
  setColorPalette: (v: string) => void;
  setPostProcessing: (v: PostProcessingConfig | ((prev: PostProcessingConfig) => PostProcessingConfig)) => void;
  setAnimationEffects: (v: AnimationEffectsConfig | ((prev: AnimationEffectsConfig) => AnimationEffectsConfig)) => void;
  setExport2x: (v: boolean) => void;
  setLockOutputAspect: (v: boolean) => void;
  setOutputWidth: (v: number) => void;
  setOutputHeight: (v: number) => void;

  // Derived
  config: AsciiConfig;
  deferredConfig: AsciiConfig;
  deferredOutputWidth: number;
  deferredOutputHeight: number;
  outputWidthPx: number;
  outputHeightPx: number;
  bgIsTransparent: boolean;

  // Actions
  applyPreset: (preset: StylePreset) => void;
  resetSettings: () => void;
  handleDensityChange: (value: number) => void;
  handleOutputWidthChange: (value: number) => void;
  handleOutputHeightChange: (value: number) => void;
}

export function useAsciiConfig(
  inputSize: { width: number; height: number } | null,
  userAdjustedRef: React.MutableRefObject<boolean>
): AsciiConfigState {
  const [density, setDensity] = useState(60);
  const [chars, setChars] = useState(DEFAULT_CHARS);
  const [color, setColor] = useState('#ffffff');
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
    scanlines: 0, glow: 0, chromaticAberration: 0,
    noise: 0, vignette: 0, flicker: 0
  });
  const [animationEffects, setAnimationEffects] = useState<AnimationEffectsConfig>({
    matrixRain: 0, waveDistortion: 0, typingReveal: false
  });
  const [export2x, setExport2x] = useState(false);
  const [lockOutputAspect, setLockOutputAspect] = useState(true);
  const [activePresetId, setActivePresetId] = useState<string>('default');
  const [outputWidth, setOutputWidth] = useState(0);
  const [outputHeight, setOutputHeight] = useState(0);

  const inputAspect = inputSize ? (inputSize.height / inputSize.width) : 1;
  const outputWidthPx = outputWidth > 0 ? outputWidth : (inputSize?.width ?? 0);
  const outputHeightPx = outputHeight > 0 ? outputHeight : (inputSize?.height ?? 0);
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

  const deferredConfig = useDeferredValue(config);
  const deferredOutputWidth = useDeferredValue(outputWidthPx);
  const deferredOutputHeight = useDeferredValue(outputHeightPx);

  const handleOutputWidthChange = useCallback((value: number) => {
    userAdjustedRef.current = true;
    setOutputWidth(value);
    if (lockOutputAspect && inputSize) {
      setOutputHeight(Math.max(1, Math.round(value * inputAspect)));
    }
  }, [lockOutputAspect, inputSize, inputAspect]);

  const handleOutputHeightChange = useCallback((value: number) => {
    userAdjustedRef.current = true;
    setOutputHeight(value);
    if (lockOutputAspect && inputSize) {
      setOutputWidth(Math.max(1, Math.round(value / inputAspect)));
    }
  }, [lockOutputAspect, inputSize, inputAspect]);

  const handleDensityChange = useCallback((value: number) => {
    userAdjustedRef.current = true;
    setDensity(value);
  }, []);

  const applyPreset = useCallback((preset: StylePreset) => {
    const c = preset.config;
    if (c.resolution !== undefined) setDensity(c.resolution);
    if (c.chars !== undefined) setChars(c.chars);
    if (c.color !== undefined) setColor(c.color);
    if (c.invert !== undefined) setInvert(!c.invert);
    if (c.backgroundColor !== undefined) setBgColor(c.backgroundColor);
    if (c.fontAspectRatio !== undefined) setFontAspectRatio(c.fontAspectRatio);
    if (c.overlayOpacity !== undefined) setOverlayOpacity(c.overlayOpacity);
    if (c.useSourceColor !== undefined) setUseSourceColor(c.useSourceColor);
    if (c.brightness !== undefined) setBrightness(c.brightness);
    if (c.contrast !== undefined) setContrast(c.contrast);
    if (c.saturation !== undefined) setSaturation(c.saturation);
    if (c.dithering !== undefined) setDithering(c.dithering);
    if (c.sharpness !== undefined) setSharpness(c.sharpness);
    if (c.colorPalette !== undefined) setColorPalette(c.colorPalette);
    if (c.postProcessing !== undefined) setPostProcessing(c.postProcessing);
    if (c.animationEffects !== undefined) setAnimationEffects(c.animationEffects);
    setActivePresetId(preset.id);
  }, []);

  const resetSettings = useCallback(() => {
    const defaultPreset = STYLE_PRESETS.find(p => p.id === 'default');
    if (defaultPreset) applyPreset(defaultPreset);
    setExport2x(false);
    setLockOutputAspect(true);
    if (inputSize) {
      setOutputWidth(inputSize.width);
      setOutputHeight(inputSize.height);
      setDensity(Math.max(10, Math.round(inputSize.width / DEFAULT_DENSITY_CELL_WIDTH)));
    }
  }, [inputSize, applyPreset]);

  return {
    density, chars, color, invert, bgColor, fontAspectRatio, overlayOpacity,
    useSourceColor, brightness, contrast, saturation, dithering, sharpness,
    colorPalette, postProcessing, animationEffects, export2x, lockOutputAspect,
    activePresetId, outputWidth, outputHeight,

    setDensity, setChars, setColor, setInvert, setBgColor, setFontAspectRatio,
    setOverlayOpacity, setUseSourceColor, setBrightness, setContrast, setSaturation,
    setDithering, setSharpness, setColorPalette, setPostProcessing, setAnimationEffects,
    setExport2x, setLockOutputAspect, setOutputWidth, setOutputHeight,

    config, deferredConfig, deferredOutputWidth, deferredOutputHeight,
    outputWidthPx, outputHeightPx, bgIsTransparent,

    applyPreset, resetSettings, handleDensityChange,
    handleOutputWidthChange, handleOutputHeightChange,
  };
}
