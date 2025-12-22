import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Play, Pause, RotateCcw, Loader2, Download, Video, FileImage, ImageIcon } from 'lucide-react';
import { parseGIF, decompressFrames } from 'gifuct-js';
import { GIFEncoder, quantize, applyPalette } from 'gifenc';
import { AsciiConfig } from '../types';
import { resizeAndGetImageData, convertToAscii, AsciiResult } from '../services/asciiUtils';
import { exportVideo, downloadBlob, isMP4ExportSupported } from '../services/videoExport';

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
  onFrame?: (base64Frame: string) => void;
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

const AsciiPlayer: React.FC<AsciiPlayerProps> = ({ imageSrc, config, outputWidth, outputHeight, export2x = false, onFrame }) => {
  const exportScale = export2x ? 2 : 1;
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
  const outputAspectRatio = outputWidth && outputHeight ? outputWidth / outputHeight : 0;
  const displayAspectRatio = outputAspectRatio > 0 ? outputAspectRatio : aspectRatio;

  // Animation State Refs (Mutable for performance in loop)
  const frameIndexRef = useRef(0);
  const lastFrameTimeRef = useRef(0);
  const requestRef = useRef<number>();
  const frameCapturedRef = useRef<boolean>(false);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null); // For resizing
    
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
    frameIndexRef.current = 0;
    frameCapturedRef.current = false;

    // Cleanup previous composition
    compositionCanvasRef.current = null;

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
              } else {
                  throw new Error("No frames found in GIF");
              }
              setIsLoading(false);
          }
        } else {
          // Load as static image (PNG, JPEG, WebP)
          const blob = new Blob([buffer]);
          const img = new Image();
          img.src = URL.createObjectURL(blob);

          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject(new Error("Failed to load image"));
          });

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

            // Cleanup blob URL
            URL.revokeObjectURL(img.src);

            // For static images, we don't use frames array
            setFrames([]);
            setIsStaticImage(true);
            setIsPlaying(false); // No animation for static images
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
  }, [imageSrc]);

  // Core Render Logic (Draws to canvasRef based on current composition)
  const renderCurrentFrameToCanvas = useCallback((targetCanvas?: HTMLCanvasElement, includeOverlay?: boolean) => {
     const finalCanvas = targetCanvas || canvasRef.current;
     if (!finalCanvas || !compositionCanvasRef.current) return null;
     
     const finalCtx = finalCanvas.getContext('2d');
     if (!finalCtx) return null;

     const hasTransparentBg = config.backgroundColor === 'transparent';
     const outputAspectRatio = outputWidth && outputHeight
        ? outputHeight / outputWidth
        : undefined;
     const cropRect = outputAspectRatio && compositionCanvasRef.current
        ? getCenteredCropRect(
            compositionCanvasRef.current.width,
            compositionCanvasRef.current.height,
            outputAspectRatio
          )
        : null;
     const imageData = resizeAndGetImageData(
        compositionCanvasRef.current,
        config.resolution,
        config.fontAspectRatio,
        getOffscreenCanvas(),
        outputAspectRatio
     );

     if (!imageData) return null;

     const asciiResult = convertToAscii(
        imageData,
        imageData.width,
        imageData.height,
        config
     );
     const asciiString = asciiResult.text;
     const colors = asciiResult.colors;

     // Clear and Draw Text
     if (hasTransparentBg) {
         finalCtx.clearRect(0, 0, finalCanvas.width, finalCanvas.height);
     } else {
         finalCtx.fillStyle = config.backgroundColor;
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

         if (colors && config.useSourceColor) {
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
             finalCtx.fillStyle = config.color;
             for (let i = 0; i < rows; i++) {
                 finalCtx.fillText(lines[i], 0, i * cellHeight, finalCanvas.width);
             }
         }
     }

     if (includeOverlay && config.overlayOpacity > 0) {
         finalCtx.save();
         finalCtx.globalAlpha = Math.min(1, Math.max(0, config.overlayOpacity));
         if (cropRect) {
            finalCtx.drawImage(
              compositionCanvasRef.current,
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
              compositionCanvasRef.current,
              0,
              0,
              finalCanvas.width,
              finalCanvas.height
            );
         }
         finalCtx.restore();
     }
     
     return { finalCtx, finalCanvas };
  }, [config]);


  // 2a. Render static image when config or canvas size changes
  useEffect(() => {
    if (!isStaticImage || isLoading || !compositionCanvasRef.current || !canvasRef.current) return;

    // Render the static image with current config
    const result = renderCurrentFrameToCanvas(undefined, true);

    // Capture frame for AI if not already captured
    if (result && !frameCapturedRef.current && onFrame) {
      try {
        const base64 = result.finalCanvas.toDataURL('image/png').split(',')[1];
        onFrame(base64);
        frameCapturedRef.current = true;
      } catch(e) {}
    }
  }, [isStaticImage, isLoading, config, displaySize, renderCurrentFrameToCanvas, onFrame]);

  // 2b. Render Loop (Playback for animated GIFs)
  const renderLoop = useCallback((timestamp: number) => {
    // Skip render loop for static images - they're rendered in the effect above
    if (isStaticImage || !isPlaying || isExporting || !canvasRef.current || frames.length === 0 || !compositionCtxRef.current || !compositionCanvasRef.current) {
      requestRef.current = requestAnimationFrame(renderLoop);
      return;
    }

    const currentFrame = frames[frameIndexRef.current];

    // Playback Timing:
    // If delay is 0, we treat it as 100ms for playback comfort,
    // unless it's a very high framerate gif where 0 means "as fast as possible".
    // Standard browsers treat 0 as 100ms (10fps).
    const delay = currentFrame.delay === 0 ? 100 : currentFrame.delay;

    // Check if it's time to advance frame
    if (timestamp - lastFrameTimeRef.current >= delay) {

        // --- COMPOSITION UPDATE ---
        const ctx = compositionCtxRef.current;
        const frame = currentFrame;
        const { width, height, top, left } = frame.dims;

        if (frame.patch && patchCtxRef.current && patchCanvasRef.current) {
            const patchData = new ImageData(frame.patch, width, height);
            patchCanvasRef.current.width = width;
            patchCanvasRef.current.height = height;
            patchCtxRef.current.putImageData(patchData, 0, 0);
            ctx.drawImage(patchCanvasRef.current, left, top);
        }

        // --- RENDER ASCII TO SCREEN ---
        const renderResult = renderCurrentFrameToCanvas(undefined, true);

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

        // Handle disposal 2 (Clear) for NEXT frame
        if (frame.disposalType === 2) {
             ctx.clearRect(left, top, width, height);
        }

        frameIndexRef.current = (frameIndexRef.current + 1) % frames.length;
    }

    requestRef.current = requestAnimationFrame(renderLoop);
  }, [isStaticImage, isPlaying, isExporting, frames, config, onFrame, renderCurrentFrameToCanvas]);

  // Start/Stop Loop
  useEffect(() => {
    requestRef.current = requestAnimationFrame(renderLoop);
    return () => {
        if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [renderLoop]);

  // Size Observer
  useEffect(() => {
    const canvas = canvasRef.current;
    const frame = frameRef.current;
    if (!canvas || !frame) return;

    const updateSize = () => {
        const { clientWidth, clientHeight } = frame;
        const ratio = displayAspectRatio > 0 ? displayAspectRatio : 1;
        let fittedWidth = clientWidth;
        let fittedHeight = Math.round(clientWidth / ratio);
        if (fittedHeight > clientHeight) {
            fittedHeight = clientHeight;
            fittedWidth = Math.round(clientHeight * ratio);
        }
        fittedWidth = Math.max(1, Math.floor(fittedWidth));
        fittedHeight = Math.max(1, Math.floor(fittedHeight));

        setDisplaySize((prev) => {
            if (prev.width === fittedWidth && prev.height === fittedHeight) return prev;
            return { width: fittedWidth, height: fittedHeight };
        });

        let canvasResized = false;

        if (outputWidth && outputHeight) {
            const width = Math.max(1, Math.floor(outputWidth));
            const height = Math.max(1, Math.floor(outputHeight));
            if (canvas.width !== width || canvas.height !== height) {
                canvas.width = width;
                canvas.height = height;
                canvasResized = true;
            }
        } else {
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            const width = Math.max(1, Math.floor(fittedWidth * dpr));
            const height = Math.max(1, Math.floor(fittedHeight * dpr));

            if (canvas.width !== width || canvas.height !== height) {
                canvas.width = width;
                canvas.height = height;
                canvasResized = true;
            }
        }

        // For static images, render immediately after resize to prevent flicker
        if (canvasResized && isStaticImage && compositionCanvasRef.current) {
            renderCurrentFrameToCanvas(undefined, true);
        }
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(frame);
    return () => observer.disconnect();
  }, [outputWidth, outputHeight, displayAspectRatio, isStaticImage, renderCurrentFrameToCanvas]);

  const togglePlay = () => setIsPlaying(!isPlaying);
  
  const restart = () => {
    frameIndexRef.current = 0;
    if (compositionCtxRef.current && compositionCanvasRef.current) {
        compositionCtxRef.current.clearRect(0, 0, compositionCanvasRef.current.width, compositionCanvasRef.current.height);
    }
    setIsPlaying(true);
  };

  // --- PNG EXPORT (for static images) ---
  const handleExportPng = useCallback(() => {
    if (!canvasRef.current || !compositionCanvasRef.current) return;

    // Create export canvas at appropriate size
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

    // Render to export canvas
    renderCurrentFrameToCanvas(exportCanvas, false);

    // Download
    const url = exportCanvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = `ascii-render-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [outputWidth, outputHeight, exportScale, renderCurrentFrameToCanvas]);

  // --- EXPORT LOGIC (DECOUPLED) ---
  
  const handleExportGif = async () => {
    if (!canvasRef.current || frames.length === 0 || isExporting) return;
    
    setIsExporting(true);
    setIsPlaying(false); // Pause playback
    setExportProgress(0);

    // Give UI a moment to update
    await new Promise(r => setTimeout(r, 50));

    try {
        const gif = new GIFEncoder();
        const exportCanvas = document.createElement('canvas');
        
        // Reset composition for export
        const compCanvas = compositionCanvasRef.current!;
        const compCtx = compositionCtxRef.current!;
        compCtx.clearRect(0, 0, compCanvas.width, compCanvas.height);
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

        // Iterate all frames
        for (let i = 0; i < frames.length; i++) {
            const frame = frames[i];
            const { width, height, top, left } = frame.dims;

            // 1. Update Composition
            if (frame.patch && patchCtxRef.current && patchCanvasRef.current) {
                const patchData = new ImageData(frame.patch, width, height);
                patchCanvasRef.current.width = width;
                patchCanvasRef.current.height = height;
                patchCtxRef.current.putImageData(patchData, 0, 0);
                compCtx.drawImage(patchCanvasRef.current, left, top);
            }

            // 2. Render ASCII to Canvas
            const renderResult = renderCurrentFrameToCanvas(exportCanvas, false);
            
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
                
                // Delay Calculation Fix:
                // 1. gifuct-js provides delay in 'milliseconds' (e.g., 30, 40, 100).
                // 2. gifenc expects delay in 'milliseconds' (e.g., 30, 40, 100).
                // 3. Browsers clamp delays < 20ms (0.02s) to 100ms (0.1s).
                //
                // Fix: Pass ms directly. Clamp min to 20ms so high-FPS gifs don't become slow-motion in browsers.
                
                let delay = frame.delay;
                // Spec says 0 delay -> 100ms
                if (!delay) delay = 100;
                
                // Safe floor: 20ms (50fps) to avoid browser throttling to 100ms
                const exportDelay = Math.max(20, delay);

                gif.writeFrame(index, finalCanvas.width, finalCanvas.height, { 
                    palette, 
                    delay: exportDelay,
                    transparent: transparentIndex >= 0,
                    transparentIndex: transparentIndex >= 0 ? transparentIndex : 0
                });
            }

            // 3. Disposal for next frame
            if (frame.disposalType === 2) {
                compCtx.clearRect(left, top, width, height);
            }

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
        setIsPlaying(true); // Resume playback
        // Reset Composition state to match frameIndexRef (which might be desynced)
        // Simplest: Restart loop
        frameIndexRef.current = 0;
        if (compositionCtxRef.current && compositionCanvasRef.current) {
            compositionCtxRef.current.clearRect(0, 0, compositionCanvasRef.current.width, compositionCanvasRef.current.height);
        }
    }
  };


  const handleExportVideo = useCallback(async () => {
    if (!canvasRef.current || frames.length === 0 || isExporting) return;

    setIsExporting(true);
    setIsPlaying(false);
    setExportProgress(0);

    // Give UI a moment to update
    await new Promise(r => setTimeout(r, 50));

    try {
        const compCanvas = compositionCanvasRef.current!;
        const compCtx = compositionCtxRef.current!;

        // Reset composition for clean export
        compCtx.clearRect(0, 0, compCanvas.width, compCanvas.height);

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

        // Frame renderer function - updates composition and renders ASCII
        const renderFrame = (frameIndex: number, targetCanvas: HTMLCanvasElement) => {
            const frame = frames[frameIndex];
            const { width, height, top, left } = frame.dims;

            // Update composition canvas
            if (frame.patch && patchCtxRef.current && patchCanvasRef.current) {
                const patchData = new ImageData(frame.patch, width, height);
                patchCanvasRef.current.width = width;
                patchCanvasRef.current.height = height;
                patchCtxRef.current.putImageData(patchData, 0, 0);
                compCtx.drawImage(patchCanvasRef.current, left, top);
            }

            // Render ASCII to target canvas
            renderCurrentFrameToCanvas(targetCanvas, false);

            // Handle disposal for next frame
            if (frame.disposalType === 2) {
                compCtx.clearRect(left, top, width, height);
            }
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
        setIsPlaying(true);
        // Reset composition state
        frameIndexRef.current = 0;
        if (compositionCtxRef.current && compositionCanvasRef.current) {
            compositionCtxRef.current.clearRect(0, 0, compositionCanvasRef.current.width, compositionCanvasRef.current.height);
        }
    }
  }, [frames, isExporting, exportScale, renderCurrentFrameToCanvas]);

  if (error) {
    return (
        <div className="w-full h-full flex items-center justify-center text-red-400 bg-red-400/10 rounded-xl p-4 text-center">
            <p>{error}</p>
        </div>
    );
  }

  return (
    <div
      ref={frameRef}
      className="w-full h-full flex items-center justify-center"
    >
      <div
        className="group relative overflow-hidden rounded-xl shadow-2xl border border-zinc-800 transition-colors duration-300"
        style={{
          backgroundColor: config.backgroundColor,
          width: `${displaySize.width}px`,
          height: `${displaySize.height}px`
        }}
      >
          {isLoading && (
              <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-zinc-950/80 backdrop-blur-sm text-zinc-400">
                  <Loader2 className="animate-spin mb-2" size={32} />
                  <p className="text-xs uppercase tracking-widest">Loading image...</p>
              </div>
          )}

          {isExporting && (
               <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/60 backdrop-blur-[2px] text-white">
                   <div className="bg-zinc-900 border border-zinc-700 p-6 rounded-xl shadow-2xl flex flex-col items-center gap-4 min-w-[200px]">
                      <Loader2 className="animate-spin text-indigo-500" size={32} />
                      <div className="text-center">
                          <p className="font-medium mb-1">Rendering...</p>
                          <div className="w-full bg-zinc-800 rounded-full h-1.5 mt-2 overflow-hidden">
                              <div
                                  className="bg-indigo-500 h-full transition-all duration-75 ease-out"
                                  style={{ width: `${exportProgress}%` }}
                              />
                          </div>
                      </div>
                   </div>
               </div>
          )}

          <canvas ref={canvasRef} className="w-full h-full block" />

          {/* Controls */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-3 py-2 bg-zinc-900/90 backdrop-blur border border-zinc-700 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 shadow-xl">
               {/* Animation controls - only for animated GIFs */}
               {!isStaticImage && (
                 <>
                   <button
                      onClick={togglePlay}
                      disabled={isExporting}
                      className="p-2 hover:bg-zinc-800 rounded-full text-zinc-200 transition-colors disabled:opacity-50"
                      title={isPlaying ? "Pause" : "Play"}
                   >
                      {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
                   </button>

                   <div className="w-px h-4 bg-zinc-700" />

                   <button
                      onClick={restart}
                      disabled={isExporting}
                      className="p-2 hover:bg-zinc-800 rounded-full text-zinc-200 transition-colors disabled:opacity-50"
                      title="Restart"
                   >
                      <RotateCcw size={18} />
                   </button>

                   <div className="w-px h-4 bg-zinc-700" />

                   <button
                      onClick={handleExportVideo}
                      disabled={isExporting}
                      className="p-2 hover:bg-zinc-800 rounded-full text-zinc-200 hover:text-indigo-400 transition-colors disabled:opacity-50"
                      title="Export Video"
                   >
                      <Video size={18} />
                   </button>

                   <button
                      onClick={handleExportGif}
                      disabled={isExporting}
                      className="p-2 hover:bg-zinc-800 rounded-full text-zinc-200 hover:text-indigo-400 transition-colors disabled:opacity-50"
                      title="Export GIF"
                   >
                      <FileImage size={18} />
                   </button>
                 </>
               )}

               {/* PNG export - for static images */}
               {isStaticImage && (
                 <button
                    onClick={handleExportPng}
                    className="p-2 hover:bg-zinc-800 rounded-full text-zinc-200 hover:text-indigo-400 transition-colors"
                    title="Export PNG"
                 >
                    <Download size={18} />
                 </button>
               )}
          </div>
      </div>
    </div>
  );
};

export default AsciiPlayer;
