# browser-cdp

Browser automation via Chrome DevTools Protocol. Control Chrome, Brave, or Edge using your real browser - same fingerprint, real cookies, no automation detection.

## Install

```bash
npm install -g browser-cdp
```

## Usage

```bash
# Start browser with CDP enabled
browser-cdp start [browser] [--isolated] [--port=PORT]

# Navigate to URL
browser-cdp nav <url> [--new]

# Execute JavaScript in page
browser-cdp eval '<code>'

# Take screenshot
browser-cdp screenshot

# Interactive element picker
browser-cdp pick '<message>'

# Stream browser console output
browser-cdp console [--duration=SECONDS]

# Show page performance metrics
browser-cdp insights [--json]
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

# Start Chrome on custom port
DEBUG_PORT=9333 browser-cdp start

# Navigate and search
browser-cdp nav https://google.com
browser-cdp eval 'document.querySelector("textarea").value = "hello"'

# Take screenshot
browser-cdp screenshot
# Returns: /tmp/screenshot-2024-01-01T12-00-00.png

# Pick elements interactively
browser-cdp pick "Select the login button"

# Stream console output for 10 seconds
browser-cdp console --duration=10

# Get page performance insights
browser-cdp insights
# Returns: TTFB, First Paint, FCP, DOM loaded, resources, memory

# Get insights as JSON
browser-cdp insights --json
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

## License

MIT
