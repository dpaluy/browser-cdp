#!/usr/bin/env node

import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { DEFAULT_PORT, getActivePage } from "./utils.js";

const args = process.argv.slice(2);
const subcommand = args[0];
const showHelp = args.includes("--help") || args.includes("-h");
const useSessionStorage = args.includes("--session");
const storageType = useSessionStorage ? "sessionStorage" : "localStorage";

function printUsage() {
  console.log("Usage: storage <subcommand> [options]");
  console.log("");
  console.log("Subcommands:");
  console.log("  get <key>             Get value for key");
  console.log("  set <key> <value>     Set key to value");
  console.log("  list                  List all keys");
  console.log("  clear                 Clear all storage");
  console.log("  export                Export storage to JSON file");
  console.log("  import <file>         Import storage from JSON file");
  console.log("");
  console.log("Options:");
  console.log("  --session             Use sessionStorage instead of localStorage");
  console.log("  --path <file>         Output file path for export (default: storage.json)");
  console.log("");
  console.log("Examples:");
  console.log("  storage get token");
  console.log("  storage set theme dark");
  console.log("  storage list");
  console.log("  storage export");
  console.log("  storage export --path session.json --session");
  console.log("  storage import session.json");
  console.log("  storage clear");
  process.exit(0);
}

if (!subcommand || showHelp) {
  printUsage();
}

if (!["get", "set", "list", "clear", "export", "import"].includes(subcommand)) {
  console.error(`Unknown subcommand: ${subcommand}`);
  console.log("Available: get, set, list, clear, export, import");
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

const positionalArgs = args.filter((a) => !a.startsWith("--"));

if (subcommand === "get") {
  const key = positionalArgs[1];

  if (!key) {
    console.error("Error: get requires a key");
    process.exit(1);
  }

  const result = await page.evaluate(
    ([storageType, key]) => window[storageType].getItem(key),
    [storageType, key]
  );

  if (result === null) {
    console.error(`Key "${key}" not found in ${storageType}`);
    process.exit(1);
  }

  console.log(result);
} else if (subcommand === "set") {
  const key = positionalArgs[1];
  const value = positionalArgs.slice(2).join(" ");

  if (!key || value === "") {
    console.error("Error: set requires <key> <value>");
    process.exit(1);
  }

  await page.evaluate(
    ([storageType, key, value]) => window[storageType].setItem(key, value),
    [storageType, key, value]
  );

  console.log(`Set ${key} in ${storageType}`);
} else if (subcommand === "list") {
  const keys = await page.evaluate(
    (storageType) => Object.keys(window[storageType]),
    storageType
  );

  if (keys.length === 0) {
    console.log(`No keys found in ${storageType}`);
  } else {
    console.log(`Keys in ${storageType}:`);
    keys.forEach((key) => console.log(`  ${key}`));
  }
} else if (subcommand === "clear") {
  await page.evaluate((storageType) => window[storageType].clear(), storageType);

  console.log(`Cleared all ${storageType}`);
} else if (subcommand === "export") {
  const pathIdx = args.findIndex((a) => a === "--path");
  const outputFile = pathIdx !== -1 ? args[pathIdx + 1] : "storage.json";

  const data = await page.evaluate((storageType) => {
    const storage = window[storageType];
    const result = {};
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      result[key] = storage.getItem(key);
    }
    return result;
  }, storageType);

  writeFileSync(outputFile, JSON.stringify(data, null, 2));
  const count = Object.keys(data).length;
  console.log(`Exported ${count} item(s) from ${storageType} to ${outputFile}`);
} else if (subcommand === "import") {
  const importFile = positionalArgs[1];

  if (!importFile) {
    console.error("Error: import requires a file path");
    process.exit(1);
  }

  let data;
  try {
    data = JSON.parse(readFileSync(importFile, "utf8"));
  } catch (error) {
    console.error(`Error reading file: ${error.message}`);
    process.exit(1);
  }

  if (typeof data !== "object" || Array.isArray(data)) {
    console.error("Error: Storage file must contain a JSON object");
    process.exit(1);
  }

  await page.evaluate(
    ([storageType, data]) => {
      const storage = window[storageType];
      for (const [key, value] of Object.entries(data)) {
        storage.setItem(key, value);
      }
    },
    [storageType, data]
  );

  const count = Object.keys(data).length;
  console.log(`Imported ${count} item(s) to ${storageType} from ${importFile}`);
}

await browser.close();
