/**
 * Regression tests for window addressing in `computer_use`.
 *
 * The bug these lock down: `app: "chrome"` used to resolve to the first Chrome
 * process, so on a machine with two Chrome windows a click landed in the wrong
 * page and `type_text` failed with a bare localized "access denied". A name that
 * matches several windows must now refuse, list the candidates, and accept an
 * explicit pid, handle or title.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";

import { defineTool } from "../lib/define-tool.mjs";
import { createComputerTool } from "../lib/computer-tool.mjs";
import { AxClient } from "../lib/ax-client.mjs";
import {
  describeCandidate,
  formatHelperFailure,
  parseWindowHandle,
  win32Name,
  windowSelection,
} from "../lib/window-target.mjs";

/** The two Chrome windows that caused the bug. */
const CHROME_GO_NAVI = { pid: 4336, hwnd: 7868876, hwnd_hex: "0x007809CC", title: "GoNavi - Google Chrome", process: "chrome", session: 1 };
const CHROME_MARKET = { pid: 32272, hwnd: 524780, hwnd_hex: "0x000801EC", title: "GoNavi 插件市场 - Google Chrome", process: "chrome", session: 1 };

/** Records backend calls instead of driving UI Automation. */
function recordingBackend() {
  const calls = [];
  return {
    calls,
    async call(action, args) {
      calls.push({ action, args });
      return { text: "ok" };
    },
  };
}

/**
 * A stand-in for the helper process: every JSON line gets the reply the test returns.
 * @param handler - Maps one request message to a helper reply.
 */
function fakeHelper(handler) {
  const child = new EventEmitter();
  child.exitCode = null;
  child.stdout = new EventEmitter();
  child.stdout.setEncoding = () => {};
  child.stderr = new EventEmitter();
  child.kill = () => {};
  child.stdin = {
    write(chunk) {
      const message = JSON.parse(String(chunk).trim());
      const reply = handler(message);
      setImmediate(() => child.stdout.emit("data", `${JSON.stringify({ id: message.id, ...reply })}\n`));
    },
  };
  return child;
}

/** An AxClient wired to a fake helper instead of a spawned process. */
function fakeClient(handler) {
  return new AxClient({
    launch: { command: "fake-helper", args: [], label: "dsh-uia", requiredPath: process.execPath },
    spawn: () => fakeHelper(handler),
  });
}

test("a window handle is accepted as decimal or 0x hex and nothing else", () => {
  assert.equal(parseWindowHandle(undefined), undefined);
  assert.equal(parseWindowHandle(""), undefined);
  assert.equal(parseWindowHandle("   "), undefined);
  assert.equal(parseWindowHandle("0x000801EC"), 524780);
  assert.equal(parseWindowHandle(524780), 524780);
  assert.equal(parseWindowHandle("524780"), 524780);
  assert.throws(() => parseWindowHandle("the market window"), /is not a window handle/);
  assert.throws(() => parseWindowHandle(0), /is not a window handle/);
});

test("selectors keep only what the caller supplied and trim the title", () => {
  assert.deepEqual(windowSelection({}), {});
  assert.deepEqual(windowSelection({ pid: 32272 }), { pid: 32272 });
  assert.deepEqual(
    windowSelection({ pid: "32272", window_handle: "0x000801EC", window_title: "  插件市场  " }),
    { pid: 32272, window_handle: 524780, window_title: "插件市场" },
  );
  assert.throws(() => windowSelection({ pid: "chrome" }), /pid must be a positive integer/);
  assert.throws(() => windowSelection({ pid: -1 }), /pid must be a positive integer/);
  // A title that is not a string must not quietly disappear: the caller would
  // believe it had pinned a window.
  assert.throws(() => windowSelection({ window_title: 2024 }), /window_title must be a string/);
  assert.throws(() => windowSelection({ window_title: { text: "插件市场" } }), /window_title must be a string/);
});

test("candidate rows name pid, handle, title and session", () => {
  assert.equal(
    describeCandidate(CHROME_MARKET),
    '  - pid=32272 hwnd=0x000801EC "GoNavi 插件市场 - Google Chrome" (chrome, session 1)',
  );
  assert.equal(
    describeCandidate({ ...CHROME_GO_NAVI, minimized: true }),
    '  - pid=4336 hwnd=0x007809CC "GoNavi - Google Chrome" (chrome, session 1, minimized)',
  );
  // A row without the hex field still renders a handle.
  assert.match(describeCandidate({ pid: 7, hwnd: 524780, title: "x" }), /hwnd=0x000801EC/);
});

test("win32 codes are named, not left as a number", () => {
  assert.equal(win32Name(5), "ERROR_ACCESS_DENIED");
  assert.equal(win32Name(1400), "ERROR_INVALID_WINDOW_HANDLE");
  assert.equal(win32Name(1234), "WIN32_1234");
  assert.equal(win32Name(undefined), null);
});

test("an ambiguous app error lists every candidate and the selectors to use", () => {
  const text = formatHelperFailure({
    code: "ambiguous_window",
    error: 'app "chrome" matches 2 windows; refusing to guess which one you mean.',
    details: { windows: [CHROME_GO_NAVI, CHROME_MARKET] },
  });
  assert.match(text, /refusing to guess/);
  assert.match(text, /pid=4336 hwnd=0x007809CC "GoNavi - Google Chrome"/);
  assert.match(text, /pid=32272 hwnd=0x000801EC "GoNavi 插件市场 - Google Chrome"/);
  assert.match(text, /\(ambiguous_window\)$/);
});

test("candidates are not duplicated when the helper already listed them", () => {
  const error = `app "chrome" matches 2 windows:\n  - pid=4336 hwnd=0x007809CC "GoNavi - Google Chrome"\n  - pid=32272 hwnd=0x000801EC "GoNavi 插件市场 - Google Chrome"`;
  const text = formatHelperFailure({ code: "ambiguous_window", error, details: { windows: [CHROME_GO_NAVI, CHROME_MARKET] } });
  assert.equal(text.match(/pid=4336/g).length, 1);
});

test("a denied keystroke keeps the win32 code, the target and the foreground", () => {
  const text = formatHelperFailure({
    code: "input_denied",
    error: 'sending keys to pid=32272 hwnd=0x000801EC "GoNavi 插件市场 - Google Chrome" failed even though the window was verified as foreground.',
    details: { win32: 5, target: CHROME_MARKET, foreground: { pid: 36396, hwnd_hex: "0x01AC0C88", title: "GoNavi" }, same_session: true },
  });
  assert.match(text, /verified as foreground/);
  assert.match(text, /win32=5 ERROR_ACCESS_DENIED/);
  assert.match(text, /input_denied/);
  assert.doesNotMatch(text, /cross-session/);
});

test("a cross-session window is called out instead of blamed on permissions", () => {
  const text = formatHelperFailure({
    code: "foreground_denied",
    error: 'could not focus pid=32272 hwnd=0x000801EC "GoNavi 插件市场 - Google Chrome" before clicking: it is still not the foreground window (Windows error 5 ERROR_ACCESS_DENIED).',
    details: { win32: 5, target: CHROME_MARKET, session: 2, same_session: false },
  });
  assert.match(text, /win32=5 ERROR_ACCESS_DENIED/);
  assert.match(text, /cross-session/);
});

test("computer_use refuses a pid without an app name", async () => {
  const ax = recordingBackend();
  const tool = createComputerTool({ ax, defineTool });
  await assert.rejects(
    () => tool.execute({ action: "get_state", pid: 32272 }, {}),
    /give `app` together with `pid`/,
  );
  assert.equal(ax.calls.length, 0);
});

test("selectors reach the helper and stay on the follow-up state read", async () => {
  const ax = recordingBackend();
  const tool = createComputerTool({ ax, defineTool });
  await tool.execute({ action: "click", app: "chrome", pid: 32272, element_index: "12" }, {});
  assert.equal(ax.calls[0].action, "click");
  assert.equal(ax.calls[0].args.pid, 32272);
  assert.equal(ax.calls[0].args.element_index, 12);
  assert.equal(ax.calls[1].action, "get_state");
  assert.equal(ax.calls[1].args.pid, 32272, "the state read must describe the window that was clicked");

  await tool.execute({ action: "type_text", app: "chrome", window_handle: "0x000801EC", window_title: "插件市场", text: "user" }, {});
  assert.equal(ax.calls[2].args.window_handle, 524780);
  assert.equal(ax.calls[2].args.window_title, "插件市场");
  assert.equal(ax.calls[3].args.window_handle, 524780);
  assert.equal(ax.calls[3].args.window_title, "插件市场", "the state read after typing must keep the title selector too");
  // The app name stays on every call: it is what the permission check reads.
  assert.equal(ax.calls[2].args.app, "chrome");
  assert.equal(ax.calls[3].args.app, "chrome");
});

test("a title or a handle alone never replaces the app name", async () => {
  const ax = recordingBackend();
  const tool = createComputerTool({ ax, defineTool });
  await assert.rejects(
    () => tool.execute({ action: "click", window_title: "插件市场", element_index: "3" }, {}),
    /give `app` together with `pid`/,
  );
  await assert.rejects(
    () => tool.execute({ action: "get_state", window_handle: "0x000801EC" }, {}),
    /give `app` together with `pid`/,
  );
  assert.equal(ax.calls.length, 0);
});

test("an ambiguous app never reaches the window and reports candidates instead", async () => {
  const seen = [];
  // The helper's own text is deliberately bare: the candidate list must come
  // from formatHelperFailure, not from a hint the fake wrote itself.
  const ax = fakeClient((message) => {
    seen.push(message.op);
    if (message.op === "get_state") {
      return {
        ok: false,
        code: "ambiguous_window",
        error: 'app "chrome" matches 2 windows; refusing to guess which one you mean.',
        details: { app: "chrome", windows: [CHROME_GO_NAVI, CHROME_MARKET] },
      };
    }
    return { ok: true, result: { text: "clicked 1" } };
  });
  const tool = createComputerTool({ ax, defineTool });
  await assert.rejects(
    () => tool.execute({ action: "get_state", app: "chrome" }, {}),
    (error) => {
      assert.equal(error.code, "ambiguous_window");
      assert.equal(error.details.windows.length, 2);
      assert.match(error.message, /refusing to guess/);
      assert.match(error.message, /pid=4336 hwnd=0x007809CC "GoNavi - Google Chrome"/);
      assert.match(error.message, /pid=32272 hwnd=0x000801EC "GoNavi 插件市场 - Google Chrome"/);
      assert.match(error.message, /\(ambiguous_window\)$/);
      return true;
    },
  );
  assert.deepEqual(seen, ["get_state"], "nothing may be clicked while the window is ambiguous");
  await ax.dispose();
});

test("a stale element from another window names both windows", async () => {
  const ax = fakeClient(() => ({
    ok: false,
    code: "element_from_other_window",
    error: `element_index 7 came from pid=4336 hwnd=0x007809CC "GoNavi - Google Chrome" (chrome, session 1), but this call targets pid=32272 hwnd=0x000801EC "GoNavi 插件市场 - Google Chrome". Run get_state for the window you mean.`,
    details: { element_source: CHROME_GO_NAVI, target: CHROME_MARKET },
  }));
  const tool = createComputerTool({ ax, defineTool });
  await assert.rejects(
    () => tool.execute({ action: "click", app: "chrome", pid: 32272, element_index: "7" }, {}),
    (error) => {
      assert.equal(error.code, "element_from_other_window");
      assert.match(error.message, /from pid=4336/);
      assert.match(error.message, /targets pid=32272/);
      assert.match(error.message, /Run get_state/);
      return true;
    },
  );
  await ax.dispose();
});
