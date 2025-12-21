/**
 * Video export service with MP4 (H.264) support and WebM fallback.
 * Uses Mediabunny for MP4 encoding via WebCodecs API.
 */

export interface VideoExportConfig {
  width: number;
  height: number;
  bitrate: number;
  framerate: number;
}

export interface VideoExportResult {
  blob: Blob;
  format: 'mp4' | 'webm';
}

// Cache the support check result
let mp4SupportCache: boolean | null = null;

/**
 * Check if MP4/H.264 encoding is supported via WebCodecs.
 * Returns false for Firefox due to known H.264 encoder issues.
 */
export async function isMP4ExportSupported(): Promise<boolean> {
  if (mp4SupportCache !== null) return mp4SupportCache;

  // Firefox has known issues with H.264 encoding via WebCodecs
  const isFirefox = navigator.userAgent.toLowerCase().includes('firefox');
  if (isFirefox) {
    mp4SupportCache = false;
    return false;
  }

  // Check for WebCodecs support
  if (typeof VideoEncoder === 'undefined') {
    mp4SupportCache = false;
    return false;
  }

  try {
    // Dynamically import mediabunny to check codec support
    const { canEncodeVideo } = await import('mediabunny');
    mp4SupportCache = await canEncodeVideo('avc');
    return mp4SupportCache;
  } catch {
    mp4SupportCache = false;
    return false;
  }
}

export interface FrameRenderer {
  (frameIndex: number, targetCanvas: HTMLCanvasElement): void;
}

export interface ExportOptions {
  frames: { delay: number }[];
  config: VideoExportConfig;
  canvas: HTMLCanvasElement;
  renderFrame: FrameRenderer;
  onProgress?: (progress: number) => void;
}

/**
 * Export video using MP4 (H.264) via Mediabunny/WebCodecs.
 * Frame-by-frame encoding for consistent quality.
 */
async function exportToMP4(options: ExportOptions): Promise<Blob> {
  const { frames, config, canvas, renderFrame, onProgress } = options;

  const {
    Output,
    BufferTarget,
    Mp4OutputFormat,
    CanvasSource,
  } = await import('mediabunny');

  const output = new Output({
    format: new Mp4OutputFormat(),
    target: new BufferTarget(),
  });

  // Create offscreen canvas for encoding
  const exportCanvas = new OffscreenCanvas(config.width, config.height);
  const exportCtx = exportCanvas.getContext('2d')!;

  const videoSource = new CanvasSource(exportCanvas, {
    codec: 'avc',
    bitrate: config.bitrate,
  });

  output.addVideoTrack(videoSource);
  await output.start();

  // Calculate timestamps based on frame delays
  let currentTime = 0;
  const frameDuration = 1 / config.framerate;

  for (let i = 0; i < frames.length; i++) {
    // Render frame to the source canvas
    renderFrame(i, canvas);

    // Copy to export canvas (may need scaling)
    exportCtx.drawImage(canvas, 0, 0, config.width, config.height);

    // Calculate duration for this frame
    // Use frame delay if available, otherwise use fixed framerate
    const delay = frames[i].delay || 100; // Default 100ms like GIF spec
    const duration = Math.max(delay / 1000, frameDuration);

    // Add frame with timestamp and duration
    await videoSource.add(currentTime, duration);
    currentTime += duration;

    // Report progress
    if (onProgress) {
      onProgress(Math.round(((i + 1) / frames.length) * 100));
    }

    // Yield to UI thread
    await new Promise(r => setTimeout(r, 0));
  }

  await output.finalize();

  const buffer = (output.target as any).buffer as ArrayBuffer;
  return new Blob([buffer], { type: 'video/mp4' });
}

/**
 * Export video using WebM via MediaRecorder.
 * Uses real-time recording approach.
 */
async function exportToWebM(options: ExportOptions): Promise<Blob> {
  const { frames, config, canvas, renderFrame, onProgress } = options;

  return new Promise((resolve, reject) => {
    try {
      // Create export canvas
      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = config.width;
      exportCanvas.height = config.height;
      const exportCtx = exportCanvas.getContext('2d')!;

      const stream = exportCanvas.captureStream(config.framerate);
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm';

      const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: config.bitrate,
      });

      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        resolve(blob);
      };

      recorder.onerror = (e) => {
        reject(new Error('MediaRecorder error'));
      };

      recorder.start();

      // Render frames with timing
      let frameIndex = 0;
      let lastTime = performance.now();

      const renderLoop = () => {
        if (frameIndex >= frames.length) {
          recorder.stop();
          return;
        }

        const now = performance.now();
        const frame = frames[frameIndex];
        const delay = frame.delay || 100;

        if (now - lastTime >= delay) {
          // Render to source canvas
          renderFrame(frameIndex, canvas);

          // Copy to export canvas
          exportCtx.drawImage(canvas, 0, 0, config.width, config.height);

          if (onProgress) {
            onProgress(Math.round(((frameIndex + 1) / frames.length) * 100));
          }

          frameIndex++;
          lastTime = now;
        }

        requestAnimationFrame(renderLoop);
      };

      renderLoop();
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * Export video with automatic format selection.
 * Tries MP4 first, falls back to WebM.
 */
export async function exportVideo(options: ExportOptions): Promise<VideoExportResult> {
  const supportsMP4 = await isMP4ExportSupported();

  if (supportsMP4) {
    try {
      const blob = await exportToMP4(options);
      return { blob, format: 'mp4' };
    } catch (e) {
      console.warn('MP4 export failed, falling back to WebM:', e);
    }
  }

  const blob = await exportToWebM(options);
  return { blob, format: 'webm' };
}

/**
 * Trigger download of a blob with specified filename.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  URL.revokeObjectURL(url);
  document.body.removeChild(a);
}
