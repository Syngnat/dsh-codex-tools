/**
 * `browser` — drive a real browser through Codex's browser-desktop provider.
 *
 * The browser surface is the same one Codex uses: tabs are bound through the
 * `cua` API inside the persistent REPL, and the binding survives across tool
 * calls so element indices stay meaningful.
 *
 * @module dsh-codex-tools/browser-tool
 */

import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { imagesOf, textOf } from "./cua-repl-client.mjs";

/** Actions the tool exposes. */
export const BROWSER_ACTIONS = [
  "list_browsers",
  "list_tabs",
  "open_tab",
  "get_tab",
  "documentation",
  "state",
  "click",
  "type_text",
  "paste",
  "press_key",
  "scroll",
  "drag",
  "select_text",
  "set_value",
  "goto",
  "back",
  "forward",
  "reload",
  "close",
  "screenshot",
];

/** Actions that operate on a bound tab. */
const TAB_ACTIONS = new Set([
  "documentation",
  "state",
  "click",
  "type_text",
  "paste",
  "press_key",
  "scroll",
  "drag",
  "select_text",
  "set_value",
  "goto",
  "back",
  "forward",
  "reload",
  "close",
  "screenshot",
]);

/** Serialize a JavaScript value for embedding in generated source. */
function js(value) {
  return JSON.stringify(value);
}

/**
 * Render an accessibility element index as a JavaScript number literal.
 *
 * The runtime's `Target` methods take `elementIndex: number`, but the tool
 * schema exposes the index as a string so a model can echo it verbatim from the
 * accessibility tree. Coerce back to a number whenever the value is integral,
 * and fall back to the raw string so the runtime can report the bad index.
 * @param value - Element index as supplied by the caller.
 * @returns JavaScript source for the index argument.
 */
function indexSource(value) {
  const numeric = Number(value);
  return Number.isInteger(numeric) ? String(numeric) : js(String(value));
}

/**
 * Build the JavaScript body for one browser action.
 * @param args - Validated tool arguments.
 * @returns JavaScript source to evaluate in the REPL.
 */
function buildActionSource(args) {
  const lines = [];
  if (TAB_ACTIONS.has(args.action)) {
    lines.push(...bindingLines(args));
  }
  switch (args.action) {
    case "list_browsers":
      lines.push(`await cua.listBrowsers();`);
      break;
    case "list_tabs":
      lines.push(`await cua.listTabs(${js(browserOptions(args))});`);
      break;
    case "open_tab": {
      const options = {};
      if (args.visible !== undefined) options.visible = args.visible;
      if (args.session_name !== undefined) options.sessionName = args.session_name;
      lines.push(`globalThis.__dshCuaTab = await cua.createBrowserTab(${js(args.browser)}, ${js(args.url)}, ${js(options)});`);
      break;
    }
    case "get_tab":
      lines.push(`globalThis.__dshCuaTab = await cua.getTab(${referenceSource(args)}, ${js(browserOptions(args))});`);
      break;
    case "documentation":
      lines.push(`nodeRepl.write(await tab.documentation());`);
      break;
    case "state":
      lines.push(`await tab.getAXState(${js(args.full_tree === true ? { disableDiffing: true } : {})});`);
      break;
    case "click": {
      const target = args.element_index !== undefined ? indexSource(args.element_index) : `[${js(args.x)}, ${js(args.y)}]`;
      lines.push(`await tab.click(${target}, ${js(clickOptions(args))});`);
      break;
    }
    case "type_text":
      lines.push(`await tab.typeText(${js(nullableIndex(args))}, ${js(args.text)});`);
      break;
    case "paste":
      lines.push(`await tab.paste(${js(nullableIndex(args))}, ${js(args.text)}, ${js(args.format === undefined ? {} : { format: args.format })});`);
      break;
    case "press_key":
      lines.push(`await tab.pressKey(${js(nullableIndex(args))}, ${js(args.key)}, ${js(args.duration_ms === undefined ? {} : { durationMs: args.duration_ms })});`);
      break;
    case "scroll": {
      const target = args.element_index !== undefined ? indexSource(args.element_index) : `[${js(args.x)}, ${js(args.y)}]`;
      lines.push(`await tab.scroll(${target}, ${js(args.direction)}, ${js(args.pages === undefined ? 1 : args.pages)});`);
      break;
    }
    case "drag":
      lines.push(`await tab.drag([${js(args.from_x)}, ${js(args.from_y)}], [${js(args.to_x)}, ${js(args.to_y)}]);`);
      break;
    case "select_text":
      lines.push(`await tab.selectText(${indexSource(args.element_index)}, ${js(args.text)}, ${js(selectTextOptions(args))});`);
      break;
    case "set_value":
      lines.push(`await tab.setValue(${indexSource(args.element_index)}, ${js(args.value)});`);
      break;
    case "goto":
      lines.push(`await tab.goto(${js(args.url)});`);
      break;
    case "back":
      lines.push(`await tab.back();`);
      break;
    case "forward":
      lines.push(`await tab.forward();`);
      break;
    case "reload":
      lines.push(`await tab.reload();`);
      break;
    case "close":
      lines.push(`await tab.close();`, `globalThis.__dshCuaTab = undefined;`, `globalThis.__dshCuaTabKey = undefined;`);
      break;
    case "screenshot":
      lines.push(`globalThis.__dshCuaShot = await tab.getScreenshot({ emit: false });`);
      break;
    default:
      throw new Error(`unsupported browser action "${String(args.action)}"`);
  }
  return lines.join("\n");
}

/** Reuse the bound tab when the request names the same one, otherwise bind it. */
function bindingLines(args) {
  const key = bindingKey(args);
  return [
    `let tab = globalThis.__dshCuaTab;`,
    `if (tab === undefined || globalThis.__dshCuaTabKey !== ${js(key)}) {`,
    `  tab = await cua.getTab(${referenceSource(args)}, ${js(browserOptions(args))});`,
    `  globalThis.__dshCuaTab = tab;`,
    `  globalThis.__dshCuaTabKey = ${js(key)};`,
    `}`,
  ];
}

/** Stable identity for the tab a call addresses. */
function bindingKey(args) {
  if (args.tab_id !== undefined) return `id:${args.tab_id}`;
  if (args.url !== undefined) return `url:${args.url}`;
  return `browser:${args.browser ?? ""}`;
}

/** Tab reference accepted by `cua.getTab`. */
function referenceSource(args) {
  if (args.tab_id !== undefined) return js(args.tab_id);
  if (args.url !== undefined) return `{ url: ${js(args.url)} }`;
  throw new Error("this action needs `tab_id` or `url` to identify a tab");
}

/** Browser selection options. */
function browserOptions(args) {
  return args.browser === undefined ? {} : { browser: args.browser };
}

/** Element index or `null` for the focused element. */
function nullableIndex(args) {
  if (args.element_index === undefined) return null;
  const numeric = Number(args.element_index);
  return Number.isInteger(numeric) ? numeric : String(args.element_index);
}

/** Options for a click. */
function clickOptions(args) {
  const out = {};
  if (args.mouse_button !== undefined) out.mouseButton = args.mouse_button;
  if (args.click_count !== undefined) out.clickCount = args.click_count;
  if (args.key !== undefined) out.key = args.key;
  if (args.duration_ms !== undefined) out.durationMs = args.duration_ms;
  return out;
}

/** Options for a text selection. */
function selectTextOptions(args) {
  const out = {};
  if (args.prefix !== undefined) out.prefix = args.prefix;
  if (args.suffix !== undefined) out.suffix = args.suffix;
  if (args.selection_type !== undefined) out.selectionType = args.selection_type;
  return out;
}

/** Parameter schema for the tool definition. */
export const BROWSER_PARAMETERS = {
  action: {
    type: "string",
    required: true,
    enum: BROWSER_ACTIONS,
    description:
      "Operation to perform. Start with `list_browsers` and `list_tabs` to see what is available, then `open_tab` or `get_tab` to bind a tab, then `state` to read it. `click`, `scroll`, `set_value`, `select_text` and `drag` act on element indices from `state`; `type_text`, `paste` and `press_key` send input; `goto`, `back`, `forward`, `reload` and `close` manage navigation; `documentation` returns the provider's own notes for the bound browser.",
  },
  browser: {
    type: "string",
    description:
      "Browser id or name to select, for example `chrome`, `iab` for the in-app browser, or a browser id from `list_browsers`. Omit to use the browser of the currently bound tab.",
  },
  tab_id: { type: "string", description: "Tab id from `list_tabs`, used to bind an existing tab." },
  url: {
    type: "string",
    description: "Tab URL. For `get_tab` it binds the matching existing tab; for `open_tab` and `goto` it is the destination.",
  },
  visible: { type: "boolean", description: "For `open_tab` on the in-app browser, whether to show the tab. Defaults to the provider's choice." },
  session_name: { type: "string", description: "Short emoji-prefixed task name for `open_tab`, for example `\"🔎 Prices\"`." },
  element_index: {
    type: "string",
    description: "Accessibility element index from the latest `state` output. Re-read state after every action.",
  },
  x: { type: "number", description: "X coordinate in screenshot pixels, used with `y` when no element index applies." },
  y: { type: "number", description: "Y coordinate in screenshot pixels, used with `x` when no element index applies." },
  text: { type: "string", description: "Literal text for `type_text` and `paste`, or the target text for `select_text`." },
  key: { type: "string", description: "Key or chord for `press_key` in xdotool syntax: `a`, `Return`, `Tab`, `super+c`." },
  value: { type: "string", description: "New value for `set_value`." },
  direction: { type: "string", enum: ["up", "down", "left", "right"], description: "Scroll direction for `scroll`." },
  pages: { type: "number", description: "Pages to scroll; fractional values are allowed. Defaults to 1." },
  mouse_button: { type: "string", enum: ["left", "right", "middle"], description: "Mouse button for `click`. Defaults to left." },
  click_count: { type: "number", description: "Number of clicks for `click`. Defaults to 1." },
  duration_ms: { type: "number", description: "Milliseconds to hold the mouse button or key." },
  format: { type: "string", enum: ["text", "md", "html"], description: "Pasteboard format for `paste`. Defaults to text." },
  selection_type: {
    type: "string",
    enum: ["text", "cursor_before", "cursor_after"],
    description: "Whether `select_text` selects the text or places the cursor before or after it.",
  },
  prefix: { type: "string", description: "Text immediately before the `select_text` target, used to disambiguate repeats." },
  suffix: { type: "string", description: "Text immediately after the `select_text` target, used to disambiguate repeats." },
  from_x: { type: "number", description: "Drag start X in screenshot pixels." },
  from_y: { type: "number", description: "Drag start Y in screenshot pixels." },
  to_x: { type: "number", description: "Drag end X in screenshot pixels." },
  to_y: { type: "number", description: "Drag end Y in screenshot pixels." },
  full_tree: {
    type: "boolean",
    description: "For `state`, return the complete accessibility tree instead of a diff against the previous read.",
  },
  return_state: {
    type: "boolean",
    description: "Append a fresh state read after the action. Defaults to true; set false when batching actions.",
  },
};

/**
 * Build the `browser` tool definition.
 * @param options - Wiring supplied by the plugin.
 * @param options.client - Started `CuaReplClient`.
 * @param options.defineTool - The harness `defineTool` helper.
 * @returns A registry-ready tool definition.
 */
export function createBrowserTool({ client, defineTool }) {
  return defineTool({
    name: "browser",
    description:
      "Drive a real browser: list browsers and tabs, open or bind a tab, read its accessibility tree, then click, type and navigate. Use this instead of fetching pages when the task needs the user's logged-in session, JavaScript-rendered content, or interaction. Element indices come from `state` and are only valid for that read.",
    parameters: BROWSER_PARAMETERS,
    output: { schema: { type: "string" }, render: (_args, value) => [{ type: "text", text: value }] },
    isConcurrencySafe: () => false,
    async execute(args, exec) {
      exec.signal?.throwIfAborted?.();
      try {
      const body = [buildActionSource(args)];
      const wantsState = TAB_ACTIONS.has(args.action) && !["state", "documentation", "screenshot", "close"].includes(args.action);
      if (wantsState && args.return_state !== false) {
        body.push(`await tab.getAXState(${js(args.full_tree === true ? { disableDiffing: true } : {})});`);
      }
      const script = `await (async () => {\n${body.join("\n")}\n})();`;
      const result = await client.runJs(script, { title: `browser:${args.action}` });
      return renderBrowserResult(result, args);
      } finally {
        await client.turnEnded?.("Stop").catch(() => {});
      }
    },
  });
}

/**
 * Turn one REPL result into model-facing text, persisting any screenshot to disk.
 * @param result - Raw MCP result.
 * @param args - Tool arguments.
 * @returns Text for the model.
 */
async function renderBrowserResult(result, args) {
  const parts = [];
  const text = textOf(result);
  if (text.length > 0) parts.push(text);
  const images = imagesOf(result);
  for (const [index, image] of images.entries()) {
    const suffix = images.length > 1 ? `-${index + 1}` : "";
    const path = join(tmpdir(), `dsh-browser-${Date.now()}${suffix}.png`);
    await writeFile(path, Buffer.from(image.data, "base64"));
    parts.push(`screenshot saved to ${path}`);
  }
  if (result?.isError === true && parts.length === 0) parts.push("the browser runtime reported an error");
  return parts.join("\n");
}
