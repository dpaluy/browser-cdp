#!/usr/bin/env node

import lighthouse from "lighthouse";
import { chromium } from "playwright";

const DEFAULT_PORT = process.env.DEBUG_PORT || 9222;

const args = process.argv.slice(2);
const showHelp = args.includes("--help") || args.includes("-h");
const jsonOutput = args.includes("--json");
const category = args.find((a) => a.startsWith("--category="))?.split("=")[1];

if (showHelp) {
  console.log("Usage: lighthouse.js [--json] [--category=NAME]");
  console.log("\nRun Lighthouse audit on the current page.");
  console.log("\nOptions:");
  console.log("  --json              Output full JSON report");
  console.log("  --category=NAME     Run specific category only");
  console.log("                      (performance, accessibility, best-practices, seo)");
  console.log("\nExamples:");
  console.log("  lighthouse.js                        # Full audit");
  console.log("  lighthouse.js --category=performance # Performance only");
  console.log("  lighthouse.js --json                 # JSON output");
  process.exit(0);
}

// Get current page URL and check for DevTools
const targetsRes = await fetch(`http://localhost:${DEFAULT_PORT}/json`);
const targets = await targetsRes.json();

const httpPages = targets.filter(t =>
  t.type === "page" && (t.url.startsWith("http://") || t.url.startsWith("https://"))
);
const devtoolsPages = targets.filter(t =>
  t.type === "page" && t.url.startsWith("devtools://")
);

if (httpPages.length === 0) {
  console.error("No HTTP page found to audit");
  process.exit(1);
}

const targetPage = httpPages[0];
const url = targetPage.url;

// Check if DevTools is open (it will block Lighthouse)
if (devtoolsPages.length > 0) {
  console.error("⚠️  DevTools is open - please close it first (Cmd+Option+I)");
  console.error("   Lighthouse needs exclusive debugger access to run audits.");
  process.exit(1);
}

if (!url.startsWith("http")) {
  console.error(`Cannot audit non-HTTP URL: ${url}`);
  process.exit(1);
}

console.error(`Running Lighthouse audit on ${url}...`);

// Navigate existing same-origin pages away to prevent conflicts
// Lighthouse creates a new tab, and existing same-origin tabs block debugger access
const browser = await chromium.connectOverCDP(`http://localhost:${DEFAULT_PORT}`);
const pages = browser.contexts()[0]?.pages() || [];
for (const page of pages) {
  const pageUrl = page.url();
  if (pageUrl.startsWith("http") && new URL(pageUrl).origin === new URL(url).origin) {
    console.error("(Navigating existing tab away to avoid conflicts)");
    await page.goto("about:blank");
  }
}
await browser.close();

let result;
try {
  result = await lighthouse(
    url,
    {
      port: DEFAULT_PORT,
      output: "json",
      logLevel: "error",
    }
  );
} catch (err) {
  if (err.message?.includes("Script execution is prohibited")) {
    console.error("\n❌ Lighthouse failed - browser blocks debugger access");
    console.error("\nBrave browser blocks CDP Debugger.enable. Use Chrome instead:");
    console.error("  1. Close Brave");
    console.error("  2. browser-cdp start chrome --isolated");
    console.error("  3. browser-cdp nav <url>");
    console.error("  4. browser-cdp lighthouse");
    process.exit(1);
  }
  throw err;
}

if (!result) {
  console.error("Lighthouse audit failed");
  process.exit(1);
}

const { lhr } = result;

if (jsonOutput) {
  console.log(JSON.stringify(lhr, null, 2));
} else {
  console.log(`\nLighthouse Report: ${lhr.finalDisplayedUrl}\n`);

  // Scores
  console.log("Scores:");
  for (const [key, cat] of Object.entries(lhr.categories)) {
    const score = Math.round((cat.score || 0) * 100);
    const bar = getScoreBar(score);
    console.log(`  ${cat.title.padEnd(20)} ${bar} ${score}`);
  }

  // Top opportunities (performance)
  if (lhr.categories.performance && lhr.audits) {
    const opportunities = Object.values(lhr.audits)
      .filter((a) => a.details?.type === "opportunity" && a.score !== null && a.score < 1)
      .sort((a, b) => (a.score || 0) - (b.score || 0))
      .slice(0, 5);

    if (opportunities.length > 0) {
      console.log("\nTop Opportunities:");
      for (const opp of opportunities) {
        const savings = opp.details?.overallSavingsMs
          ? ` (${Math.round(opp.details.overallSavingsMs)}ms)`
          : "";
        console.log(`  - ${opp.title}${savings}`);
      }
    }
  }

  // Failed audits summary
  const failed = Object.values(lhr.audits)
    .filter((a) => a.score === 0)
    .slice(0, 5);

  if (failed.length > 0) {
    console.log("\nFailed Audits:");
    for (const audit of failed) {
      console.log(`  ✗ ${audit.title}`);
    }
  }
}

function getScoreBar(score) {
  const color = score >= 90 ? "\x1b[32m" : score >= 50 ? "\x1b[33m" : "\x1b[31m";
  const reset = "\x1b[0m";
  const filled = Math.round(score / 10);
  const empty = 10 - filled;
  return `${color}${"█".repeat(filled)}${"░".repeat(empty)}${reset}`;
}
