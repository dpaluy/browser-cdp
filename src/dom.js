#!/usr/bin/env node

import { chromium } from "playwright";
import { DEFAULT_PORT, getActivePage } from "./utils.js";

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

const html = await page.content();
console.log(html);

await browser.close();
