/**
 * Chrome DevTools Protocol driver owned by this plugin.
 *
 * `browser` and `browser_use` each keep their own Chrome profile under
 * `~/.dsh/dsh-codex-tools/`. Nothing here talks to Codex or the ChatGPT
 * extension. Logins made in these windows persist in that profile only.
 *
 * @module dsh-codex-tools/cdp-browser
 */

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

export class CdpBrowser {
  #child = null;
  #port = null;
  #socket = null;
  #seq = 0;
  #pending = new Map();
  #nodes = [];
  #targetId = null;

  constructor(options = {}) {
    this.profile = options.profile ?? "browser";
    this.dir = join(homedir(), ".dsh", "dsh-codex-tools", this.profile);
  }

  async call(action, args = {}) {
    switch (action) {
      case "list_browsers":
        return { text: `owned\tDeepSeek Harness (${this.profile})\t${this.dir}` };
      case "list_tabs": {
        await this.#ensure();
        const tabs = await this.#targets();
        const text = tabs.map((tab) => `${tab.id}\t${tab.title ?? ""}\t${tab.url ?? ""}`).join("\n");
        return { text: text || "No tabs." };
      }
      case "open_tab": {
        await this.#ensure();
        const created = await this.#newTab(args.url);
        await this.#attach(created);
        return { text: `opened ${created.id}\t${created.url ?? args.url ?? ""}`, boundId: created.id };
      }
      case "get_tab":
      case "state":
      case "click":
      case "type_text":
      case "paste":
      case "press_key":
      case "scroll":
      case "set_value":
      case "goto":
      case "back":
      case "forward":
      case "reload":
      case "screenshot":
      case "documentation":
      case "close":
      case "drag":
      case "select_text":
        return this.#onTab(action, args);
      default:
        throw new Error(`unsupported browser action "${action}"`);
    }
  }

  async dispose() {
    this.#socket?.close();
    this.#socket = null;
    if (this.#child !== null) {
      this.#child.kill("SIGTERM");
      this.#child = null;
    }
  }

  async #onTab(action, args) {
    await this.#ensure();
    await this.#bind(args);
    if (action === "get_tab" || action === "documentation") {
      return { text: `bound ${this.#targetId}`, boundId: this.#targetId };
    }
    if (action === "state") return { text: await this.#tree(), boundId: this.#targetId };
    if (action === "goto") {
      await this.#send("Page.navigate", { url: args.url });
      return { text: `navigated ${args.url}`, boundId: this.#targetId };
    }
    if (action === "reload") {
      await this.#send("Page.reload");
      return { text: "reloaded", boundId: this.#targetId };
    }
    if (action === "back" || action === "forward") {
      const history = await this.#send("Page.getNavigationHistory");
      const next = history.currentIndex + (action === "back" ? -1 : 1);
      const entry = history.entries?.[next];
      if (entry === undefined) return { text: `cannot go ${action}`, boundId: this.#targetId };
      await this.#send("Page.navigateToHistoryEntry", { entryId: entry.id });
      return { text: action, boundId: this.#targetId };
    }
    if (action === "click") return { text: await this.#click(args), boundId: this.#targetId };
    if (action === "type_text" || action === "paste") {
      if (args.element_index !== undefined) await this.#click(args);
      await this.#send("Input.insertText", { text: args.text ?? "" });
      return { text: "typed", boundId: this.#targetId };
    }
    if (action === "set_value") {
      await this.#focus(args.element_index);
      await this.#send("Input.insertText", { text: args.value ?? "" });
      return { text: "set value", boundId: this.#targetId };
    }
    if (action === "press_key") {
      await this.#send("Input.dispatchKeyEvent", { type: "keyDown", key: args.key, text: args.key });
      await this.#send("Input.dispatchKeyEvent", { type: "keyUp", key: args.key });
      return { text: `pressed ${args.key}`, boundId: this.#targetId };
    }
    if (action === "scroll") {
      const delta = (args.pages ?? 1) * 240;
      const y = args.direction === "up" ? -delta : delta;
      await this.#send("Input.dispatchMouseEvent", { type: "mouseWheel", x: args.x ?? 200, y: args.y ?? 200, deltaX: 0, deltaY: y });
      return { text: `scrolled ${args.direction ?? "down"}`, boundId: this.#targetId };
    }
    if (action === "screenshot") {
      const shot = await this.#send("Page.captureScreenshot", { format: "png" });
      const path = join(tmpdir(), `dsh-browser-${Date.now()}.png`);
      await writeFile(path, Buffer.from(shot.data, "base64"));
      return { text: `screenshot saved to ${path}`, path, boundId: this.#targetId };
    }
    if (action === "close") {
      if (this.#targetId !== null) await this.#send("Target.closeTarget", { targetId: this.#targetId }).catch(() => {});
      this.#targetId = null;
      return { text: "closed" };
    }
    if (action === "select_text") {
      await this.#focus(args.element_index);
      return { text: "focused for selection", boundId: this.#targetId };
    }
    if (action === "drag") {
      await this.#send("Input.dispatchMouseEvent", { type: "mousePressed", x: args.from_x, y: args.from_y, button: "left", clickCount: 1 });
      await this.#send("Input.dispatchMouseEvent", { type: "mouseMoved", x: args.to_x, y: args.to_y, button: "left" });
      await this.#send("Input.dispatchMouseEvent", { type: "mouseReleased", x: args.to_x, y: args.to_y, button: "left", clickCount: 1 });
      return { text: "dragged", boundId: this.#targetId };
    }
    throw new Error(`unsupported browser action "${action}"`);
  }

  async #bind(args) {
    const tabs = await this.#targets();
    let target = null;
    if (args.tab_id !== undefined) target = tabs.find((tab) => tab.id === args.tab_id);
    else if (args.url !== undefined) target = tabs.find((tab) => tab.url === args.url);
    else if (this.#targetId !== null) target = tabs.find((tab) => tab.id === this.#targetId);
    if (target === undefined || target === null) {
      if (args.url !== undefined) {
        target = await this.#newTab(args.url);
      } else {
        throw new Error("needs `tab_id` or `url`");
      }
    }
    if (this.#targetId !== target.id || this.#socket === null) await this.#attach(target);
  }

  async #tree() {
    const tree = await this.#send("Accessibility.getFullAXTree");
    const nodes = tree.nodes ?? [];
    this.#nodes = nodes;
    return nodes.slice(0, 500).map((node, index) => {
      const role = node.role?.value ?? "unknown";
      const name = node.name?.value ?? "";
      return `[${index}] ${role} ${name}`;
    }).join("\n");
  }

  async #focus(index) {
    if (index === undefined) return;
    if (this.#nodes.length === 0) await this.#tree();
    const node = this.#nodes[index];
    if (node === undefined) throw new Error(`element_index ${index} is not in the last state tree`);
    if (node.backendDOMNodeId !== undefined) {
      await this.#send("DOM.focus", { backendNodeId: node.backendDOMNodeId }).catch(() => {});
    }
  }

  async #click(args) {
    let x = args.x;
    let y = args.y;
    if (args.element_index !== undefined) {
      if (this.#nodes.length === 0) await this.#tree();
      const node = this.#nodes[args.element_index];
      if (node === undefined) throw new Error(`element_index ${args.element_index} is not in the last state tree`);
      const box = await this.#send("DOM.getBoxModel", { backendNodeId: node.backendDOMNodeId });
      const quad = box.model?.content ?? box.model?.border;
      if (!quad || quad.length < 4) throw new Error("element has no box to click");
      x = (quad[0] + quad[2]) / 2;
      y = (quad[1] + quad[5]) / 2;
    }
    if (x === undefined || y === undefined) throw new Error("click needs either `element_index` or both `x` and `y`");
    const button = args.mouse_button ?? "left";
    const count = args.click_count ?? 1;
    await this.#send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button, clickCount: count });
    await this.#send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button, clickCount: count });
    return `clicked ${args.element_index ?? `${x},${y}`}`;
  }

  async #ensure() {
    if (!existsSync(CHROME)) throw new Error(`Google Chrome is not installed at ${CHROME}`);
    if (this.#port !== null && await this.#alive()) return;
    mkdirSync(this.dir, { recursive: true });
    this.#child = spawn(CHROME, [
      "--remote-debugging-port=0",
      `--user-data-dir=${this.dir}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-sync",
      "about:blank",
    ], { stdio: "ignore" });
    for (let attempt = 0; attempt < 50; attempt += 1) {
      await delay(100);
      const file = join(this.dir, "DevToolsActivePort");
      if (!existsSync(file)) continue;
      const port = Number(readFileSync(file, "utf8").split("\n")[0]);
      if (Number.isInteger(port) && port > 0) {
        this.#port = port;
        return;
      }
    }
    throw new Error("Chrome did not open a DevTools port");
  }

  async #alive() {
    try {
      const response = await fetch(`http://127.0.0.1:${this.#port}/json/version`);
      return response.ok;
    } catch {
      return false;
    }
  }

  async #targets() {
    const response = await fetch(`http://127.0.0.1:${this.#port}/json/list`);
    const targets = await response.json();
    return targets.filter((target) => target.type === "page");
  }

  async #newTab(url) {
    const endpoint = `http://127.0.0.1:${this.#port}/json/new?${encodeURIComponent(url ?? "about:blank")}`;
    let response = await fetch(endpoint, { method: "PUT" });
    if (!response.ok) response = await fetch(endpoint);
    if (!response.ok) throw new Error(`Chrome refused to open a tab (${response.status})`);
    return response.json();
  }

  async #attach(target) {
    this.#socket?.close();
    const socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      socket.addEventListener("open", resolve, { once: true });
      socket.addEventListener("error", () => reject(new Error("Chrome DevTools socket failed")), { once: true });
    });
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      const pending = this.#pending.get(message.id);
      if (pending === undefined) return;
      this.#pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message ?? "CDP error"));
      else pending.resolve(message.result ?? {});
    });
    this.#socket = socket;
    this.#targetId = target.id;
    this.#nodes = [];
    await this.#send("Page.enable");
    await this.#send("Runtime.enable");
    await this.#send("DOM.enable");
    await this.#send("Accessibility.enable");
  }

  #send(method, params = {}) {
    const id = ++this.#seq;
    this.#socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#pending.delete(id);
        reject(new Error(`${method} timed out`));
      }, 15_000);
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
    });
  }
}
