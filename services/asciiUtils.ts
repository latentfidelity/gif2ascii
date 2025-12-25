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
];

// Gamma correction constant (sRGB standard)
const GAMMA = 2.2;

/**
 * Pre-computed character density map for common characters.
 * Values represent approximate visual density (0 = empty, 1 = solid).
 * Measured by calculating pixel coverage of each character rendered in a monospace font.
 */
const CHAR_DENSITY_MAP: Record<string, number> = {
  ' ': 0.00, '.': 0.08, '·': 0.10, "'": 0.10, '`': 0.10, ',': 0.12,
  ':': 0.15, '-': 0.15, '"': 0.16, ';': 0.18, '!': 0.20, 'i': 0.22,
  'l': 0.22, 'I': 0.22, '1': 0.24, '^': 0.18, '~': 0.20, '+': 0.28,
  '?': 0.30, 'c': 0.32, 'r': 0.32, '*': 0.32, '/': 0.28, '\\': 0.28,
  '|': 0.25, '(': 0.28, ')': 0.28, 't': 0.32, 'f': 0.30, 'j': 0.30,
  '[': 0.30, ']': 0.30, '{': 0.32, '}': 0.32, 'x': 0.38, 'v': 0.36,
  'n': 0.40, 'u': 0.40, 'z': 0.38, 'L': 0.32, 'T': 0.34, 'Y': 0.34,
  'J': 0.34, 'C': 0.38, 'U': 0.42, '7': 0.34, '2': 0.42, '3': 0.42,
  '=': 0.36, 's': 0.38, 'o': 0.42, 'a': 0.42, 'e': 0.42, '5': 0.44,
  'S': 0.44, 'F': 0.38, 'P': 0.42, 'k': 0.42, 'h': 0.44, 'd': 0.44,
  'b': 0.44, 'p': 0.44, 'q': 0.44, 'w': 0.48, 'm': 0.52, 'Z': 0.46,
  'O': 0.46, '0': 0.48, 'Q': 0.50, 'X': 0.48, 'K': 0.46, 'V': 0.42,
  'A': 0.46, 'H': 0.50, 'N': 0.52, 'E': 0.46, 'R': 0.48, 'D': 0.48,
  'G': 0.50, 'B': 0.54, '4': 0.44, '6': 0.48, '8': 0.54, '9': 0.48,
  '#': 0.58, '%': 0.56, '&': 0.56, 'W': 0.58, 'M': 0.60, '@': 0.68,
  '$': 0.58,
  // Unicode blocks
  '░': 0.25, '▒': 0.50, '▓': 0.75, '█': 1.00,
  // Braille (approximate)
  '⡀': 0.125, '⣀': 0.25, '⣄': 0.31, '⣤': 0.375, '⣦': 0.44, '⣴': 0.50,
  '⣶': 0.56, '⣾': 0.69, '⣽': 0.75, '⣻': 0.81, '⢿': 0.81, '⡿': 0.81,
  '⣟': 0.875, '⣯': 0.875, '⣷': 0.875, '⣿': 1.00,
  // Dots
  '○': 0.25, '◎': 0.40, '◉': 0.55, '●': 0.70,
  // Stars
  '✧': 0.20, '✦': 0.35, '☆': 0.30, '★': 0.55,
  // Crosses
  '┼': 0.30, '╪': 0.40, '╫': 0.45, '╬': 0.55,
};

/**
 * Calculates the visual density of a character.
 * Uses pre-computed map or estimates based on character properties.
 */
const getCharDensity = (char: string): number => {
  if (CHAR_DENSITY_MAP[char] !== undefined) {
    return CHAR_DENSITY_MAP[char];
  }
  // For unknown characters, estimate based on Unicode code point
  // CJK and complex scripts tend to be denser
  const code = char.charCodeAt(0);
  if (code >= 0x3040 && code <= 0x30FF) return 0.55; // Hiragana/Katakana
  if (code >= 0x4E00 && code <= 0x9FFF) return 0.65; // CJK
  if (code >= 0x2800 && code <= 0x28FF) {
    // Braille - count dots
    const dots = (code - 0x2800).toString(2).split('1').length - 1;
    return dots / 8;
  }
  return 0.40; // Default mid-range
};

/**
 * Builds a sorted density array for a character set.
 * Returns characters sorted by density with their density values.
 */
const buildDensityArray = (chars: string): { char: string; density: number }[] => {
  const arr = Array.from(chars).map(char => ({
    char,
    density: getCharDensity(char)
  }));
  // Sort by density (darkest first for standard mapping)
  arr.sort((a, b) => b.density - a.density);
  return arr;
};

// Cache for density arrays per character set
const densityArrayCache = new Map<string, { char: string; density: number }[]>();

const getDensityArray = (chars: string): { char: string; density: number }[] => {
  if (!densityArrayCache.has(chars)) {
    densityArrayCache.set(chars, buildDensityArray(chars));
  }
  return densityArrayCache.get(chars)!;
};

/**
 * Apply gamma correction to linearize a value.
 */
const gammaCorrect = (value: number): number => {
  return Math.pow(value / 255, GAMMA) * 255;
};

/**
 * Apply inverse gamma for display.
 */
const inverseGamma = (value: number): number => {
  return Math.pow(value / 255, 1 / GAMMA) * 255;
};

export interface AsciiResult {
  text: string;
  colors: string[][] | null; // 2D array of hex colors per character, null if not using source colors
}

/**
 * Maps a grayscale value (0-255) to a character using density-calibrated mapping.
 * Finds the character whose visual density best matches the target brightness.
 * Note: sRGB input is already perceptually encoded, so we use direct mapping
 * with calibrated character densities for accurate luminance representation.
 */
const getCharByDensity = (
  gray: number,
  densityArray: { char: string; density: number }[],
  invert: boolean
): string => {
  // Convert to target density (0 = dark/dense, 1 = light/empty)
  // Gray 0 = black = need dense character, Gray 255 = white = need empty character
  // sRGB is already perceptually encoded, so direct mapping works well
  let targetDensity = 1 - (gray / 255);

  if (invert) {
    targetDensity = 1 - targetDensity;
  }

  // Find character with closest density using binary search
  let left = 0;
  let right = densityArray.length - 1;

  while (left < right) {
    const mid = Math.floor((left + right) / 2);
    if (densityArray[mid].density > targetDensity) {
      left = mid + 1;
    } else {
      right = mid;
    }
  }

  // Check neighbors for closest match
  let bestIdx = left;
  let bestDiff = Math.abs(densityArray[left].density - targetDensity);

  if (left > 0) {
    const diff = Math.abs(densityArray[left - 1].density - targetDensity);
    if (diff < bestDiff) {
      bestIdx = left - 1;
      bestDiff = diff;
    }
  }
  if (left < densityArray.length - 1) {
    const diff = Math.abs(densityArray[left + 1].density - targetDensity);
    if (diff < bestDiff) {
      bestIdx = left + 1;
    }
  }

  return densityArray[bestIdx].char;
};

/**
 * Legacy linear mapping for backwards compatibility.
 */
const getChar = (gray: number, chars: string, invert: boolean): string => {
  const len = chars.length;
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
 * Uses density-calibrated character mapping and optional Floyd-Steinberg dithering.
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
  const densityArray = getDensityArray(chars);

  // Create a copy of grayscale values for dithering
  const grayValues = new Float32Array(width * height);
  const adjustedColors: [number, number, number][] = new Array(width * height);

  // First pass: calculate all gray values and adjusted colors
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const offset = idx * 4;
      const r = data[offset];
      const g = data[offset + 1];
      const b = data[offset + 2];
      const a = data[offset + 3];

      if (a === 0) {
        grayValues[idx] = -1; // Mark as transparent
        adjustedColors[idx] = [0, 0, 0];
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
        grayValues[idx] = gray;
        adjustedColors[idx] = [adjR, adjG, adjB];
      }
    }
  }

  // Apply Floyd-Steinberg dithering if enabled
  if (config.dithering) {
    // Get the density range for error quantization
    const minDensity = densityArray[densityArray.length - 1].density;
    const maxDensity = densityArray[0].density;
    const densityRange = maxDensity - minDensity;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;

        if (grayValues[idx] < 0) continue; // Skip transparent

        const oldGray = grayValues[idx];

        // Find the character that would be selected and its target gray
        let targetDensity = 1 - (oldGray / 255);
        if (config.invert) targetDensity = 1 - targetDensity;

        // Quantize to nearest available density level
        let closestDensity = densityArray[0].density;
        let closestDiff = Math.abs(closestDensity - targetDensity);
        for (let i = 1; i < densityArray.length; i++) {
          const diff = Math.abs(densityArray[i].density - targetDensity);
          if (diff < closestDiff) {
            closestDiff = diff;
            closestDensity = densityArray[i].density;
          }
        }

        // Calculate quantization error in gray space
        const quantizedDensity = config.invert ? closestDensity : (1 - closestDensity);
        const quantizedGray = quantizedDensity * 255;
        const error = oldGray - quantizedGray;

        // Distribute error to neighbors (Floyd-Steinberg coefficients)
        if (x + 1 < width && grayValues[idx + 1] >= 0) {
          grayValues[idx + 1] = Math.max(0, Math.min(255, grayValues[idx + 1] + error * 7 / 16));
        }
        if (y + 1 < height) {
          if (x > 0 && grayValues[idx + width - 1] >= 0) {
            grayValues[idx + width - 1] = Math.max(0, Math.min(255, grayValues[idx + width - 1] + error * 3 / 16));
          }
          if (grayValues[idx + width] >= 0) {
            grayValues[idx + width] = Math.max(0, Math.min(255, grayValues[idx + width] + error * 5 / 16));
          }
          if (x + 1 < width && grayValues[idx + width + 1] >= 0) {
            grayValues[idx + width + 1] = Math.max(0, Math.min(255, grayValues[idx + width + 1] + error * 1 / 16));
          }
        }
      }
    }
  }

  // Second pass: generate ASCII output
  let asciiStr = "";
  const colors: string[][] | null = config.useSourceColor ? [] : null;

  for (let y = 0; y < height; y++) {
    const rowColors: string[] = [];
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const gray = grayValues[idx];

      if (gray < 0) {
        asciiStr += " "; // Transparent maps to space
        if (colors) rowColors.push('transparent');
      } else {
        // Use density-calibrated mapping
        asciiStr += getCharByDensity(gray, densityArray, config.invert);
        if (colors) {
          const [adjR, adjG, adjB] = adjustedColors[idx];
          rowColors.push(rgbToHex(Math.round(adjR), Math.round(adjG), Math.round(adjB)));
        }
      }
    }
    if (colors) colors.push(rowColors);
    asciiStr += "\n";
  }

  return { text: asciiStr, colors };
};

/**
 * Applies an unsharp mask filter to enhance edges and details.
 * This is applied before downsampling for better ASCII art quality.
 * @param imageData - The image data to sharpen
 * @param amount - Sharpening strength (0-100, where 0 is no sharpening)
 */
const applyUnsharpMask = (
  imageData: ImageData,
  amount: number
): ImageData => {
  if (amount <= 0) return imageData;

  const { data, width, height } = imageData;
  const strength = amount / 100; // Normalize to 0-1
  const result = new Uint8ClampedArray(data.length);

  // Copy original data
  result.set(data);

  // 3x3 Gaussian blur kernel (simplified)
  const kernel = [
    1/16, 2/16, 1/16,
    2/16, 4/16, 2/16,
    1/16, 2/16, 1/16
  ];

  // Apply unsharp mask: sharpened = original + strength * (original - blurred)
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;

      for (let c = 0; c < 3; c++) { // RGB channels only
        // Calculate blurred value
        let blurred = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const kidx = ((y + ky) * width + (x + kx)) * 4 + c;
            blurred += data[kidx] * kernel[(ky + 1) * 3 + (kx + 1)];
          }
        }

        // Unsharp mask formula
        const original = data[idx + c];
        const sharpened = original + strength * 2 * (original - blurred);
        result[idx + c] = Math.max(0, Math.min(255, Math.round(sharpened)));
      }
      // Keep alpha unchanged
      result[idx + 3] = data[idx + 3];
    }
  }

  return new ImageData(result, width, height);
};

export const resizeAndGetImageData = (
  img: CanvasImageSource, // Accepts HTMLImageElement, HTMLVideoElement, ImageBitmap, HTMLCanvasElement etc.
  targetWidth: number,
  fontAspectRatio: number = 0.55,
  existingCanvas?: HTMLCanvasElement,
  overrideAspectRatio?: number,
  sharpness: number = 0
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

  // Use high-quality image smoothing for better downsampling
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

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

    let imageData = ctx.getImageData(0, 0, finalWidth, finalHeight);

    // Apply sharpening filter if enabled
    if (sharpness > 0) {
      imageData = applyUnsharpMask(imageData, sharpness);
    }

    return imageData;
  } catch (e) {
    console.error("Failed to get image data", e);
    return null;
  }
};
