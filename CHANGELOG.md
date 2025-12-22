# Changelog

All notable changes to this project will be documented in this file.

## [0.1.0] - 2024-12-21

### Added

- Initial release
- `start` command - Launch browser with CDP enabled
  - Support for Chrome, Brave, Comet, Edge
  - `--profile` flag to sync real browser profile (cookies, logins)
  - `--port` flag for custom debugging port
- `nav` command - Navigate to URLs
- `eval` command - Execute JavaScript in page context
- `screenshot` command - Capture page screenshots
- `pick` command - Interactive element picker
- Cross-platform support (macOS, Linux)
- Environment variables: `DEBUG_PORT`, `BROWSER`, `BROWSER_PATH`
- Auto-detection of running browser with CDP
