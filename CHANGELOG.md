# Changelog

All notable changes to this project will be documented in this file.

## [0.6.4] - 2025-12-22

### Added

- `storage` command - Manage localStorage and sessionStorage
  - `get <key>` - Retrieve value for a key
  - `set <key> <value>` - Store key-value pair (supports multi-word values)
  - `list` - List all storage keys
  - `clear` - Clear all storage
  - `export` - Export storage to JSON file
  - `import <file>` - Import storage from JSON file
  - `--session` flag to use sessionStorage instead of localStorage
  - `--path <file>` option for custom export file path

## [0.6.3] - 2025-12-22

### Added

- `cookies` command - Export/import/clear browser cookies for session persistence
  - `export` subcommand - Save cookies to JSON file for later use
  - `import` subcommand - Load cookies from JSON file into browser
  - `clear` subcommand - Delete all cookies from browser
  - `--path=<file>` option for export (default: cookies.json)
  - Useful for resuming authenticated sessions across browser restarts

## [0.6.2] - 2025-12-22

### Added

- `network` command - Stream network requests and responses in real-time
  - `--filter=<pattern>` option to filter URLs by regex pattern
  - `--json` flag for JSON output (useful for piping to jq)
  - `--errors` flag to only show failed requests (4xx/5xx status codes)
  - `--duration=N` option to auto-stop after N seconds
  - Color-coded output: cyan (requests), green (2xx), yellow (3xx), red (4xx/5xx)

## [0.6.1] - 2025-12-22

### Added

- `pdf` command - Export current page as PDF
  - `--path <file>` option for custom output location
  - `--format <format>` option for paper size (A4, Letter, Legal, Tabloid)
  - `--landscape` flag for landscape orientation

## [0.5.1] - 2025-12-22

### Added

- `--reload` / `-r` flag for `console` command - Reload page before capturing console output
- npm version badge in README

## [0.5.0] - 2025-12-21

### Added

- `dom` command - Capture full page DOM/HTML
- `--console` flag for `nav` command - Capture console output during navigation
  - Sets up CDP listeners before navigating, captures load-time errors
  - `--duration=N` option (default: 5s)
- `--console` flag for `eval` command - Capture console output during JS evaluation
  - Useful for debugging async operations, fetch calls, etc.
  - `--duration=N` option (default: 3s)

## [0.3.0] - 2025-12-21

### Added

- `console` command - Stream browser console output in real-time
  - Color-coded output by log type (log, info, warn, error, debug)
  - `--duration=N` option to auto-stop after N seconds
- `insights` command - Show page performance metrics
  - Timing metrics: TTFB, First Paint, FCP, DOM Content Loaded, LCP
  - Resource breakdown by type and size
  - JavaScript heap memory usage
  - `--json` option for machine-readable output

### Removed

- Comet browser support (incomplete CDP implementation)

## [0.2.1] - 2025-12-21

### Fixed

- Detect when browser is already running without CDP and show helpful error with options

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
