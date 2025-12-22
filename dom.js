#!/usr/bin/env node

import { chromium } from "playwright";

const DEFAULT_PORT = process.env.DEBUG_PORT || 9222;

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

const html = await page.content();
console.log(html);

await browser.close();
