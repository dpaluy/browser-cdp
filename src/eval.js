#!/usr/bin/env node

import { chromium } from "playwright";
import { DEFAULT_PORT, getActivePage, formatTime, levelColors, resetColor } from "./utils.js";

const args = process.argv.slice(2);
const showHelp = args.includes("--help") || args.includes("-h");
const captureConsole = args.includes("--console");
const durationArg = args.find((a) => a.startsWith("--duration="));
const durationMs = durationArg ? parseInt(durationArg.split("=")[1]) * 1000 : 3000;
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
const page = getActivePage(pages);

if (!page) {
  console.error("No active tab found");
  process.exit(1);
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

if (captureConsole) {
  console.error(`\nListening for ${durationMs / 1000}s...`);
  await new Promise((r) => setTimeout(r, durationMs));
}

await browser.close();
