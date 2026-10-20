/**
 * Live tests against the installed Codex Computer Use runtime.
 *
 * These start a real `cua-repl` child process, read the real accessibility tree
 * and list the real browser tabs, so they only run when the runtime is present.
 * Skip them on a machine without ChatGPT.app.
 *
 * Run with `node --test tests/live.test.mjs`.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { CuaReplClient, resolveCuaRuntime } from "../lib/cua-repl-client.mjs";

/** Whether the Codex runtime is installed on this machine. */
function runtimeAvailable() {
  try {
    resolveCuaRuntime();
    return true;
  } catch {
    return false;
  }
}

const available = runtimeAvailable();
const skip = available ? false : "Codex Computer Use runtime is not installed";

test("resolveCuaRuntime finds a complete runtime", { skip }, () => {
  const runtime = resolveCuaRuntime();
  assert.match(runtime.root, /cua_node$/);
  assert.match(runtime.nodeBin, /bin\/node$/);
  assert.match(runtime.nodeRepl, /bin\/node_repl$/);
  assert.match(runtime.launcher, /cua-repl\/bin\/cua-repl\.mjs$/);
});

test("the REPL server starts and advertises its tools", { skip }, async () => {
  const client = new CuaReplClient({});
  try {
    const info = await client.start();
    assert.equal(typeof info.name, "string");
    const tools = await client.listTools();
    const names = tools.map((tool) => tool.name);
    assert.ok(names.includes("js"), `expected a js tool, got ${names.join(", ")}`);
    assert.ok(names.includes("js_reset"));
  } finally {
    await client.dispose();
  }
});

test("listApps returns the machine's applications without first-use noise", { skip }, async () => {
  const client = new CuaReplClient({});
  try {
    const text = await client.runJsText(
      [
        "await (async () => {",
        "const apps = await cua.listApps({ emit: false });",
        "nodeRepl.write(JSON.stringify(apps.map((a) => a.displayName ?? a.id)));",
        "})();",
      ].join("\n"),
      { title: "list apps" },
    );
    assert.ok(!text.includes("## Computer Use"), "the first-use manual should have been absorbed by the warm-up");
    const apps = JSON.parse(text);
    assert.ok(Array.isArray(apps));
    assert.ok(apps.length > 0, "expected at least one application");
  } finally {
    await client.dispose();
  }
});

test("browser inventory answers once turn metadata is supplied", { skip }, async () => {
  const client = new CuaReplClient({
    requestMeta: () => ({ session_id: "dsh-codex-tools-test", turn_id: `turn-${Date.now()}` }),
  });
  try {
    // The async IIFE is the shape the tools generate: it keeps every binding
    // scoped to the call, so repeated calls cannot redeclare a top-level name.
    const text = await client.runJsText(
      [
        "await (async () => {",
        "const browsers = await cua.listBrowsers({ emit: false });",
        "nodeRepl.write(JSON.stringify(browsers.map((b) => ({ id: b.id, name: b.name, type: b.type }))));",
        "})();",
      ].join("\n"),
      { title: "list browsers" },
    );
    assert.ok(!text.includes("Missing required Codex turn metadata"), text.slice(0, 200));
    const browsers = JSON.parse(text);
    assert.ok(Array.isArray(browsers));
  } finally {
    await client.dispose();
  }
});

test("the runtime asks for app approval through elicitation", { skip }, async () => {
  const client = new CuaReplClient({ approval: "accept" });
  try {
    const text = await client.runJsText(
      'const app = await cua.getApp("com.apple.finder"); nodeRepl.write(await app.getAXState());',
      { title: "read finder" },
    );
    assert.ok(!text.includes("createElicitation is unavailable"), text.slice(0, 200));
    assert.ok(text.length > 0, "expected an accessibility tree");
  } finally {
    await client.dispose();
  }
});
