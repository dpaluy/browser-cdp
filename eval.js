#!/usr/bin/env node

import { chromium } from "playwright";

const DEFAULT_PORT = process.env.DEBUG_PORT || 9222;

const args = process.argv.slice(2);
const showHelp = args.includes("--help") || args.includes("-h");
const captureConsole = args.includes("--console");
const durationArg = args.find((a) => a.startsWith("--duration="));
const durationMs = durationArg ? parseInt(durationArg.split("=")[1]) * 1000 : 3000;

// Get code (everything that's not a flag)
const code = args.filter((a) => !a.startsWith("--")).join(" ");

if (showHelp || !code) {
  console.log("Usage: eval.js '<code>' [options]");
  console.log("\nOptions:");
  console.log("  --console        Capture console output during evaluation");
  console.log("  --duration=N     With --console, capture for N seconds (default: 3)");
  console.log("\nExamples:");
  console.log('  eval.js "document.title"');
  console.log("  eval.js \"document.querySelectorAll('a').length\"");
  console.log("  eval.js \"fetch('/api/data')\" --console");
  process.exit(showHelp ? 0 : 1);
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

// Set up console capture BEFORE evaluation
if (captureConsole) {
  const formatTime = () => new Date().toISOString().split("T")[1].slice(0, 12);
  const levelColors = {
    verbose: "\x1b[90m",
    info: "\x1b[36m",
    warning: "\x1b[33m",
    error: "\x1b[31m",
  };
  const reset = "\x1b[0m";

  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Log.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Network.enable");

  cdp.on("Log.entryAdded", ({ entry }) => {
    const color = levelColors[entry.level] || levelColors.info;
    const source = entry.source ? `[${entry.source}]` : "";
    console.log(`${color}[${formatTime()}] [${entry.level.toUpperCase()}]${source} ${entry.text}${reset}`);
    if (entry.url) {
      console.log(`${color}    URL: ${entry.url}${reset}`);
    }
  });

  cdp.on("Runtime.exceptionThrown", ({ exceptionDetails }) => {
    const text = exceptionDetails.exception?.description || exceptionDetails.text;
    console.log(`\x1b[31m[${formatTime()}] [EXCEPTION] ${text}${reset}`);
  });

  cdp.on("Network.loadingFailed", ({ requestId, errorText, blockedReason }) => {
    const reason = blockedReason ? ` (${blockedReason})` : "";
    console.log(`\x1b[31m[${formatTime()}] [NETWORK ERROR] ${errorText}${reason}${reset}`);
  });

  page.on("console", (msg) => {
    const type = msg.type();
    const color = levelColors[type] || levelColors.info;
    console.log(`${color}[${formatTime()}] [CONSOLE.${type.toUpperCase()}] ${msg.text()}${reset}`);
  });

  page.on("pageerror", (error) => {
    console.log(`\x1b[31m[${formatTime()}] [PAGE ERROR] ${error.message}${reset}`);
  });
}

let result;

try {
  result = await page.evaluate((c) => {
    const AsyncFunction = (async () => {}).constructor;
    return new AsyncFunction(`return (${c})`)();
  }, code);
} catch (e) {
  console.log("Failed to evaluate expression");
  console.log(`  Expression: ${code}`);
  console.log(e);
  process.exit(1);
}

// Print result
if (Array.isArray(result)) {
  for (let i = 0; i < result.length; i++) {
    if (i > 0) console.log("");
    for (const [key, value] of Object.entries(result[i])) {
      console.log(`${key}: ${value}`);
    }
  }
} else if (typeof result === "object" && result !== null) {
  for (const [key, value] of Object.entries(result)) {
    console.log(`${key}: ${value}`);
  }
} else {
  console.log(result);
}

// Wait for async console output
if (captureConsole) {
  console.error(`\nListening for ${durationMs / 1000}s...`);
  await new Promise((r) => setTimeout(r, durationMs));
}

await browser.close();
