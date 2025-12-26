/**
 * Post-processing effects for ASCII art canvas output.
 * These effects are applied after the ASCII is rendered to create
 * retro CRT, glitch, and other visual effects.
 */

export interface PostProcessingConfig {
  scanlines: number;        // 0-300: CRT scanline intensity
  glow: number;             // 0-300: Phosphor glow/bloom intensity
  chromaticAberration: number; // 0-300: RGB split effect
  noise: number;            // 0-300: Static noise overlay
  vignette: number;         // 0-300: Edge darkening
  flicker: number;          // 0-300: Brightness flicker (for animation)
}

export const DEFAULT_POST_PROCESSING: PostProcessingConfig = {
  scanlines: 0,
  glow: 0,
  chromaticAberration: 0,
  noise: 0,
  vignette: 0,
  flicker: 0
};

/**
 * Applies CRT scanline effect
 */
const applyScanlines = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  intensity: number
): void => {
  if (intensity <= 0) return;

  const alpha = (intensity / 100) * 0.4;
  ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;

  // Draw horizontal lines every 2-3 pixels
  const lineSpacing = 3;
  for (let y = 0; y < height; y += lineSpacing) {
    ctx.fillRect(0, y, width, 1);
  }
};

/**
 * Applies phosphor glow/bloom effect using blur and additive blending
 */
const applyGlow = (
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  intensity: number
): void => {
  if (intensity <= 0) return;

  const blurAmount = (intensity / 100) * 8;
  const alpha = (intensity / 100) * 0.5;

  ctx.save();
  ctx.filter = `blur(${blurAmount}px)`;
  ctx.globalAlpha = alpha;
  ctx.globalCompositeOperation = 'lighter';
  ctx.drawImage(canvas, 0, 0);
  ctx.restore();
};

/**
 * Applies chromatic aberration (RGB split) effect
 */
const applyChromaticAberration = (
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  intensity: number
): void => {
  if (intensity <= 0) return;

  const offset = Math.round((intensity / 100) * 5);
  if (offset < 1) return;

  // Get current image data
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const result = new Uint8ClampedArray(data.length);

  // Copy original data first
  result.set(data);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;

      // Offset red channel to the left
      const redX = Math.max(0, x - offset);
      const redIdx = (y * width + redX) * 4;
      result[idx] = data[redIdx];

      // Keep green in place (already copied)

      // Offset blue channel to the right
      const blueX = Math.min(width - 1, x + offset);
      const blueIdx = (y * width + blueX) * 4;
      result[idx + 2] = data[blueIdx + 2];
    }
  }

  ctx.putImageData(new ImageData(result, width, height), 0, 0);
};

/**
 * Applies static noise overlay
 */
const applyNoise = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  intensity: number
): void => {
  if (intensity <= 0) return;

  const alpha = (intensity / 100) * 0.15;
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 255 * alpha;
    data[i] = Math.max(0, Math.min(255, data[i] + noise));
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));
  }

  ctx.putImageData(imageData, 0, 0);
};

/**
 * Applies vignette (edge darkening) effect
 */
const applyVignette = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  intensity: number
): void => {
  if (intensity <= 0) return;

  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.sqrt(centerX * centerX + centerY * centerY);
  // Clamp innerRadius to minimum 0 for extreme values
  const innerRadius = Math.max(0, radius * (1 - intensity / 100));
  const alpha = Math.min(1, (intensity / 100) * 0.8);

  const gradient = ctx.createRadialGradient(
    centerX, centerY, innerRadius,
    centerX, centerY, radius
  );

  gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
  gradient.addColorStop(1, `rgba(0, 0, 0, ${alpha})`);

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
};

/**
 * Applies brightness flicker for animation
 */
const applyFlicker = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  intensity: number,
  time: number
): void => {
  if (intensity <= 0) return;

  // Create subtle random flicker based on time
  const flickerAmount = Math.sin(time * 0.01) * 0.5 +
                        Math.sin(time * 0.023) * 0.3 +
                        Math.sin(time * 0.037) * 0.2;
  const alpha = (intensity / 100) * 0.1 * flickerAmount;

  if (alpha > 0) {
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
  } else {
    ctx.fillStyle = `rgba(0, 0, 0, ${-alpha})`;
  }
  ctx.fillRect(0, 0, width, height);
};

/**
 * Applies all post-processing effects to a canvas
 */
export const applyPostProcessing = (
  canvas: HTMLCanvasElement,
  config: PostProcessingConfig,
  time: number = 0
): void => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const { width, height } = canvas;

  // Order matters! Apply effects in a specific sequence
  // 1. Chromatic aberration (before other effects)
  applyChromaticAberration(ctx, canvas, width, height, config.chromaticAberration);

  // 2. Glow/bloom
  applyGlow(ctx, canvas, config.glow);

  // 3. Scanlines
  applyScanlines(ctx, width, height, config.scanlines);

  // 4. Noise
  applyNoise(ctx, width, height, config.noise);

  // 5. Vignette
  applyVignette(ctx, width, height, config.vignette);

  // 6. Flicker (animated)
  applyFlicker(ctx, width, height, config.flicker, time);
};

/**
 * Checks if any post-processing effects are enabled
 */
export const hasPostProcessing = (config: PostProcessingConfig): boolean => {
  return config.scanlines > 0 ||
         config.glow > 0 ||
         config.chromaticAberration > 0 ||
         config.noise > 0 ||
         config.vignette > 0 ||
         config.flicker > 0;
};
