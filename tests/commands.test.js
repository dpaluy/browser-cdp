import { test, describe, before, after } from "node:test";
import assert from "node:assert";
import { execFileSync, spawn } from "node:child_process";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PORT = "9333";
const CLI = "./cli.js";

function run(args, options = {}) {
  const env = { ...process.env, DEBUG_PORT: PORT };
  const cmdArgs = Array.isArray(args) ? args : args.split(" ");
  return execFileSync("node", [CLI, ...cmdArgs], {
    encoding: "utf8",
    env,
    timeout: 30000,
    ...options,
  });
}

function isBrowserRunning() {
  try {
    const response = execFileSync("curl", ["-s", `http://localhost:${PORT}/json/version`], {
      encoding: "utf8",
      timeout: 2000,
    });
    return response.includes("webSocketDebuggerUrl");
  } catch {
    return false;
  }
}

async function waitFor(condition, timeout = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await condition()) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

describe("browser-cdp commands", { skip: process.env.SKIP_INTEGRATION }, () => {
  before(async () => {
    if (!isBrowserRunning()) {
      console.log("Starting browser for integration tests...");
      spawn("node", [CLI, "start", "--isolated"], {
        env: { ...process.env, DEBUG_PORT: PORT },
        detached: true,
        stdio: "ignore",
      }).unref();

      const ready = await waitFor(isBrowserRunning, 15000);
      if (!ready) {
        throw new Error("Failed to start browser for tests");
      }
      console.log("Browser started on port", PORT);
    }
  });

  after(async () => {
    try {
      run(["close"]);
      console.log("Browser closed");
    } catch {
      // Browser may already be closed
    }
  });

  describe("nav command", () => {
    test("navigates to URL", () => {
      const result = run(["nav", "https://example.com"]);
      assert.match(result, /example\.com/i);
    });

    test("adds https:// prefix when missing", () => {
      const result = run(["nav", "example.com"]);
      assert.match(result, /https:\/\/example\.com/i);
    });

    test("shows help with --help flag", () => {
      const result = run(["nav", "--help"]);
      assert.match(result, /Usage:/);
      assert.match(result, /--new/);
      assert.match(result, /--console/);
    });
  });

  describe("eval command", () => {
    test("evaluates simple expression", () => {
      run(["nav", "https://example.com"]);
      const result = run(["eval", "1 + 1"]);
      assert.strictEqual(result.trim(), "2");
    });

    test("evaluates document property", () => {
      run(["nav", "https://example.com"]);
      const result = run(["eval", "document.title"]);
      assert.ok(result.trim().length > 0);
    });

    test("shows help with --help flag", () => {
      const result = run(["eval", "--help"]);
      assert.match(result, /Usage:/);
      assert.match(result, /--console/);
    });
  });

  describe("dom command", () => {
    test("returns HTML content", () => {
      run(["nav", "https://example.com"]);
      const result = run(["dom"]);
      assert.match(result, /<html/i);
      assert.match(result, /<\/html>/i);
    });
  });

  describe("screenshot command", () => {
    test("creates screenshot file", () => {
      run(["nav", "https://example.com"]);
      const result = run(["screenshot"]);
      const filepath = result.trim();
      assert.match(filepath, /\.png$/);
      assert.ok(existsSync(filepath), `Screenshot file not found: ${filepath}`);
    });
  });

  describe("pdf command", () => {
    test("creates PDF file in temp directory", () => {
      run(["nav", "https://example.com"]);
      const result = run(["pdf"]);
      const filepath = result.trim();
      assert.match(filepath, /\.pdf$/);
      assert.ok(existsSync(filepath), `PDF file not found: ${filepath}`);
      const content = readFileSync(filepath);
      assert.strictEqual(content.slice(0, 4).toString(), "%PDF");
    });

    test("creates PDF with custom path", () => {
      const outputPath = join(tmpdir(), `test-output-${Date.now()}.pdf`);
      run(["nav", "https://example.com"]);
      run(["pdf", "--path", outputPath]);
      assert.ok(existsSync(outputPath), `PDF not found at custom path: ${outputPath}`);
      unlinkSync(outputPath);
    });

    test("accepts paper format option", () => {
      run(["nav", "https://example.com"]);
      const result = run(["pdf", "--format", "A4"]);
      assert.ok(existsSync(result.trim()));
    });

    test("accepts landscape orientation", () => {
      run(["nav", "https://example.com"]);
      const result = run(["pdf", "--landscape"]);
      assert.ok(existsSync(result.trim()));
    });

    test("shows help with --help flag", () => {
      const result = run(["pdf", "--help"]);
      assert.match(result, /Usage:/);
      assert.match(result, /--path/);
      assert.match(result, /--format/);
      assert.match(result, /--landscape/);
    });
  });

  describe("network command", () => {
    test("shows help with --help flag", () => {
      const result = run(["network", "--help"]);
      assert.match(result, /Usage:/);
      assert.match(result, /--filter/);
      assert.match(result, /--json/);
      assert.match(result, /--errors/);
      assert.match(result, /--duration/);
    });

    test("streams network traffic with duration", async () => {
      run(["nav", "https://example.com"]);

      const child = spawn("node", [CLI, "network", "--duration=2"], {
        env: { ...process.env, DEBUG_PORT: PORT },
      });

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      child.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      await new Promise((resolve) => child.on("close", resolve));

      assert.match(stderr, /Connected to:/);
      assert.match(stderr, /Listening for network activity/);
    });

    test("outputs JSON with --json flag", async () => {
      run(["nav", "https://example.com"]);

      const child = spawn("node", [CLI, "network", "--json", "--duration=2"], {
        env: { ...process.env, DEBUG_PORT: PORT },
      });

      let stdout = "";
      child.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      await new Promise((resolve) => child.on("close", resolve));

      if (stdout.trim()) {
        const lines = stdout.trim().split("\n");
        const firstEvent = JSON.parse(lines[0]);
        assert.ok(firstEvent.type);
        assert.ok(firstEvent.timestamp);
      }
    });
  });

  describe("insights command", () => {
    test("returns performance metrics", () => {
      run(["nav", "https://example.com"]);
      const result = run(["insights"]);
      assert.match(result, /Page Insights:/);
      assert.match(result, /Timing:/);
      assert.match(result, /TTFB:/);
    });

    test("returns JSON with --json flag", () => {
      run(["nav", "https://example.com"]);
      const result = run(["insights", "--json"]);
      const json = JSON.parse(result);
      assert.ok(json.url);
      assert.ok(json.timing);
      assert.ok(typeof json.timing.ttfb === "number");
    });

    test("shows help with --help flag", () => {
      const result = run(["insights", "--help"]);
      assert.match(result, /Usage:/);
      assert.match(result, /--json/);
    });
  });


  describe("cookies command", () => {
    test("shows help with --help flag", () => {
      const result = run(["cookies", "--help"]);
      assert.match(result, /Usage:/);
      assert.match(result, /export/);
      assert.match(result, /import/);
      assert.match(result, /clear/);
    });

    test("exports cookies to default file", () => {
      run(["nav", "https://example.com"]);
      const result = run(["cookies", "export"]);
      assert.match(result, /Exported.*cookie/i);
      assert.ok(existsSync("cookies.json"));
      const content = JSON.parse(readFileSync("cookies.json", "utf8"));
      assert.ok(Array.isArray(content));
      unlinkSync("cookies.json");
    });

    test("exports cookies to custom path", () => {
      const timestamp = Date.now();
      const outputPath = join(tmpdir(), `test-cookies-${timestamp}.json`);
      run(["nav", "https://example.com"]);
      run(["cookies", "export", "--path", outputPath]);
      assert.ok(existsSync(outputPath));
      const content = JSON.parse(readFileSync(outputPath, "utf8"));
      assert.ok(Array.isArray(content));
      unlinkSync(outputPath);
    });

    test("imports cookies from file", () => {
      const timestamp = Date.now();
      const cookieFile = join(tmpdir(), `test-import-${timestamp}.json`);
      const testCookies = [
        {
          name: "test_cookie",
          value: "test_value",
          domain: "example.com",
          path: "/",
        },
      ];
      writeFileSync(cookieFile, JSON.stringify(testCookies));

      run(["nav", "https://example.com"]);
      const result = run(["cookies", "import", cookieFile]);
      assert.match(result, /Imported.*cookie/i);
      unlinkSync(cookieFile);
    });

    test("clears all cookies", () => {
      run(["nav", "https://example.com"]);
      const result = run(["cookies", "clear"]);
      assert.match(result, /Cleared all cookies/i);
    });
  });
  describe("storage command", () => {
    test("shows help with --help flag", () => {
      const result = run(["storage", "--help"]);
      assert.match(result, /Usage:/);
      assert.match(result, /get/);
      assert.match(result, /set/);
      assert.match(result, /list/);
      assert.match(result, /clear/);
      assert.match(result, /export/);
      assert.match(result, /import/);
      assert.match(result, /--session/);
    });

    test("sets and gets value", () => {
      run(["nav", "https://example.com"]);
      run(["storage", "set", "testKey", "testValue"]);
      const result = run(["storage", "get", "testKey"]);
      assert.strictEqual(result.trim(), "testValue");
    });

    test("sets and gets multi-word value", () => {
      run(["nav", "https://example.com"]);
      run(["storage", "set", "message", "hello", "world"]);
      const result = run(["storage", "get", "message"]);
      assert.strictEqual(result.trim(), "hello world");
    });

    test("lists storage keys", () => {
      run(["nav", "https://example.com"]);
      run(["storage", "clear"]);
      run(["storage", "set", "key1", "value1"]);
      run(["storage", "set", "key2", "value2"]);
      const result = run(["storage", "list"]);
      assert.match(result, /Keys in localStorage:/);
      assert.match(result, /key1/);
      assert.match(result, /key2/);
    });

    test("clears storage", () => {
      run(["nav", "https://example.com"]);
      run(["storage", "set", "clearMe", "value"]);
      run(["storage", "clear"]);
      const result = run(["storage", "list"]);
      assert.match(result, /No keys found/);
    });

    test("exports storage to default file", () => {
      run(["nav", "https://example.com"]);
      run(["storage", "clear"]);
      run(["storage", "set", "exportKey", "exportValue"]);
      const result = run(["storage", "export"]);
      assert.match(result, /Exported.*item/i);
      assert.ok(existsSync("storage.json"));
      const content = JSON.parse(readFileSync("storage.json", "utf8"));
      assert.strictEqual(content.exportKey, "exportValue");
      unlinkSync("storage.json");
    });

    test("exports storage to custom path", () => {
      const timestamp = Date.now();
      const outputPath = join(tmpdir(), `test-storage-${timestamp}.json`);
      run(["nav", "https://example.com"]);
      run(["storage", "clear"]);
      run(["storage", "set", "customKey", "customValue"]);
      run(["storage", "export", "--path", outputPath]);
      assert.ok(existsSync(outputPath));
      const content = JSON.parse(readFileSync(outputPath, "utf8"));
      assert.strictEqual(content.customKey, "customValue");
      unlinkSync(outputPath);
    });

    test("imports storage from file", () => {
      const timestamp = Date.now();
      const importFile = join(tmpdir(), `test-import-storage-${timestamp}.json`);
      const testData = { importedKey: "importedValue" };
      writeFileSync(importFile, JSON.stringify(testData));

      run(["nav", "https://example.com"]);
      run(["storage", "clear"]);
      const result = run(["storage", "import", importFile]);
      assert.match(result, /Imported.*item/i);

      const getValue = run(["storage", "get", "importedKey"]);
      assert.strictEqual(getValue.trim(), "importedValue");
      unlinkSync(importFile);
    });

    test("uses sessionStorage with --session flag", () => {
      run(["nav", "https://example.com"]);
      run(["storage", "clear", "--session"]);
      run(["storage", "set", "sessionKey", "sessionValue", "--session"]);
      const result = run(["storage", "get", "sessionKey", "--session"]);
      assert.strictEqual(result.trim(), "sessionValue");

      const listResult = run(["storage", "list", "--session"]);
      assert.match(listResult, /Keys in sessionStorage:/);
    });

    test("returns error for missing key", () => {
      run(["nav", "https://example.com"]);
      run(["storage", "clear"]);
      try {
        run(["storage", "get", "nonexistent"]);
        assert.fail("Should have thrown");
      } catch (e) {
        assert.match(e.stderr || e.message, /not found/);
      }
    });
  });

  describe("CLI basics", () => {
    test("shows version with --version", () => {
      const result = run(["--version"]);
      assert.match(result.trim(), /^\d+\.\d+\.\d+$/);
    });

    test("shows help with --help", () => {
      const result = run(["--help"]);
      assert.match(result, /browser-cdp/);
      assert.match(result, /Commands:/);
      assert.match(result, /start/);
      assert.match(result, /nav/);
      assert.match(result, /eval/);
    });

    test("shows error for unknown command", () => {
      try {
        run(["unknowncommand"]);
        assert.fail("Should have thrown");
      } catch (e) {
        assert.match(e.stderr || e.message, /Unknown command/);
      }
    });
  });
});

// Separate test for start/close lifecycle (doesn't need existing browser)
describe("browser lifecycle", { skip: process.env.SKIP_INTEGRATION }, () => {
  const LIFECYCLE_PORT = "9334";

  test("start and close browser", async () => {
    const env = { ...process.env, DEBUG_PORT: LIFECYCLE_PORT };

    const startResult = execFileSync("node", [CLI, "start", "--isolated"], {
      encoding: "utf8",
      env,
      timeout: 20000,
    });
    assert.match(startResult, /started/i);

    await waitFor(() => {
      try {
        execFileSync("curl", ["-s", `http://localhost:${LIFECYCLE_PORT}/json/version`], {
          encoding: "utf8",
          timeout: 2000,
        });
        return true;
      } catch {
        return false;
      }
    }, 5000);

    const closeResult = execFileSync("node", [CLI, "close"], {
      encoding: "utf8",
      env,
      timeout: 10000,
    });
    assert.match(closeResult, /closed/i);
  });
});
