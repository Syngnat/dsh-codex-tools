/**
 * Window addressing for `computer_use`.
 *
 * The helper speaks in windows, not processes: one process can own several
 * top-level windows with different pages (two Chrome profiles both report the
 * process name `chrome`). A name that matches more than one window is refused
 * with the candidate list instead of a silent first match, so these helpers make
 * the selectors and the resulting message identical in every surface.
 *
 * @module dsh-codex-tools/window-target
 */

/**
 * Win32 codes this path reports, so a caller can tell an access problem from a
 * stale handle without parsing localized text.
 */
const WIN32_NAMES = {
  0: "ERROR_SUCCESS",
  5: "ERROR_ACCESS_DENIED",
  6: "ERROR_INVALID_HANDLE",
  8: "ERROR_NOT_ENOUGH_MEMORY",
  87: "ERROR_INVALID_PARAMETER",
  1400: "ERROR_INVALID_WINDOW_HANDLE",
  1460: "ERROR_TIMEOUT",
};

/**
 * Name one Win32 error code.
 * @param code - Numeric code from the helper.
 * @returns The documented name, a synthetic name, or null when there is no code.
 */
export function win32Name(code) {
  if (!Number.isInteger(code)) return null;
  return WIN32_NAMES[code] ?? `WIN32_${code}`;
}

/**
 * Read a window handle as `list_windows` reports it: decimal or `0x` hex.
 * @param value - Caller-supplied handle.
 * @returns The handle as a number, or undefined when the caller gave none.
 */
export function parseWindowHandle(value) {
  if (value === undefined || value === null) return undefined;
  const text = String(value).trim();
  if (text.length === 0) return undefined;
  const parsed = /^0x[0-9a-f]+$/i.test(text) ? Number.parseInt(text.slice(2), 16) : Number(text);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`window_handle "${text}" is not a window handle; pass the decimal number or the 0x form that list_windows reports`);
  }
  return parsed;
}

/**
 * Turn tool arguments into the selectors the helper understands.
 * @param args - Raw tool arguments.
 * @returns Only the selectors the caller actually supplied.
 */
export function windowSelection(args = {}) {
  const out = {};
  if (args.pid !== undefined && args.pid !== null) {
    const pid = Number(args.pid);
    if (!Number.isInteger(pid) || pid <= 0) throw new Error(`pid must be a positive integer, got "${String(args.pid)}"`);
    out.pid = pid;
  }
  const handle = parseWindowHandle(args.window_handle);
  if (handle !== undefined) out.window_handle = handle;
  if (args.window_title !== undefined && args.window_title !== null) {
    // pid and window_handle reject junk; the title must not merely disappear,
    // because the caller would think it had pinned a window.
    if (typeof args.window_title !== "string") {
      throw new Error(`window_title must be a string, got "${String(args.window_title)}"`);
    }
    const title = args.window_title.trim();
    if (title.length > 0) out.window_title = title;
  }
  return out;
}

/**
 * Render one candidate window the way every message lists it.
 * @param row - One entry of `details.windows` or `result.target`.
 * @returns A single indented line.
 */
export function describeCandidate(row) {
  const value = row ?? {};
  const pid = value.pid === undefined ? "?" : String(value.pid);
  const handle = typeof value.hwnd_hex === "string"
    ? value.hwnd_hex
    : Number.isInteger(value.hwnd)
      ? `0x${(value.hwnd >>> 0).toString(16).toUpperCase().padStart(8, "0")}`
      : "?";
  const title = typeof value.title === "string" && value.title.length > 0 ? ` "${value.title}"` : "";
  const extras = [];
  if (typeof value.process === "string" && value.process.length > 0) extras.push(value.process);
  if (Number.isInteger(value.session)) extras.push(`session ${value.session}`);
  if (value.minimized === true) extras.push("minimized");
  return `  - pid=${pid} hwnd=${handle}${title}${extras.length > 0 ? ` (${extras.join(", ")})` : ""}`;
}

/**
 * Build the text a model sees for a structured helper failure.
 *
 * The helper already explains what happened; this makes sure the candidate
 * windows and the machine-readable code survive the trip, so `ambiguous_window`,
 * `foreground_denied` and `input_denied` all end with the same `(code; win32=…)`
 * line instead of a bare "access denied".
 *
 * @param payload - Helper reply carrying `code`, `error`, `details` and/or `win32`.
 * @returns Printable text for the tool result.
 */
export function formatHelperFailure(payload) {
  const code = typeof payload?.code === "string" && payload.code.length > 0 ? payload.code : null;
  const message = typeof payload?.error === "string" && payload.error.trim().length > 0
    ? payload.error
    : "computer_use could not complete the action";
  const details = payload?.details ?? {};
  const lines = [message];

  const candidates = Array.isArray(details.windows) ? details.windows.filter((row) => row && typeof row === "object") : [];
  const listed = candidates.some((row) => typeof row.hwnd_hex === "string" && message.includes(row.hwnd_hex));
  if (candidates.length > 0 && !listed) lines.push(candidates.map(describeCandidate).join("\n"));

  const tags = [code ?? "helper_error"];
  const win32 = Number.isInteger(details.win32) ? details.win32 : Number.isInteger(payload?.win32) ? payload.win32 : null;
  if (win32 !== null) tags.push(`win32=${win32} ${win32Name(win32)}`);
  if (details.same_session === false) tags.push("cross-session");
  lines.push(`(${tags.join("; ")})`);
  return lines.join("\n");
}
