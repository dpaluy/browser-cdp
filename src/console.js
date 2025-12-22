#!/usr/bin/env node

import { chromium } from "playwright";
import { DEFAULT_PORT, getActivePage, formatTime, levelColors, resetColor } from "./utils.js";

const args = process.argv.slice(2);
const duration = args.find((a) => a.startsWith("--duration="));
const durationMs = duration ? parseInt(duration.split("=")[1]) * 1000 : null;
const shouldReload = args.includes("--reload") || args.includes("-r");
const showHelp = args.includes("--help") || args.includes("-h");

if (showHelp) {
  console.log("Usage: console.js [options]");
  console.log("\nCapture browser console output in real-time.");
  console.log("\nOptions:");
  console.log("  --duration=N  Stop after N seconds (default: run until Ctrl+C)");
  console.log("  --reload, -r  Reload the page before capturing");
  console.log("\nExamples:");
  console.log("  console.js              # Stream console logs until Ctrl+C");
  console.log("  console.js --duration=5 # Capture for 5 seconds");
  console.log("  console.js --reload     # Reload page and capture logs");
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
const page = getActivePage(pages);

if (!page) {
  console.error("No active tab found");
  process.exit(1);
}

console.error(`Connected to: ${page.url()}`);

// Use CDP directly for Log domain (captures network errors, etc.)
const cdp = await page.context().newCDPSession(page);
await cdp.send("Log.enable");

cdp.on("Log.entryAdded", ({ entry }) => {
  const color = levelColors[entry.level] || levelColors.info;
  const source = entry.source ? `[${entry.source}]` : "";
  console.log(`${color}[${formatTime()}] [${entry.level.toUpperCase()}]${source} ${entry.text}${resetColor}`);
  if (entry.url) {
    console.log(`${color}    URL: ${entry.url}${resetColor}`);
  }
});

// Also capture runtime exceptions
await cdp.send("Runtime.enable");
cdp.on("Runtime.exceptionThrown", ({ exceptionDetails }) => {
  const text = exceptionDetails.exception?.description || exceptionDetails.text;
  console.log(`\x1b[31m[${formatTime()}] [EXCEPTION] ${text}${resetColor}`);
});

// Capture network failures (ERR_BLOCKED_BY_CLIENT, etc.)
await cdp.send("Network.enable");
cdp.on("Network.loadingFailed", ({ requestId, errorText, blockedReason }) => {
  const reason = blockedReason ? ` (${blockedReason})` : "";
  console.log(`\x1b[31m[${formatTime()}] [NETWORK ERROR] ${errorText}${reason}${resetColor}`);
});

// Keep Playwright listeners for console.log() calls
page.on("console", (msg) => {
  const type = msg.type();
  const color = levelColors[type] || levelColors.info;
  const text = msg.text();
  console.log(`${color}[${formatTime()}] [CONSOLE.${type.toUpperCase()}] ${text}${resetColor}`);
});

page.on("pageerror", (error) => {
  console.log(`\x1b[31m[${formatTime()}] [PAGE ERROR] ${error.message}${resetColor}`);
});

if (shouldReload) {
  console.error("Reloading page...");
  await page.reload();
}

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
