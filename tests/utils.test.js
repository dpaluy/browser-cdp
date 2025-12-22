import { test, describe } from "node:test";
import assert from "node:assert";
import {
  parseProfileName,
  normalizeUrl,
  filterRealPages,
  getActivePage,
  formatTime,
  formatLogEntry,
  levelColors,
  resetColor,
  BROWSERS,
  isMac,
  isLinux,
} from "../src/utils.js";

describe("parseProfileName", () => {
  test("finds profile by exact name", () => {
    const localState = {
      profile: {
        info_cache: {
          "Profile 1": { name: "Work" },
          "Profile 2": { name: "Personal" },
        },
      },
    };
    assert.strictEqual(parseProfileName(localState, "Work"), "Profile 1");
  });

  test("finds profile case-insensitively", () => {
    const localState = {
      profile: {
        info_cache: {
          "Profile 1": { name: "Work" },
        },
      },
    };
    assert.strictEqual(parseProfileName(localState, "work"), "Profile 1");
    assert.strictEqual(parseProfileName(localState, "WORK"), "Profile 1");
  });

  test("returns null for unknown profile", () => {
    const localState = {
      profile: {
        info_cache: {
          "Profile 1": { name: "Work" },
        },
      },
    };
    assert.strictEqual(parseProfileName(localState, "Unknown"), null);
  });

  test("returns null for empty state", () => {
    assert.strictEqual(parseProfileName({}, "Work"), null);
  });

  test("returns null for missing info_cache", () => {
    const localState = { profile: {} };
    assert.strictEqual(parseProfileName(localState, "Work"), null);
  });
});

describe("normalizeUrl", () => {
  test("adds https:// to bare domain", () => {
    assert.strictEqual(normalizeUrl("example.com"), "https://example.com");
  });

  test("adds https:// to domain with path", () => {
    assert.strictEqual(normalizeUrl("example.com/path"), "https://example.com/path");
  });

  test("preserves existing https://", () => {
    assert.strictEqual(normalizeUrl("https://example.com"), "https://example.com");
  });

  test("preserves existing http://", () => {
    assert.strictEqual(normalizeUrl("http://example.com"), "http://example.com");
  });

  test("handles uppercase protocol", () => {
    assert.strictEqual(normalizeUrl("HTTP://example.com"), "HTTP://example.com");
    assert.strictEqual(normalizeUrl("HTTPS://example.com"), "HTTPS://example.com");
  });
});

describe("filterRealPages", () => {
  test("filters http pages", () => {
    const pages = [
      { url: () => "http://example.com" },
      { url: () => "https://example.com" },
      { url: () => "devtools://devtools/bundled/inspector.html" },
      { url: () => "about:blank" },
    ];
    const filtered = filterRealPages(pages);
    assert.strictEqual(filtered.length, 2);
    assert.strictEqual(filtered[0].url(), "http://example.com");
    assert.strictEqual(filtered[1].url(), "https://example.com");
  });

  test("returns empty array when no http pages", () => {
    const pages = [
      { url: () => "devtools://devtools/bundled/inspector.html" },
      { url: () => "about:blank" },
    ];
    const filtered = filterRealPages(pages);
    assert.strictEqual(filtered.length, 0);
  });

  test("handles empty array", () => {
    assert.deepStrictEqual(filterRealPages([]), []);
  });
});

describe("getActivePage", () => {
  test("returns last real page when available", () => {
    const pages = [
      { url: () => "http://first.com" },
      { url: () => "https://second.com" },
      { url: () => "devtools://devtools" },
    ];
    const active = getActivePage(pages);
    assert.strictEqual(active.url(), "https://second.com");
  });

  test("falls back to last page when no real pages", () => {
    const pages = [
      { url: () => "about:blank" },
      { url: () => "devtools://devtools" },
    ];
    const active = getActivePage(pages);
    assert.strictEqual(active.url(), "devtools://devtools");
  });

  test("returns null for empty array", () => {
    assert.strictEqual(getActivePage([]), null);
  });
});

describe("formatTime", () => {
  test("returns time in HH:MM:SS.mmm format", () => {
    const time = formatTime();
    assert.strictEqual(time.length, 12);
    assert.match(time, /^\d{2}:\d{2}:\d{2}\.\d{3}$/);
  });
});

describe("formatLogEntry", () => {
  test("formats info level entry", () => {
    const entry = formatLogEntry("info", "", "test message");
    assert.ok(entry.includes("[INFO]"));
    assert.ok(entry.includes("test message"));
    assert.ok(entry.includes(levelColors.info));
    assert.ok(entry.includes(resetColor));
  });

  test("formats error level entry", () => {
    const entry = formatLogEntry("error", "", "error message");
    assert.ok(entry.includes("[ERROR]"));
    assert.ok(entry.includes("error message"));
    assert.ok(entry.includes(levelColors.error));
  });

  test("includes source when provided", () => {
    const entry = formatLogEntry("info", "network", "request made");
    assert.ok(entry.includes("[network]"));
    assert.ok(entry.includes("[INFO]"));
  });

  test("omits source tag when empty", () => {
    const entry = formatLogEntry("info", "", "message");
    assert.ok(!entry.includes("[]"));
  });

  test("defaults to info color for unknown level", () => {
    const entry = formatLogEntry("unknown", "", "message");
    assert.ok(entry.includes(levelColors.info));
  });
});

describe("BROWSERS config", () => {
  test("has chrome, brave, and edge configurations", () => {
    assert.ok(BROWSERS.chrome);
    assert.ok(BROWSERS.brave);
    assert.ok(BROWSERS.edge);
  });

  test("each browser has required properties", () => {
    for (const [name, config] of Object.entries(BROWSERS)) {
      assert.ok(config.name, `${name} missing name`);
      assert.ok(config.path, `${name} missing path`);
      assert.ok(config.process, `${name} missing process`);
      assert.ok(config.profileSource, `${name} missing profileSource`);
    }
  });

  test("paths are platform-specific", () => {
    if (isMac) {
      assert.ok(BROWSERS.chrome.path.includes("/Applications/"));
    } else if (isLinux) {
      assert.ok(BROWSERS.chrome.path.includes("/usr/bin/"));
    }
  });
});

describe("platform detection", () => {
  test("isMac and isLinux are mutually exclusive or both false", () => {
    assert.ok(!(isMac && isLinux));
  });

  test("platform values are booleans", () => {
    assert.strictEqual(typeof isMac, "boolean");
    assert.strictEqual(typeof isLinux, "boolean");
  });
});
