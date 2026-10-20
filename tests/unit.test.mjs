/**
 * Unit tests that need no Codex runtime: schema compilation, tool registration
 * and the argument validation the tools perform before touching any service.
 *
 * Run with `node --test tests/`.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { defineTool, parameterSchema } from "../lib/define-tool.mjs";
import { computerHelperLaunch, windowsCompileCommand } from "../lib/ax-client.mjs";
import { updatePageAction } from "../lib/update-host.mjs";
import { browserDenial, computerDenial, normalizeSettings } from "../lib/settings-store.mjs";
import { createComputerTool } from "../lib/computer-tool.mjs";
import { createBrowserTool, createBrowserUseTool } from "../lib/browser-tool.mjs";
import { apply } from "../index.js";

/** A context that records registrations and serves no services. */
function fakeContext() {
  const registered = new Map();
  return {
    registered,
    logger: { debug() {}, info() {}, warn() {} },
    tools: {
      register(definition) {
        registered.set(definition.name, definition);
        return () => registered.delete(definition.name);
      },
    },
    get: () => undefined,
    on() {},
  };
}

test("parameterSchema compiles required flags and annotations", () => {
  const schema = parameterSchema({
    action: { type: "string", required: true, enum: ["a", "b"], description: "pick one" },
    count: { type: "number", description: "how many" },
  });
  assert.equal(schema.type, "object");
  assert.deepEqual(schema.required, ["action"]);
  assert.deepEqual(schema.properties.action.enum, ["a", "b"]);
  assert.equal(schema.properties.action.description, "pick one");
  assert.equal(schema.properties.count.type, "number");
  assert.equal(schema.properties.count.required, undefined);
});

test("parameterSchema rejects a non-true required flag", () => {
  assert.throws(() => parameterSchema({ a: { type: "string", required: false } }), /must be true/);
});

test("parameterSchema rejects a schema with neither type nor oneOf", () => {
  assert.throws(() => parameterSchema({ a: { description: "no type" } }), /must declare/);
});

test("defineTool produces a registry-ready definition", () => {
  const definition = defineTool({
    name: "probe",
    description: "probe",
    parameters: { value: { type: "string", required: true } },
    output: { schema: { type: "string" }, render: (_args, value) => [{ type: "text", text: value }] },
    execute: async (args) => `got ${args.value}`,
  });
  assert.equal(definition.name, "probe");
  assert.deepEqual(definition.parameters.required, ["value"]);
  assert.equal(definition.output.schema.type, "string");
  assert.deepEqual(definition.output.render({}, "x"), [{ type: "text", text: "x" }]);
});

test("apply registers exactly the five tools", () => {
  const ctx = fakeContext();
  apply(ctx, {});
  assert.deepEqual([...ctx.registered.keys()].sort(), [
    "browser",
    "browser_use",
    "codex_tools_update",
    "computer_use",
    "session_message",
  ]);
});

test("apply honours the per-tool disable switches", () => {
  const ctx = fakeContext();
  apply(ctx, { computerUse: false, browser: false, browserUse: false, update: false });
  assert.deepEqual([...ctx.registered.keys()], ["session_message"]);
});

test("computer_use exposes every documented action", () => {
  const ctx = fakeContext();
  apply(ctx, {});
  const actions = ctx.registered.get("computer_use").parameters.properties.action.enum;
  assert.deepEqual(actions, [
    "list_apps",
    "list_windows",
    "get_state",
    "click",
    "type_text",
    "paste",
    "press_key",
    "scroll",
    "drag",
    "set_value",
    "select_text",
    "perform_secondary_action",
    "screenshot",
  ]);
});

test("browser exposes every documented action", () => {
  const ctx = fakeContext();
  apply(ctx, {});
  const actions = ctx.registered.get("browser").parameters.properties.action.enum;
  assert.ok(actions.includes("open_tab"));
  assert.ok(actions.includes("get_tab"));
  assert.ok(actions.includes("goto"));
  assert.ok(actions.includes("screenshot"));
});

test("session_message reports a missing Host service instead of failing obscurely", async () => {
  const ctx = fakeContext();
  apply(ctx, {});
  await assert.rejects(
    () => ctx.registered.get("session_message").execute({ action: "list_workspaces" }, {}),
    /session controller service/,
  );
});

test("session_message validates its own arguments before calling the Host", async () => {
  const ctx = fakeContext();
  const calls = [];
  ctx.get = (name) =>
    name === "sessionController"
      ? {
          list: async () => ({ items: [] }),
          create: async () => ({ sessionId: "s1" }),
          prompt: async (request) => calls.push(request),
          fork: async () => ({ sessionId: "s2" }),
          rename: async () => ({}),
        }
      : name === "workspaceRegistry"
        ? { list: () => [], create: async (path) => ({ id: "w1", path }) }
        : undefined;
  apply(ctx, {});
  const tool = ctx.registered.get("session_message");

  await assert.rejects(() => tool.execute({ action: "send" }, {}), /needs a `session_id`/);
  await assert.rejects(() => tool.execute({ action: "send", session_id: "s1" }, {}), /needs a non-empty `message`/);
  await assert.rejects(() => tool.execute({ action: "rename", session_id: "s1" }, {}), /needs a non-empty `title`/);
  await assert.rejects(() => tool.execute({ action: "dispatch" }, {}), /needs a non-empty `message`/);
  await assert.rejects(() => tool.execute({ action: "nonsense" }, {}), /unsupported session_message action/);
  assert.equal(calls.length, 0);
});

test("session_message send carries a requestId and an optional mode", async () => {
  const ctx = fakeContext();
  const calls = [];
  ctx.get = (name) =>
    name === "sessionController"
      ? { prompt: async (request) => calls.push(request), list: async () => ({ items: [] }) }
      : undefined;
  apply(ctx, {});
  const tool = ctx.registered.get("session_message");

  await tool.execute({ action: "send", session_id: "s1", message: "hello" }, {});
  assert.equal(calls[0].sessionId, "s1");
  assert.equal(typeof calls[0].requestId, "string");
  assert.deepEqual(calls[0].content, [{ type: "text", text: "hello" }]);
  assert.equal(calls[0].mode, undefined);

  await tool.execute({ action: "send", session_id: "s1", message: "stop", mode: "steer" }, {});
  assert.equal(calls[1].mode, "steer");
  assert.notEqual(calls[0].requestId, calls[1].requestId);
});

test("session_message dispatch prompts before it renames", async () => {
  const ctx = fakeContext();
  const order = [];
  ctx.get = (name) =>
    name === "sessionController"
      ? {
          create: async () => {
            order.push("create");
            return { sessionId: "s9" };
          },
          prompt: async () => order.push("prompt"),
          rename: async () => order.push("rename"),
          list: async () => ({ items: [] }),
        }
      : name === "workspaceRegistry"
        ? { list: () => [], create: async (path) => ({ id: "w1", path }) }
        : undefined;
  apply(ctx, {});
  const out = await ctx.registered
    .get("session_message")
    .execute({ action: "dispatch", workspace: "/tmp/example", message: "do it", title: "T" }, {});
  assert.deepEqual(order, ["create", "prompt", "rename"]);
  assert.match(out, /Started session s9/);
  assert.match(out, /titled "T"/);
});

test("session_message dispatch reports a rejected prompt with its cause", async () => {
  const ctx = fakeContext();
  ctx.get = (name) =>
    name === "sessionController"
      ? {
          create: async () => ({ sessionId: "s9" }),
          prompt: async () => {
            const error = new Error("prompt rejected");
            error.code = "session/agent-busy";
            error.info = { reason: "agent is running" };
            throw error;
          },
          list: async () => ({ items: [] }),
        }
      : name === "workspaceRegistry"
        ? { list: () => [], create: async (path) => ({ id: "w1", path }) }
        : undefined;
  apply(ctx, {});
  await assert.rejects(
    () => ctx.registered.get("session_message").execute({ action: "dispatch", workspace: "/tmp/x", message: "m" }, {}),
    /session s9 was created .* but the prompt was not accepted: prompt rejected \{"reason":"agent is running"\} code=session\/agent-busy/,
  );
});

test("session_message resolves a workspace by id, path or title", async () => {
  const ctx = fakeContext();
  const workspaces = [
    { id: "w1", path: "/tmp/alpha", title: "Alpha", sessionIds: ["s1"] },
    { id: "w2", path: "/tmp/beta", title: "Beta", sessionIds: [] },
  ];
  ctx.get = (name) =>
    name === "workspaceRegistry"
      ? { list: () => workspaces, create: async (path) => ({ id: "w3", path }) }
      : name === "sessionController"
        ? { list: async () => ({ items: [{ sessionId: "s1", title: "one" }, { sessionId: "s2" }] }) }
        : undefined;
  apply(ctx, {});
  const tool = ctx.registered.get("session_message");

  const byId = JSON.parse(await tool.execute({ action: "list_sessions", workspace: "w1" }, {}));
  assert.deepEqual(byId.map((row) => row.sessionId), ["s1"]);

  const byPath = await tool.execute({ action: "list_sessions", workspace: "/tmp/beta" }, {});
  assert.equal(byPath, "No matching sessions.");

  const byTitle = JSON.parse(await tool.execute({ action: "list_sessions", workspace: "alph" }, {}));
  assert.deepEqual(byTitle.map((row) => row.sessionId), ["s1"]);

  await assert.rejects(
    () => tool.execute({ action: "list_sessions", workspace: "nope" }, {}),
    /no workspace matches "nope"/,
  );
});

/** Records backend calls instead of driving Accessibility or Chrome. */
function recordingBackend() {
  const calls = [];
  return {
    calls,
    async call(action, args) {
      calls.push({ action, args });
      return { text: "ok", boundId: args.tab_id ?? args.boundId ?? (action === "open_tab" ? "tab-new" : undefined) };
    },
  };
}

test("computer_use passes element indices as numbers, not strings", async () => {
  const ax = recordingBackend();
  const tool = createComputerTool({ ax, defineTool });
  await tool.execute({ action: "click", app: "Finder", element_index: "250" }, {});
  assert.equal(ax.calls[0].args.element_index, 250);
  await tool.execute({ action: "set_value", app: "Finder", element_index: "12", value: "x" }, {});
  assert.equal(ax.calls[2].args.element_index, 12);
  await tool.execute({ action: "select_text", app: "Finder", element_index: "7", text: "hi" }, {});
  assert.equal(ax.calls[4].args.element_index, 7);
  await tool.execute({ action: "perform_secondary_action", app: "Finder", element_index: "3", action_name: "Raise" }, {});
  assert.equal(ax.calls[6].args.element_index, 3);
  await tool.execute({ action: "scroll", app: "Finder", element_index: "9", direction: "down" }, {});
  assert.equal(ax.calls[8].args.element_index, 9);
});

test("computer_use still accepts a pixel target and rejects a missing one", async () => {
  const ax = recordingBackend();
  const tool = createComputerTool({ ax, defineTool });
  await tool.execute({ action: "click", app: "Finder", x: 10, y: 20 }, {});
  assert.equal(ax.calls[0].args.x, 10);
  assert.equal(ax.calls[0].args.y, 20);
  await assert.rejects(
    () => tool.execute({ action: "click", app: "Finder" }, {}),
    /needs either `element_index` or both `x` and `y`/,
  );
});

test("computer_use does not append a second state read for get_state", async () => {
  const ax = recordingBackend();
  const tool = createComputerTool({ ax, defineTool });
  await tool.execute({ action: "get_state", app: "Finder" }, {});
  assert.deepEqual(ax.calls.map((call) => call.action), ["get_state"]);

  await tool.execute({ action: "click", app: "Finder", element_index: "1" }, {});
  assert.deepEqual(ax.calls.slice(1).map((call) => call.action), ["click", "get_state"]);

  await tool.execute({ action: "click", app: "Finder", element_index: "1", return_state: false }, {});
  assert.deepEqual(ax.calls.slice(3).map((call) => call.action), ["click"]);
});

test("browser passes element indices as numbers and null for the focused element", async () => {
  const driver = recordingBackend();
  const tool = createBrowserTool({ driver, defineTool });
  await tool.execute({ action: "click", tab_id: "t1", element_index: "42" }, {});
  assert.equal(driver.calls[0].args.element_index, 42);
  await tool.execute({ action: "type_text", tab_id: "t1", text: "hi" }, {});
  assert.equal(driver.calls[2].args.element_index, undefined);
  await tool.execute({ action: "type_text", tab_id: "t1", element_index: "5", text: "hi" }, {});
  assert.equal(driver.calls[4].args.element_index, 5);
  await tool.execute({ action: "set_value", tab_id: "t1", element_index: "8", value: "v" }, {});
  assert.equal(driver.calls[6].args.element_index, 8);
});

test("browser reuses a bound tab and rebinds when the target changes", async () => {
  const driver = recordingBackend();
  const tool = createBrowserTool({ driver, defineTool });
  await tool.execute({ action: "state", tab_id: "t1" }, {});
  assert.equal(driver.calls[0].args.tab_id, "t1");
  await tool.execute({ action: "state", tab_id: "t1" }, {});
  assert.equal(driver.calls[1].args.tab_id, "t1");
  await tool.execute({ action: "state", url: "https://example.test/" }, {});
  assert.equal(driver.calls[2].args.url, "https://example.test/");
  const fresh = createBrowserTool({ driver: recordingBackend(), defineTool });
  await assert.rejects(() => fresh.execute({ action: "state" }, {}), /needs `tab_id` or `url`/);
});

test("list actions reach the local backends and never a Codex runtime", async () => {
  const ax = recordingBackend();
  const driver = recordingBackend();
  const computer = createComputerTool({ ax, defineTool });
  const browser = createBrowserTool({ driver, defineTool });
  await computer.execute({ action: "list_apps" }, {});
  await browser.execute({ action: "list_browsers" }, {});
  assert.deepEqual(ax.calls.map((call) => call.action), ["list_apps"]);
  assert.deepEqual(driver.calls.map((call) => call.action), ["list_browsers"]);
});

test("browser_use opens a tab through its own driver", async () => {
  const driver = recordingBackend();
  const tool = createBrowserUseTool({ driver, defineTool });
  assert.equal(tool.name, "browser_use");
  await tool.execute({ action: "open_tab", url: "http://127.0.0.1:3000" }, {});
  assert.equal(driver.calls[0].action, "open_tab");
  assert.equal(driver.calls[0].args.url, "http://127.0.0.1:3000");
  await tool.execute({ action: "list_tabs" }, {});
  assert.equal(driver.calls[1].action, "list_tabs");
});

test("browser open_tab does not require a Codex browser id", async () => {
  const driver = recordingBackend();
  const tool = createBrowserTool({ driver, defineTool });
  await tool.execute({ action: "open_tab", url: "https://example.com" }, {});
  assert.equal(driver.calls[0].action, "open_tab");
  assert.equal(driver.calls[0].args.url, "https://example.com");
  assert.equal(driver.calls[0].args.browser, undefined);
});

test("computer helper launches its own Windows program, not PowerShell", () => {
  const launch = computerHelperLaunch("win32");
  assert.match(launch.command, /dsh-uia\.exe$/);
  assert.deepEqual(launch.args, []);
  assert.equal(launch.label, "dsh-uia");
  assert.equal(JSON.stringify(launch).toLowerCase().includes("powershell"), false);
});

test("windows helper is compiled with the built-in C# compiler", () => {
  const exists = (path) => path.replaceAll("\\", "/").includes("Framework64") && (path.endsWith("csc.exe") || path.endsWith(".dll"));
  const plan = windowsCompileCommand({ systemRoot: "C:\\Windows", pluginRoot: "D:\\plugin", exists });
  assert.match(plan.command, /csc\.exe$/);
  assert.match(plan.output, /dsh-uia\.exe$/);
  assert.match(plan.source, /dsh-uia\.cs$/);
  assert.equal(plan.args.includes(plan.source), true);
  assert.equal(JSON.stringify(plan).toLowerCase().includes("powershell"), false);
});

test("computer helper selects the macOS accessibility binary on darwin", () => {
  const launch = computerHelperLaunch("darwin");
  assert.match(launch.command, /dsh-ax$/);
  assert.deepEqual(launch.args, []);
  assert.equal(launch.label, "dsh-ax");
});

test("computer helper rejects systems other than macOS and Windows", () => {
  assert.throws(() => computerHelperLaunch("linux"), /does not support linux/);
});

test("the update page accepts check and a confirmed install only", () => {
  assert.equal(updatePageAction({ action: "check" }), "check");
  assert.equal(updatePageAction({ action: "install", confirm: true }), "install");
  assert.equal(updatePageAction({ action: "install", confirm: false }), null);
  assert.equal(updatePageAction({ action: "install", confirm: true, extra: 1 }), null);
});

test("settings keep only the computer and browser switches", () => {
  const settings = normalizeSettings({ computerEnabled: false, anyApp: false, allowedApps: [" Safari ", "safari", 3], browserEnabled: false, extra: true });
  assert.equal(settings.computerEnabled, false);
  assert.equal(settings.anyApp, false);
  assert.deepEqual(settings.allowedApps, ["Safari"]);
  assert.equal(settings.browserEnabled, false);
  assert.equal(settings.browserUseEnabled, true);
  assert.equal(settings.fullCdp, true);
  assert.equal(settings.showFullUrl, true);
});

test("computer use refuses an app that is not always allowed", () => {
  const settings = normalizeSettings({ anyApp: false, allowedApps: ["Safari"] });
  assert.equal(computerDenial(settings, "Notes"), "「Notes」不在始终允许的应用里。到「电脑操作」里打开任意应用，或把这个应用加进去。");
  assert.equal(computerDenial(settings, "Safari"), null);
  assert.equal(computerDenial(normalizeSettings({ computerEnabled: false }), "Safari"), "电脑操作已在设置里关闭。");
});

test("each browser window can be closed from settings", () => {
  const settings = normalizeSettings({ browserUseEnabled: false });
  assert.equal(browserDenial(settings, "browser"), null);
  assert.equal(browserDenial(settings, "browser-use"), "浏览器已在设置里关闭。");
});

