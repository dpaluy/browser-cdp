# browser-cdp

Browser automation via Chrome DevTools Protocol. Control Chrome, Brave, Comet, or Edge using your real browser - same fingerprint, real cookies, no automation detection.

## Install

```bash
npm install -g browser-cdp
```

## Usage

```bash
# Start browser with CDP enabled
browser-cdp start [browser] [--profile] [--port=PORT]

# Navigate to URL
browser-cdp nav <url> [--new]

# Execute JavaScript in page
browser-cdp eval '<code>'

# Take screenshot
browser-cdp screenshot

# Interactive element picker
browser-cdp pick '<message>'
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DEBUG_PORT` | CDP debugging port | `9222` |
| `BROWSER` | Browser to use (chrome, brave, comet, edge) | `chrome` |
| `BROWSER_PATH` | Custom browser executable path | (auto-detect) |

## Examples

```bash
# Start Brave with your profile
browser-cdp start brave --profile

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

| Browser | Command | Profile Support |
|---------|---------|-----------------|
| Chrome | `chrome` (default) | Yes |
| Brave | `brave` | Yes |
| Comet | `comet` | No |
| Edge | `edge` | Yes |

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
| Profile | Can use real cookies/logins | Fresh test profile |
| Detection | Not detectable as automation | Automation flags present |
| Use case | Real-world testing, scraping | Isolated E2E tests |

## License

MIT
