import { AsciiConfig } from '../types';

export const DEFAULT_CHARS = "@%#*+=-:. ";
export const DENSE_CHARS = "$@B%8&WM#*oahkbdpqwmZO0QLCJUYXzcvunxrjft/\\|()1{}[]?-_+~<>i!lI;:,\"^`'. ";

/**
 * Maps a grayscale value (0-255) to a character from the set.
 */
const getChar = (gray: number, chars: string, invert: boolean): string => {
  const len = chars.length;
  // If invert is true, 0 maps to last char, 255 to first
  const index = Math.floor((gray / 255) * (len - 1));
  const safeIndex = Math.max(0, Math.min(len - 1, index));
  
  if (invert) {
    return chars[len - 1 - safeIndex];
  }
  return chars[safeIndex];
};

/**
 * Converts ImageData to an ASCII string based on config.
 */
export const convertToAscii = (
  imageData: ImageData, 
  width: number, 
  height: number, 
  config: AsciiConfig
): string => {
  const { data } = imageData;
  // Ensure we have at least one character to map to
  const chars = (config.chars && config.chars.length > 0) ? config.chars : DEFAULT_CHARS;
  let asciiStr = "";

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 4;
      const r = data[offset];
      const g = data[offset + 1];
      const b = data[offset + 2];
      const a = data[offset + 3];

      if (a === 0) {
        asciiStr += " "; // Transparent maps to space
      } else {
        // Standard luminance formula
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;
        asciiStr += getChar(gray, chars, config.invert);
      }
    }
    // Add newline at the end of each row
    asciiStr += "\n";
  }

  return asciiStr;
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
