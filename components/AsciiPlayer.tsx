import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Play, Pause, RotateCcw, Loader2, Download, Video, FileImage } from 'lucide-react';
import { parseGIF, decompressFrames } from 'gifuct-js';
import { GIFEncoder, quantize, applyPalette } from 'gifenc';
import { AsciiConfig } from '../types';
import { resizeAndGetImageData, convertToAscii } from '../services/asciiUtils';

interface AsciiPlayerProps {
  imageSrc: string;
  config: AsciiConfig;
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

const AsciiPlayer: React.FC<AsciiPlayerProps> = ({ imageSrc, config, onFrame }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
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
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [aspectRatio, setAspectRatio] = useState<number>(1);

  // Animation State Refs (Mutable for performance in loop)
  const frameIndexRef = useRef(0);
  const lastFrameTimeRef = useRef(0);
  const requestRef = useRef<number>();
  const frameCapturedRef = useRef<boolean>(false);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null); // For resizing
  
  // Recording Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  
  // Helper: Offscreen canvas for scaling
  const getOffscreenCanvas = () => {
    if (!offscreenCanvasRef.current) {
      offscreenCanvasRef.current = document.createElement('canvas');
    }
    return offscreenCanvasRef.current;
  };

  // 1. Fetch and Parse GIF
  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError(null);
    setFrames([]);
    frameIndexRef.current = 0;
    frameCapturedRef.current = false;
    
    // Cleanup previous composition
    compositionCanvasRef.current = null;

    const loadGif = async () => {
      try {
        const resp = await fetch(imageSrc);
        if (!resp.ok) throw new Error("Failed to fetch image");
        const buffer = await resp.arrayBuffer();
        
        // Parse
        const gif = parseGIF(buffer);
        const loadedFrames = decompressFrames(gif, true) as GifFrame[];

        if (active) {
            if (loadedFrames.length > 0) {
                // Setup Composition Canvas (The "Source of Truth" for pixels)
                const width = loadedFrames[0].dims.width;
                const height = loadedFrames[0].dims.height;
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
            } else {
                throw new Error("No frames found in GIF");
            }
            setIsLoading(false);
        }
      } catch (err: any) {
        if (active) {
            console.error("GIF Parse Error:", err);
            setError("Could not parse GIF. Please try another file.");
            setIsLoading(false);
        }
      }
    };

    loadGif();
    return () => { active = false; };
  }, [imageSrc]);

  // Core Render Logic (Draws to canvasRef based on current composition)
  const renderCurrentFrameToCanvas = useCallback((targetCanvas?: HTMLCanvasElement) => {
     const finalCanvas = targetCanvas || canvasRef.current;
     if (!finalCanvas || !compositionCanvasRef.current) return null;
     
     const finalCtx = finalCanvas.getContext('2d', { alpha: false });
     if (!finalCtx) return null;

     const imageData = resizeAndGetImageData(
        compositionCanvasRef.current, 
        config.resolution,
        config.fontAspectRatio,
        getOffscreenCanvas()
     );

     if (!imageData) return null;

     const asciiString = convertToAscii(
        imageData, 
        imageData.width, 
        imageData.height, 
        config
     );

     // Clear and Draw Text
     finalCtx.fillStyle = config.backgroundColor;
     finalCtx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);
     
     finalCtx.fillStyle = config.color;
     finalCtx.textBaseline = 'top';

     const lines = asciiString.split('\n');
     if (lines.length > 0 && lines[lines.length-1] === '') lines.pop();
     
     const rows = lines.length;
     if (rows > 0) {
         const cellHeight = finalCanvas.height / rows;
         finalCtx.font = `bold ${cellHeight * 1.05}px "JetBrains Mono", monospace`; 
         for (let i = 0; i < rows; i++) {
             finalCtx.fillText(lines[i], 0, i * cellHeight, finalCanvas.width);
         }
     }
     
     return { finalCtx, finalCanvas };
  }, [config]);


  // 2. Render Loop (Playback)
  const renderLoop = useCallback((timestamp: number) => {
    if (!isPlaying || isExporting || !canvasRef.current || frames.length === 0 || !compositionCtxRef.current || !compositionCanvasRef.current) {
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
        const renderResult = renderCurrentFrameToCanvas();

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

        // --- VIDEO RECORDING CHECK ---
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            // Stop if we wrapped around
            if (frameIndexRef.current === frames.length - 1) {
                mediaRecorderRef.current.stop();
            }
        }

        frameIndexRef.current = (frameIndexRef.current + 1) % frames.length;
    }

    requestRef.current = requestAnimationFrame(renderLoop);
  }, [isPlaying, isExporting, frames, config, onFrame, renderCurrentFrameToCanvas]);

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
    const container = containerRef.current;
    if (!canvas || !container) return;

    const updateSize = () => {
        const { clientWidth, clientHeight } = container;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        
        if (canvas.width !== clientWidth * dpr || canvas.height !== clientHeight * dpr) {
            canvas.width = clientWidth * dpr;
            canvas.height = clientHeight * dpr;
        }
    };
    updateSize(); 
    const observer = new ResizeObserver(updateSize);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const togglePlay = () => setIsPlaying(!isPlaying);
  
  const restart = () => {
    frameIndexRef.current = 0;
    if (compositionCtxRef.current && compositionCanvasRef.current) {
        compositionCtxRef.current.clearRect(0, 0, compositionCanvasRef.current.width, compositionCanvasRef.current.height);
    }
    setIsPlaying(true);
  };

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
        exportCanvas.width = compCanvas.width;
        exportCanvas.height = compCanvas.height;

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
            const renderResult = renderCurrentFrameToCanvas(exportCanvas);
            
            if (renderResult) {
                const { finalCtx, finalCanvas } = renderResult;
                const pixels = finalCtx.getImageData(0, 0, finalCanvas.width, finalCanvas.height).data;
                const palette = quantize(pixels, 256);
                const index = applyPalette(pixels, palette);
                
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
                    delay: exportDelay 
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


  const handleExportVideo = useCallback(() => {
     // WEBM Export uses MediaRecorder which records real-time.
     // To avoid lag affecting the video, we should ideally use CanvasCaptureMediaStreamTrack 
     // but that's complex to sync manually. 
     // For now, we'll use the existing "record the playback" method but reset cleanly.
     
    if (!canvasRef.current || frames.length === 0 || isExporting) return;
    
    setIsExporting(true);
    setExportProgress(0); // Indeterminate
    
    // Restart animation for clean loop
    frameIndexRef.current = 0;
    lastFrameTimeRef.current = 0;
    if (compositionCtxRef.current && compositionCanvasRef.current) {
        compositionCtxRef.current.clearRect(0, 0, compositionCanvasRef.current.width, compositionCanvasRef.current.height);
    }
    setIsPlaying(true);
    
    try {
        const stream = canvasRef.current.captureStream(30); 
        const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') 
            ? 'video/webm;codecs=vp9' 
            : 'video/webm';
            
        const recorder = new MediaRecorder(stream, { mimeType });
        mediaRecorderRef.current = recorder;
        recordedChunksRef.current = [];

        recorder.ondataavailable = (e) => {
            if (e.data.size > 0) recordedChunksRef.current.push(e.data);
        };

        recorder.onstop = () => {
            const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = `ascii-render-${Date.now()}.webm`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            
            setIsExporting(false);
            mediaRecorderRef.current = null;
        };

        recorder.start();
        
    } catch (e) {
        console.error("Export failed", e);
        setIsExporting(false);
        alert("Video export is not supported in this browser.");
    }
  }, [frames, isExporting]);

  if (error) {
    return (
        <div className="w-full h-full flex items-center justify-center text-red-400 bg-red-400/10 rounded-xl p-4 text-center">
            <p>{error}</p>
        </div>
    );
  }

  return (
    <div 
      className="group relative flex items-center justify-center overflow-hidden rounded-xl shadow-2xl border border-zinc-800 transition-colors duration-300"
      style={{ 
        backgroundColor: config.backgroundColor,
        width: '100%',
        height: '100%'
      }}
    >
        {isLoading && (
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-zinc-950/80 backdrop-blur-sm text-zinc-400">
                <Loader2 className="animate-spin mb-2" size={32} />
                <p className="text-xs uppercase tracking-widest">Parsing GIF...</p>
            </div>
        )}

        {isExporting && (
             <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/60 backdrop-blur-[2px] text-white">
                 <div className="bg-zinc-900 border border-zinc-700 p-6 rounded-xl shadow-2xl flex flex-col items-center gap-4 min-w-[200px]">
                    <Loader2 className="animate-spin text-indigo-500" size={32} />
                    <div className="text-center">
                        <p className="font-medium mb-1">
                            {mediaRecorderRef.current ? 'Recording Video...' : 'Rendering GIF...'}
                        </p>
                        {!mediaRecorderRef.current && (
                             <div className="w-full bg-zinc-800 rounded-full h-1.5 mt-2 overflow-hidden">
                                <div 
                                    className="bg-indigo-500 h-full transition-all duration-75 ease-out" 
                                    style={{ width: `${exportProgress}%` }}
                                />
                             </div>
                        )}
                    </div>
                    {mediaRecorderRef.current && <p className="text-xs text-zinc-400">Wait for loop to finish...</p>}
                 </div>
             </div>
        )}

        <div 
            ref={containerRef}
            style={{ 
                aspectRatio: `${aspectRatio}`,
                width: aspectRatio > 1 ? '100%' : 'auto',
                height: aspectRatio <= 1 ? '100%' : 'auto',
                maxWidth: '100%',
                maxHeight: '100%',
                position: 'relative'
            }}
        >
            <canvas ref={canvasRef} className="w-full h-full block" />
            <img 
                src={imageSrc}
                alt="overlay"
                className="absolute inset-0 w-full h-full object-contain pointer-events-none transition-opacity duration-100"
                style={{ opacity: config.overlayOpacity }}
            />
        </div>

        {/* Controls */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-3 py-2 bg-zinc-900/90 backdrop-blur border border-zinc-700 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 shadow-xl">
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
                title="Export Video (WEBM)"
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
        </div>
    </div>
  );
};

export default AsciiPlayer;
