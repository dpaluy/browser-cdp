#!/usr/bin/env node

import { chromium } from "playwright";
import { DEFAULT_PORT, normalizeUrl, getActivePage, formatTime, levelColors, resetColor } from "./utils.js";

const args = process.argv.slice(2);
const showHelp = args.includes("--help") || args.includes("-h");
const newTab = args.includes("--new");
const captureConsole = args.includes("--console");
const durationArg = args.find((a) => a.startsWith("--duration="));
const durationMs = durationArg ? parseInt(durationArg.split("=")[1]) * 1000 : 5000;

// Get URL (first arg that doesn't start with --)
let url = args.find((a) => !a.startsWith("--"));

if (showHelp || !url) {
  console.log("Usage: nav.js <url> [options]");
  console.log("\nOptions:");
  console.log("  --new            Open in new tab");
  console.log("  --console        Capture console output during navigation");
  console.log("  --duration=N     With --console, capture for N seconds (default: 5)");
  console.log("\nExamples:");
  console.log("  nav.js example.com              # Navigate current tab");
  console.log("  nav.js example.com --new        # Open in new tab");
  console.log("  nav.js example.com --console    # Navigate and capture console");
  process.exit(showHelp ? 0 : 1);
}

url = normalizeUrl(url);

const browser = await chromium.connectOverCDP(`http://localhost:${DEFAULT_PORT}`);
const contexts = browser.contexts();
const context = contexts[0] || await browser.newContext();

let page;
if (newTab) {
  page = await context.newPage();
} else {
  const pages = context.pages();
  const realPages = pages.filter(p => {
    const u = p.url();
    return u.startsWith("http://") || u.startsWith("https://") || u === "about:blank";
  });
  page = realPages[realPages.length - 1] || pages[pages.length - 1] || await context.newPage();
}

if (captureConsole) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Log.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Network.enable");

  cdp.on("Log.entryAdded", ({ entry }) => {
    const color = levelColors[entry.level] || levelColors.info;
    const source = entry.source ? `[${entry.source}]` : "";
    console.log(`${color}[${formatTime()}] [${entry.level.toUpperCase()}]${source} ${entry.text}${resetColor}`);
    if (entry.url) {
      console.log(`${color}    URL: ${entry.url}${resetColor}`);
    }
  });

  cdp.on("Runtime.exceptionThrown", ({ exceptionDetails }) => {
    const text = exceptionDetails.exception?.description || exceptionDetails.text;
    console.log(`\x1b[31m[${formatTime()}] [EXCEPTION] ${text}${resetColor}`);
  });

  cdp.on("Network.loadingFailed", ({ requestId, errorText, blockedReason }) => {
    const reason = blockedReason ? ` (${blockedReason})` : "";
    console.log(`\x1b[31m[${formatTime()}] [NETWORK ERROR] ${errorText}${reason}${resetColor}`);
  });

  page.on("console", (msg) => {
    const type = msg.type();
    const color = levelColors[type] || levelColors.info;
    console.log(`${color}[${formatTime()}] [CONSOLE.${type.toUpperCase()}] ${msg.text()}${resetColor}`);
  });

  page.on("pageerror", (error) => {
    console.log(`\x1b[31m[${formatTime()}] [PAGE ERROR] ${error.message}${resetColor}`);
  });

  console.error(`Navigating to ${url} (capturing console for ${durationMs / 1000}s)...`);
}

await page.goto(url, { waitUntil: "domcontentloaded" });

if (captureConsole) {
  console.error(`Loaded: ${url}`);
  await new Promise((r) => setTimeout(r, durationMs));
  console.error("Done.");
} else {
  console.log(newTab ? "Opened:" : "Navigated to:", url);
}

await browser.close();
