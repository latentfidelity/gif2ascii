# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Run Commands

- **Development server**: `npm run dev` (runs on port 3000)
- **Production build**: `npm run build`
- **Preview production build**: `npm run preview`

No linting or test scripts are configured.

## Environment Variables

Create a `.env` file in the project root for optional Tenor GIF search:
```
VITE_TENOR_API_KEY=your_tenor_key_here
```

## Architecture

Gif2Ascii is a React-based web app that converts GIF animations to ASCII art rendered on canvas, with export capabilities.

### Core Flow

1. **FileUpload** accepts GIF/image files via drag-drop or file picker
2. **TenorSearch** provides inline GIF search (requires API key in `.env`)
3. **App** manages configuration state (density, colors, font aspect ratio, output dimensions)
4. **AsciiPlayer** handles:
   - GIF parsing via `gifuct-js` (decompresses frames with proper disposal handling)
   - Frame composition on an offscreen canvas (handles GIF disposal types 2/3)
   - ASCII conversion via `services/asciiUtils.ts`
   - Canvas rendering with JetBrains Mono font
   - Export to GIF (`gifenc`) or WebM (MediaRecorder API)

### Key Files

- `App.tsx` - Main component with all render settings state
- `components/AsciiPlayer.tsx` - Core playback/rendering/export logic (~680 lines)
- `components/TenorSearch.tsx` - Tenor API integration with debounced search
- `services/asciiUtils.ts` - Image-to-ASCII conversion algorithms
- `types.ts` - TypeScript interfaces (AsciiConfig, AsciiFrame, AppState)

### ASCII Conversion Pipeline

`resizeAndGetImageData()` → scales source to target resolution accounting for font aspect ratio → `convertToAscii()` → maps pixel luminance to character set

The character map goes from dark to light (e.g., `@%#*+=-:. `). The `invert` flag reverses this mapping.

### GIF Frame Handling

Uses a composition canvas pattern: each frame's patch is drawn onto a persistent canvas, respecting GIF disposal types. The composition canvas represents the current visual state that gets converted to ASCII.

### Tenor Proxy

In development/preview, Vite proxies `/tenor` to `https://tenor.googleapis.com` to avoid CORS issues. In production (GitHub Pages), API calls go directly to Tenor's endpoint. See `vite.config.ts`.

### Styling

Uses Tailwind CSS via CDN (in index.html). Fonts: Inter for UI, JetBrains Mono for ASCII rendering.

### Path Alias

`@` is aliased to the project root in `vite.config.ts`.

### Deployment

Production build uses `/gif2ascii/` base path. GitHub Actions automatically deploys to GitHub Pages on push to `main` (see `.github/workflows/deploy.yml`).