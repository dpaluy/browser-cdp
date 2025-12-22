#!/usr/bin/env node

import { spawn, execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { platform } from "node:os";
import { chromium } from "playwright";

const isMac = platform() === "darwin";
const isLinux = platform() === "linux";

// Browser configurations per platform
const BROWSERS = {
  chrome: {
    name: "Google Chrome",
    path: isMac
      ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
      : "/usr/bin/google-chrome",
    process: "Google Chrome",
    profileSource: isMac
      ? `${process.env.HOME}/Library/Application Support/Google/Chrome/`
      : `${process.env.HOME}/.config/google-chrome/`,
  },
  brave: {
    name: "Brave",
    path: isMac
      ? "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser"
      : "/usr/bin/brave-browser",
    process: "Brave Browser",
    profileSource: isMac
      ? `${process.env.HOME}/Library/Application Support/BraveSoftware/Brave-Browser/`
      : `${process.env.HOME}/.config/BraveSoftware/Brave-Browser/`,
  },
  comet: {
    name: "Comet",
    path: isMac ? "/Applications/Comet.app/Contents/MacOS/Comet" : "/usr/bin/comet",
    process: "Comet",
    profileSource: null,
  },
  edge: {
    name: "Microsoft Edge",
    path: isMac
      ? "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"
      : "/usr/bin/microsoft-edge",
    process: "Microsoft Edge",
    profileSource: isMac
      ? `${process.env.HOME}/Library/Application Support/Microsoft Edge/`
      : `${process.env.HOME}/.config/microsoft-edge/`,
  },
};

const DEFAULT_PORT = 9222;

function printUsage() {
  console.log("Usage: start.js [browser] [--isolated] [--port=PORT]");
  console.log("\nBrowsers:");
  console.log("  chrome  - Google Chrome (default)");
  console.log("  brave   - Brave Browser");
  console.log("  comet   - Comet Browser");
  console.log("  edge    - Microsoft Edge");
  console.log("\nOptions:");
  console.log("  --isolated  Use isolated profile (default: real profile)");
  console.log("  --port=N    Use custom debugging port (default: 9222)");
  console.log("\nEnvironment variables:");
  console.log("  BROWSER       Default browser (chrome, brave, comet, edge)");
  console.log("  BROWSER_PATH  Custom browser executable path");
  console.log("  DEBUG_PORT    Custom debugging port");
  console.log("\nExamples:");
  console.log("  start.js                    # Start Chrome with real profile");
  console.log("  start.js brave              # Start Brave with real profile");
  console.log("  start.js comet --isolated   # Start Comet with isolated profile");
  console.log("  start.js --port=9333        # Start Chrome on port 9333");
  process.exit(1);
}

// Parse arguments
const args = process.argv.slice(2);
let browserName = process.env.BROWSER || "chrome";
let isolated = false;
let port = parseInt(process.env.DEBUG_PORT) || DEFAULT_PORT;

for (const arg of args) {
  if (arg === "--help" || arg === "-h") {
    printUsage();
  } else if (arg === "--isolated") {
    isolated = true;
  } else if (arg.startsWith("--port=")) {
    port = parseInt(arg.split("=")[1]);
  } else if (BROWSERS[arg]) {
    browserName = arg;
  } else if (!arg.startsWith("--")) {
    console.error(`Unknown browser: ${arg}`);
    console.log(`Available: ${Object.keys(BROWSERS).join(", ")}`);
    process.exit(1);
  }
}

// Resolve browser config
const browserPath = process.env.BROWSER_PATH || BROWSERS[browserName]?.path;
const browserConfig = BROWSERS[browserName] || {
  name: "Custom",
  path: browserPath,
  process: null,
  profileSource: null,
};

if (!browserPath) {
  console.error("No browser path specified");
  printUsage();
}

if (!existsSync(browserPath)) {
  console.error(`Browser not found: ${browserPath}`);
  process.exit(1);
}

// Check if port is available or has a browser with CDP
try {
  const response = await fetch(`http://localhost:${port}/json/version`);
  if (response.ok) {
    // CDP endpoint responded - browser already running
    console.log(`Browser already running on :${port}`);
    process.exit(0);
  } else {
    // Port occupied by non-CDP process
    console.error(`Error: Port ${port} is in use by another process (not a browser with CDP)`);
    console.error(`Try a different port: ./start.js --port=9333`);
    process.exit(1);
  }
} catch (err) {
  if (err.cause?.code === "ECONNREFUSED") {
    // Port is free, proceed to start browser
  } else {
    // Port occupied but not responding to CDP
    console.error(`Error: Port ${port} is in use by another process`);
    console.error(`Try a different port: ./start.js --port=9333`);
    process.exit(1);
  }
}

// Check if browser is already running without CDP (only matters for real profile)
if (!isolated && browserConfig.process) {
  try {
    const pgrepArgs = isMac
      ? ["-x", browserConfig.process]
      : ["-f", browserConfig.path];
    const result = execFileSync("pgrep", pgrepArgs, { encoding: "utf8" }).trim();
    if (result) {
      console.error(`Error: ${browserConfig.name} is already running without CDP enabled.`);
      console.error("");
      console.error("When a browser is already open, launching it again just opens a new");
      console.error("window in the existing process - the CDP flag is ignored.");
      console.error("");
      console.error("Options:");
      console.error(`  1. Quit ${browserConfig.name} and run this command again`);
      console.error(`  2. Use --isolated flag: browser-cdp start ${browserName} --isolated`);
      console.error("     (creates separate instance, but without your cookies/logins)");
      process.exit(1);
    }
  } catch {
    // pgrep returns non-zero if no match - browser not running, proceed
  }
}

// Build browser arguments
const browserArgs = [`--remote-debugging-port=${port}`];

if (isolated) {
  const cacheBase = isMac
    ? `${process.env.HOME}/Library/Caches`
    : `${process.env.HOME}/.cache`;
  const profileDir = `${cacheBase}/browser-cdp/${browserName}`;
  execFileSync("mkdir", ["-p", profileDir], { stdio: "ignore" });
  browserArgs.push(`--user-data-dir=${profileDir}`);
}

// Start browser
console.log(`Starting ${browserConfig.name} on port ${port}${isolated ? " (isolated)" : ""}...`);

spawn(browserPath, browserArgs, {
  detached: true,
  stdio: "ignore",
}).unref();

// Wait for browser to be ready
let connected = false;
for (let i = 0; i < 30; i++) {
  try {
    const browser = await chromium.connectOverCDP(`http://localhost:${port}`);
    await browser.close();
    connected = true;
    break;
  } catch {
    await new Promise((r) => setTimeout(r, 500));
  }
}

if (!connected) {
  console.error(`Failed to connect to ${browserConfig.name} on port ${port}`);
  process.exit(1);
}

console.log(`${browserConfig.name} started on :${port}${isolated ? " (isolated)" : ""}`);
