#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, "package.json"), "utf8"));

const command = process.argv[2];
const args = process.argv.slice(3);

const commands = {
  start: "./src/start.js",
  close: "./src/close.js",
  nav: "./src/nav.js",
  eval: "./src/eval.js",
  dom: "./src/dom.js",
  screenshot: "./src/screenshot.js",
  pdf: "./src/pdf.js",
  pick: "./src/pick.js",
  console: "./src/console.js",
  network: "./src/network.js",
  cookies: "./src/cookies.js",
  storage: "./src/storage.js",
  insights: "./src/insights.js",
  lighthouse: "./src/lighthouse.js",
};

function printUsage() {
  console.log(`browser-cdp v${pkg.version} - Browser automation via Chrome DevTools Protocol`);
  console.log("");
  console.log("Usage: browser-cdp <command> [options]");
  console.log("");
  console.log("Commands:");
  console.log("  start [browser]     Start browser with CDP (uses real profile)");
  console.log("  close               Close the browser");
  console.log("  nav <url>           Navigate to URL (--console to capture logs)");
  console.log("  eval '<code>'       Evaluate JS in page (--console to capture logs)");
  console.log("  dom                 Capture full page DOM/HTML");
  console.log("  screenshot          Take screenshot of current page");
  console.log("  pdf                 Export current page as PDF");
  console.log("  pick '<message>'    Interactive element picker");
  console.log("  console             Stream browser console output");
  console.log("  network             Stream network requests/responses");
  console.log("  cookies             Export/import/clear browser cookies");
  console.log("  storage             Manage localStorage/sessionStorage");
  console.log("  insights            Show page performance metrics");
  console.log("  lighthouse          Run Lighthouse audit");
  console.log("");
  console.log("Environment:");
  console.log("  DEBUG_PORT          CDP port (default: 9222)");
  console.log("  BROWSER             Browser to use (chrome, brave, edge)");
  console.log("  BROWSER_PATH        Custom browser executable path");
  console.log("");
  console.log("Examples:");
  console.log("  browser-cdp start brave");
  console.log("  browser-cdp nav https://google.com");
  console.log("  browser-cdp eval 'document.title'");
  console.log("  browser-cdp dom > page.html");
  console.log("  browser-cdp console --duration=10");
  console.log("  browser-cdp network --filter=api");
  console.log("  browser-cdp cookies export --path session.json");
  console.log("  browser-cdp insights --json");
  process.exit(0);
}

if (command === "--version" || command === "-v") {
  console.log(pkg.version);
  process.exit(0);
}

if (!command || command === "--help" || command === "-h") {
  printUsage();
}

if (!commands[command]) {
  console.error(`Unknown command: ${command}`);
  console.log(`Available: ${Object.keys(commands).join(", ")}`);
  process.exit(1);
}

// Re-run with the specific command script
process.argv = [process.argv[0], commands[command], ...args];
await import(commands[command]);
