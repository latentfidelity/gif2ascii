import React, { useEffect, useImperativeHandle, useRef, useState, useCallback } from 'react';
import { Play, Pause, RotateCcw, Download, Video, FileImage, Copy, FileText, ChevronLeft, ChevronRight, Maximize, SkipBack, SkipForward } from 'lucide-react';
import { parseGIF, decompressFrames } from 'gifuct-js';
import { GIFEncoder, quantize, applyPalette } from 'gifenc';
import { AsciiConfig, type PlaybackLoopMode } from '../types';
import { resizeAndGetImageData, convertToAscii } from '../services/asciiUtils';
import { exportVideo, downloadBlob, isMP4ExportSupported } from '../services/videoExport';
import { applyPostProcessing, hasPostProcessing } from '../services/postProcessing';
import { renderMatrixRain, applyWaveDistortion, applyTypingReveal, resetTypingReveal, hasAnimationEffects } from '../services/animationEffects';

// Check if buffer is a GIF by magic bytes
const isGifBuffer = (buffer: ArrayBuffer): boolean => {
  const arr = new Uint8Array(buffer.slice(0, 6));
  // GIF87a or GIF89a
  return (
    arr[0] === 0x47 && // G
    arr[1] === 0x49 && // I
    arr[2] === 0x46 && // F
    arr[3] === 0x38 && // 8
    (arr[4] === 0x37 || arr[4] === 0x39) && // 7 or 9
    arr[5] === 0x61 // a
  );
};

interface AsciiPlayerProps {
  imageSrc: string;
  config: AsciiConfig;
  outputWidth?: number;
  outputHeight?: number;
  export2x?: boolean;
  frameRate?: number;
  playbackSpeed?: number;
  loopMode?: PlaybackLoopMode;
  onPlaybackSpeedChange?: (speed: number) => void;
  onNativeFrameRate?: (frameRate: number | null) => void;
  onFrame?: (base64Frame: string) => void;
}

export interface AsciiPlayerHandle {
  exportPng: () => void;
}

// Types for gifuct-js frames
interface GifFrame {
  dims: { width: number; height: number; top: number; left: number };
  colorTable: [number, number, number][];
  delay: number;
  disposalType: number;
  patch: Uint8ClampedArray;
  transparentIndex: number;
}

const VIDEO_EXPORT_BITRATE = 8000000;
const MIN_PLAYER_WIDTH = 320;
const MIN_PLAYER_HEIGHT = 260;
const DEFAULT_PLAYER_WIDTH = 400;
const DEFAULT_PLAYER_HEIGHT = 300;
const DEFAULT_GIF_FRAME_DELAY_MS = 100;
const PLAYBACK_SPEED_PRESETS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
const INTERACTIVE_KEYBOARD_SELECTOR = [
  'input',
  'textarea',
  'select',
  'button',
  '[contenteditable="true"]',
  '[role="button"]',
  '[role="slider"]',
  '[role="spinbutton"]',
  '[role="textbox"]',
  '[role="combobox"]',
].join(',');

const isInteractiveKeyboardTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;

  return Boolean(target.closest(INTERACTIVE_KEYBOARD_SELECTOR));
};

const parseCssPixels = (value: string): number => {
  if (!value || value === 'none') return 0;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getEffectiveFrameDelay = (delay: number): number => (
  delay > 0 ? delay : DEFAULT_GIF_FRAME_DELAY_MS
);

const getNativeFrameRate = (frames: GifFrame[]): number | null => {
  if (frames.length <= 1) return null;

  const totalDelay = frames.reduce((sum, frame) => (
    sum + getEffectiveFrameDelay(frame.delay)
  ), 0);

  if (totalDelay <= 0) return null;
  return 1000 / (totalDelay / frames.length);
};

interface GifRestoreState {
  imageData: ImageData;
  left: number;
  top: number;
}

const drawGifFrameToComposition = (
  ctx: CanvasRenderingContext2D,
  patchCtx: CanvasRenderingContext2D | null,
  patchCanvas: HTMLCanvasElement | null,
  frame: GifFrame
): GifRestoreState | null => {
  const { width, height, top, left } = frame.dims;
  const restoreState = frame.disposalType === 3
    ? { imageData: ctx.getImageData(left, top, width, height), left, top }
    : null;

  if (frame.patch && patchCtx && patchCanvas) {
    const patchData = new ImageData(frame.patch, width, height);
    patchCanvas.width = width;
    patchCanvas.height = height;
    patchCtx.putImageData(patchData, 0, 0);
    ctx.drawImage(patchCanvas, left, top);
  }

  return restoreState;
};

const disposeGifFrameFromComposition = (
  ctx: CanvasRenderingContext2D,
  frame: GifFrame,
  restoreState: GifRestoreState | null
): void => {
  const { width, height, top, left } = frame.dims;

  if (frame.disposalType === 2) {
    ctx.clearRect(left, top, width, height);
  } else if (frame.disposalType === 3 && restoreState) {
    ctx.putImageData(restoreState.imageData, restoreState.left, restoreState.top);
  }
};

// Floyd-Steinberg dithering for better GIF quality
const applyFloydSteinberg = (
  data: Uint8ClampedArray,
  width: number,
  height: number,
  palette: [number, number, number][]
): Uint8ClampedArray => {
  const pixels = new Float32Array(data.length);
  for (let i = 0; i < data.length; i++) pixels[i] = data[i];

  const findNearest = (r: number, g: number, b: number): [number, number, number] => {
    let minDist = Infinity;
    let nearest = palette[0];
    for (const c of palette) {
      const dr = r - c[0], dg = g - c[1], db = b - c[2];
      const dist = dr * dr + dg * dg + db * db;
      if (dist < minDist) {
        minDist = dist;
        nearest = c;
      }
    }
    return nearest;
  };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const oldR = pixels[i], oldG = pixels[i + 1], oldB = pixels[i + 2];
      const [newR, newG, newB] = findNearest(oldR, oldG, oldB);

      pixels[i] = newR;
      pixels[i + 1] = newG;
      pixels[i + 2] = newB;

      const errR = oldR - newR, errG = oldG - newG, errB = oldB - newB;

      if (x + 1 < width) {
        pixels[i + 4] += errR * 7 / 16;
        pixels[i + 5] += errG * 7 / 16;
        pixels[i + 6] += errB * 7 / 16;
      }
      if (y + 1 < height) {
        if (x > 0) {
          const j = ((y + 1) * width + (x - 1)) * 4;
          pixels[j] += errR * 3 / 16;
          pixels[j + 1] += errG * 3 / 16;
          pixels[j + 2] += errB * 3 / 16;
        }
        const j = ((y + 1) * width + x) * 4;
        pixels[j] += errR * 5 / 16;
        pixels[j + 1] += errG * 5 / 16;
        pixels[j + 2] += errB * 5 / 16;
        if (x + 1 < width) {
          const k = ((y + 1) * width + (x + 1)) * 4;
          pixels[k] += errR / 16;
          pixels[k + 1] += errG / 16;
          pixels[k + 2] += errB / 16;
        }
      }
    }
  }

  const result = new Uint8ClampedArray(data.length);
  for (let i = 0; i < pixels.length; i++) {
    result[i] = Math.max(0, Math.min(255, Math.round(pixels[i])));
  }
  return result;
};
const getCenteredCropRect = (width: number, height: number, targetAspect: number) => {
  const sourceAspect = height / width;
  let cropWidth = width;
  let cropHeight = height;
  let cropX = 0;
  let cropY = 0;

  if (targetAspect > sourceAspect) {
    cropHeight = height;
    cropWidth = Math.round(height / targetAspect);
    cropX = Math.round((width - cropWidth) / 2);
  } else if (targetAspect < sourceAspect) {
    cropWidth = width;
    cropHeight = Math.round(width * targetAspect);
    cropY = Math.round((height - cropHeight) / 2);
  }

  cropWidth = Math.max(1, Math.min(width, cropWidth));
  cropHeight = Math.max(1, Math.min(height, cropHeight));
  cropX = Math.max(0, Math.min(width - cropWidth, cropX));
  cropY = Math.max(0, Math.min(height - cropHeight, cropY));

  return { x: cropX, y: cropY, width: cropWidth, height: cropHeight };
};

const AsciiPlayer = React.forwardRef<AsciiPlayerHandle, AsciiPlayerProps>(({
  imageSrc,
  config,
  outputWidth,
  outputHeight,
  export2x = false,
  frameRate,
  playbackSpeed,
  loopMode = 'forever',
  onPlaybackSpeedChange,
  onNativeFrameRate,
  onFrame,
}, ref) => {
  const exportScale = export2x ? 2 : 1;
  const shellRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  
  // The composition canvas holds the full-resolution pixel data of the current GIF frame
  const compositionCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const compositionCtxRef = useRef<CanvasRenderingContext2D | null>(null);

  // Temporary canvas to handle "patch" blitting with correct transparency
  const patchCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const patchCtxRef = useRef<CanvasRenderingContext2D | null>(null);

  const [frames, setFrames] = useState<GifFrame[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isStaticImage, setIsStaticImage] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [aspectRatio, setAspectRatio] = useState<number>(1);
  const [displaySize, setDisplaySize] = useState<{ width: number; height: number }>({ width: 1, height: 1 });
  const [internalPlaybackSpeed, setInternalPlaybackSpeed] = useState(1);
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [lastAsciiText, setLastAsciiText] = useState<string>('');
  const [copyStatus, setCopyStatus] = useState<{ target: 'image' | 'text'; state: 'copied' | 'failed' } | null>(null);
  const typingRevealEnabled = config.animationEffects?.typingReveal ?? false;
  const hasAnimatedFrames = !isStaticImage && frames.length > 1;
  const needsContinuousRender =
    (config.animationEffects && hasAnimationEffects(config.animationEffects)) ||
    (config.postProcessing?.flicker ?? 0) > 0;
  const displayPlaybackSpeed = playbackSpeed ?? internalPlaybackSpeed;
  const targetFrameRate = frameRate && frameRate > 0 ? frameRate : null;
  const setDisplayPlaybackSpeed = useCallback((speed: number) => {
    if (onPlaybackSpeedChange) {
      onPlaybackSpeedChange(speed);
      return;
    }
    setInternalPlaybackSpeed(speed);
  }, [onPlaybackSpeedChange]);

  // Animation State Refs (Mutable for performance in loop)
  const frameIndexRef = useRef(0);
  const lastFrameTimeRef = useRef(0);
  const requestRef = useRef<number>();
  const frameCapturedRef = useRef<boolean>(false);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null); // For resizing
  const displayedFrameIndexRef = useRef(0);
    
  // Helper: Offscreen canvas for scaling
  const getOffscreenCanvas = () => {
    if (!offscreenCanvasRef.current) {
      offscreenCanvasRef.current = document.createElement('canvas');
    }
    return offscreenCanvasRef.current;
  };

  // 1. Fetch and Parse Image (GIF or Static)
  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError(null);
    setFrames([]);
    setIsStaticImage(false);
    setIsPlaying(true); // Reset to playing when loading new file
    frameIndexRef.current = 0;
    displayedFrameIndexRef.current = 0;
    lastFrameTimeRef.current = 0;
    frameCapturedRef.current = false;
    setCurrentFrameIndex(0);

    // Cleanup previous composition
    compositionCanvasRef.current = null;

    // Reset typing reveal animation
    resetTypingReveal();

    const loadImage = async () => {
      try {
        const resp = await fetch(imageSrc);
        if (!resp.ok) throw new Error("Failed to fetch image");
        const buffer = await resp.arrayBuffer();

        if (isGifBuffer(buffer)) {
          // Parse as GIF
          const gif = parseGIF(buffer);
          const loadedFrames = decompressFrames(gif, true) as GifFrame[];

          if (active) {
              if (loadedFrames.length > 0) {
                  // Setup Composition Canvas (The "Source of Truth" for pixels)
                  const width = gif.lsd?.width || loadedFrames[0].dims.width;
                  const height = gif.lsd?.height || loadedFrames[0].dims.height;
                  setAspectRatio(width / height);

                  const cCanvas = document.createElement('canvas');
                  cCanvas.width = width;
                  cCanvas.height = height;
                  compositionCanvasRef.current = cCanvas;
                  compositionCtxRef.current = cCanvas.getContext('2d', { willReadFrequently: true });

                  // Setup Patch Helper Canvas
                  const pCanvas = document.createElement('canvas');
                  // Size will be set dynamically per frame patch
                  patchCanvasRef.current = pCanvas;
                  patchCtxRef.current = pCanvas.getContext('2d', { willReadFrequently: true });

                  setFrames(loadedFrames);
                  setIsStaticImage(false);
                  setIsPlaying(loadedFrames.length > 1);
                  onNativeFrameRate?.(getNativeFrameRate(loadedFrames));
              } else {
                  throw new Error("No frames found in GIF");
              }
              setIsLoading(false);
          }
        } else {
          // Load as static image (PNG, JPEG, WebP)
          const blob = new Blob([buffer], {
            type: resp.headers.get('content-type') || undefined,
          });
          const img = new Image();
          const imageObjectUrl = URL.createObjectURL(blob);
          img.src = imageObjectUrl;

          try {
            await new Promise<void>((resolve, reject) => {
              img.onload = () => resolve();
              img.onerror = () => reject(new Error("Failed to load image"));
            });
          } finally {
            URL.revokeObjectURL(imageObjectUrl);
          }

          if (active) {
            const width = img.naturalWidth;
            const height = img.naturalHeight;
            setAspectRatio(width / height);

            // Setup Composition Canvas with the static image
            const cCanvas = document.createElement('canvas');
            cCanvas.width = width;
            cCanvas.height = height;
            compositionCanvasRef.current = cCanvas;
            const ctx = cCanvas.getContext('2d', { willReadFrequently: true });
            compositionCtxRef.current = ctx;

            // Draw the image to the composition canvas
            if (ctx) {
              ctx.drawImage(img, 0, 0);
            }

            // For static images, we don't use frames array
            setFrames([]);
            setIsStaticImage(true);
            setIsPlaying(false); // No animation for static images
            onNativeFrameRate?.(null);
            setIsLoading(false);
          }
        }
      } catch (err: any) {
        if (active) {
            console.error("Image Parse Error:", err);
            setError("Could not parse image. Please try another file.");
            setIsLoading(false);
        }
      }
    };

    loadImage();
    return () => { active = false; };
  }, [imageSrc, onNativeFrameRate]);

  useEffect(() => {
    if (typingRevealEnabled) {
      resetTypingReveal();
    }
  }, [typingRevealEnabled, imageSrc]);

  // Core Render Logic (Draws to canvasRef based on current composition)
  const renderCurrentFrameToCanvas = useCallback((
    targetCanvas?: HTMLCanvasElement,
    includeOverlay?: boolean,
    time?: number,
    sourceCanvasOverride?: HTMLCanvasElement,
    updateLastAsciiText = true
  ) => {
     const finalCanvas = targetCanvas || canvasRef.current;
     const sourceCanvas = sourceCanvasOverride || compositionCanvasRef.current;
     if (!finalCanvas || !sourceCanvas) return null;
     
     const finalCtx = finalCanvas.getContext('2d', { willReadFrequently: true });
     if (!finalCtx) return null;

     const renderConfig = config;
     const hasTransparentBg = renderConfig.backgroundColor === 'transparent';
     const outputAspectRatio = outputWidth && outputHeight
        ? outputHeight / outputWidth
        : undefined;
     const cropRect = outputAspectRatio
        ? getCenteredCropRect(
            sourceCanvas.width,
            sourceCanvas.height,
            outputAspectRatio
          )
        : null;
     let imageData = resizeAndGetImageData(
        sourceCanvas,
        renderConfig.resolution,
        renderConfig.fontAspectRatio,
        getOffscreenCanvas(),
        outputAspectRatio,
        renderConfig.sharpness || 0
     );

     if (!imageData) return null;

     const asciiResult = convertToAscii(
        imageData,
        imageData.width,
        imageData.height,
        renderConfig
     );
     const asciiString = asciiResult.text;
     const colors = asciiResult.colors;
     const underpaintAlphas = asciiResult.underpaintAlphas;

     // Store last ASCII text for copy function during preview renders.
     if (updateLastAsciiText) {
       setLastAsciiText(asciiString);
     }

     // Clear and Draw Text
     if (hasTransparentBg) {
         finalCtx.clearRect(0, 0, finalCanvas.width, finalCanvas.height);
     } else {
         finalCtx.fillStyle = renderConfig.backgroundColor;
         finalCtx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);
     }

     finalCtx.textBaseline = 'top';

     const lines = asciiString.split('\n');
     if (lines.length > 0 && lines[lines.length-1] === '') lines.pop();

     const rows = lines.length;
     if (rows > 0) {
         const cellHeight = finalCanvas.height / rows;
         const cols = lines[0]?.length || 1;
         const cellWidth = finalCanvas.width / cols;
         finalCtx.font = `bold ${cellHeight * 1.05}px "JetBrains Mono", monospace`;

         if (colors && renderConfig.useSourceColor) {
             // Tint sparse glyph cells so source color survives the ASCII negative space.
             if (!hasTransparentBg && underpaintAlphas) {
                 finalCtx.save();
                 for (let y = 0; y < rows; y++) {
                     const rowColors = colors[y] || [];
                     const rowUnderpaintAlphas = underpaintAlphas[y] || [];
                     for (let x = 0; x < cols; x++) {
                         const charColor = rowColors[x];
                         const underpaintAlpha = rowUnderpaintAlphas[x] || 0;
                         if (charColor && charColor !== 'transparent' && underpaintAlpha > 0) {
                             finalCtx.globalAlpha = underpaintAlpha;
                             finalCtx.fillStyle = charColor;
                             finalCtx.fillRect(x * cellWidth, y * cellHeight, cellWidth + 0.5, cellHeight + 0.5);
                         }
                     }
                 }
                 finalCtx.restore();
             }

             // Per-character color rendering
             for (let y = 0; y < rows; y++) {
                 const line = lines[y];
                 const rowColors = colors[y] || [];
                 for (let x = 0; x < line.length; x++) {
                     const char = line[x];
                     const charColor = rowColors[x];
                     if (charColor && charColor !== 'transparent' && char !== ' ') {
                         finalCtx.fillStyle = charColor;
                         finalCtx.fillText(char, x * cellWidth, y * cellHeight);
                     }
                 }
             }
         } else {
             // Single color rendering (original)
             finalCtx.fillStyle = renderConfig.color;
             for (let i = 0; i < rows; i++) {
                 finalCtx.fillText(lines[i], 0, i * cellHeight, finalCanvas.width);
             }
         }
     }

     if (includeOverlay && renderConfig.overlayOpacity > 0) {
         finalCtx.save();
         finalCtx.globalAlpha = Math.min(1, Math.max(0, renderConfig.overlayOpacity));
         if (cropRect) {
            finalCtx.drawImage(
              sourceCanvas,
              cropRect.x,
              cropRect.y,
              cropRect.width,
              cropRect.height,
              0,
              0,
              finalCanvas.width,
              finalCanvas.height
            );
         } else {
            finalCtx.drawImage(
              sourceCanvas,
              0,
              0,
              finalCanvas.width,
              finalCanvas.height
            );
         }
         finalCtx.restore();
     }

     // Apply post-processing effects (CRT, glow, etc.)
     const currentTime = time ?? Date.now();
     if (includeOverlay && renderConfig.postProcessing && hasPostProcessing(renderConfig.postProcessing)) {
         applyPostProcessing(finalCanvas, renderConfig.postProcessing, currentTime);
     }

     // Apply animation effects (matrix rain, wave distortion, typing reveal)
     if (includeOverlay && renderConfig.animationEffects && hasAnimationEffects(renderConfig.animationEffects)) {
         const rows = lines.length;
         const cols = lines[0]?.length || 1;
         const cellHeight = finalCanvas.height / rows;
         const cellWidth = finalCanvas.width / cols;

         // Wave distortion (applies to whole canvas)
         if (renderConfig.animationEffects.waveDistortion > 0) {
             applyWaveDistortion(
               finalCtx,
               finalCanvas,
               renderConfig.animationEffects.waveDistortion,
               currentTime,
               renderConfig.backgroundColor
             );
         }

         // Matrix rain overlay
         if (renderConfig.animationEffects.matrixRain > 0) {
             renderMatrixRain(finalCtx, finalCanvas.width, finalCanvas.height, cellWidth, cellHeight, renderConfig.animationEffects.matrixRain, currentTime);
         }

         // Typing reveal (for static images or paused GIFs)
         if (renderConfig.animationEffects.typingReveal) {
             applyTypingReveal(finalCtx, finalCanvas.width, finalCanvas.height, cellWidth, cellHeight, currentTime, renderConfig.backgroundColor);
         }
     }

     return { finalCtx, finalCanvas };
  }, [config, outputWidth, outputHeight]);


  // 2a. Render static image when config or canvas size changes
  useEffect(() => {
    if (!isStaticImage || isLoading || !compositionCanvasRef.current || !canvasRef.current) return;

    // Check if animation effects need continuous updates
    if (needsContinuousRender) {
      // Animation effects need continuous rendering
      let animationId: number;
      const animate = () => {
        renderCurrentFrameToCanvas(undefined, true, Date.now());
        animationId = requestAnimationFrame(animate);
      };
      animationId = requestAnimationFrame(animate);

      // Capture frame for AI once
      if (!frameCapturedRef.current && onFrame) {
        try {
          const base64 = canvasRef.current.toDataURL('image/png').split(',')[1];
          onFrame(base64);
          frameCapturedRef.current = true;
        } catch(e) {}
      }

      return () => cancelAnimationFrame(animationId);
    } else {
      // Static rendering (no animation effects)
      const result = renderCurrentFrameToCanvas(undefined, true);

      // Capture frame for AI if not already captured
      if (result && !frameCapturedRef.current && onFrame) {
        try {
          const base64 = result.finalCanvas.toDataURL('image/png').split(',')[1];
          onFrame(base64);
          frameCapturedRef.current = true;
        } catch(e) {}
      }
    }
  }, [isStaticImage, isLoading, config, displaySize, renderCurrentFrameToCanvas, onFrame, needsContinuousRender]);

  // 2a-2. Re-render paused animated GIF when config changes
  useEffect(() => {
    // Only for animated GIFs that are paused
    if (isStaticImage || isPlaying || isLoading || frames.length === 0) return;
    if (!compositionCanvasRef.current || !canvasRef.current) return;

    // Check if animation effects need continuous updates
    if (needsContinuousRender) {
      // Animation effects need continuous rendering even when paused
      let animationId: number;
      const animate = () => {
        renderCurrentFrameToCanvas(undefined, true, Date.now());
        animationId = requestAnimationFrame(animate);
      };
      animationId = requestAnimationFrame(animate);
      return () => cancelAnimationFrame(animationId);
    } else {
      // Re-render the current frame with updated config
      renderCurrentFrameToCanvas(undefined, true);
    }
  }, [isStaticImage, isPlaying, isLoading, frames.length, config, displaySize, renderCurrentFrameToCanvas, needsContinuousRender]);

  // 2b. Render Loop (Playback for animated GIFs)
  const renderLoop = useCallback((timestamp: number) => {
    if (
      !hasAnimatedFrames ||
      !canvasRef.current ||
      !compositionCtxRef.current ||
      !compositionCanvasRef.current
    ) {
      return;
    }

    const renderedFrameIndex = frameIndexRef.current;
    const currentFrame = frames[renderedFrameIndex];

    // Playback Timing:
    // If delay is 0, we treat it as 100ms for playback comfort,
    // unless it's a very high framerate gif where 0 means "as fast as possible".
    // Standard browsers treat 0 as 100ms (10fps).
    const baseDelay = targetFrameRate ? 1000 / targetFrameRate : getEffectiveFrameDelay(currentFrame.delay);
    // Apply playback speed (higher speed = shorter delay)
    const delay = baseDelay / displayPlaybackSpeed;

    // Check if it's time to advance frame
    if (timestamp - lastFrameTimeRef.current >= delay) {

        // --- COMPOSITION UPDATE ---
        const ctx = compositionCtxRef.current;
        const frame = currentFrame;
        const restoreState = drawGifFrameToComposition(
            ctx,
            patchCtxRef.current,
            patchCanvasRef.current,
            frame
        );

        // --- RENDER ASCII TO SCREEN ---
        const renderResult = renderCurrentFrameToCanvas(undefined, true, timestamp);

        // AI Frame Capture (Once per file load)
        if (renderResult && !frameCapturedRef.current && onFrame) {
            try {
                const base64 = renderResult.finalCanvas.toDataURL('image/png').split(',')[1];
                onFrame(base64);
                frameCapturedRef.current = true;
            } catch(e) {}
        }

        // Advance Frame
        lastFrameTimeRef.current = timestamp;

        disposeGifFrameFromComposition(ctx, frame, restoreState);

        displayedFrameIndexRef.current = renderedFrameIndex;
        const nextFrameIndex = renderedFrameIndex + 1;
        if (nextFrameIndex >= frames.length) {
          frameIndexRef.current = loopMode === 'forever' ? 0 : frames.length - 1;
          if (loopMode === 'once') {
            setIsPlaying(false);
          }
        } else {
          frameIndexRef.current = nextFrameIndex;
        }
        setCurrentFrameIndex(renderedFrameIndex);
    }

    requestRef.current = requestAnimationFrame(renderLoop);
  }, [hasAnimatedFrames, frames, onFrame, renderCurrentFrameToCanvas, displayPlaybackSpeed, targetFrameRate, loopMode]);

  // Start/Stop Loop
  useEffect(() => {
    if (!hasAnimatedFrames || !isPlaying || isExporting || isLoading) {
      return;
    }

    requestRef.current = requestAnimationFrame(renderLoop);
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
        requestRef.current = undefined;
      }
    };
  }, [hasAnimatedFrames, isPlaying, isExporting, isLoading, renderLoop]);

  const getBaseDisplaySize = useCallback(() => {
    const hasOutputWidth = Boolean(outputWidth && outputWidth > 0);
    const hasOutputHeight = Boolean(outputHeight && outputHeight > 0);
    const sourceAspect = aspectRatio > 0 ? aspectRatio : 1;

    if (hasOutputWidth && hasOutputHeight) {
      return {
        width: Math.max(1, Math.floor(outputWidth!)),
        height: Math.max(1, Math.floor(outputHeight!)),
      };
    }

    if (hasOutputWidth) {
      const width = Math.max(1, Math.floor(outputWidth!));
      return {
        width,
        height: Math.max(1, Math.round(width / sourceAspect)),
      };
    }

    if (hasOutputHeight) {
      const height = Math.max(1, Math.floor(outputHeight!));
      return {
        width: Math.max(1, Math.round(height * sourceAspect)),
        height,
      };
    }

    return {
      width: DEFAULT_PLAYER_WIDTH,
      height: Math.max(1, Math.round(DEFAULT_PLAYER_WIDTH / sourceAspect || DEFAULT_PLAYER_HEIGHT)),
    };
  }, [aspectRatio, outputHeight, outputWidth]);

  const getFittedDisplaySize = useCallback(() => {
    const baseSize = getBaseDisplaySize();
    const shell = shellRef.current;
    const frame = frameRef.current;
    const host = shell?.parentElement;
    const hostWidth = host?.clientWidth || shell?.clientWidth || baseSize.width;
    const cssMaxHeight = frame ? parseCssPixels(window.getComputedStyle(frame).maxHeight) : 0;
    const fallbackMaxHeight = Math.max(MIN_PLAYER_HEIGHT, Math.round(window.innerHeight * 0.58));
    const maxWidth = Math.max(1, hostWidth);
    const maxHeight = Math.max(1, cssMaxHeight || fallbackMaxHeight);

    const fitScale = Math.min(maxWidth / baseSize.width, maxHeight / baseSize.height);
    const preferredScale = Math.max(
      1,
      MIN_PLAYER_WIDTH / baseSize.width,
      MIN_PLAYER_HEIGHT / baseSize.height
    );
    const scale = Math.max(0.01, Math.min(preferredScale, fitScale));

    return {
      width: Math.max(1, Math.round(baseSize.width * scale)),
      height: Math.max(1, Math.round(baseSize.height * scale)),
    };
  }, [getBaseDisplaySize]);

  useEffect(() => {
    const updateDisplaySize = () => {
      const next = getFittedDisplaySize();
      setDisplaySize((prev) => {
        if (prev.width === next.width && prev.height === next.height) return prev;
        return next;
      });
    };

    updateDisplaySize();

    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(updateDisplaySize)
      : null;

    if (resizeObserver) {
      if (shellRef.current) resizeObserver.observe(shellRef.current);
      if (shellRef.current?.parentElement) resizeObserver.observe(shellRef.current.parentElement);
      if (frameRef.current) resizeObserver.observe(frameRef.current);
    }

    window.addEventListener('resize', updateDisplaySize);
    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', updateDisplaySize);
    };
  }, [getFittedDisplaySize]);

  // Size and Canvas Setup
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Don't resize canvas while loading - it clears the canvas and we have no content to redraw.
    if (isLoading) return;

    let canvasResized = false;
    if (canvas.width !== displaySize.width || canvas.height !== displaySize.height) {
      canvas.width = displaySize.width;
      canvas.height = displaySize.height;
      canvasResized = true;
    }

    // For static images, render immediately after resize to prevent flicker.
    if (canvasResized && isStaticImage && compositionCanvasRef.current) {
      renderCurrentFrameToCanvas(undefined, true);
    }
  }, [displaySize, isStaticImage, isLoading, renderCurrentFrameToCanvas]);

  const restart = () => {
    frameIndexRef.current = 0;
    displayedFrameIndexRef.current = 0;
    lastFrameTimeRef.current = 0;
    setCurrentFrameIndex(0);
    if (compositionCtxRef.current && compositionCanvasRef.current) {
        compositionCtxRef.current.clearRect(0, 0, compositionCanvasRef.current.width, compositionCanvasRef.current.height);
    }
    setIsPlaying(true);
  };

  const createVisualExportCanvas = useCallback((time = Date.now()): HTMLCanvasElement | null => {
    if (!canvasRef.current || !compositionCanvasRef.current) return null;

    const compCanvas = compositionCanvasRef.current;
    const aspect = compCanvas.height / compCanvas.width;
    const baseWidth = Math.max(
        1,
        Math.floor(outputWidth || ((outputHeight || compCanvas.height) / aspect))
    );
    const baseHeight = Math.max(
        1,
        Math.round(outputHeight || (baseWidth * aspect))
    );
    const exportWidth = Math.max(1, Math.floor(baseWidth * exportScale));
    const exportHeight = Math.max(1, Math.floor(baseHeight * exportScale));

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = exportWidth;
    exportCanvas.height = exportHeight;

    const result = renderCurrentFrameToCanvas(exportCanvas, true, time, undefined, false);
    return result?.finalCanvas ?? null;
  }, [outputWidth, outputHeight, exportScale, renderCurrentFrameToCanvas]);

  // --- PNG EXPORT (for static images) ---
  const handleExportPng = useCallback(() => {
    const exportCanvas = createVisualExportCanvas();
    if (!exportCanvas) return;

    // Download
    const url = exportCanvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = `ascii-render-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [createVisualExportCanvas]);

  useImperativeHandle(ref, () => ({
    exportPng: handleExportPng,
  }), [handleExportPng]);

  // --- COPY TO CLIPBOARD ---
  const copyImageToClipboard = useCallback(async () => {
    if (!canvasRef.current) return;
    try {
      if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
        throw new Error('Image clipboard is not supported');
      }

      const blob = await new Promise<Blob | null>((resolve) =>
        canvasRef.current!.toBlob(resolve, 'image/png')
      );

      if (!blob) {
        throw new Error('Canvas did not produce an image');
      }

      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ]);
      setCopyStatus({ target: 'image', state: 'copied' });
    } catch {
      setCopyStatus({ target: 'image', state: 'failed' });
    }
  }, []);

  const copyTextWithFallback = useCallback(async (text: string): Promise<void> => {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '0';
    textarea.setAttribute('readonly', 'true');
    document.body.appendChild(textarea);
    textarea.select();

    try {
      if (!document.execCommand('copy')) {
        throw new Error('Text clipboard fallback failed');
      }
    } finally {
      document.body.removeChild(textarea);
    }
  }, []);

  const copyTextToClipboard = useCallback(async () => {
    if (!lastAsciiText) {
      setCopyStatus({ target: 'text', state: 'failed' });
      return;
    }

    try {
      await copyTextWithFallback(lastAsciiText);
      setCopyStatus({ target: 'text', state: 'copied' });
    } catch {
      setCopyStatus({ target: 'text', state: 'failed' });
    }
  }, [copyTextWithFallback, lastAsciiText]);

  useEffect(() => {
    if (!copyStatus) return;
    const timeoutId = window.setTimeout(() => setCopyStatus(null), 3000);
    return () => window.clearTimeout(timeoutId);
  }, [copyStatus]);

  // --- FRAME NAVIGATION ---
  const goToFrame = useCallback((index: number) => {
    if (frames.length === 0 || !compositionCtxRef.current || !compositionCanvasRef.current) return;

    // Clamp index
    const targetIndex = Math.max(0, Math.min(frames.length - 1, index));

    // Reset composition and rebuild up to target frame
    const ctx = compositionCtxRef.current;
    ctx.clearRect(0, 0, compositionCanvasRef.current.width, compositionCanvasRef.current.height);

    for (let i = 0; i <= targetIndex; i++) {
      const frame = frames[i];
      const restoreState = drawGifFrameToComposition(
        ctx,
        patchCtxRef.current,
        patchCanvasRef.current,
        frame
      );

      if (i < targetIndex) {
        disposeGifFrameFromComposition(ctx, frame, restoreState);
      }
    }

    frameIndexRef.current = targetIndex;
    displayedFrameIndexRef.current = targetIndex;
    setCurrentFrameIndex(targetIndex);
    renderCurrentFrameToCanvas(undefined, true);
  }, [frames, renderCurrentFrameToCanvas]);

  const stepFrame = useCallback((delta: number) => {
    const newIndex = (displayedFrameIndexRef.current + delta + frames.length) % frames.length;
    goToFrame(newIndex);
  }, [frames.length, goToFrame]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!hasAnimatedFrames || isInteractiveKeyboardTarget(e.target)) return;

      if (/^[1-8]$/.test(e.key)) {
        e.preventDefault();
        setDisplayPlaybackSpeed(PLAYBACK_SPEED_PRESETS[Number(e.key) - 1]);
        return;
      }

      switch (e.key) {
        case ' ':
          e.preventDefault();
          setIsPlaying(p => !p);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          setIsPlaying(false);
          stepFrame(-1);
          break;
        case 'ArrowRight':
          e.preventDefault();
          setIsPlaying(false);
          stepFrame(1);
          break;
        case 'Home':
          e.preventDefault();
          setIsPlaying(false);
          goToFrame(0);
          break;
        case 'End':
          e.preventDefault();
          setIsPlaying(false);
          goToFrame(frames.length - 1);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasAnimatedFrames, frames.length, stepFrame, goToFrame, setDisplayPlaybackSpeed]);

  // --- EXPORT LOGIC (DECOUPLED) ---
  
  const handleExportGif = async () => {
    if (!canvasRef.current || frames.length <= 1 || isExporting) return;

    const wasPlaying = isPlaying;
    setIsExporting(true);
    setIsPlaying(false); // Pause playback
    setExportProgress(0);

    // Give UI a moment to update
    await new Promise(r => setTimeout(r, 50));

    try {
        const gif = new GIFEncoder();
        const exportCanvas = document.createElement('canvas');
        
        const compCanvas = compositionCanvasRef.current!;
        const exportCompositionCanvas = document.createElement('canvas');
        exportCompositionCanvas.width = compCanvas.width;
        exportCompositionCanvas.height = compCanvas.height;
        const exportCompositionCtx = exportCompositionCanvas.getContext('2d')!;
        const aspect = compCanvas.height / compCanvas.width;
        const baseWidth = Math.max(
            1,
            Math.floor(outputWidth || ((outputHeight || compCanvas.height) / aspect))
        );
        const baseHeight = Math.max(
            1,
            Math.round(outputHeight || (baseWidth * aspect))
        );
        const exportWidth = Math.max(1, Math.floor(baseWidth * exportScale));
        const exportHeight = Math.max(1, Math.floor(baseHeight * exportScale));
        exportCanvas.width = exportWidth;
        exportCanvas.height = exportHeight;

        const effectStartTime = Date.now();
        let elapsedTime = 0;

        // Iterate all frames
        for (let i = 0; i < frames.length; i++) {
            const frame = frames[i];
            // gifuct-js and gifenc both use milliseconds. Treat 0 delay like the GIF spec default.
            const exportDelay = Math.max(20, frame.delay || 100);

            // 1. Update Composition
            const restoreState = drawGifFrameToComposition(
                exportCompositionCtx,
                patchCtxRef.current,
                patchCanvasRef.current,
                frame
            );

            // 2. Render ASCII to Canvas
            const renderResult = renderCurrentFrameToCanvas(
                exportCanvas,
                true,
                effectStartTime + elapsedTime,
                exportCompositionCanvas,
                false
            );
            
            if (renderResult) {
                const { finalCtx, finalCanvas } = renderResult;
                const imageData = finalCtx.getImageData(0, 0, finalCanvas.width, finalCanvas.height);
                const pixels = imageData.data;
                const isTransparentBg = config.backgroundColor === 'transparent';
                const palette = quantize(
                    pixels,
                    256,
                    isTransparentBg ? { format: 'rgba4444', clearAlpha: false, oneBitAlpha: true } : undefined
                );
                // Apply Floyd-Steinberg dithering for smoother gradients
                const ditheredPixels = applyFloydSteinberg(
                    pixels,
                    finalCanvas.width,
                    finalCanvas.height,
                    palette as [number, number, number][]
                );
                const paletteFormat = isTransparentBg ? 'rgba4444' : 'rgb565';
                const index = applyPalette(ditheredPixels, palette, paletteFormat);
                const transparentIndex = isTransparentBg
                    ? palette.findIndex((color) => color[3] === 0)
                    : -1;

                gif.writeFrame(index, finalCanvas.width, finalCanvas.height, { 
                    palette, 
                    delay: exportDelay,
                    transparent: transparentIndex >= 0,
                    transparentIndex: transparentIndex >= 0 ? transparentIndex : 0
                });
            }

            elapsedTime += exportDelay;

            // 3. Disposal for next frame
            disposeGifFrameFromComposition(exportCompositionCtx, frame, restoreState);

            // Update Progress
            setExportProgress(Math.round(((i + 1) / frames.length) * 100));
            // Yield to UI
            await new Promise(r => setTimeout(r, 0));
        }

        gif.finish();
        const buffer = gif.bytes();
        const blob = new Blob([buffer], { type: 'image/gif' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `ascii-render-${Date.now()}.gif`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

    } catch (e) {
        console.error("GIF Export Error", e);
        alert("Failed to export GIF");
    } finally {
        setIsExporting(false);
        setIsPlaying(wasPlaying);
    }
  };


  const handleExportVideo = useCallback(async () => {
    if (!canvasRef.current || frames.length <= 1 || isExporting) return;

    const wasPlaying = isPlaying;
    setIsExporting(true);
    setIsPlaying(false);
    setExportProgress(0);

    // Give UI a moment to update
    await new Promise(r => setTimeout(r, 50));

    try {
        const compCanvas = compositionCanvasRef.current!;
        const exportCompositionCanvas = document.createElement('canvas');
        exportCompositionCanvas.width = compCanvas.width;
        exportCompositionCanvas.height = compCanvas.height;
        const exportCompositionCtx = exportCompositionCanvas.getContext('2d')!;

        const aspect = compCanvas.height / compCanvas.width;
        const baseWidth = Math.max(
            1,
            Math.floor(outputWidth || ((outputHeight || compCanvas.height) / aspect))
        );
        const baseHeight = Math.max(
            1,
            Math.round(outputHeight || (baseWidth * aspect))
        );
        const exportWidth = Math.max(1, Math.floor(baseWidth * exportScale));
        const exportHeight = Math.max(1, Math.floor(baseHeight * exportScale));

        // Create export canvas
        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = exportWidth;
        exportCanvas.height = exportHeight;

        const frameStartTimes: number[] = [];
        let elapsedTime = 0;
        for (const frame of frames) {
            frameStartTimes.push(elapsedTime);
            elapsedTime += Math.max(20, frame.delay || 100);
        }

        const effectStartTime = Date.now();

        // Frame renderer function - updates composition and renders ASCII
        const renderFrame = (frameIndex: number, targetCanvas: HTMLCanvasElement) => {
            const frame = frames[frameIndex];
            // Update composition canvas
            const restoreState = drawGifFrameToComposition(
                exportCompositionCtx,
                patchCtxRef.current,
                patchCanvasRef.current,
                frame
            );

            // Render ASCII to target canvas
            renderCurrentFrameToCanvas(
                targetCanvas,
                true,
                effectStartTime + (frameStartTimes[frameIndex] ?? 0),
                exportCompositionCanvas,
                false
            );

            // Handle disposal for next frame
            disposeGifFrameFromComposition(exportCompositionCtx, frame, restoreState);
        };

        const result = await exportVideo({
            frames,
            config: {
                width: exportWidth,
                height: exportHeight,
                bitrate: VIDEO_EXPORT_BITRATE,
                framerate: 30,
            },
            canvas: exportCanvas,
            renderFrame,
            onProgress: setExportProgress,
        });

        // Download the result
        const extension = result.format;
        downloadBlob(result.blob, `ascii-render-${Date.now()}.${extension}`);

    } catch (e) {
        console.error("Video export failed", e);
        alert("Video export failed. Please try again.");
    } finally {
        setIsExporting(false);
        setIsPlaying(wasPlaying);
    }
  }, [frames, isExporting, isPlaying, outputWidth, outputHeight, exportScale, renderCurrentFrameToCanvas]);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen?.();
      return;
    }

    void frameRef.current?.requestFullscreen?.();
  }, []);

  if (error) {
    return (
        <div className="error-state">
            <p className="error-state__text">[ERROR] {error}</p>
        </div>
    );
  }

  // Generate segmented progress bar segments
  const PROGRESS_SEGMENTS = 20;
  const filledSegments = Math.round((exportProgress / 100) * PROGRESS_SEGMENTS);
  const frameCount = hasAnimatedFrames ? frames.length : 1;
  const displayFrameNumber = hasAnimatedFrames ? currentFrameIndex + 1 : 1;
  const displayFrameText = `${displayFrameNumber} / ${frameCount}`;
  const displaySpeed = displayPlaybackSpeed;
  const displayScrubberFrameCount = frameCount;
  const displayScrubberFrameIndex = hasAnimatedFrames ? currentFrameIndex : 0;
  const transportIsAvailable = hasAnimatedFrames;

  return (
    <div
      ref={shellRef}
      className="player-shell"
      style={{ maxWidth: `${displaySize.width}px` }}
    >
      <div
        ref={frameRef}
        className="player"
        style={{
          backgroundColor: config.backgroundColor,
          aspectRatio: `${displaySize.width} / ${displaySize.height}`
        }}
      >
          {isLoading && (
              <div className="player__loading">
                  <span className="player__loading-text">[LOADING...]</span>
              </div>
          )}

          {isExporting && (
               <div className="player__export-overlay">
                   <div className="player__export-card">
                      <span className="player__export-label">Rendering</span>
                      <div className="progress-bar">
                        {Array.from({ length: PROGRESS_SEGMENTS }).map((_, i) => (
                          <div
                            key={i}
                            className={`progress-bar__segment ${i < filledSegments ? 'progress-bar__segment--filled' : ''}`}
                          />
                        ))}
                      </div>
                      <span className="progress-bar__value">{exportProgress}%</span>
                   </div>
               </div>
          )}

          <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
      </div>

      <div className="player__transport">
        <div className="player__frame-info">
          <span className="player__frame-counter">
            {displayFrameText}
          </span>
          <div className="separator" />
          <select
            value={displaySpeed}
            onChange={(e) => {
              if (hasAnimatedFrames) {
                setDisplayPlaybackSpeed(Number(e.target.value));
              }
            }}
            className="player__speed"
            title="Playback Speed"
            aria-label="Playback Speed"
            disabled={!transportIsAvailable || isExporting}
          >
            {PLAYBACK_SPEED_PRESETS.map((speed) => (
              <option key={speed} value={speed}>{speed.toFixed(1)}x</option>
            ))}
          </select>
          <button
            type="button"
            onClick={toggleFullscreen}
            className="btn btn--icon player__fullscreen-button"
            title="Fullscreen"
            aria-label="Fullscreen"
            disabled={isExporting}
          >
            <Maximize size={16} strokeWidth={1.5} />
          </button>
        </div>

        <div className="player__scrubber">
          <input
            type="range"
            min={0}
            max={Math.max(0, displayScrubberFrameCount - 1)}
            value={displayScrubberFrameIndex}
            onChange={(e) => {
              if (!hasAnimatedFrames) return;
              setIsPlaying(false);
              goToFrame(Number(e.target.value));
            }}
            aria-label="Frame"
            disabled={!transportIsAvailable || isExporting}
          />
        </div>

          <div className="player__controls">
               <span className="sr-only" role="status" aria-live="polite">
                 {copyStatus?.state === 'copied' && copyStatus.target === 'image' ? 'Copied image to clipboard' : ''}
                 {copyStatus?.state === 'copied' && copyStatus.target === 'text' ? 'Copied ASCII text to clipboard' : ''}
                 {copyStatus?.state === 'failed' && copyStatus.target === 'image' ? 'Image copy unavailable' : ''}
                 {copyStatus?.state === 'failed' && copyStatus.target === 'text' ? 'Text copy unavailable' : ''}
               </span>
                 <button
                    onClick={() => {
                      if (hasAnimatedFrames) {
                        setIsPlaying(true);
                      }
                    }}
                    disabled={!transportIsAvailable || isExporting}
                    className="btn btn--icon player__control-button player__control-button--primary"
                    title="Play (Space)"
                    aria-label="Play"
                 >
                  <Play size={16} fill="currentColor" strokeWidth={1.5} />
               </button>

                 <button
                    onClick={() => {
                      if (hasAnimatedFrames) {
                        setIsPlaying(false);
                      }
                    }}
                    disabled={!transportIsAvailable || isExporting}
                    className="btn btn--icon player__control-button player__control-button--primary"
                    title="Pause (Space)"
                    aria-label="Pause"
                 >
                  <Pause size={16} fill="currentColor" strokeWidth={1.5} />
               </button>

                 <button
                    onClick={() => {
                      if (hasAnimatedFrames) {
                        setIsPlaying(false);
                        stepFrame(-1);
                      }
                    }}
                    disabled={!transportIsAvailable || isExporting}
                    className="btn btn--icon player__control-button player__control-button--primary"
                    title="Previous Frame (←)"
                    aria-label="Previous Frame"
                 >
                  <span className="player__control-icon player__control-icon--desktop">
                    <ChevronLeft size={16} strokeWidth={1.5} />
                  </span>
                  <span className="player__control-icon player__control-icon--mobile">
                    <SkipBack size={16} strokeWidth={1.5} />
                  </span>
               </button>

                 <button
                    onClick={() => {
                      if (hasAnimatedFrames) {
                        setIsPlaying(false);
                        stepFrame(1);
                      }
                    }}
                    disabled={!transportIsAvailable || isExporting}
                    className="btn btn--icon player__control-button player__control-button--primary"
                    title="Next Frame (→)"
                    aria-label="Next Frame"
                 >
                  <span className="player__control-icon player__control-icon--desktop">
                    <ChevronRight size={16} strokeWidth={1.5} />
                  </span>
                  <span className="player__control-icon player__control-icon--mobile">
                    <SkipForward size={16} strokeWidth={1.5} />
                  </span>
               </button>

               <div className="separator separator--primary" />

                 <button
                    onClick={() => {
                      if (hasAnimatedFrames) {
                        restart();
                      }
                    }}
                    disabled={!transportIsAvailable || isExporting}
                    className="btn btn--icon player__control-button player__control-button--primary"
                    title="Restart"
                    aria-label="Restart"
                 >
                  <RotateCcw size={16} strokeWidth={1.5} />
               </button>

               <div className="separator separator--secondary" />

                 <button
                    onClick={copyImageToClipboard}
                    className={`btn btn--icon player__control-button player__control-button--secondary ${copyStatus?.target === 'image' ? `btn--copy-${copyStatus.state}` : ''}`}
                    title={copyStatus?.target === 'image'
                      ? copyStatus.state === 'copied' ? 'Image Copied' : 'Image Copy Unavailable'
                      : 'Copy Image'}
                    aria-label={copyStatus?.target === 'image'
                      ? copyStatus.state === 'copied' ? 'Copy Image (copied)' : 'Copy Image (unavailable)'
                      : 'Copy Image'}
                 >
                  <Copy size={16} strokeWidth={1.5} />
               </button>

                 <button
                    onClick={copyTextToClipboard}
                    className={`btn btn--icon player__control-button player__control-button--secondary ${copyStatus?.target === 'text' ? `btn--copy-${copyStatus.state}` : ''}`}
                    title={copyStatus?.target === 'text'
                      ? copyStatus.state === 'copied' ? 'ASCII Text Copied' : 'Text Copy Unavailable'
                      : 'Copy ASCII Text'}
                    aria-label={copyStatus?.target === 'text'
                      ? copyStatus.state === 'copied' ? 'Copy ASCII Text (copied)' : 'Copy ASCII Text (unavailable)'
                      : 'Copy ASCII Text'}
                 >
                  <FileText size={16} strokeWidth={1.5} />
               </button>

               <div className="separator separator--secondary" />

               {hasAnimatedFrames && (
                 <>
                     <button
                        onClick={handleExportVideo}
                        disabled={isExporting}
                        className="btn btn--icon player__control-button player__control-button--secondary"
                        title="Export Video"
                        aria-label="Export Video"
                     >
                      <Video size={16} strokeWidth={1.5} />
                   </button>

                     <button
                        onClick={handleExportGif}
                        disabled={isExporting}
                        className="btn btn--icon player__control-button player__control-button--secondary"
                        title="Export GIF"
                        aria-label="Export GIF"
                     >
                      <Download size={16} strokeWidth={1.5} />
                   </button>
                 </>
               )}

                 <button
                    onClick={handleExportPng}
                    className="btn btn--icon player__control-button player__control-button--secondary"
                    title="Export PNG"
                    aria-label="Export PNG"
                 >
                  <FileImage size={16} strokeWidth={1.5} />
               </button>

          </div>
      </div>
    </div>
  );
});

AsciiPlayer.displayName = 'AsciiPlayer';

export default AsciiPlayer;
