/**
 * Unit tests that need no Codex runtime: schema compilation, tool registration
 * and the argument validation the tools perform before touching any service.
 *
 * Run with `node --test tests/`.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { defineTool, parameterSchema } from "../lib/define-tool.mjs";
import { computerHelperLaunch, windowsCompileCommand } from "../lib/ax-client.mjs";
import { UPDATE_PAGE_PATH, updatePageAction } from "../lib/update-host.mjs";
import { SETTINGS_PATH } from "../lib/settings-host.mjs";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { browserDenial, computerDenial, normalizeSettings } from "../lib/settings-store.mjs";
import { extensionLaunchFlags, isExcelApp, listPasswordSummaries, presentUrl, savePassword, useDataRoot } from "../lib/owned-data.mjs";
import { createComputerTool } from "../lib/computer-tool.mjs";
import { createBrowserTool } from "../lib/browser-tool.mjs";
import { apply, inject } from "../index.js";

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

test("apply registers exactly the four tools", () => {
  const ctx = fakeContext();
  apply(ctx, {});
  assert.deepEqual([...ctx.registered.keys()].sort(), [
    "browser",
    "codex_tools_update",
    "computer_use",
    "session_message",
  ]);
});

test("apply honours the per-tool disable switches", () => {
  const ctx = fakeContext();
  apply(ctx, { computerUse: false, browser: false, update: false });
  assert.deepEqual([...ctx.registered.keys()], ["session_message"]);
});

/**
 * Cordis throws when a plugin reads a service it did not inject. Optional
 * chaining still calls the getter, which a plain object does not reproduce.
 * @param {string[]} injected - Service names the plugin declared.
 */
function cordisContext(injected) {
  const allowed = new Set(injected);
  const registered = new Map();
  const routes = [];
  const services = {
    tools: {
      register(definition) {
        registered.set(definition.name, definition);
        return () => registered.delete(definition.name);
      },
    },
    connection: {
      fetch: {
        register(route) {
          routes.push(route.path);
          return async () => {};
        },
      },
    },
  };
  return new Proxy(services, {
    get(target, prop) {
      if (prop === "registered") return registered;
      if (prop === "routes") return routes;
      if (prop === "get") return () => undefined;
      if (prop === "on") return () => {};
      if (prop === "logger") return { debug() {}, info() {}, warn() {} };
      if (prop === "effect") return (run) => run();
      if (!allowed.has(prop)) throw new Error(`cannot get property "${String(prop)}" without inject`);
      if (target[prop] === undefined) throw new Error(`cannot get required service "${String(prop)}" in inactive context`);
      return target[prop];
    },
  });
}

test("reading connection without inject aborts apply", () => {
  const ctx = cordisContext(inject.filter((name) => name !== "connection"));
  assert.throws(() => apply(ctx, {}), /cannot get property "connection" without inject/);
});

test("declaring connection lets apply register the host routes", () => {
  assert.ok(inject.includes("tools"));
  assert.ok(inject.includes("connection"));
  const ctx = cordisContext(inject);
  apply(ctx, {});
  assert.deepEqual([...ctx.routes].sort(), [SETTINGS_PATH, UPDATE_PAGE_PATH].sort());
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

test("session_message send defaults to steer and only queues when asked", async () => {
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
  assert.equal(calls[0].mode, "steer");

  await tool.execute({ action: "send", session_id: "s1", message: "stop", mode: "steer" }, {});
  assert.equal(calls[1].mode, "steer");
  assert.notEqual(calls[0].requestId, calls[1].requestId);

  await tool.execute({ action: "send", session_id: "s1", message: "later", mode: "queue" }, {});
  assert.equal(calls[2].mode, "queue");
});

test("session_message send steers an attributed agent message with the sender session", async () => {
  const ctx = fakeContext();
  const steered = [];
  const followed = [];
  const prompted = [];
  ctx.get = (name) =>
    name === "sessionController"
      ? {
          resolveAgent: async (sessionId) => ({
            agent: {
              session: { header: { origin: "user" } },
              steer: (message) => steered.push({ sessionId, message }),
              followup: (message) => followed.push({ sessionId, message }),
            },
          }),
          prompt: async (request) => prompted.push(request),
          list: async () => ({ items: [{ sessionId: "sender-1", title: "迁移任务" }] }),
        }
      : undefined;
  apply(ctx, {});
  const tool = ctx.registered.get("session_message");

  await tool.execute({ action: "send", session_id: "target", message: "sync" }, { agent: { id: "sender-1" } });
  assert.equal(prompted.length, 0);
  assert.equal(steered.length, 1);
  assert.equal(steered[0].sessionId, "target");
  const message = steered[0].message;
  assert.equal(message.role, "user");
  assert.deepEqual(message.source, { kind: "agent-message", form: "relay", senderSessionId: "迁移任务" });
  assert.equal(message.content[0].type, "text");
  assert.match(message.content[0].text, /Agent 迁移任务 \(sender-1\) sent a message:/);
  assert.deepEqual(message.content[1], { type: "text", text: "sync" });
  assert.equal(followed.length, 0);

  await tool.execute({ action: "send", session_id: "target", message: "later", mode: "queue" }, { agent: { id: "sender-1" } });
  assert.equal(followed.length, 1);
  assert.equal(followed[0].message.source.senderSessionId, "迁移任务");
  assert.equal(steered.length, 1);
});

test("session_message repairs a bare UUID to the canonical session- id", async () => {
  const ctx = fakeContext();
  const steered = [];
  const bare = "984b4cef-c3b6-4faa-a59f-5688d6f6c7ee";
  const canonical = "session-" + bare;
  ctx.get = (name) =>
    name === "sessionController"
      ? {
          resolveAgent: async (sessionId) => {
            if (sessionId !== canonical) throw Object.assign(new Error("session not found"), { code: "session/not-found" });
            return { agent: { session: { header: { origin: "user" } }, steer: (message) => steered.push({ sessionId, message }) } };
          },
          prompt: async () => { throw new Error("must not prompt"); },
          list: async () => ({ items: [] }),
        }
      : undefined;
  apply(ctx, {});
  const tool = ctx.registered.get("session_message");

  await tool.execute({ action: "send", session_id: bare, message: "sync" }, { agent: { id: "sender-1" } });
  assert.equal(steered.length, 1);
  assert.equal(steered[0].sessionId, canonical);
  assert.equal(steered[0].message.source.senderSessionId, "sender-1");
});

test("session_message falls back to a bare UUID when the prefixed id is absent", async () => {
  const ctx = fakeContext();
  const steered = [];
  const bare = "984b4cef-c3b6-4faa-a59f-5688d6f6c7ee";
  ctx.get = (name) =>
    name === "sessionController"
      ? {
          resolveAgent: async (sessionId) => {
            if (sessionId !== bare) throw Object.assign(new Error("session not found"), { code: "session/not-found" });
            return { agent: { session: { header: { origin: "user" } }, steer: (message) => steered.push({ sessionId, message }) } };
          },
          prompt: async () => { throw new Error("must not prompt"); },
          list: async () => ({ items: [] }),
        }
      : undefined;
  apply(ctx, {});
  const tool = ctx.registered.get("session_message");

  await tool.execute({ action: "send", session_id: "session-" + bare, message: "sync" }, { agent: { id: "sender-1" } });
  assert.equal(steered.length, 1);
  assert.equal(steered[0].sessionId, bare);
});

test("session_message read returns recent user/assistant text and relay attribution", async () => {
  const ctx = fakeContext();
  const events = [
    {
      type: "user/message",
      seq: 1,
      data: {
        role: "user",
        content: [{ type: "text", text: "sync" }],
        source: { kind: "agent-message", form: "relay", senderSessionId: "sender-1" },
      },
    },
    {
      type: "assistant/message",
      seq: 2,
      data: { message: { role: "assistant", content: [{ type: "reasoning", text: "private" }, { type: "text", text: "done" }] } },
    },
    { type: "tool/call", seq: 3, data: { name: "bash" } },
    { type: "assistant/message", seq: 4, data: { message: { role: "assistant", content: [{ type: "text", text: "final" }] } } },
  ];
  ctx.get = (name) =>
    name === "sessionQuery"
      ? { readSurface: async (sessionId) => ({ session: { id: sessionId }, events }), readTitle: async () => "目标会话" }
      : name === "sessionController"
        ? { list: async () => ({ items: [] }) }
        : undefined;
  apply(ctx, {});
  const tool = ctx.registered.get("session_message");

  const value = JSON.parse(await tool.execute({ action: "read", session_id: "session-x", limit: 3 }, {}));
  assert.equal(value.title, "目标会话");
  assert.deepEqual(value.messages.map((message) => message.text), ["sync", "done", "final"]);
  assert.deepEqual(value.messages[0].source, { kind: "agent-message", form: "relay", senderSessionId: "sender-1" });
  assert.equal(value.messages[1].role, "assistant");
});

test("session_message read normalizes the id and rejects a bad limit", async () => {
  const ctx = fakeContext();
  const bare = "984b4cef-c3b6-4faa-a59f-5688d6f6c7ee";
  const canonical = "session-" + bare;
  ctx.get = (name) =>
    name === "sessionQuery"
      ? {
          readSurface: async (sessionId) => {
            if (sessionId !== canonical) throw Object.assign(new Error("session was not found"), { code: "SESSION_QUERY_SESSION_NOT_FOUND" });
            return { events: [{ type: "assistant/message", seq: 1, data: { message: { role: "assistant", content: [{ type: "text", text: "ok" }] } } }] };
          },
          readTitle: async () => undefined,
        }
      : name === "sessionController"
        ? { list: async () => ({ items: [] }) }
        : undefined;
  apply(ctx, {});
  const tool = ctx.registered.get("session_message");

  const value = JSON.parse(await tool.execute({ action: "read", session_id: bare }, {}));
  assert.equal(value.sessionId, canonical);
  assert.equal(value.messages[0].text, "ok");
  await assert.rejects(() => tool.execute({ action: "read", session_id: bare, limit: 0 }, {}), /limit/);
});

test("session_message keeps the ownership-checked prompt path for subagents", async () => {
  const ctx = fakeContext();
  const prompted = [];
  ctx.get = (name) =>
    name === "sessionController"
      ? {
          resolveAgent: async () => ({
            agent: { session: { header: { origin: "subagent" } }, steer: () => { throw new Error("must not steer"); } },
          }),
          prompt: async (request) => prompted.push(request),
          list: async () => ({ items: [] }),
        }
      : undefined;
  apply(ctx, {});
  const tool = ctx.registered.get("session_message");

  await tool.execute({ action: "send", session_id: "child", message: "hello" }, { agent: { id: "parent" } });
  assert.equal(prompted.length, 1);
  assert.equal(prompted[0].mode, "steer");
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
        ? { list: async () => ({ items: [{ sessionId: "s1", title: "one" }, { sessionId: "s2", origin: "subagent", parentSessionId: "s1" }] }) }
        : undefined;
  apply(ctx, {});
  const tool = ctx.registered.get("session_message");

  const byId = JSON.parse(await tool.execute({ action: "list_sessions", workspace: "w1" }, {}));
  assert.deepEqual(byId.map((row) => row.sessionId), ["s1"]);
  const topLevel = JSON.parse(await tool.execute({ action: "list_sessions" }, {}));
  assert.deepEqual(topLevel.map((row) => row.sessionId), ["s1"]);
  const withSubagents = JSON.parse(await tool.execute({ action: "list_sessions", include_subagents: true }, {}));
  assert.equal(withSubagents[1].origin, "subagent");
  assert.equal(withSubagents[1].parentSessionId, "s1");

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
  assert.equal(plan.args.some((arg) => arg.includes("WindowsBase.dll")), true);
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

test("the update page accepts check, prepare and a confirmed install only", () => {
  const token = "c".repeat(64);
  assert.equal(updatePageAction({ action: "check" }), "check");
  assert.equal(updatePageAction({ action: "prepare" }), "prepare");
  assert.equal(updatePageAction({ action: "confirm", token, targetVersion: "2.0.1", consent: true }), "confirm");
  assert.equal(updatePageAction({ action: "confirm", token, targetVersion: "2.0.1", consent: false }), null);
  assert.equal(updatePageAction({ action: "confirm", token, targetVersion: "2.0.1" }), null);
  assert.equal(updatePageAction({ action: "confirm", token: "short", targetVersion: "2.0.1", consent: true }), null);
  assert.equal(updatePageAction({ action: "confirm", token, targetVersion: "2.0.1", consent: true, extra: 1 }), null);
  assert.equal(updatePageAction({ action: "install", confirm: true }), null);
});

test("settings keep only the computer and browser switches", () => {
  const settings = normalizeSettings({ computerEnabled: false, anyApp: false, allowedApps: [" Safari ", "safari", 3], browserEnabled: false, extra: true });
  assert.equal(settings.computerEnabled, false);
  assert.equal(settings.anyApp, false);
  assert.deepEqual(settings.allowedApps, ["Safari"]);
  assert.equal(settings.browserEnabled, false);
  assert.equal(settings.fullCdp, true);
  assert.equal(settings.showFullUrl, true);
});

test("computer use refuses an app that is not always allowed", () => {
  const settings = normalizeSettings({ anyApp: false, allowedApps: ["Safari"] });
  assert.equal(computerDenial(settings, "Notes"), "「Notes」不在始终允许的应用里。到「电脑操作」里打开任意应用，或把这个应用加进去。");
  assert.equal(computerDenial(settings, "Safari"), null);
  assert.equal(computerDenial(normalizeSettings({ computerEnabled: false }), "Safari"), "电脑操作已在设置里关闭。");
});

test("the browser window can be closed from settings", () => {
  assert.equal(browserDenial(normalizeSettings({ browserEnabled: false })), "浏览器已在设置里关闭。");
  assert.equal(browserDenial(normalizeSettings({})), null);
});

test("Excel and the lock screen are real permissions", () => {
  assert.equal(isExcelApp("Microsoft Excel"), true);
  assert.equal(isExcelApp("EXCEL.EXE"), true);
  assert.equal(isExcelApp("Safari"), false);
  const open = normalizeSettings({});
  assert.equal(open.excelEnabled, true);
  assert.equal(open.lockScreen, false);
  assert.equal(computerDenial(open, "Microsoft Excel"), null);
  assert.equal(computerDenial(normalizeSettings({ excelEnabled: false, anyApp: true }), "Microsoft Excel"), "Microsoft Excel 已在设置里关闭。");
  assert.equal(computerDenial(normalizeSettings({ anyApp: false, excelEnabled: true }), "Microsoft Excel"), null);
  assert.match(computerDenial(open, "Safari", { locked: true }), /锁屏/);
  assert.equal(computerDenial(normalizeSettings({ lockScreen: true }), "Safari", { locked: true }), null);
});

test("extension flags, visible URLs, and saved logins stay out of the summary", () => {
  assert.deepEqual(extensionLaunchFlags({ extensionsEnabled: false }), ["--disable-extensions"]);
  assert.deepEqual(extensionLaunchFlags({ extraExtensionPaths: ["C:\\ext"] }), ["--load-extension=C:\\ext"]);
  assert.equal(presentUrl("https://example.com/path?q=1#x", false), "https://example.com");
  const dir = mkdtempSync(join(tmpdir(), "codex-tools-"));
  useDataRoot(dir);
  try {
    savePassword({ origin: "https://example.com/login", username: "ada", password: "secret" });
    assert.deepEqual(listPasswordSummaries(), [{ id: "https://example.com\nada", origin: "https://example.com", username: "ada" }]);
    assert.equal(JSON.stringify(listPasswordSummaries()).includes("secret"), false);
  } finally {
    useDataRoot(null);
    rmSync(dir, { recursive: true, force: true });
  }
});


test("the settings page lives in the settings dialog and the main panel, with no sidebar row", () => {
  const source = readFileSync(new URL("../client-entry.js", import.meta.url), "utf8");
  // The sidebar keeps one row for the app; the settings open from the settings
  // dialog's own navigation, and the plugin-page button is gone.
  assert.doesNotMatch(source, /sidebar\.panellist/);
  assert.doesNotMatch(source, /plugins\.detail\.actions/);
  assert.match(source, /settings\.section/);
  assert.match(source, /name: "main",\s*\n\s*key: "dsh-codex-tools"/);
});
