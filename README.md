# browser-cdp

[![npm version](https://img.shields.io/npm/v/browser-cdp.svg)](https://www.npmjs.com/package/browser-cdp)

Browser automation via Chrome DevTools Protocol. Control Chrome, Brave, or Edge using your real browser - same fingerprint, real cookies, no automation detection.

## Install

```bash
npm install -g browser-cdp
```

## Usage

```bash
# Start browser with CDP enabled
browser-cdp start [browser] [--profile=NAME] [--isolated] [--port=PORT]

# Close the browser
browser-cdp close

# Navigate to URL
browser-cdp nav <url> [--new]

# Execute JavaScript in page
browser-cdp eval '<code>'

# Take screenshot
browser-cdp screenshot

# Export page as PDF
browser-cdp pdf [--path=FILE] [--format=A4|Letter|Legal|Tabloid] [--landscape]

# Interactive element picker
browser-cdp pick '<message>'

# Stream browser console output (network errors, exceptions, logs)
browser-cdp console [--duration=SECONDS]

# Show page performance metrics
browser-cdp insights [--json]

# Run Lighthouse audit (Chrome only)
browser-cdp lighthouse [--json] [--category=NAME]
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DEBUG_PORT` | CDP debugging port | `9222` |
| `BROWSER` | Browser to use (chrome, brave, edge) | `chrome` |
| `BROWSER_PATH` | Custom browser executable path | (auto-detect) |

## Examples

```bash
# Start Brave with real profile
browser-cdp start brave

# Start Brave with specific profile (by name)
browser-cdp start brave --profile=Work

# Start Chrome on custom port
DEBUG_PORT=9333 browser-cdp start

# Navigate and search
browser-cdp nav https://google.com
browser-cdp eval 'document.querySelector("textarea").value = "hello"'

# Take screenshot
browser-cdp screenshot
# Returns: /tmp/screenshot-2024-01-01T12-00-00.png

# Export page as PDF
browser-cdp pdf
# Returns: /tmp/pdf-2024-01-01T12-00-00.pdf

# Export to specific file in A4 landscape
browser-cdp pdf --path report.pdf --format A4 --landscape

# Pick elements interactively
browser-cdp pick "Select the login button"

# Stream console output (captures network errors, exceptions, console.log)
browser-cdp console
# Then refresh the page to see errors

# Stream console for 10 seconds
browser-cdp console --duration=10

# Get page performance insights
browser-cdp insights
# Returns: TTFB, First Paint, FCP, DOM loaded, resources, memory

# Run Lighthouse audit (Chrome only - Brave blocks CDP debugger)
browser-cdp start chrome --isolated
browser-cdp nav https://example.com
browser-cdp lighthouse
# Returns: Performance, Accessibility, Best Practices, SEO scores

# Close browser when done
browser-cdp close
```

## Pre-started Browser

If you already have a browser running with CDP enabled, the CLI will connect to it:

```bash
# Add to ~/.zshrc
alias brave-debug='/Applications/Brave\ Browser.app/Contents/MacOS/Brave\ Browser --remote-debugging-port=9222'

# Start browser manually
brave-debug

# CLI detects and connects
browser-cdp start  # "Browser already running on :9222"
browser-cdp nav https://example.com
```

## Supported Browsers

| Browser | Command |
|---------|---------|
| Chrome | `chrome` (default) |
| Brave | `brave` |
| Edge | `edge` |

## Platform Support

Works on **macOS** and **Linux**. Browser paths auto-detected per platform.

| Platform | Chrome Path | Config Path |
|----------|-------------|-------------|
| macOS | `/Applications/Google Chrome.app/...` | `~/Library/Application Support/Google/Chrome/` |
| Linux | `/usr/bin/google-chrome` | `~/.config/google-chrome/` |

Use `BROWSER_PATH` env var to override if your browser is installed elsewhere.

## Why Real Browser?

| Aspect | browser-cdp | Playwright Test Mode |
|--------|-------------|---------------------|
| Browser | Your installed Chrome/Brave/etc | Bundled Chromium |
| Profile | Real cookies/logins by default | Fresh test profile |
| Detection | Not detectable as automation | Automation flags present |
| Use case | Real-world testing, scraping | Isolated E2E tests |

## Development

```bash
# Install dependencies
bun install

# Run all tests
bun run test

# Run unit tests only (fast, no browser needed)
bun run test:unit

# Run integration tests (requires browser)
bun run test:integration

# Watch mode
bun run test:watch
```

## See Also

- [dev-browser](https://github.com/SawyerHood/dev-browser) - Browser automation plugin for Claude Code with LLM-optimized DOM snapshots

## License

MIT
