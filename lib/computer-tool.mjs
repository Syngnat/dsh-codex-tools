/**
 * `computer_use` — native macOS app control through this plugin's `dsh-ax` helper.
 *
 * The helper speaks Accessibility and Quartz events. It does not start Codex,
 * ChatGPT, or Sky. Element indices belong to the last `get_state` in that helper.
 *
 * @module dsh-codex-tools/computer-tool
 */

import { computerDenial, readSettings } from "./settings-store.mjs";

import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

/** Actions the tool exposes, mapped to the runtime call each one performs. */
export const COMPUTER_ACTIONS = [
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
];

/** Actions that need an app binding. */
const APP_ACTIONS = new Set(COMPUTER_ACTIONS.filter((name) => name !== "list_apps" && name !== "list_windows"));

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
 * Build the JavaScript body for one action.
 * @param args - Validated tool arguments.
 * @returns JavaScript source to evaluate in the REPL.
 */
function buildActionSource(args) {
  const app = args.app;
  const lines = [];
  if (APP_ACTIONS.has(args.action)) {
    lines.push(
      `let app = globalThis.__dshCuaApp;`,
      `if (app === undefined || globalThis.__dshCuaAppKey !== ${js(app)}) {`,
      `  app = await cua.getApp(${js(app)});`,
      `  globalThis.__dshCuaApp = app;`,
      `  globalThis.__dshCuaAppKey = ${js(app)};`,
      `}`,
    );
  }
  switch (args.action) {
    case "list_apps":
      lines.push(`await cua.listApps();`);
      break;
    case "list_windows":
      lines.push(`await cua.listWindows();`);
      break;
    case "get_state":
      lines.push(`await app.getAXState(${js(stateOptions(args))});`);
      break;
    case "click": {
      const target = clickTarget(args);
      lines.push(`await app.click(${target}, ${js(clickOptions(args))});`);
      break;
    }
    case "type_text":
      lines.push(`await app.typeText(${js(args.text)});`);
      break;
    case "paste":
      lines.push(`await app.paste(${js(args.text)}, ${js(pasteOptions(args))});`);
      break;
    case "press_key":
      lines.push(`await app.pressKey(${js(args.key)}, ${js(pressKeyOptions(args))});`);
      break;
    case "scroll": {
      const target = clickTarget(args);
      const distance = args.pages === undefined ? 1 : args.pages;
      lines.push(`await app.scroll(${target}, ${js(args.direction)}, ${js(distance)});`);
      break;
    }
    case "drag":
      lines.push(
        `await app.drag([${js(args.from_x)}, ${js(args.from_y)}], [${js(args.to_x)}, ${js(args.to_y)}]);`,
      );
      break;
    case "set_value":
      lines.push(`await app.setValue(${indexSource(args.element_index)}, ${js(args.value)});`);
      break;
    case "select_text":
      lines.push(`await app.selectText(${indexSource(args.element_index)}, ${js(args.text)}, ${js(selectTextOptions(args))});`);
      break;
    case "perform_secondary_action":
      lines.push(`await app.performSecondaryAction(${indexSource(args.element_index)}, ${js(args.action_name)});`);
      break;
    case "screenshot":
      lines.push(`globalThis.__dshCuaShot = await app.getScreenshot({ emit: false });`);
      break;
    default:
      throw new Error(`unsupported computer_use action "${String(args.action)}"`);
  }
  return lines.join("\n");
}

/** Options for an accessibility-state read. */
function stateOptions(args) {
  return args.full_tree === true ? { disableDiffing: true } : {};
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

/** Options for a paste. */
function pasteOptions(args) {
  return args.format === undefined ? {} : { format: args.format };
}

/** Options for a key press. */
function pressKeyOptions(args) {
  return args.duration_ms === undefined ? {} : { durationMs: args.duration_ms };
}

/** Options for a text selection. */
function selectTextOptions(args) {
  const out = {};
  if (args.prefix !== undefined) out.prefix = args.prefix;
  if (args.suffix !== undefined) out.suffix = args.suffix;
  if (args.selection_type !== undefined) out.selectionType = args.selection_type;
  return out;
}

/**
 * Render the click/scroll target: an accessibility element index or a pixel pair.
 * @param args - Tool arguments carrying `element_index` and/or `x`/`y`.
 * @returns JavaScript source for the target argument.
 */
function clickTarget(args) {
  if (args.element_index !== undefined) return indexSource(args.element_index);
  if (args.x !== undefined && args.y !== undefined) return `[${js(args.x)}, ${js(args.y)}]`;
  throw new Error("this action needs either `element_index` or both `x` and `y`");
}

/** Parameter schema shared by the tool definition. */
export const COMPUTER_PARAMETERS = {
  action: {
    type: "string",
    required: true,
    enum: COMPUTER_ACTIONS,
    description:
      "Operation to perform. `list_apps` and `list_windows` take no app. `get_state` reads the app's accessibility tree (diffed against the previous read unless `full_tree` is true). `click`, `scroll`, `set_value`, `select_text` and `perform_secondary_action` target an element by `element_index`; `click` and `scroll` also accept pixel `x`/`y`. `type_text`, `paste` and `press_key` send input. `screenshot` captures the app's window.",
  },
  app: {
    type: "string",
    description:
      "App display name, bundle identifier, or full app path, for example `Safari`, `com.apple.Safari`, or `/Applications/Safari.app`. Required for every action except `list_apps` and `list_windows`.",
  },
  element_index: {
    type: "string",
    description:
      "Accessibility element index taken from the most recent `get_state` output. Indices are only valid for the state they came from; re-read state after every action.",
  },
  x: { type: "number", description: "X coordinate in screenshot pixels, used with `y` when no element index applies." },
  y: { type: "number", description: "Y coordinate in screenshot pixels, used with `x` when no element index applies." },
  text: {
    type: "string",
    description: "Literal text for `type_text` and `paste`, or the target text for `select_text`.",
  },
  key: {
    type: "string",
    description:
      "Key or chord for `press_key`, in xdotool syntax: `a`, `Return`, `Tab`, `Up`, `super+c`, `KP_0`. For `click` it is a chord held across the click.",
  },
  value: { type: "string", description: "New value for `set_value`." },
  action_name: {
    type: "string",
    description: "Secondary accessibility action name for `perform_secondary_action`, exactly as exposed in the accessibility tree.",
  },
  direction: {
    type: "string",
    enum: ["up", "down", "left", "right"],
    description: "Scroll direction for `scroll`.",
  },
  pages: { type: "number", description: "Pages to scroll; fractional values are allowed. Defaults to 1." },
  mouse_button: { type: "string", enum: ["left", "right", "middle"], description: "Mouse button for `click`. Defaults to left." },
  click_count: { type: "number", description: "Number of clicks for `click`. Defaults to 1." },
  duration_ms: {
    type: "number",
    description: "Milliseconds to hold the mouse button (`click`) or the key (`press_key`).",
  },
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
    description: "For `get_state`, return the complete accessibility tree instead of a diff against the previous read.",
  },
  return_state: {
    type: "boolean",
    description:
      "Append a fresh accessibility read after the action. Defaults to true; set false only when batching several actions in a row.",
  },
};

/**
 * Build the `computer_use` tool definition.
 * @param options - Wiring supplied by the plugin.
 * @param options.client - Started `CuaReplClient`.
 * @param options.defineTool - The harness `defineTool` helper.
 * @returns A registry-ready tool definition.
 */
const MUTATING = new Set([
  "click", "type_text", "paste", "press_key", "scroll", "drag",
  "set_value", "select_text", "perform_secondary_action",
]);

function integerArg(value, name) {
  if (value === undefined) return undefined;
  const numeric = Number(value);
  if (!Number.isInteger(numeric)) throw new Error(`${name} must be an integer`);
  return numeric;
}

function normalizeComputer(args) {
  const out = { ...args, element_index: integerArg(args.element_index, "element_index") };
  if (out.action === "click" && out.element_index === undefined && (out.x === undefined || out.y === undefined)) {
    throw new Error("click needs either `element_index` or both `x` and `y`");
  }
  return out;
}

function axText(result) {
  if (typeof result?.text === "string" && result.text.length > 0) return result.text;
  return JSON.stringify(result ?? {});
}

/**
 * Build the `computer_use` tool definition.
 * @param options - Wiring supplied by the plugin.
 * @param options.ax - `AxClient` (or a test double with `call`).
 * @param options.defineTool - The harness `defineTool` helper.
 * @returns A registry-ready tool definition.
 */
export function createComputerTool({ ax, defineTool }) {
  return defineTool({
    name: "computer_use",
    description:
      "Control a native macOS app by reading and operating its user interface. Use `list_apps` to discover apps, then `get_state` to read the accessibility tree and obtain element indices, then act on those indices. Element indices are only valid for the state they came from, so re-read state after each action. This does not use Codex or ChatGPT. Prefer a purpose-built CLI or API when one exists.",
    parameters: COMPUTER_PARAMETERS,
    output: { schema: { type: "string" }, render: (_args, value) => [{ type: "text", text: value }] },
    isConcurrencySafe: () => false,
    async execute(args, exec) {
      exec.signal?.throwIfAborted?.();
      const payload = normalizeComputer(args);
      const denied = computerDenial(readSettings(), payload.app);
      if (denied !== null) throw new Error(denied);
      const first = await ax.call(payload.action, payload);
      const parts = [axText(first)];
      if (MUTATING.has(payload.action) && payload.return_state !== false) {
        const state = await ax.call("get_state", { app: payload.app, window_id: payload.window_id });
        parts.push(axText(state));
      }
      return parts.filter((part) => part.length > 0).join("\n");
    },
  });
}

/**
 * Turn one REPL result into model-facing text, persisting any screenshot to disk.
 * @param result - Raw MCP result.
 * @param args - Tool arguments, used to name the artifact.
 * @returns Text for the model.
 */
