<div align="center">

# gif2ascii

Convert GIFs and images to ASCII art with real-time preview and export capabilities.

[Live Demo](https://latentfidelity.github.io/gif2ascii) · [Report Bug](https://github.com/latentfidelity/gif2ascii/issues)

</div>

## Features

- **Multiple formats**: GIF, PNG, JPEG, WebP support
- **13 character presets**: Standard, Dense, Blocks, Braille, Katakana, and more
- **Color modes**: Monochrome, source colors, or custom foreground/background
- **Image adjustments**: Brightness, contrast, saturation controls
- **Export options**: GIF, MP4, WebM, PNG
- **Tenor integration**: Search and convert GIFs directly (requires API key)
- **CLI tool**: Terminal-based playback with ANSI colors and Sixel support

## Quick Start

```bash
npm install
npm run dev
```

Open http://localhost:3000

## CLI Usage

```bash
npm run build:cli
npm link
gif2ascii input.gif --source-color
```

See `gif2ascii --help` for all options.

## Environment Variables

For Tenor GIF search, create a `.env` file:

```
VITE_TENOR_API_KEY=your_tenor_key_here
```

## License

[MIT](LICENSE)
