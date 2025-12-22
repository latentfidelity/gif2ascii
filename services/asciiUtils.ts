import { AsciiConfig } from '../types';

export const DEFAULT_CHARS = "@%#*+=-:. ";
export const DENSE_CHARS = "$@B%8&WM#*oahkbdpqwmZO0QLCJUYXzcvunxrjft/\\|()1{}[]?-_+~<>i!lI;:,\"^`'. ";
export const BLOCKS_CHARS = "█▓▒░ ";
export const SIMPLE_CHARS = "@#*+:. ";
export const BINARY_CHARS = "10";
export const BRAILLE_CHARS = "⣿⣷⣯⣟⡿⢿⣻⣽⣾⣶⣦⣴⣤⣄⣀⡀ ";
export const NUMERIC_CHARS = "0123456789";
export const KATAKANA_CHARS = "ヲァィゥェォャュョッアイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワン ";
export const DOTS_CHARS = "●◉◎○· ";
export const SHADES_CHARS = "█▓▒░· ";
export const CROSSES_CHARS = "╬╫╪┼+· ";
export const STARS_CHARS = "★☆✦✧· ";
export const SLASHES_CHARS = "#/\\|-:. ";
export const MINIMAL_CHARS = "█ ";

export const CHAR_PRESETS: { name: string; chars: string }[] = [
  { name: "Standard", chars: DEFAULT_CHARS },
  { name: "Dense", chars: DENSE_CHARS },
  { name: "Blocks", chars: BLOCKS_CHARS },
  { name: "Simple", chars: SIMPLE_CHARS },
  { name: "Binary", chars: BINARY_CHARS },
  { name: "Braille", chars: BRAILLE_CHARS },
  { name: "Numeric", chars: NUMERIC_CHARS },
  { name: "Katakana", chars: KATAKANA_CHARS },
  { name: "Dots", chars: DOTS_CHARS },
  { name: "Shades", chars: SHADES_CHARS },
  { name: "Crosses", chars: CROSSES_CHARS },
  { name: "Stars", chars: STARS_CHARS },
  { name: "Slashes", chars: SLASHES_CHARS },
  { name: "Minimal", chars: MINIMAL_CHARS },
];

export interface AsciiResult {
  text: string;
  colors: string[][] | null; // 2D array of hex colors per character, null if not using source colors
}

/**
 * Maps a grayscale value (0-255) to a character from the set.
 */
const getChar = (gray: number, chars: string, invert: boolean): string => {
  const len = chars.length;
  // Map gray value to character index with proper distribution
  // Use (len) instead of (len - 1) to evenly distribute across all characters
  // Then clamp to valid range to handle edge case of gray = 255
  const index = Math.min(len - 1, Math.floor((gray / 255) * len));

  if (invert) {
    return chars[len - 1 - index];
  }
  return chars[index];
};

/**
 * Converts RGB to hex color string.
 */
const rgbToHex = (r: number, g: number, b: number): string => {
  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
};

/**
 * Applies brightness adjustment to a value.
 * brightness: -100 to 100, where 0 is neutral
 */
const applyBrightness = (value: number, brightness: number): number => {
  // Convert brightness from -100..100 to -255..255 range
  const adjustment = (brightness / 100) * 255;
  return Math.max(0, Math.min(255, value + adjustment));
};

/**
 * Applies contrast adjustment to a value.
 * contrast: -100 to 100, where 0 is neutral
 */
const applyContrast = (value: number, contrast: number): number => {
  // Convert contrast to a factor (0.5 to 2.0 range for -100 to 100)
  const factor = (contrast + 100) / 100;
  // Apply contrast around midpoint (128)
  return Math.max(0, Math.min(255, (value - 128) * factor + 128));
};

/**
 * Applies saturation adjustment to RGB values.
 * saturation: -100 to 100, where 0 is neutral, -100 is grayscale
 */
const applySaturation = (r: number, g: number, b: number, saturation: number): [number, number, number] => {
  const gray = 0.299 * r + 0.587 * g + 0.114 * b;
  const factor = (saturation + 100) / 100;
  return [
    Math.max(0, Math.min(255, gray + (r - gray) * factor)),
    Math.max(0, Math.min(255, gray + (g - gray) * factor)),
    Math.max(0, Math.min(255, gray + (b - gray) * factor))
  ];
};

/**
 * Converts ImageData to an ASCII string based on config.
 * When useSourceColor is true, also returns a 2D array of colors per character.
 */
export const convertToAscii = (
  imageData: ImageData,
  width: number,
  height: number,
  config: AsciiConfig
): AsciiResult => {
  const { data } = imageData;
  // Ensure we have at least one character to map to
  const chars = (config.chars && config.chars.length > 0) ? config.chars : DEFAULT_CHARS;
  let asciiStr = "";
  const colors: string[][] | null = config.useSourceColor ? [] : null;

  for (let y = 0; y < height; y++) {
    const rowColors: string[] = [];
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 4;
      const r = data[offset];
      const g = data[offset + 1];
      const b = data[offset + 2];
      const a = data[offset + 3];

      if (a === 0) {
        asciiStr += " "; // Transparent maps to space
        if (colors) rowColors.push('transparent');
      } else {
        // Apply adjustments
        const brightness = config.brightness || 0;
        const contrast = config.contrast || 0;
        const saturation = config.saturation || 0;

        // Apply saturation first (works on original colors)
        let [adjR, adjG, adjB] = applySaturation(r, g, b, saturation);

        // Apply brightness
        adjR = applyBrightness(adjR, brightness);
        adjG = applyBrightness(adjG, brightness);
        adjB = applyBrightness(adjB, brightness);

        // Apply contrast
        adjR = applyContrast(adjR, contrast);
        adjG = applyContrast(adjG, contrast);
        adjB = applyContrast(adjB, contrast);

        // Standard luminance formula with adjusted values
        const gray = 0.299 * adjR + 0.587 * adjG + 0.114 * adjB;
        asciiStr += getChar(gray, chars, config.invert);
        if (colors) rowColors.push(rgbToHex(Math.round(adjR), Math.round(adjG), Math.round(adjB)));
      }
    }
    if (colors) colors.push(rowColors);
    // Add newline at the end of each row
    asciiStr += "\n";
  }

  return { text: asciiStr, colors };
};

export const resizeAndGetImageData = (
  img: CanvasImageSource, // Accepts HTMLImageElement, HTMLVideoElement, ImageBitmap, HTMLCanvasElement etc.
  targetWidth: number,
  fontAspectRatio: number = 0.55,
  existingCanvas?: HTMLCanvasElement,
  overrideAspectRatio?: number
): ImageData | null => {
  // Reuse existing canvas if provided to avoid garbage collection stutter
  const canvas = existingCanvas || document.createElement('canvas');
  // Remove willReadFrequently to ensure we get the latest frame from video/gif sources
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Determine intrinsic dimensions
  let naturalWidth = 0;
  let naturalHeight = 0;

  if (img instanceof HTMLImageElement) {
    naturalWidth = img.naturalWidth;
    naturalHeight = img.naturalHeight;
  } else if (img instanceof HTMLVideoElement) {
    naturalWidth = img.videoWidth;
    naturalHeight = img.videoHeight;
  } else if (img instanceof ImageBitmap) {
    naturalWidth = img.width;
    naturalHeight = img.height;
  } else if (img instanceof HTMLCanvasElement) {
     naturalWidth = img.width;
     naturalHeight = img.height;
  }

  // Fallback if we couldn't get dimensions
  if (naturalWidth === 0 || naturalHeight === 0) {
     return null;
  }

  const sourceAspect = naturalHeight / naturalWidth;
  const targetAspect = (overrideAspectRatio && overrideAspectRatio > 0)
    ? overrideAspectRatio
    : sourceAspect;
  const aspectRatio = targetAspect;
  let sourceX = 0;
  let sourceY = 0;
  let sourceWidth = naturalWidth;
  let sourceHeight = naturalHeight;

  if (overrideAspectRatio && overrideAspectRatio > 0 && sourceAspect !== targetAspect) {
    if (targetAspect > sourceAspect) {
      sourceHeight = naturalHeight;
      sourceWidth = Math.round(naturalHeight / targetAspect);
      sourceX = Math.round((naturalWidth - sourceWidth) / 2);
    } else {
      sourceWidth = naturalWidth;
      sourceHeight = Math.round(naturalWidth * targetAspect);
      sourceY = Math.round((naturalHeight - sourceHeight) / 2);
    }

    sourceWidth = Math.max(1, Math.min(naturalWidth, sourceWidth));
    sourceHeight = Math.max(1, Math.min(naturalHeight, sourceHeight));
    sourceX = Math.max(0, Math.min(naturalWidth - sourceWidth, sourceX));
    sourceY = Math.max(0, Math.min(naturalHeight - sourceHeight, sourceY));
  }
  
  // Calculate Target Dimensions
  const finalWidth = Math.floor(Math.max(1, targetWidth));
  const finalHeight = Math.floor(Math.max(1, finalWidth * aspectRatio * fontAspectRatio));

  if (canvas.width !== finalWidth || canvas.height !== finalHeight) {
      canvas.width = finalWidth;
      canvas.height = finalHeight;
  } else {
      ctx.clearRect(0, 0, finalWidth, finalHeight);
  }
  
  try {
    ctx.drawImage(
      img,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      finalWidth,
      finalHeight
    );
    return ctx.getImageData(0, 0, finalWidth, finalHeight);
  } catch (e) {
    console.error("Failed to get image data", e);
    return null;
  }
};
