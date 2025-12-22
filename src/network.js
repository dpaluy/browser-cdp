#!/usr/bin/env node

import { chromium } from "playwright";
import { DEFAULT_PORT, getActivePage, formatTime, resetColor } from "./utils.js";

const args = process.argv.slice(2);
const filterPattern = args.find((a) => a.startsWith("--filter="))?.split("=")[1];
const jsonOutput = args.includes("--json");
const errorsOnly = args.includes("--errors");
const duration = args.find((a) => a.startsWith("--duration="));
const durationMs = duration ? parseInt(duration.split("=")[1]) * 1000 : null;
const showHelp = args.includes("--help") || args.includes("-h");

if (showHelp) {
  console.log("Usage: network.js [options]");
  console.log("\nStream network requests and responses in real-time.");
  console.log("\nOptions:");
  console.log("  --filter=PATTERN  Filter URLs by regex pattern");
  console.log("  --json            Output as JSON for piping");
  console.log("  --errors          Only show failed requests (4xx/5xx)");
  console.log("  --duration=N      Stop after N seconds (default: run until Ctrl+C)");
  console.log("\nExamples:");
  console.log("  network.js                      # Stream all network traffic");
  console.log("  network.js --filter=api         # Only show URLs containing 'api'");
  console.log("  network.js --errors             # Only show failed requests");
  console.log("  network.js --json               # JSON output for jq/parsing");
  console.log("  network.js --duration=10        # Capture for 10 seconds");
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
const page = getActivePage(pages);

if (!page) {
  console.error("No active tab found");
  process.exit(1);
}

console.error(`Connected to: ${page.url()}`);

const cdp = await page.context().newCDPSession(page);
await cdp.send("Network.enable");

const requests = new Map();

const statusColors = {
  success: "\x1b[32m", // green for 2xx
  redirect: "\x1b[33m", // yellow for 3xx
  error: "\x1b[31m", // red for 4xx/5xx
  request: "\x1b[36m", // cyan for requests
};

function matchesFilter(url) {
  if (!filterPattern) return true;
  try {
    return new RegExp(filterPattern).test(url);
  } catch {
    return url.includes(filterPattern);
  }
}

cdp.on("Network.requestWillBeSent", ({ requestId, request, timestamp }) => {
  requests.set(requestId, { method: request.method, url: request.url, timestamp });

  if (!matchesFilter(request.url)) return;
  if (errorsOnly) return;

  if (jsonOutput) {
    console.log(
      JSON.stringify({
        type: "request",
        timestamp: new Date(timestamp * 1000).toISOString(),
        method: request.method,
        url: request.url,
        requestId,
      })
    );
  } else {
    console.log(`${statusColors.request}[${formatTime()}] → ${request.method} ${request.url}${resetColor}`);
  }
});

cdp.on("Network.responseReceived", ({ requestId, response, timestamp, type }) => {
  const req = requests.get(requestId);

  if (!matchesFilter(response.url)) return;
  if (errorsOnly && response.status < 400) return;

  if (jsonOutput) {
    console.log(
      JSON.stringify({
        type: "response",
        timestamp: new Date(timestamp * 1000).toISOString(),
        status: response.status,
        statusText: response.statusText,
        url: response.url,
        mimeType: response.mimeType,
        resourceType: type,
        requestId,
        method: req?.method,
      })
    );
  } else {
    let color = statusColors.success;
    if (response.status >= 400) {
      color = statusColors.error;
    } else if (response.status >= 300) {
      color = statusColors.redirect;
    }

    const method = req ? `${req.method} ` : "";
    console.log(`${color}[${formatTime()}] ← ${response.status} ${method}${response.url}${resetColor}`);
  }
});

cdp.on("Network.loadingFailed", ({ requestId, errorText, blockedReason, canceled }) => {
  const req = requests.get(requestId);

  if (req && !matchesFilter(req.url)) return;

  if (jsonOutput) {
    console.log(
      JSON.stringify({
        type: "failed",
        timestamp: new Date().toISOString(),
        url: req?.url,
        method: req?.method,
        error: errorText,
        blockedReason,
        canceled,
        requestId,
      })
    );
  } else {
    const reason = blockedReason ? ` (${blockedReason})` : "";
    const canceledStr = canceled ? " [CANCELED]" : "";
    console.log(
      `${statusColors.error}[${formatTime()}] ✗ ${errorText}${reason}${canceledStr} - ${req?.url || "unknown"}${resetColor}`
    );
  }

  if (requestId) {
    requests.delete(requestId);
  }
});

console.error(`Listening for network activity... (Ctrl+C to stop)`);

if (durationMs) {
  await new Promise((r) => setTimeout(r, durationMs));
  await browser.close();
} else {
  // Keep running until interrupted
  process.on("SIGINT", async () => {
    console.error("\nStopping...");
    await browser.close();
    process.exit(0);
  });

  // Keep the process alive
  await new Promise(() => {});
}
