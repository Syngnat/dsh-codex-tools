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
import { readSettings } from "./settings-store.mjs";
import {
  appendDownload,
  appendHistory,
  chromeExecutable,
  extensionLaunchFlags,
  pageOrigin,
  passwordForUrl,
  presentUrl,
  readContact,
  resolveDownloadDirectory,
} from "./owned-data.mjs";

export class CdpBrowser {
  #child = null;
  #port = null;
  #socket = null;
  #browserSocket = null;
  #seq = 0;
  #pending = new Map();
  #browserPending = new Map();
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
        const note = args.url ? await this.#afterNavigation(args.url) : "";
        return { text: `opened ${created.id}\t${this.#visibleUrl(created.url ?? args.url ?? "")}${note}`, boundId: created.id };
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
    this.#browserSocket?.close();
    this.#browserSocket = null;
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
      const note = await this.#afterNavigation(args.url);
      return { text: `navigated ${this.#visibleUrl(args.url)}${note}`, boundId: this.#targetId };
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
      const sx = args.x ?? 200;
      const sy = args.y ?? 200;
      await this.#showAgentCursor(sx, sy);
      await this.#send("Input.dispatchMouseEvent", { type: "mouseWheel", x: sx, y: sy, deltaX: 0, deltaY: y });
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
      await this.#showAgentCursor(args.from_x, args.from_y);
      await this.#send("Input.dispatchMouseEvent", { type: "mousePressed", x: args.from_x, y: args.from_y, button: "left", clickCount: 1 });
      await this.#showAgentCursor(args.to_x, args.to_y);
      await this.#send("Input.dispatchMouseEvent", { type: "mouseMoved", x: args.to_x, y: args.to_y, button: "left" });
      await this.#send("Input.dispatchMouseEvent", { type: "mouseReleased", x: args.to_x, y: args.to_y, button: "left", clickCount: 1 });
      return { text: "dragged", boundId: this.#targetId };
    }
    throw new Error(`unsupported browser action "${action}"`);
  }


  #visibleUrl(url) {
    return presentUrl(url, readSettings().showFullUrl !== false);
  }

  async #afterNavigation(url) {
    const settings = readSettings();
    if (settings.historyAccess !== "deny" && typeof url === "string" && url.length > 0) {
      appendHistory({ profile: this.profile, url, title: "" });
    }
    await this.#applyPermissions(url).catch(() => {});
    const notes = [];
    if (settings.passwordsEnabled && await this.#fillLogin(url).catch(() => false)) notes.push("filled saved login");
    if (settings.contactsEnabled && await this.#fillContact().catch(() => false)) notes.push("filled saved contact");
    return notes.length > 0 ? ` (${notes.join(", ")})` : "";
  }

  async #applyPermissions(url) {
    const origin = pageOrigin(url);
    if (origin === null) return;
    const choices = readSettings().sitePermissions ?? {};
    const setting = { allow: "granted", deny: "denied" };
    for (const name of ["camera", "microphone", "geolocation", "notifications"]) {
      const choice = choices[name];
      if (choice !== "allow" && choice !== "deny") continue;
      await this.#browserSend("Browser.setPermission", { origin, permission: { name }, setting: setting[choice] });
    }
  }

  async #fillLogin(url) {
    const login = passwordForUrl(url);
    if (login === null) return false;
    const filled = await this.#evaluate(`(() => {
      const pass = document.querySelector('input[type="password"]');
      if (!pass) return false;
      const user = document.querySelector('input[type="email"], input[autocomplete="username"], input[name="username"], input[type="text"]');
      const set = (el, value) => { if (!el || value === "") return; el.focus(); el.value = value; el.dispatchEvent(new Event("input", { bubbles: true })); };
      set(user, ${JSON.stringify(login.username)});
      set(pass, ${JSON.stringify(login.password)});
      return true;
    })()`);
    return filled === true;
  }

  async #fillContact() {
    const contact = readContact();
    if (![contact.name, contact.email, contact.phone, contact.address].some((value) => value.length > 0)) return false;
    const filled = await this.#evaluate(`(() => {
      const contact = ${JSON.stringify(contact)};
      const set = (selector, value) => {
        const el = document.querySelector(selector);
        if (!el || el.value) return false;
        el.focus();
        el.value = value;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        return true;
      };
      return [
        contact.name && set('input[autocomplete="name"], input[name="name"]', contact.name),
        contact.email && set('input[type="email"], input[autocomplete="email"]', contact.email),
        contact.phone && set('input[type="tel"], input[autocomplete="tel"]', contact.phone),
        contact.address && set('textarea[autocomplete="street-address"], input[autocomplete="street-address"]', contact.address),
      ].some(Boolean);
    })()`);
    return filled === true;
  }

  async #evaluate(expression) {
    const result = await this.#send("Runtime.evaluate", { expression, returnByValue: true });
    return result.result?.value;
  }

  async #configureBrowser() {
    const settings = readSettings();
    const downloadPath = resolveDownloadDirectory(settings.downloadDirectory);
    mkdirSync(downloadPath, { recursive: true });
    await this.#browserSend("Browser.setDownloadBehavior", {
      behavior: settings.askDownloadLocation ? "default" : "allow",
      downloadPath,
      eventsEnabled: true,
    });
  }

  async #browserSend(method, params = {}) {
    await this.#ensureBrowserSocket();
    const id = ++this.#seq;
    this.#browserSocket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#browserPending.delete(id);
        reject(new Error(`${method} timed out`));
      }, 15_000);
      this.#browserPending.set(id, {
        resolve: (value) => { clearTimeout(timer); resolve(value); },
        reject: (error) => { clearTimeout(timer); reject(error); },
      });
    });
  }

  async #ensureBrowserSocket() {
    if (this.#browserSocket !== null && this.#browserSocket.readyState === WebSocket.OPEN) return;
    const response = await fetch(`http://127.0.0.1:${this.#port}/json/version`);
    const version = await response.json();
    const socket = new WebSocket(version.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      socket.addEventListener("open", resolve, { once: true });
      socket.addEventListener("error", () => reject(new Error("Chrome browser socket failed")), { once: true });
    });
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.method === "Browser.downloadWillBegin") {
        appendDownload({ profile: this.profile, guid: message.params?.guid, url: message.params?.url, filename: message.params?.suggestedFilename, state: "inProgress" });
      } else if (message.method === "Browser.downloadProgress" && message.params?.state && message.params.state !== "inProgress") {
        appendDownload({ profile: this.profile, guid: message.params.guid, state: message.params.state });
      }
      const pending = this.#browserPending.get(message.id);
      if (pending === undefined) return;
      this.#browserPending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message ?? "CDP error"));
      else pending.resolve(message.result ?? {});
    });
    this.#browserSocket = socket;
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

  async #showAgentCursor(x, y) {
    const expression = `(() => {
      const id = "__dsh_agent_cursor";
      let el = document.getElementById(id);
      if (!el) {
        el = document.createElement("div");
        el.id = id;
        el.style.cssText = "position:fixed;z-index:2147483647;pointer-events:none;width:18px;height:22px";
        el.innerHTML = '<svg width="18" height="22" viewBox="0 0 18 22"><path d="M2 1 L2 17 L6 13 L10 21 L13 19 L9 12 L16 12 Z" fill="#fff" stroke="#2563eb" stroke-width="1.2"/></svg>';
        (document.documentElement || document.body).appendChild(el);
      }
      el.style.left = ${Number(x)} + "px";
      el.style.top = ${Number(y)} + "px";
      clearTimeout(el.__hide);
      el.__hide = setTimeout(() => el.remove(), 500);
      return true;
    })()`;
    await this.#evaluate(expression).catch(() => {});
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
    await this.#showAgentCursor(x, y);
    await this.#send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button, clickCount: count });
    await this.#send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button, clickCount: count });
    return `clicked ${args.element_index ?? `${x},${y}`}`;
  }

  async #ensure() {
    const chrome = chromeExecutable();
    if (this.#port !== null && await this.#alive()) return;
    mkdirSync(this.dir, { recursive: true });
    const settings = readSettings();
    this.#child = spawn(chrome, [
      "--remote-debugging-port=0",
      `--user-data-dir=${this.dir}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-sync",
      ...extensionLaunchFlags(settings),
      "about:blank",
    ], { stdio: "ignore" });
    for (let attempt = 0; attempt < 50; attempt += 1) {
      await delay(100);
      const file = join(this.dir, "DevToolsActivePort");
      if (!existsSync(file)) continue;
      const port = Number(readFileSync(file, "utf8").split("\n")[0]);
      if (Number.isInteger(port) && port > 0) {
        this.#port = port;
        await this.#configureBrowser().catch(() => {});
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
