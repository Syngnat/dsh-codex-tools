/**
 * `browser` — drive a Chrome window this plugin launches and owns.
 *
 * Every call goes through a caller-supplied Chrome DevTools driver
 * (`lib/cdp-browser.mjs`): the driver starts its own Chrome with the plugin's
 * profile, and the bound tab survives across tool calls so element indices stay
 * meaningful. Nothing here talks to Codex, ChatGPT, or an MCP server, and it
 * never attaches to a Chrome window the user is already using.
 *
 * @module dsh-codex-tools/browser-tool
 */

import { browserDenial, readSettings } from "./settings-store.mjs";

import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

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
      "Browser id or name to select, for example `chrome`, or a browser id from `list_browsers`. Omit to use the browser of the currently bound tab.",
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

const NEEDS_TAB = new Set([
  "get_tab", "documentation", "state", "click", "type_text", "paste", "press_key",
  "scroll", "drag", "select_text", "set_value", "goto", "back", "forward", "reload",
  "screenshot", "close",
]);

function integerArg(value, name) {
  if (value === undefined) return undefined;
  const numeric = Number(value);
  if (!Number.isInteger(numeric)) throw new Error(`${name} must be an integer`);
  return numeric;
}

/**
 * Build the `browser` tool on a caller-supplied Chrome DevTools driver.
 * @param options - Wiring supplied by the plugin.
 * @param options.driver - `CdpBrowser` or a test double with `call(action, args)`.
 * @param options.defineTool - The harness `defineTool` helper.
 * @returns A registry-ready tool definition.
 */
export function createBrowserTool({ driver, defineTool, name = "browser", description } = {}) {
  let boundId = null;
  return defineTool({
    name,
    description:
      description ??
      "Drive a Chrome window this plugin owns (profile ~/.dsh/dsh-codex-tools/browser). List tabs, open or bind one, read the accessibility tree, then click, type and navigate. Element indices come from `state` and stay valid for that page, so a later read does not renumber them. This does not use Codex or the ChatGPT extension, and it does not attach to your already-running Chrome.",
    parameters: BROWSER_PARAMETERS,
    output: { schema: { type: "string" }, render: (_args, value) => [{ type: "text", text: value }] },
    isConcurrencySafe: () => false,
    async execute(args, exec) {
      exec.signal?.throwIfAborted?.();
      const denied = browserDenial(readSettings());
      if (denied !== null) throw new Error(denied);
      const payload = { ...args, element_index: integerArg(args.element_index, "element_index") };
      if (NEEDS_TAB.has(payload.action) && payload.tab_id === undefined && payload.url === undefined && boundId === null) {
        throw new Error("needs `tab_id` or `url`");
      }
      const result = await driver.call(payload.action, { ...payload, boundId });
      if (result?.boundId) boundId = result.boundId;
      if (payload.action === "close") boundId = null;
      const parts = [typeof result?.text === "string" ? result.text : JSON.stringify(result ?? {})];
      const follow = NEEDS_TAB.has(payload.action)
        && !["state", "documentation", "screenshot", "close", "get_tab"].includes(payload.action)
        && payload.return_state !== false;
      if (follow) {
        const state = await driver.call("state", { tab_id: boundId, boundId });
        if (state?.boundId) boundId = state.boundId;
        if (typeof state?.text === "string" && state.text.length > 0) parts.push(state.text);
      }
      return parts.filter((part) => part.length > 0).join("\n");
    },
  });
}
