#!/usr/bin/env node

import { chromium } from "playwright";

const DEFAULT_PORT = process.env.DEBUG_PORT || 9222;

const args = process.argv.slice(2);
const showHelp = args.includes("--help") || args.includes("-h");
const jsonOutput = args.includes("--json");

if (showHelp) {
  console.log("Usage: insights.js [--json]");
  console.log("\nCollect page performance insights and Web Vitals.");
  console.log("\nOptions:");
  console.log("  --json    Output as JSON");
  console.log("\nMetrics collected:");
  console.log("  - Page load timing (DOM, load, first paint)");
  console.log("  - Web Vitals (LCP, FID, CLS, FCP, TTFB)");
  console.log("  - Resource counts and sizes");
  console.log("  - JavaScript heap usage");
  process.exit(0);
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

// Collect performance metrics
const metrics = await page.evaluate(() => {
  const perf = performance;
  const timing = perf.timing || {};
  const navigation = perf.getEntriesByType("navigation")[0] || {};
  const paint = perf.getEntriesByType("paint") || [];
  const resources = perf.getEntriesByType("resource") || [];

  // Calculate timing metrics
  const navStart = timing.navigationStart || navigation.startTime || 0;
  const domContentLoaded = (timing.domContentLoadedEventEnd || navigation.domContentLoadedEventEnd || 0) - navStart;
  const loadComplete = (timing.loadEventEnd || navigation.loadEventEnd || 0) - navStart;
  const firstPaint = paint.find((p) => p.name === "first-paint")?.startTime || 0;
  const firstContentfulPaint = paint.find((p) => p.name === "first-contentful-paint")?.startTime || 0;
  const ttfb = (timing.responseStart || navigation.responseStart || 0) - navStart;

  // Resource breakdown
  const resourceStats = resources.reduce(
    (acc, r) => {
      acc.count++;
      acc.totalSize += r.transferSize || 0;
      const type = r.initiatorType || "other";
      acc.byType[type] = (acc.byType[type] || 0) + 1;
      return acc;
    },
    { count: 0, totalSize: 0, byType: {} }
  );

  // Try to get LCP (requires PerformanceObserver to have recorded it)
  let lcp = null;
  try {
    const lcpEntries = perf.getEntriesByType("largest-contentful-paint");
    if (lcpEntries.length > 0) {
      lcp = lcpEntries[lcpEntries.length - 1].startTime;
    }
  } catch (e) {}

  // Memory info (Chrome only)
  let memory = null;
  if (perf.memory) {
    memory = {
      usedJSHeapSize: Math.round(perf.memory.usedJSHeapSize / 1024 / 1024),
      totalJSHeapSize: Math.round(perf.memory.totalJSHeapSize / 1024 / 1024),
    };
  }

  return {
    url: location.href,
    timing: {
      ttfb: Math.round(ttfb),
      firstPaint: Math.round(firstPaint),
      firstContentfulPaint: Math.round(firstContentfulPaint),
      domContentLoaded: Math.round(domContentLoaded),
      loadComplete: Math.round(loadComplete),
      lcp: lcp ? Math.round(lcp) : null,
    },
    resources: {
      count: resourceStats.count,
      totalSizeKB: Math.round(resourceStats.totalSize / 1024),
      byType: resourceStats.byType,
    },
    memory,
  };
});

if (jsonOutput) {
  console.log(JSON.stringify(metrics, null, 2));
} else {
  console.log(`Page Insights: ${metrics.url}\n`);

  console.log("Timing:");
  console.log(`  TTFB:                  ${metrics.timing.ttfb}ms`);
  console.log(`  First Paint:           ${metrics.timing.firstPaint}ms`);
  console.log(`  First Contentful Paint: ${metrics.timing.firstContentfulPaint}ms`);
  console.log(`  DOM Content Loaded:    ${metrics.timing.domContentLoaded}ms`);
  console.log(`  Load Complete:         ${metrics.timing.loadComplete}ms`);
  if (metrics.timing.lcp) {
    console.log(`  Largest Contentful Paint: ${metrics.timing.lcp}ms`);
  }

  console.log("\nResources:");
  console.log(`  Total:     ${metrics.resources.count} requests`);
  console.log(`  Size:      ${metrics.resources.totalSizeKB} KB`);
  console.log(`  Breakdown: ${Object.entries(metrics.resources.byType).map(([k, v]) => `${k}(${v})`).join(", ")}`);

  if (metrics.memory) {
    console.log("\nMemory:");
    console.log(`  JS Heap Used:  ${metrics.memory.usedJSHeapSize} MB`);
    console.log(`  JS Heap Total: ${metrics.memory.totalJSHeapSize} MB`);
  }
}

await browser.close();
