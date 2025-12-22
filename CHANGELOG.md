# Changelog

All notable changes to this project will be documented in this file.

## [0.2.0] - 2024-12-21

### Changed

- **Breaking:** `start` now uses real browser profile by default
- Removed `--profile` flag (no longer needed)
- Added `--isolated` flag for fresh profile in cache directory

### Fixed

- `nav` auto-adds `https://` for bare domains (e.g., `nav google.com`)

## [0.1.0] - 2024-12-21

### Added

- Initial release
- `start` command - Launch browser with CDP enabled
  - Support for Chrome, Brave, Comet, Edge
  - `--profile` flag to sync real browser profile
  - `--port` flag for custom debugging port
- `nav` command - Navigate to URLs
- `eval` command - Execute JavaScript in page context
- `screenshot` command - Capture page screenshots
- `pick` command - Interactive element picker
- Cross-platform support (macOS, Linux)
- Environment variables: `DEBUG_PORT`, `BROWSER`, `BROWSER_PATH`
- Auto-detection of running browser with CDP
