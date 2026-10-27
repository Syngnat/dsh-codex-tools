/**
 * JSON-line client for this plugin's computer-use helper.
 *
 * macOS uses `bin/dsh-ax` (Accessibility). Windows uses `bin/dsh-uia.exe`,
 * built on first use from `native/dsh-uia.cs` with the .NET Framework C#
 * compiler that ships with Windows. PowerShell is not involved.
 *
 * @module dsh-codex-tools/ax-client
 */

import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { closeSync, existsSync, mkdirSync, openSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { dataRoot } from "./owned-data.mjs";
import { formatHelperFailure } from "./window-target.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Directory holding helpers this plugin builds for itself.
 *
 * It sits outside the installed package on purpose. Windows keeps an image lock
 * on a running `dsh-uia.exe`, and any update that has to delete the old package
 * directory fails with EPERM while that lock is held — which left the plugin
 * removed and uninstallable. The file name also carries a hash of the C# source,
 * so a rebuilt helper never overwrites the file a running helper still holds.
 *
 * @returns Absolute directory; it may not exist yet.
 */
export function helperDirectory() {
  return join(dataRoot(), "helper");
}

/**
 * Where the Windows helper for the current C# source lives.
 * @param options - Plugin root, helper directory, and a read used by tests.
 * @returns Absolute path of the exe that will be spawned.
 */
export function windowsHelperPath({ pluginRoot = root, helperDir = helperDirectory(), read = readFileSync } = {}) {
  let digest = "nosource";
  try {
    digest = createHash("sha256").update(read(join(pluginRoot, "native", "dsh-uia.cs"))).digest("hex").slice(0, 12);
  } catch {
    // An unreadable source still gets a stable name; the compile step reports
    // the real problem with a clearer message.
  }
  return join(helperDir, `dsh-uia-${digest}.exe`);
}

/**
 * The helper path older versions built inside the package.
 * @param options - Plugin root.
 * @returns Absolute path that may still hold a running, locked exe.
 */
export function legacyWindowsHelperPath({ pluginRoot = root } = {}) {
  return join(pluginRoot, "bin", "dsh-uia.exe");
}

/**
 * Whether the file at `path` cannot be replaced right now.
 *
 * Windows allows reading and even renaming a running image, but refuses to
 * delete or rewrite it. A read-write open is therefore the cheapest honest
 * probe: it succeeds exactly when the file could be replaced.
 *
 * @param path - File to probe.
 * @param options - Platform and fs seams used by tests.
 * @returns True when a running process still holds the file.
 */
export function helperLocked(path, { platform = process.platform, open = openSync, close = closeSync, exists = existsSync } = {}) {
  if (platform !== "win32" || !exists(path)) return false;
  try {
    close(open(path, "r+"));
    return false;
  } catch {
    return true;
  }
}

/**
 * Pick the computer-use process for one operating system.
 * @param platform - `process.platform` value. Defaults to this machine.
 * @returns Spawn command, arguments, and the file that must exist.
 */
/**
 * Build command for the Windows helper. `csc.exe` comes with Windows itself.
 * @param options - System root, plugin root, and an exists check (tests inject one).
 * @returns Compiler path, arguments, source, and the exe that will be produced.
 */
export function windowsCompileCommand({ systemRoot = process.env.SystemRoot || "C:\\Windows", pluginRoot = root, helperDir = helperDirectory(), exists = existsSync } = {}) {
  const frameworks = [
    join(systemRoot, "Microsoft.NET", "Framework64", "v4.0.30319"),
    join(systemRoot, "Microsoft.NET", "Framework", "v4.0.30319"),
  ];
  const framework = frameworks.find((dir) => exists(join(dir, "csc.exe")));
  if (framework === undefined) {
    throw new Error("The Windows C# compiler (csc.exe) was not found. computer_use builds its own helper with it; PowerShell is not required.");
  }
  const libraries = ["UIAutomationClient.dll", "UIAutomationTypes.dll", "WindowsBase.dll", "System.Windows.Forms.dll", "System.Drawing.dll", "System.Web.Extensions.dll"];
  const references = libraries.map((name) => {
    const hit = [join(framework, name), join(framework, "WPF", name)].find((path) => exists(path));
    if (hit === undefined) throw new Error(`computer_use cannot find ${name} next to csc.exe.`);
    return `/reference:${hit}`;
  });
  const output = windowsHelperPath({ pluginRoot, helperDir });
  const source = join(pluginRoot, "native", "dsh-uia.cs");
  return {
    command: join(framework, "csc.exe"),
    args: ["/nologo", "/optimize+", `/out:${output}`, ...references, source],
    output,
    source,
  };
}

function compileWindowsHelper() {
  const plan = windowsCompileCommand();
  if (!existsSync(plan.source)) throw new Error(`computer-use source is missing at ${plan.source}`);
  mkdirSync(dirname(plan.output), { recursive: true });
  const compiled = spawnSync(plan.command, plan.args, { encoding: "utf8", windowsHide: true });
  if (compiled.status !== 0) {
    const detail = `${compiled.stdout || ""}\n${compiled.stderr || ""}`.trim();
    throw new Error(`computer_use could not build dsh-uia.exe.${detail ? ` ${detail}` : ""}`);
  }
}

export function computerHelperLaunch(platform = process.platform) {
  if (platform === "win32") {
    const output = windowsHelperPath();
    return { command: output, args: [], label: "dsh-uia", requiredPath: output };
  }
  if (platform === "darwin") {
    const command = join(root, "bin", "dsh-ax");
    return { command, args: [], label: "dsh-ax", requiredPath: command };
  }
  throw new Error(`computer_use does not support ${platform}. Supported systems are macOS and Windows.`);
}

export class AxClient {
  #child = null;
  #buffer = "";
  #nextId = 1;
  #pending = new Map();
  #spawn = spawn;

  constructor(options = {}) {
    const launch = options.launch ?? computerHelperLaunch(options.platform);
    if (typeof options.spawn === "function") this.#spawn = options.spawn;
    this.command = launch.command;
    this.args = launch.args;
    this.label = launch.label;
    this.requiredPath = launch.requiredPath;
  }

  async start() {
    if (this.#child !== null && this.#child.exitCode === null) return;
    if (this.label === "dsh-uia" && !existsSync(this.requiredPath)) compileWindowsHelper();
    if (!existsSync(this.requiredPath)) {
      const hint = this.label === "dsh-ax" ? " Rebuild it with swiftc from native/dsh-ax.swift." : "";
      throw new Error(`computer-use helper is missing at ${this.requiredPath}.${hint}`);
    }
    const child = this.#spawn(this.command, this.args, { stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
    this.#child = child;
    this.#buffer = "";
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => this.#onData(chunk));
    child.on("exit", () => {
      const error = new Error(`${this.label} exited`);
      for (const pending of this.#pending.values()) pending.reject(error);
      this.#pending.clear();
      if (this.#child === child) this.#child = null;
    });
  }

  async call(op, args = {}) {
    await this.start();
    const id = this.#nextId++;
    const child = this.#child;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#pending.delete(id);
        // A helper blocked on a hung window would otherwise fail every later
        // call too; kill it so the next call starts a fresh one.
        try {
          this.#child?.kill();
        } catch {
          // The child is already gone.
        }
        reject(new Error(`${this.label} did not answer ${op} within 20s; the helper was restarted. The target window may be hung, so call list_windows and pick a window that answers.`));
      }, 20_000);
      this.#pending.set(id, {
        resolve: (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
      });
      child.stdin.write(`${JSON.stringify({ id, op, args })}\n`);
    });
  }

  /**
   * Stop the helper and wait until it is gone.
   *
   * Waiting matters: an update deletes the package directory right after this
   * call, and on Windows a helper that has not exited yet still holds its image
   * lock. The wait is bounded, and a helper that ignores SIGTERM is killed.
   *
   * @param options - Exit deadline used by tests.
   */
  async dispose({ timeoutMs = 2_000 } = {}) {
    const child = this.#child;
    this.#child = null;
    if (child === null) return;
    await new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      const timer = setTimeout(() => {
        try {
          child.kill("SIGKILL");
        } catch {
          // The child exited between the timeout and the kill.
        }
        finish();
      }, timeoutMs);
      // The deadline stays referenced: an update is waiting on this promise, and
      // letting the loop drain would resolve the caller without releasing the
      // file the replacement is about to delete.
      child.once("exit", () => {
        clearTimeout(timer);
        finish();
      });
      try {
        child.kill("SIGTERM");
      } catch {
        clearTimeout(timer);
        finish();
      }
    });
  }

  #onData(chunk) {
    this.#buffer += chunk;
    for (;;) {
      const newline = this.#buffer.indexOf("\n");
      if (newline < 0) return;
      const line = this.#buffer.slice(0, newline).trim();
      this.#buffer = this.#buffer.slice(newline + 1);
      if (line.length === 0) continue;
      let message;
      try {
        message = JSON.parse(line);
      } catch {
        continue;
      }
      const pending = this.#pending.get(message.id);
      if (pending === undefined) continue;
      this.#pending.delete(message.id);
      if (message.ok === true) {
        pending.resolve(message.result ?? {});
        continue;
      }
      // Keep the helper's code and details on the error: an ambiguous app and a
      // denied keystroke need different repairs, and both must name the window.
      const error = new Error(formatHelperFailure(message));
      error.code = typeof message.code === "string" ? message.code : null;
      error.details = message.details ?? null;
      error.helper = this.label;
      pending.reject(error);
    }
  }
}
