/**
 * Live window-addressing tests. They drive the real helper against the real
 * desktop, so they only run when DSH_LIVE_WINDOWS=1:
 *
 *     npm run test:windows            (PowerShell: $env:DSH_LIVE_WINDOWS=1; npm run test:windows)
 *
 * They never type into a window: the input path is exercised with an empty
 * string, which still runs the foreground check and the error mapping.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { defineTool } from "../lib/define-tool.mjs";
import { createComputerTool } from "../lib/computer-tool.mjs";
import { AxClient } from "../lib/ax-client.mjs";

const skip = process.env.DSH_LIVE_WINDOWS === "1"
  ? false
  : "set DSH_LIVE_WINDOWS=1 to drive the real desktop";

const ax = new AxClient();
const tool = createComputerTool({ ax, defineTool });

test.after(async () => {
  await ax.dispose();
});

/** The machine's visible top-level windows, straight from the helper. */
async function inventory() {
  const result = await ax.call("list_windows", {});
  return Array.isArray(result.windows) ? result.windows : [];
}

test("list_windows names pid, handle, title and session for every window", { skip }, async () => {
  const rows = await inventory();
  assert.ok(rows.length > 0, "expected at least one visible window");
  for (const row of rows) {
    assert.ok(Number.isInteger(row.pid) && row.pid > 0, `pid must be a real process id, got ${row.pid}`);
    assert.ok(Number.isInteger(row.hwnd) && row.hwnd > 0, `hwnd must be a real handle, got ${row.hwnd}`);
    assert.match(row.hwnd_hex, /^0x[0-9A-F]{8}$/);
    assert.equal(typeof row.title, "string");
    assert.ok(Number.isInteger(row.session), "session must be reported so cross-session windows are obvious");
  }
  const text = (await ax.call("list_windows", {})).text;
  assert.match(text, /pid=\d+ hwnd=0x[0-9A-F]{8} "/);
  assert.match(text, /session \d+/);
});

test("an app name with several windows is refused, never guessed", { skip }, async (t) => {
  const rows = await inventory();
  const groups = new Map();
  for (const row of rows) {
    const key = row.process;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  const entry = [...groups.entries()].find(([process, list]) => process && list.length > 1);
  if (entry === undefined) {
    t.skip("this machine has no single app with two visible windows");
    return;
  }
  const [process, list] = entry;
  await assert.rejects(
    () => tool.execute({ action: "get_state", app: process }, {}),
    (error) => {
      assert.equal(error.code, "ambiguous_window");
      for (const row of list) assert.ok(error.message.includes(row.hwnd_hex), `${row.hwnd_hex} must be listed as a candidate`);
      assert.match(error.message, /window_handle/);
      return true;
    },
  );
});

test("two windows of one process stay apart", { skip }, async (t) => {
  const rows = await inventory();
  const groups = new Map();
  for (const row of rows) {
    if (!groups.has(row.pid)) groups.set(row.pid, []);
    groups.get(row.pid).push(row);
  }
  const entry = [...groups.entries()].find(([, list]) => list.length > 1);
  if (entry === undefined) {
    t.skip("no single process with two visible windows on this machine");
    return;
  }
  const [pid, list] = entry;
  const [first, second] = list;

  // A pid is not a window: inside one process it still leaves two candidates.
  await assert.rejects(
    () => tool.execute({ action: "get_state", app: first.process, pid }, {}),
    (error) => {
      assert.equal(error.code, "ambiguous_window");
      for (const row of list) assert.ok(error.message.includes(row.hwnd_hex), `${row.hwnd_hex} must be listed as a candidate`);
      return true;
    },
  );

  // An index from one window must not be usable against its sibling.
  const state = await ax.call("get_state", { app: first.process, window_handle: first.hwnd_hex });
  assert.equal(state.target.hwnd, first.hwnd);
  await assert.rejects(
    () => tool.execute({ action: "click", app: second.process, window_handle: second.hwnd_hex, element_index: "1", return_state: false }, {}),
    (error) => {
      assert.equal(error.code, "element_from_other_window");
      assert.ok(error.message.includes(first.hwnd_hex), "the source window must be named");
      assert.ok(error.message.includes(second.hwnd_hex), "the target window must be named");
      return true;
    },
  );
});

test("a pid selects exactly one window and its tree", { skip }, async () => {
  const rows = await inventory();
  const row = rows.find((item) => item.process) ?? rows[0];
  const state = await ax.call("get_state", { app: row.process, pid: row.pid });
  assert.equal(state.target.pid, row.pid);
  assert.equal(state.target.hwnd, row.hwnd);
  assert.match(state.text, new RegExp(`^target: pid=${row.pid} hwnd=${row.hwnd_hex}`));
});

test("a window handle addresses the same window as its pid", { skip }, async () => {
  const rows = await inventory();
  const row = rows.find((item) => item.process) ?? rows[0];
  const byHandle = await ax.call("get_state", { app: row.process, window_handle: row.hwnd_hex });
  assert.equal(byHandle.target.hwnd, row.hwnd);
  const byPid = await ax.call("get_state", { app: row.process, pid: row.pid, window_handle: row.hwnd_hex });
  assert.equal(byPid.count, byHandle.count);
});

test("input on a target window either works or fails with a coded reason", { skip }, async () => {
  const rows = await inventory();
  const row = rows.find((item) => item.title.length > 0 && item.process) ?? rows[0];
  try {
    const text = await tool.execute({ action: "type_text", app: row.process, pid: row.pid, text: "" }, {});
    assert.match(text, /on pid=\d+ hwnd=0x[0-9A-F]{8}/, "a successful input must name the window it used");
  } catch (error) {
    assert.ok(
      error.code === "foreground_denied" || error.code === "input_denied",
      `a denied input must carry a code, got ${String(error.code)}: ${error.message}`,
    );
    assert.doesNotMatch(error.message, /^拒绝访问$/);
    assert.match(error.message, /hwnd=0x[0-9A-F]{8}/);
    if (Number.isInteger(error.details?.win32)) {
      assert.match(error.message, /win32=\d+ (ERROR_|WIN32_)/);
    }
  }
});
