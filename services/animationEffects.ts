/**
 * Animation effects for ASCII art output.
 * These effects require continuous updates and are applied during the render loop.
 */

export interface AnimationEffectsConfig {
  matrixRain: number;      // 0-300: Matrix-style falling characters intensity
  waveDistortion: number;  // 0-300: Horizontal wave distortion
  typingReveal: boolean;   // Typing effect for static images (reveal characters over time)
}

export const DEFAULT_ANIMATION_EFFECTS: AnimationEffectsConfig = {
  matrixRain: 0,
  waveDistortion: 0,
  typingReveal: false
};

// Matrix rain state
interface MatrixColumn {
  y: number;           // Current head position
  speed: number;       // Fall speed
  length: number;      // Trail length
  chars: string[];     // Characters in the trail
  lastUpdate: number;  // Last update time
}

const MATRIX_CHARS = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

let matrixColumns: MatrixColumn[] = [];
let lastMatrixInit = 0;

/**
 * Initialize matrix rain columns for the given dimensions
 */
const initMatrixColumns = (cols: number, rows: number): void => {
  matrixColumns = [];
  const columnCount = Math.ceil(cols / 2); // One column every 2 characters

  for (let i = 0; i < columnCount; i++) {
    matrixColumns.push({
      y: Math.random() * rows * -1, // Start above screen
      speed: 0.5 + Math.random() * 1.5,
      length: 5 + Math.floor(Math.random() * 15),
      chars: Array.from({ length: 20 }, () =>
        MATRIX_CHARS[Math.floor(Math.random() * MATRIX_CHARS.length)]
      ),
      lastUpdate: 0
    });
  }
};

/**
 * Updates and renders matrix rain effect onto an ASCII canvas
 */
export const renderMatrixRain = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  cellWidth: number,
  cellHeight: number,
  intensity: number,
  time: number
): void => {
  if (intensity <= 0) return;

  const cols = Math.floor(width / cellWidth);
  const rows = Math.floor(height / cellHeight);

  // Reinitialize if dimensions changed significantly
  if (matrixColumns.length === 0 || Math.abs(lastMatrixInit - cols) > 5) {
    initMatrixColumns(cols, rows);
    lastMatrixInit = cols;
  }

  const alpha = (intensity / 100) * 0.8;
  ctx.font = `bold ${cellHeight}px "JetBrains Mono", monospace`;
  ctx.textBaseline = 'top';

  // Update and render each column
  for (let i = 0; i < matrixColumns.length; i++) {
    const col = matrixColumns[i];
    const x = (i * 2) * cellWidth + cellWidth / 2;

    // Update position based on time
    const timeDelta = time - col.lastUpdate;
    if (timeDelta > 50) { // Update every 50ms
      col.y += col.speed;
      col.lastUpdate = time;

      // Randomly change head character
      if (Math.random() < 0.3) {
        col.chars[0] = MATRIX_CHARS[Math.floor(Math.random() * MATRIX_CHARS.length)];
      }

      // Reset when off screen
      if (col.y - col.length > rows) {
        col.y = Math.random() * -10;
        col.speed = 0.5 + Math.random() * 1.5;
        col.length = 5 + Math.floor(Math.random() * 15);
      }
    }

    // Draw the trail
    for (let j = 0; j < col.length; j++) {
      const charY = Math.floor(col.y) - j;
      if (charY < 0 || charY >= rows) continue;

      const fadeAlpha = j === 0 ? alpha : alpha * (1 - j / col.length) * 0.7;
      const green = j === 0 ? 255 : Math.floor(255 * (1 - j / col.length * 0.5));

      ctx.fillStyle = `rgba(${j === 0 ? 200 : 0}, ${green}, ${j === 0 ? 200 : 0}, ${fadeAlpha})`;
      ctx.fillText(col.chars[j % col.chars.length], x, charY * cellHeight);
    }
  }
};

/**
 * Applies wave distortion effect by shifting pixels horizontally
 */
export const applyWaveDistortion = (
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  intensity: number,
  time: number
): void => {
  if (intensity <= 0) return;

  const { width, height } = canvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const result = new Uint8ClampedArray(data.length);

  // Fill with transparent/black first
  result.fill(0);

  const amplitude = (intensity / 100) * 10; // Max 10 pixel shift
  const frequency = 0.02 + (intensity / 100) * 0.03;
  const speed = time * 0.003;

  for (let y = 0; y < height; y++) {
    // Calculate horizontal offset for this row
    const offset = Math.sin(y * frequency + speed) * amplitude;
    const intOffset = Math.round(offset);

    for (let x = 0; x < width; x++) {
      const srcX = x - intOffset;

      if (srcX >= 0 && srcX < width) {
        const srcIdx = (y * width + srcX) * 4;
        const dstIdx = (y * width + x) * 4;

        result[dstIdx] = data[srcIdx];
        result[dstIdx + 1] = data[srcIdx + 1];
        result[dstIdx + 2] = data[srcIdx + 2];
        result[dstIdx + 3] = data[srcIdx + 3];
      }
    }
  }

  ctx.putImageData(new ImageData(result, width, height), 0, 0);
};

// Typing reveal state
let typingRevealProgress = 0;
let lastTypingUpdate = 0;

/**
 * Resets the typing reveal progress
 */
export const resetTypingReveal = (): void => {
  typingRevealProgress = 0;
  lastTypingUpdate = 0;
};

/**
 * Creates a mask for typing reveal effect
 * Returns the number of characters to show
 */
export const getTypingRevealMask = (
  totalChars: number,
  time: number,
  speed: number = 50 // characters per second
): number => {
  const timeDelta = time - lastTypingUpdate;

  if (timeDelta > 20) { // Update every 20ms
    typingRevealProgress += (timeDelta / 1000) * speed;
    lastTypingUpdate = time;
  }

  return Math.min(totalChars, Math.floor(typingRevealProgress));
};

/**
 * Applies typing reveal effect by masking characters
 */
export const applyTypingReveal = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  cellWidth: number,
  cellHeight: number,
  time: number,
  backgroundColor: string
): boolean => {
  const cols = Math.floor(width / cellWidth);
  const rows = Math.floor(height / cellHeight);
  const totalChars = cols * rows;

  const visibleChars = getTypingRevealMask(totalChars, time, 100);

  if (visibleChars >= totalChars) {
    return true; // Effect complete
  }

  // Calculate which row/col to start masking from
  const visibleRows = Math.floor(visibleChars / cols);
  const partialRowChars = visibleChars % cols;

  // Fill everything after the visible portion with background
  ctx.fillStyle = backgroundColor === 'transparent' ? 'rgba(0,0,0,0)' : backgroundColor;

  // Mask partial row
  if (visibleRows < rows) {
    ctx.fillRect(
      partialRowChars * cellWidth,
      visibleRows * cellHeight,
      width - partialRowChars * cellWidth,
      cellHeight
    );

    // Mask remaining rows
    if (visibleRows + 1 < rows) {
      ctx.fillRect(
        0,
        (visibleRows + 1) * cellHeight,
        width,
        height - (visibleRows + 1) * cellHeight
      );
    }
  }

  // Draw cursor
  ctx.fillStyle = '#ffffff';
  const cursorX = partialRowChars * cellWidth;
  const cursorY = visibleRows * cellHeight;

  // Blinking cursor
  if (Math.floor(time / 500) % 2 === 0) {
    ctx.fillRect(cursorX, cursorY, cellWidth * 0.8, cellHeight);
  }

  return false; // Effect still in progress
};

/**
 * Checks if any animation effects are enabled
 */
export const hasAnimationEffects = (config: AnimationEffectsConfig): boolean => {
  return config.matrixRain > 0 ||
         config.waveDistortion > 0 ||
         config.typingReveal;
};
