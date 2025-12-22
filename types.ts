export interface AsciiConfig {
  resolution: number; // Width in characters
  chars: string; // The character set (darkest to lightest)
  color: string; // Text color hex
  backgroundColor: string; // Background color hex
  invert: boolean;
  fontAspectRatio: number; // Aspect ratio of the font character (width/height), typically ~0.55
  overlayOpacity: number; // Opacity of the original image behind the ASCII (0-1)
  useSourceColor: boolean; // Use original image colors for ASCII characters
  brightness: number; // Brightness adjustment (-100 to 100, 0 is neutral)
  contrast: number; // Contrast adjustment (-100 to 100, 0 is neutral)
  saturation: number; // Saturation adjustment (-100 to 100, 0 is neutral)
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
