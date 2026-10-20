/**
 * Unit tests that need no Codex runtime: schema compilation, tool registration
 * and the argument validation the tools perform before touching any service.
 *
 * Run with `node --test tests/`.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { defineTool, parameterSchema } from "../lib/define-tool.mjs";
import { createComputerTool } from "../lib/computer-tool.mjs";
import { createBrowserTool } from "../lib/browser-tool.mjs";
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

/** A client that records the generated script instead of running it. */
function recordingClient() {
  const scripts = [];
  const turnEndedCalls = [];
  return {
    scripts,
    turnEndedCalls,
    runJs: async (code) => {
      scripts.push(code);
      return { content: [{ type: "text", text: "ok" }] };
    },
    turnEnded: async (event) => {
      turnEndedCalls.push(event);
      return { content: [{ type: "text", text: "{}" }] };
    },
  };
}

test("computer_use passes element indices as numbers, not strings", async () => {
  const client = recordingClient();
  const tool = createComputerTool({ client, defineTool });
  await tool.execute({ action: "click", app: "Finder", element_index: "250" }, {});
  assert.match(client.scripts[0], /app\.click\(250,/);
  assert.doesNotMatch(client.scripts[0], /app\.click\("250"/);

  await tool.execute({ action: "set_value", app: "Finder", element_index: "12", value: "x" }, {});
  assert.match(client.scripts[1], /app\.setValue\(12,/);

  await tool.execute({ action: "select_text", app: "Finder", element_index: "7", text: "hi" }, {});
  assert.match(client.scripts[2], /app\.selectText\(7,/);

  await tool.execute({ action: "perform_secondary_action", app: "Finder", element_index: "3", action_name: "Raise" }, {});
  assert.match(client.scripts[3], /app\.performSecondaryAction\(3,/);

  await tool.execute({ action: "scroll", app: "Finder", element_index: "9", direction: "down" }, {});
  assert.match(client.scripts[4], /app\.scroll\(9,/);
});

test("computer_use still accepts a pixel target and rejects a missing one", async () => {
  const client = recordingClient();
  const tool = createComputerTool({ client, defineTool });
  await tool.execute({ action: "click", app: "Finder", x: 10, y: 20 }, {});
  assert.match(client.scripts[0], /app\.click\(\[10, 20\],/);
  await assert.rejects(
    () => tool.execute({ action: "click", app: "Finder" }, {}),
    /needs either `element_index` or both `x` and `y`/,
  );
});

test("computer_use does not append a second state read for get_state", async () => {
  const client = recordingClient();
  const tool = createComputerTool({ client, defineTool });
  await tool.execute({ action: "get_state", app: "Finder" }, {});
  assert.equal((client.scripts[0].match(/getAXState\(/g) ?? []).length, 1);

  await tool.execute({ action: "click", app: "Finder", element_index: "1" }, {});
  assert.equal((client.scripts[1].match(/getAXState\(/g) ?? []).length, 1);

  await tool.execute({ action: "click", app: "Finder", element_index: "1", return_state: false }, {});
  assert.equal((client.scripts[2].match(/getAXState\(/g) ?? []).length, 0);
});

test("browser passes element indices as numbers and null for the focused element", async () => {
  const client = recordingClient();
  const tool = createBrowserTool({ client, defineTool });
  await tool.execute({ action: "click", browser: "chrome", tab_id: "t1", element_index: "42" }, {});
  assert.match(client.scripts[0], /tab\.click\(42,/);

  await tool.execute({ action: "type_text", browser: "chrome", tab_id: "t1", text: "hi" }, {});
  assert.match(client.scripts[1], /tab\.typeText\(null,/);

  await tool.execute({ action: "type_text", browser: "chrome", tab_id: "t1", element_index: "5", text: "hi" }, {});
  assert.match(client.scripts[2], /tab\.typeText\(5,/);

  await tool.execute({ action: "set_value", browser: "chrome", tab_id: "t1", element_index: "8", value: "v" }, {});
  assert.match(client.scripts[3], /tab\.setValue\(8,/);
});

test("browser reuses a bound tab and rebinds when the target changes", async () => {
  const client = recordingClient();
  const tool = createBrowserTool({ client, defineTool });
  await tool.execute({ action: "state", browser: "chrome", tab_id: "t1" }, {});
  assert.match(client.scripts[0], /cua\.getTab\("t1"/);
  await tool.execute({ action: "state", browser: "chrome", tab_id: "t1" }, {});
  assert.match(client.scripts[1], /cua\.getTab\("t1"/);
  await tool.execute({ action: "state", browser: "chrome", url: "https://example.test/" }, {});
  assert.match(client.scripts[2], /cua\.getTab\(\{ url: "https:\/\/example\.test\/" \}/);
  await assert.rejects(
    () => tool.execute({ action: "state", browser: "chrome" }, {}),
    /needs `tab_id` or `url`/,
  );
});

test("generated scripts are wrapped so repeated calls cannot redeclare bindings", async () => {
  const client = recordingClient();
  const computer = createComputerTool({ client, defineTool });
  const browser = createBrowserTool({ client, defineTool });
  await computer.execute({ action: "list_apps" }, {});
  await browser.execute({ action: "list_browsers" }, {});
  for (const script of client.scripts) {
    assert.match(script, /^await \(async \(\) => \{/);
    assert.match(script, /\}\)\(\);$/);
  }
});

test("computer_use dismisses the Sky cursor after every action", async () => {
  const client = recordingClient();
  const tool = createComputerTool({ client, defineTool });
  await tool.execute({ action: "list_apps" }, {});
  await tool.execute({ action: "click", app: "Finder", element_index: "1" }, {});
  assert.deepEqual(client.turnEndedCalls, ["Stop", "Stop"]);
});

test("browser dismisses the Sky cursor after every action", async () => {
  const client = recordingClient();
  const tool = createBrowserTool({ client, defineTool });
  await tool.execute({ action: "list_browsers" }, {});
  assert.deepEqual(client.turnEndedCalls, ["Stop"]);
});
