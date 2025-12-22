#!/usr/bin/env node

import { tmpdir } from "node:os";
import { join } from "node:path";
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
const page = pages[pages.length - 1];

if (!page) {
  console.error("No active tab found");
  process.exit(1);
}

const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const filename = `screenshot-${timestamp}.png`;
const filepath = join(tmpdir(), filename);

await page.screenshot({ path: filepath });

console.log(filepath);

await browser.close();
