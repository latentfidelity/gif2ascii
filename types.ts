export interface PostProcessingConfig {
  scanlines: number;        // 0-300: CRT scanline intensity
  glow: number;             // 0-300: Phosphor glow/bloom intensity
  chromaticAberration: number; // 0-300: RGB split effect
  noise: number;            // 0-300: Static noise overlay
  vignette: number;         // 0-300: Edge darkening
  flicker: number;          // 0-300: Brightness flicker (for animation)
}

export interface AnimationEffectsConfig {
  matrixRain: number;      // 0-300: Matrix-style falling characters intensity
  waveDistortion: number;  // 0-300: Horizontal wave distortion
  typingReveal: boolean;   // Typing effect for static images
}

export type PlaybackLoopMode = 'forever' | 'once';

export interface AsciiConfig {
  resolution: number; // Width in characters
  chars: string; // The character set (darkest to lightest)
  color: string; // Text color hex
  backgroundColor: string; // Background color hex
  invert: boolean;
  fontAspectRatio: number; // Aspect ratio of the font character (width/height), typically ~0.55
  overlayOpacity: number; // Opacity of the original image behind the ASCII (0-1)
  useSourceColor: boolean; // Use original image colors for ASCII characters
  brightness: number; // Brightness adjustment (-300 to 300, 0 is neutral)
  contrast: number; // Contrast adjustment (-300 to 300, 0 is neutral)
  saturation: number; // Saturation adjustment (-300 to 300, 0 is neutral)
  dithering: boolean; // Enable Floyd-Steinberg dithering for smoother gradients
  sharpness: number; // Pre-sharpening filter strength (0-300, 0 is off)
  colorPalette: string; // Color palette ID for retro effects (e.g., 'gameboy', 'c64', 'none')
  postProcessing: PostProcessingConfig; // CRT and visual effects
  animationEffects: AnimationEffectsConfig; // Animated effects (matrix rain, wave, etc.)
}

export interface AsciiFrame {
  text: string;
}

export enum AppState {
  IDLE = 'IDLE',
  PROCESSING = 'PROCESSING',
  PLAYING = 'PLAYING',
  ERROR = 'ERROR'
}
