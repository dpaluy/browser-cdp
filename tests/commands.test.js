import { test, describe, before, after } from "node:test";
import assert from "node:assert";
import { execFileSync, spawn } from "node:child_process";
import { existsSync, readFileSync, unlinkSync } from "node:fs";
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
