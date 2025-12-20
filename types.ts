export interface AsciiConfig {
  resolution: number; // Width in characters
  chars: string; // The character set (darkest to lightest)
  color: string; // Text color hex
  backgroundColor: string; // Background color hex
  invert: boolean;
  fontAspectRatio: number; // Aspect ratio of the font character (width/height), typically ~0.55
  overlayOpacity: number; // Opacity of the original image behind the ASCII (0-1)
}

export interface GeminiAnalysisResult {
  caption: string;
  moodColor: string;
  recommendedChars: string;
  theme: string;
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
