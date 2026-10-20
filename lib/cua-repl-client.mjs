/**
 * MCP stdio client for Codex Desktop's unified Computer Use runtime.
 *
 * Codex Desktop exposes computer use and browser control through one MCP server:
 * `@oai/cua-repl`'s launcher, which spawns the bundled `node_repl` kernel with the
 * `cua` API bound to the trusted `@oai/sky/service` and `@oai/browser-desktop/service`
 * providers. The server exposes `js`, `js_reset`, `js_add_node_module_dir` and
 * `turn_ended`; `js` evaluates JavaScript in a persistent REPL whose global `cua`
 * object drives native apps and browser tabs.
 *
 * This module owns one lazily started child process, the JSON-RPC framing, and
 * restart-on-failure. It never executes application code of its own.
 *
 * @module dsh-codex-tools/cua-repl-client
 */

import { spawn } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

/** Protocol revision this client speaks to the bundled server. */
const PROTOCOL_VERSION = "2024-11-05";

/** How long one `js` call may take before the client gives up, in milliseconds. */
const DEFAULT_CALL_TIMEOUT_MS = 120_000;

/** How long the server may take to answer `initialize`, in milliseconds. */
const DEFAULT_START_TIMEOUT_MS = 120_000;

/** Bounded stderr tail retained for diagnostics. */
const STDERR_TAIL_BYTES = 8_192;

/** How many elicitation decisions to keep for reporting. */
const MAX_APPROVAL_LOG = 64;

/** Raised when the Codex runtime cannot be located or fails to start. */
export class CuaRuntimeUnavailableError extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = "CuaRuntimeUnavailableError";
  }
}

/** Raised when the runtime answered a call with an MCP error or an error result. */
export class CuaCallError extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = "CuaCallError";
  }
}

/**
 * Candidate `cua_node` roots, most specific first.
 * @returns Absolute candidate directories.
 */
function cuaNodeCandidates() {
  const out = [];
  const fromEnv = process.env.DSH_CODEX_CUA_NODE;
  if (typeof fromEnv === "string" && fromEnv.length > 0) out.push(fromEnv);
  const appFromEnv = process.env.DSH_CODEX_APP;
  const apps = [
    ...(typeof appFromEnv === "string" && appFromEnv.length > 0 ? [appFromEnv] : []),
    "/Applications/ChatGPT.app",
    join(homedir(), "Applications", "ChatGPT.app"),
  ];
  for (const app of apps) out.push(join(app, "Contents", "Resources", "cua_node"));
  return out;
}

/**
 * Resolve the bundled Codex runtime once, verifying every path the launcher needs.
 * @returns Absolute paths for the node binary, the launcher, the REPL kernel and the module root.
 * @throws {CuaRuntimeUnavailableError} when no candidate holds a complete runtime.
 */
export function resolveCuaRuntime() {
  const problems = [];
  for (const root of cuaNodeCandidates()) {
    const nodeBin = join(root, "bin", "node");
    const nodeRepl = join(root, "bin", "node_repl");
    const moduleRoot = join(root, "lib", "node_modules");
    const launcher = join(moduleRoot, "@oai", "cua-repl", "bin", "cua-repl.mjs");
    const skyService = join(moduleRoot, "@oai", "sky", "dist", "project", "cua", "sky_js", "src", "service.js");
    const missing = [nodeBin, nodeRepl, launcher, moduleRoot].filter((p) => !existsSync(p));
    if (missing.length > 0) {
      problems.push(`${root}: missing ${missing.join(", ")}`);
      continue;
    }
    return { root, nodeBin, nodeRepl, launcher, moduleRoot, skyService };
  }
  throw new CuaRuntimeUnavailableError(
    `Codex Computer Use runtime not found. Looked for a ChatGPT.app bundle with ` +
      `Contents/Resources/cua_node containing bin/node, bin/node_repl and ` +
      `lib/node_modules/@oai/cua-repl. Set DSH_CODEX_CUA_NODE to the cua_node ` +
      `directory to override. Tried: ${problems.join("; ")}`,
  );
}

/** One in-flight JSON-RPC request. */
class Pending {
  constructor(resolve, reject, timer) {
    this.resolve = resolve;
    this.reject = reject;
    this.timer = timer;
  }
}

/**
 * A persistent MCP client for the Codex Computer Use REPL server.
 *
 * The child is started on first use and kept alive across calls so the REPL's
 * JavaScript bindings (`cua.getApp(...)`, bound tabs, and so on) persist exactly
 * as they do inside Codex.
 */
export class CuaReplClient {
  #runtime;
  #child = null;
  #startPromise = null;
  #pending = new Map();
  #nextId = 1;
  #buffer = "";
  #stderrTail = "";
  #disposed = false;
  #generation = 0;

  /**
   * @param options - Optional overrides.
   * @param options.runtime - Pre-resolved runtime paths; resolved lazily when omitted.
   * @param options.surfaces - `CUA_REPL_ENABLED_SURFACES` value; defaults to `computer,browser`.
   * @param options.callTimeoutMs - Per-call deadline; defaults to 120000.
   * @param options.logger - Optional sink for lifecycle diagnostics.
   */
  constructor(options = {}) {
    this.#runtime = options.runtime;
    this.surfaces = options.surfaces ?? "computer,browser";
    this.callTimeoutMs = options.callTimeoutMs ?? DEFAULT_CALL_TIMEOUT_MS;
    this.logger = options.logger;
    this.requestMeta = options.requestMeta ?? null;
    this.approval = options.approval ?? "accept";
    this.onElicitation = options.onElicitation ?? null;
    this.approvals = [];
  }

  /**
   * Attach the Codex turn metadata the browser provider requires.
   *
   * The browser-desktop service rejects any call whose MCP `_meta` lacks
   * `x-codex-turn-metadata` with a `session_id` and `turn_id`. Codex supplies
   * those from its own turn; here the plugin supplies a stable session identity
   * and a fresh turn identity per call.
   * @param params - MCP request params to decorate.
   * @returns The same params object.
   */
  #withRequestMeta(params) {
    if (this.requestMeta === null) return params;
    const meta = typeof this.requestMeta === "function" ? this.requestMeta() : this.requestMeta;
    if (meta === null || meta === undefined) return params;
    params._meta = { "x-codex-turn-metadata": JSON.stringify(meta) };
    return params;
  }

  /** Resolved runtime paths, resolving them on first access. */
  get runtime() {
    if (this.#runtime === undefined) this.#runtime = resolveCuaRuntime();
    return this.#runtime;
  }

  /** Whether a live child process is currently attached. */
  get running() {
    return this.#child !== null && this.#child.exitCode === null && !this.#child.killed;
  }

  /** Bounded stderr tail from the current child, for diagnostics. */
  get stderrTail() {
    return this.#stderrTail;
  }

  /**
   * Start the server if it is not already running and complete the MCP handshake.
   * @returns The server identity reported by `initialize`.
   */
  async start() {
    if (this.#disposed) throw new CuaRuntimeUnavailableError("the Codex Computer Use client was disposed");
    if (this.running && this.#startPromise === null) return this.#serverInfo;
    if (this.#startPromise !== null) return this.#startPromise;
    this.#startPromise = this.#spawnAndInitialize().finally(() => {
      this.#startPromise = null;
    });
    return this.#startPromise;
  }

  async #spawnAndInitialize() {
    const { nodeBin, launcher, nodeRepl, moduleRoot } = this.runtime;
    const generation = ++this.#generation;
    const env = {
      ...process.env,
      CUA_REPL_NODE_REPL_PATH: nodeRepl,
      CUA_REPL_ENABLED_SURFACES: this.surfaces,
      NODE_REPL_NODE_MODULE_DIRS: moduleRoot,
      NODE_REPL_TRUSTED_CODE_PATHS: moduleRoot,
    };
    const child = spawn(nodeBin, [launcher], {
      cwd: moduleRoot,
      env,
      stdio: ["pipe", "pipe", "pipe"],
    });
    this.#child = child;
    this.#buffer = "";
    this.#stderrTail = "";
    this.#warmed = false;
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => this.#onStdout(chunk));
    child.stderr.on("data", (chunk) => {
      this.#stderrTail = (this.#stderrTail + chunk).slice(-STDERR_TAIL_BYTES);
    });
    child.on("error", (error) => this.#failAll(error));
    child.on("exit", (code, signal) => {
      if (generation !== this.#generation) return;
      this.#child = null;
      this.#failAll(
        new CuaRuntimeUnavailableError(
          `the Codex Computer Use server exited (code=${String(code)}, signal=${String(signal)})` +
            (this.#stderrTail.length > 0 ? `; stderr tail: ${this.#stderrTail.trim()}` : ""),
        ),
      );
    });
    const result = await this.#request(
      "initialize",
      {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { elicitation: {} },
        clientInfo: { name: "dsh-codex-tools", version: "1.0.0" },
      },
      DEFAULT_START_TIMEOUT_MS,
    );
    this.#serverInfo = result?.serverInfo ?? {};
    this.#notify("notifications/initialized", {});
    return this.#serverInfo;
  }

  #serverInfo = {};

  #warmed = false;

  /**
   * Absorb the runtime's one-time first-use documentation.
   *
   * The REPL prints a long Computer Use manual the first time the `cua` API is
   * touched in a fresh kernel, and a second one the first time a browser is
   * selected. Consuming both here keeps every real tool result clean; the
   * browser pass is best-effort because a machine may have no browser at all.
   */
  async #warmup() {
    if (this.#warmed) return;
    this.#warmed = true;
    const warm = async (code, title) => {
      try {
        await this.#request(
          "tools/call",
          this.#withRequestMeta({ name: "js", arguments: { code, title } }),
          this.callTimeoutMs,
        );
      } catch (error) {
        this.logger?.debug?.(`dsh-codex-tools: ${title} failed: ${String(error)}`);
      }
    };
    await warm("await cua.listApps({ emit: false });", "warm up computer use");
    if (this.surfaces.includes("browser")) {
      await warm(
        [
          "const browsers = await cua.listBrowsers({ emit: false });",
          "for (const browser of browsers) {",
          "  try { await cua.getBrowser({ id: browser.id }); } catch (error) { void error; }",
          "}",
        ].join("\n"),
        "warm up browser",
      );
    }
  }

  #onStdout(chunk) {
    this.#buffer += chunk;
    let index = this.#buffer.indexOf("\n");
    while (index !== -1) {
      const line = this.#buffer.slice(0, index).trim();
      this.#buffer = this.#buffer.slice(index + 1);
      if (line.length > 0) this.#onMessage(line);
      index = this.#buffer.indexOf("\n");
    }
  }

  #onMessage(line) {
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      this.logger?.debug?.(`dsh-codex-tools: ignoring non-JSON line from cua-repl: ${line.slice(0, 200)}`);
      return;
    }
    const id = message?.id;
    if (typeof message?.method === "string" && id !== undefined && id !== null) {
      this.#onServerRequest(id, message.method, message.params);
      return;
    }
    if (id === undefined || id === null) return;
    const pending = this.#pending.get(id);
    if (pending === undefined) return;
    this.#pending.delete(id);
    clearTimeout(pending.timer);
    if (message.error !== undefined && message.error !== null) {
      pending.reject(new CuaCallError(`cua-repl error: ${message.error.message ?? JSON.stringify(message.error)}`));
      return;
    }
    pending.resolve(message.result);
  }

  /**
   * Answer a server-initiated request.
   *
   * The Computer Use runtime asks the client to approve an app before it will
   * read or drive that app's UI, through MCP form elicitation. The plugin's
   * configured policy decides the answer; every decision is recorded so the
   * model and the user can see what was approved.
   * @param id - Request id to answer.
   * @param method - Requested method.
   * @param params - Request payload.
   */
  #onServerRequest(id, method, params) {
    if (method !== "elicitation/create") {
      this.#write({ jsonrpc: "2.0", id, error: { code: -32601, message: `unsupported method ${method}` } });
      return;
    }
    const decision = this.onElicitation?.(params) ?? this.approval;
    const action = decision === "deny" ? "decline" : "accept";
    this.approvals.push({
      at: new Date().toISOString(),
      action,
      message: typeof params?.message === "string" ? params.message : undefined,
    });
    if (this.approvals.length > MAX_APPROVAL_LOG) this.approvals.shift();
    this.#write({ jsonrpc: "2.0", id, result: { action, content: {} } });
  }

  /** Elicitation decisions recorded so far, oldest first. */
  get approvalLog() {
    return [...this.approvals];
  }

  #failAll(error) {
    const pending = [...this.#pending.values()];
    this.#pending.clear();
    for (const entry of pending) {
      clearTimeout(entry.timer);
      entry.reject(error);
    }
  }

  #write(payload) {
    const child = this.#child;
    if (child === null || child.stdin === null || child.stdin.destroyed) {
      throw new CuaRuntimeUnavailableError("the Codex Computer Use server is not running");
    }
    child.stdin.write(`${JSON.stringify(payload)}\n`);
  }

  #notify(method, params) {
    this.#write({ jsonrpc: "2.0", method, params });
  }

  #request(method, params, timeoutMs) {
    const id = this.#nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#pending.delete(id);
        reject(new CuaCallError(`cua-repl did not answer ${method} within ${timeoutMs}ms`));
      }, timeoutMs);
      if (typeof timer.unref === "function") timer.unref();
      this.#pending.set(id, new Pending(resolve, reject, timer));
      try {
        this.#write({ jsonrpc: "2.0", id, method, params });
      } catch (error) {
        this.#pending.delete(id);
        clearTimeout(timer);
        reject(error);
      }
    });
  }

  /**
   * List the tools the runtime advertises.
   * @returns Tool descriptors as reported by the server.
   */
  async listTools() {
    await this.start();
    const result = await this.#request("tools/list", {}, this.callTimeoutMs);
    return result?.tools ?? [];
  }

  /**
   * Evaluate JavaScript in the persistent Codex REPL.
   *
   * The script runs with the `cua` global already bound and `nodeRepl` available
   * for output, exactly as inside Codex. Use `nodeRepl.write(...)` for text and
   * `nodeRepl.emitImage(...)` for images.
   *
   * @param code - JavaScript source to evaluate.
   * @param options - Optional title and deadline.
   * @returns The raw MCP result: `{ content, isError?, structuredContent? }`.
   */
  async runJs(code, options = {}) {
    await this.start();
    await this.#warmup();
    const args = { code };
    if (options.title !== undefined) args.title = options.title;
    const timeoutMs = options.timeoutMs ?? this.callTimeoutMs;
    if (options.timeoutMs !== undefined) args.timeout_ms = options.timeoutMs;
    const result = await this.#request(
      "tools/call",
      this.#withRequestMeta({ name: "js", arguments: args }),
      timeoutMs + 15_000,
    );
    return result ?? {};
  }

  /**
   * Evaluate JavaScript and return its textual output, throwing on an error result.
   * @param code - JavaScript source to evaluate.
   * @param options - Optional title and deadline.
   * @returns Concatenated text content, or a JSON dump of structured content.
   */
  async runJsText(code, options = {}) {
    const result = await this.runJs(code, options);
    const text = textOf(result);
    if (result.isError === true) {
      throw new CuaCallError(text.length > 0 ? text : "the Codex Computer Use runtime reported an error");
    }
    return text;
  }

  /** Reset the persistent REPL, discarding every JavaScript binding. */
  async reset() {
    await this.start();
    const result = await this.#request("tools/call", { name: "js_reset", arguments: {} }, this.callTimeoutMs);
    return textOf(result ?? {});
  }

  /** Stop the child process and reject anything still in flight. */
  async dispose() {
    this.#disposed = true;
    const child = this.#child;
    this.#child = null;
    this.#failAll(new CuaRuntimeUnavailableError("the Codex Computer Use client was disposed"));
    if (child === null) return;
    await new Promise((resolve) => {
      const done = () => resolve();
      child.once("exit", done);
      child.kill("SIGTERM");
      const timer = setTimeout(() => {
        child.kill("SIGKILL");
        resolve();
      }, 3_000);
      if (typeof timer.unref === "function") timer.unref();
    });
  }
}

/**
 * Flatten one MCP tool result into text, preserving non-text blocks as markers.
 * @param result - MCP result object.
 * @returns Human-readable text.
 */
export function textOf(result) {
  const blocks = Array.isArray(result?.content) ? result.content : [];
  const parts = [];
  for (const block of blocks) {
    if (block?.type === "text" && typeof block.text === "string") parts.push(block.text);
    else if (block?.type === "image") parts.push(`[image ${block.mimeType ?? "image/png"}]`);
    else if (block !== undefined && block !== null) parts.push(JSON.stringify(block));
  }
  if (parts.length > 0) return parts.join("\n");
  if (result?.structuredContent !== undefined) return JSON.stringify(result.structuredContent, null, 2);
  return "";
}

/**
 * Collect image blocks from one MCP tool result.
 * @param result - MCP result object.
 * @returns `{ mimeType, data }` pairs in server order.
 */
export function imagesOf(result) {
  const blocks = Array.isArray(result?.content) ? result.content : [];
  return blocks
    .filter((block) => block?.type === "image" && typeof block.data === "string")
    .map((block) => ({ mimeType: block.mimeType ?? "image/png", data: block.data }));
}

/**
 * List the browser-capable native-messaging hosts Codex has registered, when present.
 * Informational only: the browser surface is reached through the REPL, not this file.
 * @returns Absolute host paths, or an empty array.
 */
export function listChromeNativeHosts() {
  const config = join(homedir(), ".codex", "chrome-native-hosts-v2.json");
  if (!existsSync(config)) return [];
  try {
    const parsed = JSON.parse(readFileSync(config, "utf8"));
    const paths = parsed?.paths ?? {};
    return Object.values(paths).filter((value) => typeof value === "string");
  } catch {
    return [];
  }
}

/** Directory names under a root, used by diagnostics. */
export function listDirNames(root) {
  try {
    return readdirSync(root);
  } catch {
    return [];
  }
}
