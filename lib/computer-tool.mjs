/**
 * `computer_use` — native app control. Windows uses `dsh-uia.exe` (UI Automation);
 * macOS uses `dsh-ax` (Accessibility).
 *
 * The helper does not start Codex,
 * ChatGPT, or Sky. Element indices belong to the last `get_state` in that helper.
 *
 * @module dsh-codex-tools/computer-tool
 */

import { computerDenial, readSettings } from "./settings-store.mjs";
import { sessionLocked } from "./owned-data.mjs";
import { windowSelection } from "./window-target.mjs";

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

/** Parameter schema shared by the tool definition. */
export const COMPUTER_PARAMETERS = {
  action: {
    type: "string",
    required: true,
    enum: COMPUTER_ACTIONS,
    description:
      "Operation to perform. `list_apps` and `list_windows` take no app; `list_windows` reports the pid, window handle, title and session of every window. `get_state` reads the app's accessibility tree (diffed against the previous read unless `full_tree` is true). `click`, `scroll`, `set_value`, `select_text` and `perform_secondary_action` target an element by `element_index`; `click` and `scroll` also accept pixel `x`/`y`. `type_text`, `paste` and `press_key` send input. `screenshot` captures the app's window.",
  },
  app: {
    type: "string",
    description:
      "App display name, executable, or full path. On Windows use `notepad`, `explorer`, or `C:\\Windows\\notepad.exe`. On macOS use `Safari` or `com.apple.Safari`. Required for every action except `list_apps` and `list_windows`. A name that matches several windows is refused with the candidate list; add `pid`, `window_handle` or `window_title` to choose one.",
  },
  pid: {
    type: "number",
    description:
      "Process id of the window to act on, as `list_windows` reports it. Use this when several windows share one app name (two Chrome windows can show different pages). Requires `app`.",
  },
  window_handle: {
    type: "string",
    description:
      "Window handle of the target window, decimal or `0x` hex as `list_windows` reports it. The most exact selector. Requires `app`.",
  },
  window_title: {
    type: "string",
    description:
      "Case-insensitive title fragment of the target window. Use it when several windows share an app name and you know part of the title. Requires `app`.",
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
 * @param options.ax - The accessibility helper client for this platform.
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
  const selection = windowSelection(args);
  for (const key of ["pid", "window_handle", "window_title"]) {
    if (selection[key] === undefined) delete out[key];
    else out[key] = selection[key];
  }
  // The app name is what the permission check reads, so a bare pid or handle is
  // never enough to reach the helper.
  if (Object.keys(selection).length > 0 && (typeof out.app !== "string" || out.app.trim().length === 0)) {
    throw new Error("give `app` together with `pid`/`window_handle`/`window_title`: the app name drives the permission check and the window match, and the selector picks one of that app's windows");
  }
  if (out.action === "click" && out.element_index === undefined && (out.x === undefined || out.y === undefined)) {
    throw new Error("click needs either `element_index` or both `x` and `y`");
  }
  return out;
}

/**
 * Keep the caller's window choice on every follow-up call, so the state read
 * after a click describes the same window that was clicked.
 * @param payload - Normalized tool arguments.
 * @returns The selectors that were supplied, if any.
 */
function selectionOf(payload) {
  const out = {};
  for (const key of ["pid", "window_handle", "window_title"]) {
    if (payload[key] !== undefined) out[key] = payload[key];
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
      "Control a native app on Windows or macOS by reading and operating its user interface. Windows uses UI Automation; macOS uses Accessibility. Use `list_apps` to discover apps, then `get_state` to read the accessibility tree and obtain element indices, then act on those indices. Element indices are only valid for the state they came from, so re-read state after each action. This does not use Codex or ChatGPT. Prefer a purpose-built CLI or API when one exists.",
    parameters: COMPUTER_PARAMETERS,
    output: { schema: { type: "string" }, render: (_args, value) => [{ type: "text", text: value }] },
    isConcurrencySafe: () => false,
    async execute(args, exec) {
      exec.signal?.throwIfAborted?.();
      const payload = normalizeComputer(args);
      const denied = computerDenial(readSettings(), payload.app, { locked: sessionLocked() });
      if (denied !== null) throw new Error(denied);
      const first = await ax.call(payload.action, payload);
      const parts = [axText(first)];
      if (MUTATING.has(payload.action) && payload.return_state !== false) {
        const state = await ax.call("get_state", { app: payload.app, window_id: payload.window_id, ...selectionOf(payload) });
        parts.push(axText(state));
      }
      return parts.filter((part) => part.length > 0).join("\n");
    },
  });
}
