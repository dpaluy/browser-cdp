#!/usr/bin/env node

import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";
import { DEFAULT_PORT, getActivePage } from "./utils.js";

const args = process.argv.slice(2);

if (args.includes("--help") || args.includes("-h")) {
  console.log("Usage: pdf [options]");
  console.log("");
  console.log("Options:");
  console.log("  --path <file>       Output path (default: temp dir with timestamp)");
  console.log("  --format <format>   Paper size: A4, Letter, Legal, Tabloid (default: Letter)");
  console.log("  --landscape         Landscape orientation (default: portrait)");
  console.log("");
  console.log("Examples:");
  console.log("  pdf");
  console.log("  pdf --path output.pdf");
  console.log("  pdf --format A4 --landscape");
  process.exit(0);
}

const PAPER_FORMATS = {
  A4: { width: 8.27, height: 11.69 },
  LETTER: { width: 8.5, height: 11 },
  LEGAL: { width: 8.5, height: 14 },
  TABLOID: { width: 11, height: 17 },
};

const pathIdx = args.findIndex((a) => a === "--path");
const formatIdx = args.findIndex((a) => a === "--format");
const landscape = args.includes("--landscape");

const customPath = pathIdx !== -1 ? args[pathIdx + 1] : null;
const format = formatIdx !== -1 ? args[formatIdx + 1]?.toUpperCase() : "LETTER";
const paperSize = PAPER_FORMATS[format] || PAPER_FORMATS.LETTER;

const outputPath =
  customPath ||
  join(tmpdir(), `pdf-${new Date().toISOString().replace(/[:.]/g, "-")}.pdf`);

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

const cdp = await context.newCDPSession(page);
const { data } = await cdp.send("Page.printToPDF", {
  printBackground: true,
  paperWidth: paperSize.width,
  paperHeight: paperSize.height,
  landscape,
  marginTop: 0.4,
  marginBottom: 0.4,
  marginLeft: 0.4,
  marginRight: 0.4,
});

writeFileSync(outputPath, Buffer.from(data, "base64"));

console.log(outputPath);

await browser.close();
