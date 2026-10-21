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
import { rmSync } from "node:fs";
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
  openTargetFor,
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
  #byId = new Map();
  #targetId = null;
  #lastAction = null;

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
        if (args.url && openTargetFor(args.url, readSettings()) === "system") {
          return { text: `opened in the system browser: ${args.url}` };
        }
        await this.#ensure();
        const created = await this.#newTab(args.url);
        await this.#attach(created);
        if (args.url) await this.#ensureNavigated(args.url);
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
      if (openTargetFor(args.url, readSettings()) === "system") {
        openInSystemBrowser(args.url);
        return { text: `opened in the system browser: ${args.url}`, boundId: this.#targetId };
      }
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
    if (action === "click") {
      const before = await this.#targetIds();
      const text = await this.#click(args);
      const opened = await this.#newTargetSince(before);
      return { text: opened === null ? text : `${text} (opened a new tab: ${opened})`, boundId: this.#targetId };
    }
    if (action === "type_text" || action === "paste") {
      if (args.element_index !== undefined) await this.#click(args);
      await this.#send("Input.insertText", { text: args.text ?? "" });
      return { text: "typed", boundId: this.#targetId };
    }
    if (action === "set_value") {
      await this.#focus(args.element_index);
      await this.#selectFocusedContents();
      await this.#send("Input.insertText", { text: args.value ?? "" });
      return { text: "set value", boundId: this.#targetId };
    }
    if (action === "press_key") {
      const chord = parseKeyChord(args.key);
      await this.#send("Input.dispatchKeyEvent", chord.down);
      if (args.duration_ms !== undefined) await delay(Number(args.duration_ms) || 0);
      await this.#send("Input.dispatchKeyEvent", chord.up);
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
      const mode = readSettings().annotationScreenshots;
      const last = this.#lastAction;
      const annotate = last !== null && (mode === "always" || (mode === "drag" && last.kind === "drag"));
      return { text: `screenshot saved to ${path}${annotate ? `\nannotation: last ${last.kind} at ${last.label}` : ""}`, path, boundId: this.#targetId };
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
      this.#lastAction = { kind: "drag", label: `${Math.round(args.from_x)},${Math.round(args.from_y)} → ${Math.round(args.to_x)},${Math.round(args.to_y)}` };
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
    const ordinals = new Map();
    const byId = new Map();
    const lines = [];
    for (const node of nodes.slice(0, 500)) {
      // The AX nodeId is stable inside one document, but Chrome reuses it for
      // pairs of synthetic InlineTextBox nodes, so the key carries an ordinal.
      const base = String(node.nodeId ?? "?");
      const ordinal = ordinals.get(base) ?? 0;
      ordinals.set(base, ordinal + 1);
      let id = fnv32(`${base}#${ordinal}`);
      while (byId.has(id)) id = (id + 1) >>> 0;
      byId.set(id, node);
      const role = node.role?.value ?? "unknown";
      const name = node.name?.value ?? "";
      lines.push(`[${id}] ${role} ${name}`);
    }
    this.#byId = byId;
    return lines.join("\n");
  }

  #nodeFor(index) {
    const id = Number(index);
    const node = this.#byId.get(id);
    if (node === undefined) throw new Error(`element_index ${index} is not in the last state tree`);
    return node;
  }

  async #focus(index) {
    if (index === undefined) return;
    if (this.#byId.size === 0) await this.#tree();
    const node = this.#nodeFor(index);
    if (node.backendDOMNodeId === undefined) return;
    try {
      await this.#send("DOM.focus", { backendNodeId: node.backendDOMNodeId });
      return;
    } catch (error) {
      const resolved = await this.#send("DOM.resolveNode", { backendNodeId: node.backendDOMNodeId }).catch(() => null);
      const objectId = resolved?.object?.objectId;
      if (objectId === undefined) throw new Error(`could not focus element ${index}: ${error?.message ?? error}`);
      await this.#send("Runtime.callFunctionOn", {
        objectId,
        functionDeclaration: "function () { this.focus?.(); }",
        returnByValue: true,
      });
    }
  }

  async #selectFocusedContents() {
    const expression = `(() => {
      const el = document.activeElement;
      if (!el) return false;
      if (el.isContentEditable) {
        const range = document.createRange();
        range.selectNodeContents(el);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        return true;
      }
      if (typeof el.select === "function") { el.select(); return true; }
      if (typeof el.setSelectionRange === "function") { el.setSelectionRange(0, (el.value ?? "").length); return true; }
      return false;
    })()`;
    await this.#evaluate(expression).catch(() => {});
  }

  async #targetIds() {
    try { return new Set((await this.#targets()).map((target) => target.id)); } catch { return new Set(); }
  }

  async #newTargetSince(before) {
    if (before.size === 0) return null;
    await delay(250);
    try {
      const fresh = (await this.#targets()).find((target) => !before.has(target.id));
      return fresh ? `${fresh.id} ${fresh.url ?? ""}`.trim() : null;
    } catch {
      return null;
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
      if (this.#byId.size === 0) await this.#tree();
      const node = this.#nodeFor(args.element_index);
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
    this.#lastAction = { kind: "click", label: args.element_index !== undefined ? `element ${args.element_index}` : `${Math.round(x)},${Math.round(y)}` };
    return `clicked ${args.element_index ?? `${x},${y}`}`;
  }

  async #ensure() {
    const chrome = chromeExecutable();
    if (this.#port !== null && await this.#alive()) return;
    mkdirSync(this.dir, { recursive: true });
    // A port file left behind by a crashed Chrome points at a dead browser.
    rmSync(join(this.dir, "DevToolsActivePort"), { force: true });
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
        await this.#waitForBrowser();
        await this.#configureBrowser().catch(() => {});
        return;
      }
    }
    throw new Error("Chrome did not open a DevTools port");
  }

  async #waitForBrowser() {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      if (await this.#alive()) {
        await delay(200);
        return;
      }
      await delay(150);
    }
    throw new Error("Chrome started but its DevTools port never answered");
  }

  /**
   * A tab created right after the browser starts can come up blank, because
   * Chrome drops the URL it was given. Verify it and navigate when needed.
   * @param wanted - The URL the tab should show.
   */
  async #ensureNavigated(wanted) {
    const current = await this.#evaluate("location.href").catch(() => null);
    if (typeof current === "string" && current !== "" && current !== "about:blank") return;
    await this.#send("Page.navigate", { url: wanted }).catch(() => {});
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const ready = await this.#evaluate("document.readyState").catch(() => null);
      const href = await this.#evaluate("location.href").catch(() => null);
      if (ready !== "loading" && typeof href === "string" && href !== "about:blank") return;
      await delay(100);
    }
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

/**
 * Hand a URL to the system default browser.
 * @param url - Target URL.
 */
function openInSystemBrowser(url) {
  const command = process.platform === "darwin" ? ["open", [url]]
    : process.platform === "win32" ? ["cmd", ["/c", "start", "", url]]
    : ["xdg-open", [url]];
  const child = spawn(command[0], command[1], { detached: true, stdio: "ignore" });
  child.unref();
}

const KEY_MODIFIERS = Object.freeze({ shift: 8, ctrl: 2, control: 2, alt: 1, option: 1, meta: 4, cmd: 4, command: 4, super: 4, win: 4 });

const NAMED_KEYS = Object.freeze({
  return: ["Enter", "Enter", 13, "\r"],
  enter: ["Enter", "Enter", 13, "\r"],
  tab: ["Tab", "Tab", 9, null],
  escape: ["Escape", "Escape", 27, null],
  esc: ["Escape", "Escape", 27, null],
  backspace: ["Backspace", "Backspace", 8, null],
  delete: ["Delete", "Delete", 46, null],
  space: [" ", "Space", 32, " "],
  up: ["ArrowUp", "ArrowUp", 38, null],
  arrowup: ["ArrowUp", "ArrowUp", 38, null],
  down: ["ArrowDown", "ArrowDown", 40, null],
  arrowdown: ["ArrowDown", "ArrowDown", 40, null],
  left: ["ArrowLeft", "ArrowLeft", 37, null],
  arrowleft: ["ArrowLeft", "ArrowLeft", 37, null],
  right: ["ArrowRight", "ArrowRight", 39, null],
  arrowright: ["ArrowRight", "ArrowRight", 39, null],
  home: ["Home", "Home", 36, null],
  end: ["End", "End", 35, null],
  pageup: ["PageUp", "PageUp", 33, null],
  page_up: ["PageUp", "PageUp", 33, null],
  pagedown: ["PageDown", "PageDown", 34, null],
  page_down: ["PageDown", "PageDown", 34, null],
  insert: ["Insert", "Insert", 45, null],
});

/**
 * Turn one xdotool-style key or chord into Chrome key events.
 * @param input - Such as `Return`, `ArrowDown`, or `Meta+c`.
 * @returns The keyDown and keyUp payloads.
 */
export function parseKeyChord(input) {
  const text = typeof input === "string" ? input.trim() : "";
  if (text.length === 0) throw new Error("press_key needs a `key`, such as Return, ArrowDown, or Meta+c");
  const parts = text.split("+").map((part) => part.trim()).filter((part) => part.length > 0);
  if (parts.length === 0) throw new Error(`unknown key "${input}"`);
  let modifiers = 0;
  const main = parts.pop();
  for (const part of parts) {
    const bit = KEY_MODIFIERS[part.toLowerCase()];
    if (bit === undefined) throw new Error(`unknown modifier "${part}" in "${input}"`);
    modifiers |= bit;
  }
  const named = NAMED_KEYS[main.toLowerCase()];
  if (named !== undefined) {
    const [key, code, vk, keyText] = named;
    const wantsText = keyText !== null && (modifiers === 0 || modifiers === 8);
    return buildKeyEvents(key, code, vk, wantsText ? keyText : null, modifiers);
  }
  if ([...main].length === 1) {
    const shifted = (modifiers & 8) !== 0;
    const typed = shifted ? main.toUpperCase() : main;
    const upper = typed.toUpperCase();
    const vk = /[A-Z]/u.test(upper) ? upper.charCodeAt(0) : /[0-9]/u.test(upper) ? upper.charCodeAt(0) : 0;
    const code = /[A-Z]/u.test(upper) ? `Key${upper}` : /[0-9]/u.test(upper) ? `Digit${upper}` : "";
    const wantsText = modifiers === 0 || modifiers === 8;
    return buildKeyEvents(typed, code, vk, wantsText ? typed : null, modifiers);
  }
  throw new Error(`unknown key "${main}"`);
}

function buildKeyEvents(key, code, vk, text, modifiers) {
  const common = { modifiers, key, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk };
  const down = text === null
    ? { type: "rawKeyDown", ...common }
    : { type: "keyDown", ...common, text, unmodifiedText: text };
  return { down, up: { type: "keyUp", ...common } };
}

/**
 * Stable 32-bit hash for an AX node key.
 * @param text - Node key.
 * @returns An unsigned integer.
 */
export function fnv32(text) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}
