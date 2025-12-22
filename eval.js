#!/usr/bin/env node

import { chromium } from "playwright";

const DEFAULT_PORT = process.env.DEBUG_PORT || 9222;

const code = process.argv.slice(2).join(" ");
if (!code) {
  console.log("Usage: eval.js 'code'");
  console.log("\nExamples:");
  console.log('  eval.js "document.title"');
  console.log("  eval.js \"document.querySelectorAll('a').length\"");
  process.exit(1);
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

await browser.close();
