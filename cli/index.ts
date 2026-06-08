#!/usr/bin/env node
import { program } from 'commander';
import { createCanvas, loadImage, type Canvas, type ImageData, type SKRSContext2D } from '@napi-rs/canvas';
import { parseGIF, decompressFrames } from 'gifuct-js';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';

// Types
interface GifFrame {
  dims: { width: number; height: number; top: number; left: number };
  delay: number;
  disposalType: number;
  patch: Uint8ClampedArray;
}

interface GifRestoreState {
  imageData: ImageData;
  left: number;
  top: number;
}

interface Options {
  cols: number;
  chars: string;
  sourceColor: boolean;
  color: string;
  bg: string;
  invert: boolean;
  aspect: number;
  speed: number;
  loop: boolean;
  fit: boolean;
  mode: 'ascii' | 'sixel';
  width?: number;
  height?: number;
  fontSize?: number;
  frame?: number;
  output?: string;
}

const DEFAULT_CHARS = '@%#*+=-:. ';

function drawGifFrameToComposition(
  compCtx: SKRSContext2D,
  patchCtx: SKRSContext2D,
  patchCanvas: Canvas,
  frame: GifFrame
): GifRestoreState | null {
  const { width, height, top, left } = frame.dims;
  const restoreState = frame.disposalType === 3
    ? { imageData: compCtx.getImageData(left, top, width, height), left, top }
    : null;

  if (frame.patch) {
    patchCanvas.width = width;
    patchCanvas.height = height;
    const patchData = patchCtx.createImageData(width, height);
    patchData.data.set(frame.patch);
    patchCtx.putImageData(patchData, 0, 0);
    compCtx.drawImage(patchCanvas, left, top);
  }

  return restoreState;
}

function disposeGifFrameFromComposition(
  compCtx: SKRSContext2D,
  frame: GifFrame,
  restoreState: GifRestoreState | null
): void {
  const { width, height, top, left } = frame.dims;

  if (frame.disposalType === 2) {
    compCtx.clearRect(left, top, width, height);
  } else if (frame.disposalType === 3 && restoreState) {
    compCtx.putImageData(restoreState.imageData, restoreState.left, restoreState.top);
  }
}

// ANSI escape codes
const ESC = '\x1b';
const RESET = `${ESC}[0m`;
const CLEAR = `${ESC}[2J${ESC}[H`;
const HOME = `${ESC}[H`;
const HIDE_CURSOR = `${ESC}[?25l`;
const SHOW_CURSOR = `${ESC}[?25h`;
const ALT_SCREEN_ON = `${ESC}[?1049h`;
const ALT_SCREEN_OFF = `${ESC}[?1049l`;

async function waitForKeypress(): Promise<void> {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') {
    return;
  }

  process.stdout.write(`\n${RESET}Press any key to exit...`);
  process.stdin.setRawMode(true);
  process.stdin.resume();

  try {
    await new Promise((resolve) => process.stdin.once('data', resolve));
  } finally {
    process.stdin.setRawMode(false);
  }
}

// Sixel escape sequences
const SIXEL_START = `${ESC}Pq`;
const SIXEL_END = `${ESC}\\`;

// Encode image data to Sixel format
function encodeToSixel(
  imageData: { data: Uint8ClampedArray; width: number; height: number },
  maxColors: number = 256
): string {
  const { data, width, height } = imageData;

  // Build color palette using simple quantization
  const colorMap = new Map<string, number>();
  const palette: [number, number, number][] = [];
  const pixelColors: number[] = new Array(width * height);

  for (let i = 0; i < width * height; i++) {
    const offset = i * 4;
    const r = data[offset];
    const g = data[offset + 1];
    const b = data[offset + 2];
    const a = data[offset + 3];

    if (a < 128) {
      pixelColors[i] = -1; // Transparent
      continue;
    }

    // Quantize to reduce colors (5 bits per channel)
    const qr = Math.floor(r / 8) * 8;
    const qg = Math.floor(g / 8) * 8;
    const qb = Math.floor(b / 8) * 8;
    const key = `${qr},${qg},${qb}`;

    if (!colorMap.has(key)) {
      if (palette.length < maxColors) {
        colorMap.set(key, palette.length);
        palette.push([qr, qg, qb]);
      }
    }
    pixelColors[i] = colorMap.get(key) ?? 0;
  }

  // Build Sixel output
  let output = SIXEL_START;

  // Set raster attributes (pixel aspect ratio 1:1)
  output += `"1;1;${width};${height}`;

  // Define color palette
  for (let i = 0; i < palette.length; i++) {
    const [r, g, b] = palette[i];
    // Sixel uses 0-100 for RGB values
    const sr = Math.round((r / 255) * 100);
    const sg = Math.round((g / 255) * 100);
    const sb = Math.round((b / 255) * 100);
    output += `#${i};2;${sr};${sg};${sb}`;
  }

  // Encode pixels in 6-row bands
  for (let bandY = 0; bandY < height; bandY += 6) {
    // For each color, encode which pixels in this band use it
    const bandColors = new Set<number>();
    for (let y = bandY; y < Math.min(bandY + 6, height); y++) {
      for (let x = 0; x < width; x++) {
        const colorIdx = pixelColors[y * width + x];
        if (colorIdx >= 0) bandColors.add(colorIdx);
      }
    }

    const sortedColors = Array.from(bandColors).sort((a, b) => a - b);

    for (let ci = 0; ci < sortedColors.length; ci++) {
      const colorIdx = sortedColors[ci];
      output += `#${colorIdx}`;

      let runLength = 0;
      let lastChar = '';

      for (let x = 0; x < width; x++) {
        // Build sixel character (6 vertical pixels)
        let sixelValue = 0;
        for (let bit = 0; bit < 6; bit++) {
          const y = bandY + bit;
          if (y < height) {
            const pixelColor = pixelColors[y * width + x];
            if (pixelColor === colorIdx) {
              sixelValue |= (1 << bit);
            }
          }
        }
        const char = String.fromCharCode(63 + sixelValue);

        // Run-length encoding
        if (char === lastChar) {
          runLength++;
        } else {
          if (runLength > 0) {
            if (runLength > 3) {
              output += `!${runLength}${lastChar}`;
            } else {
              output += lastChar.repeat(runLength);
            }
          }
          lastChar = char;
          runLength = 1;
        }
      }

      // Flush remaining run
      if (runLength > 0) {
        if (runLength > 3) {
          output += `!${runLength}${lastChar}`;
        } else {
          output += lastChar.repeat(runLength);
        }
      }

      // Move to next color in same band (carriage return)
      if (ci < sortedColors.length - 1) {
        output += '$';
      }
    }

    // Move to next band (newline)
    output += '-';
  }

  output += SIXEL_END;
  return output;
}

function rgbToAnsi(r: number, g: number, b: number): string {
  return `${ESC}[38;2;${r};${g};${b}m`;
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

function bgAnsi(r: number, g: number, b: number): string {
  return `${ESC}[48;2;${r};${g};${b}m`;
}

// Detect file type from path/URL
function getFileType(input: string): 'gif' | 'image' {
  const lower = input.toLowerCase();
  if (lower.endsWith('.gif')) return 'gif';
  if (lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.webp')) return 'image';
  // Check URL path without query params
  const urlPath = lower.split('?')[0];
  if (urlPath.endsWith('.gif')) return 'gif';
  if (urlPath.endsWith('.png') || urlPath.endsWith('.jpg') || urlPath.endsWith('.jpeg') || urlPath.endsWith('.webp')) return 'image';
  // Default to gif for unknown
  return 'gif';
}

// Load static image (PNG, JPEG, WebP) and convert to frames format
async function loadStaticImage(input: string): Promise<{ canvas: Canvas; width: number; height: number }> {
  const image = await loadImage(input);
  const canvas = createCanvas(image.width, image.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0);
  return { canvas, width: image.width, height: image.height };
}

// Fetch file from URL or read from disk
async function loadFile(input: string): Promise<ArrayBuffer> {
  if (input.startsWith('http://') || input.startsWith('https://')) {
    return new Promise((resolve, reject) => {
      const client = input.startsWith('https://') ? https : http;
      client.get(input, (res) => {
        const statusCode = res.statusCode ?? 0;

        if (statusCode >= 300 && statusCode < 400 && res.headers.location) {
          const redirectUrl = new URL(res.headers.location, input).toString();
          res.resume();
          loadFile(redirectUrl).then(resolve).catch(reject);
          return;
        }

        if (statusCode < 200 || statusCode >= 300) {
          res.resume();
          reject(new Error(`Failed to fetch ${input}: HTTP ${statusCode}`));
          return;
        }

        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const buffer = Buffer.concat(chunks);
          resolve(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
        });
        res.on('error', reject);
      }).on('error', reject);
    });
  }
  const buffer = fs.readFileSync(path.resolve(input));
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

// Convert image data to ASCII with optional colors
function convertToAscii(
  imageData: { data: Uint8ClampedArray; width: number; height: number },
  options: Options
): { lines: string[]; colors: [number, number, number][][] } {
  const { data, width, height } = imageData;
  const chars = options.chars || DEFAULT_CHARS;
  const lines: string[] = [];
  const colors: [number, number, number][][] = [];

  for (let y = 0; y < height; y++) {
    let line = '';
    const rowColors: [number, number, number][] = [];

    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 4;
      const r = data[offset];
      const g = data[offset + 1];
      const b = data[offset + 2];
      const a = data[offset + 3];

      if (a === 0) {
        line += ' ';
        rowColors.push([0, 0, 0]);
      } else {
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;
        let index = Math.floor((gray / 255) * (chars.length - 1));
        index = Math.max(0, Math.min(chars.length - 1, index));

        if (options.invert) {
          line += chars[chars.length - 1 - index];
        } else {
          line += chars[index];
        }
        rowColors.push([r, g, b]);
      }
    }
    lines.push(line);
    colors.push(rowColors);
  }

  return { lines, colors };
}

// Render a single frame to ASCII
function renderFrame(
  compositionCanvas: Canvas,
  options: Options
): { lines: string[]; colors: [number, number, number][][] } {
  const { width: srcWidth, height: srcHeight } = compositionCanvas;
  const aspectRatio = srcHeight / srcWidth;

  // Start with requested cols
  let cols = options.cols;
  let rows = Math.floor(cols * aspectRatio * options.aspect);

  // Scale down to fit terminal if --fit is enabled (default)
  if (options.fit) {
    const termCols = process.stdout.columns || 80;
    const termRows = process.stdout.rows || 24;
    const maxRows = Math.max(1, termRows - 1);

    if (cols > termCols || rows > maxRows) {
      const scaleX = termCols / cols;
      const scaleY = maxRows / rows;
      const scale = Math.min(scaleX, scaleY);
      cols = Math.floor(cols * scale);
      rows = Math.floor(rows * scale);
    }
  }

  cols = Math.max(1, cols);
  rows = Math.max(1, rows);

  // Create resize canvas
  const resizeCanvas = createCanvas(cols, rows);
  const ctx = resizeCanvas.getContext('2d');
  ctx.drawImage(compositionCanvas, 0, 0, cols, rows);
  const imageData = ctx.getImageData(0, 0, cols, rows);

  return convertToAscii(
    { data: imageData.data as unknown as Uint8ClampedArray, width: cols, height: rows },
    options
  );
}

// Format frame as ANSI string for terminal
function formatAnsiFrame(
  lines: string[],
  colors: [number, number, number][][],
  options: Options
): string {
  let output = '';
  const [bgR, bgG, bgB] = options.bg !== 'transparent' ? hexToRgb(options.bg) : [0, 0, 0];
  const [fgR, fgG, fgB] = hexToRgb(options.color);

  if (options.bg !== 'transparent') {
    output += bgAnsi(bgR, bgG, bgB);
  }

  for (let y = 0; y < lines.length; y++) {
    const line = lines[y];
    const rowColors = colors[y];

    for (let x = 0; x < line.length; x++) {
      const char = line[x];
      if (options.sourceColor && char !== ' ') {
        const [r, g, b] = rowColors[x];
        output += rgbToAnsi(r, g, b) + char;
      } else if (char !== ' ') {
        output += rgbToAnsi(fgR, fgG, fgB) + char;
      } else {
        output += ' ';
      }
    }
    output += RESET + '\n';
  }

  return output;
}

// Render frame for Sixel mode - renders ASCII art to canvas, then encodes to Sixel
function renderSixelFrame(
  compositionCanvas: Canvas,
  options: Options
): string {
  // First, convert to ASCII (reuse the ASCII rendering logic)
  const { lines, colors } = renderFrame(compositionCanvas, options);

  // Calculate font size: use explicit fontSize, or derive from width, or default to 12
  let fontSize: number;
  if (options.fontSize) {
    fontSize = options.fontSize;
  } else if (options.width || options.height) {
    const widthSize = options.width
      ? options.width / (lines[0].length * 0.6)
      : Number.POSITIVE_INFINITY;
    const heightSize = options.height
      ? options.height / Math.max(1, lines.length)
      : Number.POSITIVE_INFINITY;
    fontSize = Math.floor(Math.min(widthSize, heightSize));
  } else {
    fontSize = 12;
  }
  const minFontSize = (options.width || options.height || options.fontSize) ? 1 : 4;
  fontSize = Math.max(minFontSize, fontSize);

  const charWidth = fontSize * 0.6; // Approximate monospace character width
  const charHeight = fontSize;

  const canvasWidth = Math.ceil(lines[0].length * charWidth);
  const canvasHeight = Math.ceil(lines.length * charHeight);

  // Create canvas to render ASCII art
  const asciiCanvas = createCanvas(canvasWidth, canvasHeight);
  const ctx = asciiCanvas.getContext('2d');

  // Fill background
  if (options.bg !== 'transparent') {
    const [r, g, b] = hexToRgb(options.bg);
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  } else {
    ctx.fillStyle = 'rgb(0,0,0)';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  }

  // Set up font
  ctx.font = `${fontSize}px monospace`;
  ctx.textBaseline = 'top';

  const [fgR, fgG, fgB] = hexToRgb(options.color);

  // Draw each character
  for (let y = 0; y < lines.length; y++) {
    const line = lines[y];
    const rowColors = colors[y];

    for (let x = 0; x < line.length; x++) {
      const char = line[x];
      if (char === ' ') continue;

      if (options.sourceColor) {
        const [r, g, b] = rowColors[x];
        ctx.fillStyle = `rgb(${r},${g},${b})`;
      } else {
        ctx.fillStyle = `rgb(${fgR},${fgG},${fgB})`;
      }

      ctx.fillText(char, x * charWidth, y * charHeight);
    }
  }

  const imageData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);

  return encodeToSixel(
    { data: imageData.data as unknown as Uint8ClampedArray, width: canvasWidth, height: canvasHeight }
  );
}

// Play Sixel animation in terminal
async function playSixelAnimation(frames: GifFrame[], options: Options): Promise<void> {
  const gifWidth = frames[0].dims.width;
  const gifHeight = frames[0].dims.height;

  let maxWidth = gifWidth;
  let maxHeight = gifHeight;
  for (const frame of frames) {
    maxWidth = Math.max(maxWidth, frame.dims.left + frame.dims.width);
    maxHeight = Math.max(maxHeight, frame.dims.top + frame.dims.height);
  }

  const compositionCanvas = createCanvas(maxWidth, maxHeight);
  const compCtx = compositionCanvas.getContext('2d');
  const patchCanvas = createCanvas(1, 1);
  const patchCtx = patchCanvas.getContext('2d');

  process.stdout.write(ALT_SCREEN_ON + HIDE_CURSOR);

  const cleanup = () => {
    process.stdout.write(SHOW_CURSOR + ALT_SCREEN_OFF);
    process.exit();
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  const playOnce = async () => {
    for (let i = 0; i < frames.length; i++) {
      if (options.frame !== undefined && i !== options.frame) continue;

      const frame = frames[i];
      const restoreState = drawGifFrameToComposition(compCtx, patchCtx, patchCanvas, frame);

      const sixelFrame = renderSixelFrame(compositionCanvas, options);
      process.stdout.write(HOME + sixelFrame);

      disposeGifFrameFromComposition(compCtx, frame, restoreState);

      if (options.frame !== undefined) {
        await waitForKeypress();
        process.stdout.write(SHOW_CURSOR + ALT_SCREEN_OFF);
        return;
      }

      const delay = (frame.delay || 100) / options.speed;
      await new Promise((r) => setTimeout(r, delay));
    }
  };

  if (options.loop) {
    while (true) {
      await playOnce();
      compCtx.clearRect(0, 0, maxWidth, maxHeight);
    }
  } else {
    await playOnce();
    await waitForKeypress();
    process.stdout.write(SHOW_CURSOR + ALT_SCREEN_OFF);
  }
}

// Display static image in terminal (ASCII mode)
async function displayStaticImage(canvas: Canvas, options: Options): Promise<void> {
  process.stdout.write(ALT_SCREEN_ON + HIDE_CURSOR);

  const cleanup = () => {
    process.stdout.write(SHOW_CURSOR + ALT_SCREEN_OFF);
    process.exit();
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  const { lines, colors } = renderFrame(canvas, options);
  const ansiFrame = formatAnsiFrame(lines, colors, options);
  process.stdout.write(HOME + ansiFrame);

  await waitForKeypress();
  process.stdout.write(SHOW_CURSOR + ALT_SCREEN_OFF);
}

// Display static image in terminal (Sixel mode)
async function displayStaticImageSixel(canvas: Canvas, options: Options): Promise<void> {
  process.stdout.write(ALT_SCREEN_ON + HIDE_CURSOR);

  const cleanup = () => {
    process.stdout.write(SHOW_CURSOR + ALT_SCREEN_OFF);
    process.exit();
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  const sixelFrame = renderSixelFrame(canvas, options);
  process.stdout.write(HOME + sixelFrame);

  await waitForKeypress();
  process.stdout.write(SHOW_CURSOR + ALT_SCREEN_OFF);
}

// Play ASCII animation in terminal
async function playAnimation(frames: GifFrame[], options: Options): Promise<void> {
  const gifWidth = frames[0].dims.width;
  const gifHeight = frames[0].dims.height;

  // Find actual dimensions from frame patches
  let maxWidth = gifWidth;
  let maxHeight = gifHeight;
  for (const frame of frames) {
    maxWidth = Math.max(maxWidth, frame.dims.left + frame.dims.width);
    maxHeight = Math.max(maxHeight, frame.dims.top + frame.dims.height);
  }

  // Create composition canvas
  const compositionCanvas = createCanvas(maxWidth, maxHeight);
  const compCtx = compositionCanvas.getContext('2d');

  // Patch canvas for drawing frames
  const patchCanvas = createCanvas(1, 1);
  const patchCtx = patchCanvas.getContext('2d');

  // Use alternate screen buffer to prevent scrollback pollution
  process.stdout.write(ALT_SCREEN_ON + HIDE_CURSOR);

  const cleanup = () => {
    process.stdout.write(SHOW_CURSOR + ALT_SCREEN_OFF);
    process.exit();
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  let lastLineCount = 0;

  const playOnce = async () => {
    for (let i = 0; i < frames.length; i++) {
      // Handle single frame mode
      if (options.frame !== undefined && i !== options.frame) continue;

      const frame = frames[i];
      // Draw patch to composition
      const restoreState = drawGifFrameToComposition(compCtx, patchCtx, patchCanvas, frame);

      // Render ASCII
      const { lines, colors } = renderFrame(compositionCanvas, options);
      const ansiFrame = formatAnsiFrame(lines, colors, options);

      // Move cursor to home and overwrite in place
      process.stdout.write(HOME + ansiFrame);
      lastLineCount = lines.length;

      // Handle disposal
      disposeGifFrameFromComposition(compCtx, frame, restoreState);

      // Single frame mode - wait for keypress then exit
      if (options.frame !== undefined) {
        await waitForKeypress();
        process.stdout.write(SHOW_CURSOR + ALT_SCREEN_OFF);
        return;
      }

      // Wait for next frame
      const delay = (frame.delay || 100) / options.speed;
      await new Promise((r) => setTimeout(r, delay));
    }
  };

  if (options.loop) {
    while (true) {
      await playOnce();
      // Reset composition for next loop
      compCtx.clearRect(0, 0, maxWidth, maxHeight);
    }
  } else {
    await playOnce();
    // Wait for keypress before exiting
    await waitForKeypress();
    process.stdout.write(SHOW_CURSOR + ALT_SCREEN_OFF);
  }
}

// Export to shell script
function exportBashScript(frames: GifFrame[], options: Options): string {
  const gifWidth = frames[0].dims.width;
  const gifHeight = frames[0].dims.height;

  let maxWidth = gifWidth;
  let maxHeight = gifHeight;
  for (const frame of frames) {
    maxWidth = Math.max(maxWidth, frame.dims.left + frame.dims.width);
    maxHeight = Math.max(maxHeight, frame.dims.top + frame.dims.height);
  }

  const compositionCanvas = createCanvas(maxWidth, maxHeight);
  const compCtx = compositionCanvas.getContext('2d');
  const patchCanvas = createCanvas(1, 1);
  const patchCtx = patchCanvas.getContext('2d');

  let script = `#!/bin/bash
# Generated by gif2ascii
trap 'tput cnorm; exit' INT
tput civis
`;

  if (options.loop) {
    script += 'while true; do\n';
  }

  for (const frame of frames) {
    const restoreState = drawGifFrameToComposition(compCtx, patchCtx, patchCanvas, frame);

    const { lines, colors } = renderFrame(compositionCanvas, options);
    const ansiFrame = formatAnsiFrame(lines, colors, options);

    // Escape for bash
    const escaped = ansiFrame
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "'\\''")
      .replace(/\x1b/g, '\\x1b');

    const delay = ((frame.delay || 100) / options.speed / 1000).toFixed(3);
    script += `clear\necho -e '${escaped}'\nsleep ${delay}\n`;

    disposeGifFrameFromComposition(compCtx, frame, restoreState);
  }

  if (options.loop) {
    script += 'done\n';
  }

  script += 'tput cnorm\n';
  return script;
}

// Export to PowerShell script
function exportPowerShellScript(frames: GifFrame[], options: Options): string {
  const gifWidth = frames[0].dims.width;
  const gifHeight = frames[0].dims.height;

  let maxWidth = gifWidth;
  let maxHeight = gifHeight;
  for (const frame of frames) {
    maxWidth = Math.max(maxWidth, frame.dims.left + frame.dims.width);
    maxHeight = Math.max(maxHeight, frame.dims.top + frame.dims.height);
  }

  const compositionCanvas = createCanvas(maxWidth, maxHeight);
  const compCtx = compositionCanvas.getContext('2d');
  const patchCanvas = createCanvas(1, 1);
  const patchCtx = patchCanvas.getContext('2d');

  let script = `# Generated by gif2ascii
[Console]::CursorVisible = $false
try {
`;

  if (options.loop) {
    script += 'while ($true) {\n';
  }

  for (const frame of frames) {
    const restoreState = drawGifFrameToComposition(compCtx, patchCtx, patchCanvas, frame);

    const { lines, colors } = renderFrame(compositionCanvas, options);
    const ansiFrame = formatAnsiFrame(lines, colors, options);

    // Convert ANSI escapes for PowerShell
    const escaped = ansiFrame
      .replace(/`/g, '``')
      .replace(/"/g, '`"')
      .replace(/\$/g, '`$')
      .replace(/\x1b/g, '`e');

    const delay = Math.round((frame.delay || 100) / options.speed);
    script += `Clear-Host\nWrite-Host "${escaped}"\nStart-Sleep -Milliseconds ${delay}\n`;

    disposeGifFrameFromComposition(compCtx, frame, restoreState);
  }

  if (options.loop) {
    script += '}\n';
  }

  script += `} finally {
[Console]::CursorVisible = $true
}
`;
  return script;
}

// Export single frame as ANSI text
function exportAnsiFile(frames: GifFrame[], options: Options, frameIndex: number = 0): string {
  const gifWidth = frames[0].dims.width;
  const gifHeight = frames[0].dims.height;

  let maxWidth = gifWidth;
  let maxHeight = gifHeight;
  for (const frame of frames) {
    maxWidth = Math.max(maxWidth, frame.dims.left + frame.dims.width);
    maxHeight = Math.max(maxHeight, frame.dims.top + frame.dims.height);
  }

  const compositionCanvas = createCanvas(maxWidth, maxHeight);
  const compCtx = compositionCanvas.getContext('2d');
  const patchCanvas = createCanvas(1, 1);
  const patchCtx = patchCanvas.getContext('2d');

  // Build up to the target frame
  for (let i = 0; i <= frameIndex && i < frames.length; i++) {
    const frame = frames[i];
    const restoreState = drawGifFrameToComposition(compCtx, patchCtx, patchCanvas, frame);

    if (i < frameIndex) {
      disposeGifFrameFromComposition(compCtx, frame, restoreState);
    }
  }

  const { lines, colors } = renderFrame(compositionCanvas, options);
  return formatAnsiFrame(lines, colors, options);
}

// Export plain text (no colors)
function exportPlainText(frames: GifFrame[], options: Options, frameIndex: number = 0): string {
  const gifWidth = frames[0].dims.width;
  const gifHeight = frames[0].dims.height;

  let maxWidth = gifWidth;
  let maxHeight = gifHeight;
  for (const frame of frames) {
    maxWidth = Math.max(maxWidth, frame.dims.left + frame.dims.width);
    maxHeight = Math.max(maxHeight, frame.dims.top + frame.dims.height);
  }

  const compositionCanvas = createCanvas(maxWidth, maxHeight);
  const compCtx = compositionCanvas.getContext('2d');
  const patchCanvas = createCanvas(1, 1);
  const patchCtx = patchCanvas.getContext('2d');

  for (let i = 0; i <= frameIndex && i < frames.length; i++) {
    const frame = frames[i];
    const restoreState = drawGifFrameToComposition(compCtx, patchCtx, patchCanvas, frame);

    if (i < frameIndex) {
      disposeGifFrameFromComposition(compCtx, frame, restoreState);
    }
  }

  const { lines } = renderFrame(compositionCanvas, options);
  return lines.join('\n') + '\n';
}

// Main
async function main() {
  program
    .name('gif2ascii')
    .description('Convert GIFs, PNGs, and JPEGs to ASCII art in the terminal')
    .version('1.0.0')
    .argument('<input>', 'Image file path or URL (GIF, PNG, JPEG, WebP)')
    .option('-c, --cols <n>', 'Column count / density', '80')
    .option('--chars <set>', 'Character map, dark→light', DEFAULT_CHARS)
    .option('--source-color', 'Use source image colors', false)
    .option('--color <hex>', 'Text color (when not using source)', '#ffffff')
    .option('--bg <hex>', 'Background color (or "transparent")', '#000000')
    .option('-i, --invert', 'Invert luminance mapping', false)
    .option('-a, --aspect <ratio>', 'Font aspect ratio', '0.55')
    .option('--speed <multiplier>', 'Playback speed', '1.0')
    .option('-l, --loop', 'Loop forever', false)
    .option('--no-fit', 'Disable auto-scaling to terminal size')
    .option('-m, --mode <mode>', 'Render mode: ascii or sixel', 'ascii')
    .option('-W, --width <px>', 'Target output width in pixels (sixel mode)')
    .option('-H, --height <px>', 'Height in pixels (sixel mode, auto if omitted)')
    .option('-F, --font-size <px>', 'Font size in pixels (sixel mode, default 12)')
    .option('--frame <n>', 'Show single frame only')
    .option('-o, --output <file>', 'Save to file (.sh, .ps1, .ans, .txt)')
    .action(async (input: string, opts: Record<string, string | boolean | undefined>) => {
      const options: Options = {
        cols: parseInt(opts.cols as string, 10),
        chars: opts.chars as string,
        sourceColor: opts.sourceColor as boolean,
        color: opts.color as string,
        bg: opts.bg as string,
        invert: opts.invert as boolean,
        aspect: parseFloat(opts.aspect as string),
        speed: parseFloat(opts.speed as string),
        loop: opts.loop as boolean,
        fit: opts.fit !== false,
        mode: (opts.mode as string) === 'sixel' ? 'sixel' : 'ascii',
        width: opts.width ? parseInt(opts.width as string, 10) : undefined,
        height: opts.height ? parseInt(opts.height as string, 10) : undefined,
        fontSize: opts.fontSize ? parseInt(opts.fontSize as string, 10) : undefined,
        frame: opts.frame !== undefined ? parseInt(opts.frame as string, 10) : undefined,
        output: opts.output as string | undefined,
      };

      try {
        const fileType = getFileType(input);

        if (fileType === 'image') {
          // Handle static images (PNG, JPEG, WebP)
          const { canvas } = await loadStaticImage(input);

          if (options.output) {
            // Export static image
            const ext = path.extname(options.output).toLowerCase();
            const { lines, colors } = renderFrame(canvas, options);

            let content: string;
            switch (ext) {
              case '.ans':
                content = formatAnsiFrame(lines, colors, options);
                break;
              case '.txt':
                content = lines.join('\n') + '\n';
                break;
              default:
                console.error(`Error: For static images, use .ans or .txt output format`);
                process.exit(1);
            }

            fs.writeFileSync(options.output, content);
            console.log(`Saved to ${options.output}`);
          } else {
            // Display in terminal
            if (options.mode === 'sixel') {
              await displayStaticImageSixel(canvas, options);
            } else {
              await displayStaticImage(canvas, options);
            }
          }
        } else {
          // Handle GIF
          const buffer = await loadFile(input);
          const gif = parseGIF(buffer);
          const frames = decompressFrames(gif, true) as GifFrame[];

          if (frames.length === 0) {
            console.error('Error: No frames found in GIF');
            process.exit(1);
          }

          // Handle output file
          if (options.output) {
            const ext = path.extname(options.output).toLowerCase();
            let content: string;

            switch (ext) {
              case '.sh':
                content = exportBashScript(frames, options);
                break;
              case '.ps1':
                content = exportPowerShellScript(frames, options);
                break;
              case '.ans':
                content = exportAnsiFile(frames, options, options.frame || 0);
                break;
              case '.txt':
                content = exportPlainText(frames, options, options.frame || 0);
                break;
              default:
                console.error(`Error: Unknown output format "${ext}". Use .sh, .ps1, .ans, or .txt`);
                process.exit(1);
            }

            fs.writeFileSync(options.output, content);
            console.log(`Saved to ${options.output}`);
          } else {
            // Play in terminal
            if (options.mode === 'sixel') {
              await playSixelAnimation(frames, options);
            } else {
              await playAnimation(frames, options);
            }
          }
        }
      } catch (err) {
        console.error('Error:', (err as Error).message);
        process.exit(1);
      }
    });

  program.parse();
}

main();
