#!/usr/bin/env node

import { chromium } from "playwright";

const DEFAULT_PORT = process.env.DEBUG_PORT || 9222;

let url = process.argv[2];
const newTab = process.argv[3] === "--new";

// Add protocol if missing
if (url && !url.match(/^https?:\/\//i)) {
  url = "https://" + url;
}

if (!url) {
  console.log("Usage: nav.js <url> [--new]");
  console.log("\nExamples:");
  console.log("  nav.js example.com       # Navigate current tab");
  console.log("  nav.js example.com --new # Open in new tab");
  process.exit(1);
}

const browser = await chromium.connectOverCDP(`http://localhost:${DEFAULT_PORT}`);
const contexts = browser.contexts();
const context = contexts[0] || await browser.newContext();

if (newTab) {
  const page = await context.newPage();
  await page.goto(url, { waitUntil: "domcontentloaded" });
  console.log("Opened:", url);
} else {
  const pages = context.pages();
  const page = pages[pages.length - 1] || await context.newPage();
  await page.goto(url, { waitUntil: "domcontentloaded" });
  console.log("Navigated to:", url);
}

await browser.close();
