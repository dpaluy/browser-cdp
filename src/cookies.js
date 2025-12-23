#!/usr/bin/env node

import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { DEFAULT_PORT, getActivePage } from "./utils.js";

const args = process.argv.slice(2);
const subcommand = args[0];
const showHelp = args.includes("--help") || args.includes("-h");

function printUsage() {
  console.log("Usage: cookies <subcommand> [options]");
  console.log("");
  console.log("Subcommands:");
  console.log("  export                Export cookies to JSON file");
  console.log("  import <file>         Import cookies from JSON file");
  console.log("  clear                 Clear all cookies from browser");
  console.log("");
  console.log("Options:");
  console.log("  --path <file>         Output file path for export (default: cookies.json)");
  console.log("");
  console.log("Examples:");
  console.log("  cookies export");
  console.log("  cookies export --path session.json");
  console.log("  cookies import session.json");
  console.log("  cookies clear");
  process.exit(0);
}

if (!subcommand || showHelp) {
  printUsage();
}

if (!["export", "import", "clear"].includes(subcommand)) {
  console.error(`Unknown subcommand: ${subcommand}`);
  console.log("Available: export, import, clear");
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
const page = getActivePage(pages);

if (!page) {
  console.error("No active tab found");
  process.exit(1);
}

const cdp = await page.context().newCDPSession(page);

if (subcommand === "export") {
  const pathIdx = args.findIndex((a) => a === "--path");
  const outputFile = pathIdx !== -1 ? args[pathIdx + 1] : "cookies.json";

  const { cookies } = await cdp.send("Network.getCookies");
  writeFileSync(outputFile, JSON.stringify(cookies, null, 2));
  console.log(`Exported ${cookies.length} cookie(s) to ${outputFile}`);
} else if (subcommand === "import") {
  const importFile = args[1];

  if (!importFile) {
    console.error("Error: import requires a file path");
    process.exit(1);
  }

  const cookies = JSON.parse(readFileSync(importFile, "utf8"));

  if (!Array.isArray(cookies)) {
    console.error("Error: Cookie file must contain a JSON array");
    process.exit(1);
  }

  await cdp.send("Network.setCookies", { cookies });
  console.log(`Imported ${cookies.length} cookie(s) from ${importFile}`);
} else if (subcommand === "clear") {
  await cdp.send("Network.clearBrowserCookies");
  console.log("Cleared all cookies");
}

await browser.close();
