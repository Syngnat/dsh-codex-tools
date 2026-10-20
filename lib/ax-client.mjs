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
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

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
export function windowsCompileCommand({ systemRoot = process.env.SystemRoot || "C:\\Windows", pluginRoot = root, exists = existsSync } = {}) {
  const frameworks = [
    join(systemRoot, "Microsoft.NET", "Framework64", "v4.0.30319"),
    join(systemRoot, "Microsoft.NET", "Framework", "v4.0.30319"),
  ];
  const framework = frameworks.find((dir) => exists(join(dir, "csc.exe")));
  if (framework === undefined) {
    throw new Error("The Windows C# compiler (csc.exe) was not found. computer_use builds its own helper with it; PowerShell is not required.");
  }
  const libraries = ["UIAutomationClient.dll", "UIAutomationTypes.dll", "System.Windows.Forms.dll", "System.Drawing.dll", "System.Web.Extensions.dll"];
  const references = libraries.map((name) => {
    const hit = [join(framework, name), join(framework, "WPF", name)].find((path) => exists(path));
    if (hit === undefined) throw new Error(`computer_use cannot find ${name} next to csc.exe.`);
    return `/reference:${hit}`;
  });
  const output = join(pluginRoot, "bin", "dsh-uia.exe");
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
  mkdirSync(join(root, "bin"), { recursive: true });
  const compiled = spawnSync(plan.command, plan.args, { encoding: "utf8", windowsHide: true });
  if (compiled.status !== 0) {
    const detail = `${compiled.stdout || ""}\n${compiled.stderr || ""}`.trim();
    throw new Error(`computer_use could not build dsh-uia.exe.${detail ? ` ${detail}` : ""}`);
  }
}

export function computerHelperLaunch(platform = process.platform) {
  if (platform === "win32") {
    const output = join(root, "bin", "dsh-uia.exe");
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

  constructor(options = {}) {
    const launch = options.launch ?? computerHelperLaunch(options.platform);
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
    const child = spawn(this.command, this.args, { stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
    this.#child = child;
    this.#buffer = "";
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => this.#onData(chunk));
    child.on("exit", () => {
      const error = new Error(`${this.label} exited`);
      for (const pending of this.#pending.values()) pending.reject(error);
      this.#pending.clear();
      this.#child = null;
    });
  }

  async call(op, args = {}) {
    await this.start();
    const id = this.#nextId++;
    const child = this.#child;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#pending.delete(id);
        reject(new Error(`${this.label} did not answer ${op} within 20s`));
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

  async dispose() {
    const child = this.#child;
    this.#child = null;
    if (child === null) return;
    child.kill("SIGTERM");
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
      if (message.ok === true) pending.resolve(message.result ?? {});
      else pending.reject(new Error(message.error || `${this.label} failed`));
    }
  }
}
