# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- **Image adjustments**: Brightness, contrast, and saturation sliders (-100 to +100)
- **Edge detection mode**: Sobel filter for outline/contour ASCII effects
- **URL input**: Load images directly from URLs in the web app
- **Reset settings**: Button to restore all settings to defaults
- **Collapsible settings panels**: Output, Colors, Adjustments, Characters, and Export sections
- **Numeric dimension input**: Direct number entry for output width/height alongside sliders
- **Character preset dropdown**: Quick access to all character sets (Standard, Dense, Blocks, Simple, Binary, Braille)

### Changed
- Reorganized settings UI into collapsible sections for better organization

## [2024-12-22] - d1f8d3f

### Added
- Source color mode preserving original image colors for ASCII characters
- Static image support (PNG, JPEG, WebP) with magic byte detection
- CLI tool with terminal playback, Sixel mode, and script export

## Previous Changes

- **a831222**: Fix slider responsiveness using useDeferredValue
- **0153048**: Change default text color to white and disable 2x export by default
- **b61f3e7**: Add 2x export resolution toggle for GIF and video exports
- **664150a**: Fix Tenor panel overflow by using flex layout constraints
- **d49d1ae**: Add infinite scroll to Tenor search panel with hidden scrollbar
- **74639b2**: Add Floyd-Steinberg dithering to GIF export
