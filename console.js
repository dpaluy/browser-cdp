#!/usr/bin/env node

import { chromium } from "playwright";

const DEFAULT_PORT = process.env.DEBUG_PORT || 9222;

const args = process.argv.slice(2);
const duration = args.find((a) => a.startsWith("--duration="));
const durationMs = duration ? parseInt(duration.split("=")[1]) * 1000 : null;
const showHelp = args.includes("--help") || args.includes("-h");

if (showHelp) {
  console.log("Usage: console.js [--duration=SECONDS]");
  console.log("\nCapture browser console output in real-time.");
  console.log("\nOptions:");
  console.log("  --duration=N  Stop after N seconds (default: run until Ctrl+C)");
  console.log("\nExamples:");
  console.log("  console.js              # Stream console logs until Ctrl+C");
  console.log("  console.js --duration=5 # Capture for 5 seconds");
  process.exit(0);
}

const browser = await chromium.connectOverCDP(`http://localhost:${DEFAULT_PORT}`);
const contexts = browser.contexts();
const context = contexts[0];

if (!context) {
  console.error("No browser context found");
  process.exit(1);
}

const pages = context.pages();
// Filter out devtools pages and pick a real page
const realPages = pages.filter(p => {
  const url = p.url();
  return url.startsWith("http://") || url.startsWith("https://");
});
const page = realPages[realPages.length - 1] || pages[pages.length - 1];

if (!page) {
  console.error("No active tab found");
  process.exit(1);
}

console.error(`Connected to: ${page.url()}`);

const formatTime = () => new Date().toISOString().split("T")[1].slice(0, 12);

const levelColors = {
  verbose: "\x1b[90m",  // gray
  info: "\x1b[36m",     // cyan
  warning: "\x1b[33m",  // yellow
  error: "\x1b[31m",    // red
};
const reset = "\x1b[0m";

// Use CDP directly for Log domain (captures network errors, etc.)
const cdp = await page.context().newCDPSession(page);
await cdp.send("Log.enable");

cdp.on("Log.entryAdded", ({ entry }) => {
  const color = levelColors[entry.level] || levelColors.info;
  const source = entry.source ? `[${entry.source}]` : "";
  console.log(`${color}[${formatTime()}] [${entry.level.toUpperCase()}]${source} ${entry.text}${reset}`);
  if (entry.url) {
    console.log(`${color}    URL: ${entry.url}${reset}`);
  }
});

// Also capture runtime exceptions
await cdp.send("Runtime.enable");
cdp.on("Runtime.exceptionThrown", ({ exceptionDetails }) => {
  const text = exceptionDetails.exception?.description || exceptionDetails.text;
  console.log(`\x1b[31m[${formatTime()}] [EXCEPTION] ${text}${reset}`);
});

// Capture network failures (ERR_BLOCKED_BY_CLIENT, etc.)
await cdp.send("Network.enable");
cdp.on("Network.loadingFailed", ({ requestId, errorText, blockedReason }) => {
  const reason = blockedReason ? ` (${blockedReason})` : "";
  console.log(`\x1b[31m[${formatTime()}] [NETWORK ERROR] ${errorText}${reason}${reset}`);
});

// Keep Playwright listeners for console.log() calls
page.on("console", (msg) => {
  const type = msg.type();
  const color = levelColors[type] || levelColors.info;
  const text = msg.text();
  console.log(`${color}[${formatTime()}] [CONSOLE.${type.toUpperCase()}] ${text}${reset}`);
});

page.on("pageerror", (error) => {
  console.log(`\x1b[31m[${formatTime()}] [PAGE ERROR] ${error.message}${reset}`);
});

console.error(`Listening for console output... (Ctrl+C to stop)`);

if (durationMs) {
  await new Promise((r) => setTimeout(r, durationMs));
  await browser.close();
} else {
  // Keep running until interrupted
  process.on("SIGINT", async () => {
    console.error("\nStopping...");
    await browser.close();
    process.exit(0);
  });

  // Keep the process alive
  await new Promise(() => {});
}
