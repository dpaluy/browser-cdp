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
const page = pages[pages.length - 1];

if (!page) {
  console.error("No active tab found");
  process.exit(1);
}

const formatTime = () => new Date().toISOString().split("T")[1].slice(0, 12);

const typeColors = {
  log: "\x1b[0m",      // default
  info: "\x1b[36m",    // cyan
  warn: "\x1b[33m",    // yellow
  error: "\x1b[31m",   // red
  debug: "\x1b[90m",   // gray
};
const reset = "\x1b[0m";

page.on("console", (msg) => {
  const type = msg.type();
  const color = typeColors[type] || typeColors.log;
  const text = msg.text();
  console.log(`${color}[${formatTime()}] [${type.toUpperCase()}] ${text}${reset}`);
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
