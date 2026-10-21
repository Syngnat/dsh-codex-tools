/**
 * Data the settings page owns besides the main switches: navigation history,
 * downloads, saved logins, contact details, and the owned Chrome profiles.
 *
 * @module dsh-codex-tools/owned-data
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";

let rootOverride = null;

/** @returns Directory that holds both Chrome profiles and these records. */
export function dataRoot() {
  return rootOverride ?? join(homedir(), ".dsh", "dsh-codex-tools");
}

/** Point record files at another directory. Tests use this; pass null to restore the default. */
export function useDataRoot(dir) {
  rootOverride = dir;
}

const ROOT = () => dataRoot();

function readJson(name, fallback) {
  try {
    return JSON.parse(readFileSync(join(ROOT(), name), "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(name, value) {
  const path = join(ROOT(), name);
  mkdirSync(ROOT(), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

/**
 * Show or hide the path, query, and fragment.
 * @param url - Absolute URL, or any string.
 * @param showFullUrl - When false, only the origin is returned for http(s) URLs.
 * @returns The URL as the settings say it should be shown.
 */
export function presentUrl(url, showFullUrl = true) {
  const text = typeof url === "string" ? url : "";
  if (showFullUrl || text.length === 0) return text;
  try {
    return new URL(text).origin;
  } catch {
    return text;
  }
}

/**
 * Decide whether a URL opens in this plugin's window or in the system browser.
 * @param url - Target URL.
 * @param settings - Normalized settings.
 * @returns `"system"` or `"app"`.
 */
export function openTargetFor(url, settings) {
  const text = typeof url === "string" ? url.trim() : "";
  if (text.length === 0) return "app";
  const chosen = isLocalUrl(text) ? settings?.localUrlTarget : settings?.webUrlTarget;
  return chosen === "system" ? "system" : "app";
}

/**
 * @param url - Target URL.
 * @returns Whether it points at this machine.
 */
export function isLocalUrl(url) {
  const text = typeof url === "string" ? url.trim() : "";
  if (text.length === 0) return false;
  let parsed;
  try {
    parsed = new URL(text);
  } catch {
    return text.startsWith("/") || text.startsWith("./") || text.startsWith("../");
  }
  if (parsed.protocol === "file:") return true;
  if (!["http:", "https:", "ws:", "wss:"].includes(parsed.protocol)) return false;
  const host = parsed.hostname.toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host === "::1" || host.endsWith(".localhost");
}

/**
 * @param app - App name from a computer-use call.
 * @returns Whether the target is Microsoft Excel.
 */
export function isExcelApp(app) {
  if (app === undefined || app === null) return false;
  const name = String(app).trim().toLowerCase();
  if (name.length === 0) return false;
  return name === "excel"
    || name === "excel.exe"
    || name.endsWith("\\excel.exe")
    || name.endsWith("/excel.exe")
    || name.includes("microsoft excel")
    || name === "com.microsoft.excel";
}

/**
 * Find the Chrome executable for this operating system.
 * @param options - Platform, environment, and exists check. Tests inject them.
 * @returns Absolute path.
 */
export function chromeExecutable({ platform = process.platform, env = process.env, exists = existsSync } = {}) {
  const programFiles = env.PROGRAMFILES || "C:\\Program Files";
  const programFilesX86 = env["PROGRAMFILES(X86)"] || "C:\\Program Files (x86)";
  const localAppData = env.LOCALAPPDATA || "";
  const candidates = platform === "win32"
    ? [
        join(programFiles, "Google", "Chrome", "Application", "chrome.exe"),
        join(programFilesX86, "Google", "Chrome", "Application", "chrome.exe"),
        localAppData ? join(localAppData, "Google", "Chrome", "Application", "chrome.exe") : "",
      ]
    : platform === "darwin"
      ? ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"]
      : ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium"];
  const found = candidates.find((path) => path && exists(path));
  if (found === undefined) throw new Error("Google Chrome was not found.");
  return found;
}

/**
 * Extra Chrome arguments implied by the extension settings.
 * @param settings - Normalized settings.
 * @returns Flags, excluding the remote-debugging and profile flags.
 */
export function extensionLaunchFlags(settings) {
  if (settings?.extensionsEnabled === false) return ["--disable-extensions"];
  const paths = Array.isArray(settings?.extraExtensionPaths) ? settings.extraExtensionPaths.filter((path) => typeof path === "string" && path.trim().length > 0) : [];
  if (paths.length === 0) return [];
  return [`--load-extension=${paths.join(",")}`];
}

/**
 * @param url - Page URL.
 * @returns The origin, or null when the URL has none.
 */
export function pageOrigin(url) {
  try {
    const origin = new URL(url).origin;
    return origin === "null" ? null : origin;
  } catch {
    return null;
  }
}

const HISTORY_LIMIT = 100;

/** Record one navigation performed by this plugin. */
export function appendHistory(entry) {
  const history = readJson("history.json", []);
  const list = Array.isArray(history) ? history : [];
  list.unshift({
    profile: typeof entry.profile === "string" ? entry.profile : "browser",
    url: typeof entry.url === "string" ? entry.url.slice(0, 2000) : "",
    title: typeof entry.title === "string" ? entry.title.slice(0, 300) : "",
    at: new Date().toISOString(),
  });
  writeJson("history.json", list.slice(0, HISTORY_LIMIT));
}

/** @returns Newest navigations first. */
export function listHistory() {
  const history = readJson("history.json", []);
  return Array.isArray(history) ? history.slice(0, HISTORY_LIMIT) : [];
}

/** Remove the navigation log. Chrome's own History database is untouched. */
export function clearHistory() {
  writeJson("history.json", []);
}

/** Record one download reported by Chrome. */
export function appendDownload(entry) {
  const downloads = readJson("downloads.json", []);
  const list = Array.isArray(downloads) ? downloads : [];
  const guid = typeof entry.guid === "string" ? entry.guid : `${Date.now()}`;
  const next = {
    guid,
    profile: typeof entry.profile === "string" ? entry.profile : "browser",
    url: typeof entry.url === "string" ? entry.url.slice(0, 2000) : "",
    filename: typeof entry.filename === "string" ? entry.filename.slice(0, 300) : "",
    path: typeof entry.path === "string" ? entry.path.slice(0, 500) : "",
    state: typeof entry.state === "string" ? entry.state : "inProgress",
    at: new Date().toISOString(),
  };
  const without = list.filter((item) => item?.guid !== guid);
  without.unshift(next);
  writeJson("downloads.json", without.slice(0, HISTORY_LIMIT));
}

/** @returns Newest downloads first. */
export function listDownloads() {
  const downloads = readJson("downloads.json", []);
  return Array.isArray(downloads) ? downloads : [];
}

function passwordId(origin, username) {
  return `${origin}\n${username}`;
}

/**
 * Saved logins. The settings page receives usernames only.
 * @returns Public rows.
 */
export function listPasswordSummaries() {
  return readPasswords().map(({ id, origin, username }) => ({ id, origin, username }));
}

/** @returns Full login rows, including secrets. Callers must not print the password. */
export function readPasswords() {
  const rows = readJson("passwords.json", []);
  return Array.isArray(rows) ? rows : [];
}

/**
 * Insert or replace one login.
 * @param entry - Origin, username, and password.
 * @returns Public rows.
 */
export function savePassword(entry) {
  const origin = pageOrigin(entry?.origin) ?? (typeof entry?.origin === "string" ? entry.origin.trim() : "");
  const username = typeof entry?.username === "string" ? entry.username.trim() : "";
  const password = typeof entry?.password === "string" ? entry.password : "";
  if (!origin || origin.length > 200 || !username || username.length > 200 || !password || password.length > 500) {
    throw new Error("invalid-password");
  }
  const rows = readPasswords().filter((row) => row.id !== passwordId(origin, username));
  rows.unshift({ id: passwordId(origin, username), origin, username, password });
  writeJson("passwords.json", rows.slice(0, 50));
  return listPasswordSummaries();
}

/** @param id - Row id from {@link listPasswordSummaries}. */
export function deletePassword(id) {
  writeJson("passwords.json", readPasswords().filter((row) => row.id !== id));
  return listPasswordSummaries();
}

/**
 * Login for an exact page origin.
 * @param url - Current page URL.
 * @returns The login, or null.
 */
export function passwordForUrl(url) {
  const origin = pageOrigin(url);
  if (origin === null) return null;
  return readPasswords().find((row) => pageOrigin(row.origin) === origin || row.origin === origin) ?? null;
}

const EMPTY_CONTACT = Object.freeze({ name: "", email: "", phone: "", address: "" });

/** @returns The saved contact card. */
export function readContact() {
  const value = readJson("contact.json", EMPTY_CONTACT);
  const source = value && typeof value === "object" ? value : {};
  const field = (key) => typeof source[key] === "string" ? source[key].slice(0, 200) : "";
  return { name: field("name"), email: field("email"), phone: field("phone"), address: field("address") };
}

/** @param value - Contact fields. */
export function writeContact(value) {
  const source = value && typeof value === "object" ? value : {};
  const field = (key) => typeof source[key] === "string" ? source[key].trim().slice(0, 200) : "";
  const contact = { name: field("name"), email: field("email"), phone: field("phone"), address: field("address") };
  writeJson("contact.json", contact);
  return contact;
}

/**
 * Extensions unpacked under an owned Chrome profile.
 * @param profileDir - User-data directory.
 * @returns Extension name, id, and version.
 */
export function extensionsInProfile(profileDir, exists = existsSync, list = readdirSync, read = readFileSync) {
  const found = [];
  for (const [dir, enabled] of [[EXTENSIONS_DIR, true], [DISABLED_DIR, false]]) {
    const root = join(profileDir, "Default", dir);
    if (!exists(root)) continue;
    for (const id of list(root)) {
      const idDir = join(root, id);
      let versions = [];
      try { versions = list(idDir); } catch { continue; }
      for (const version of versions) {
        const manifestPath = join(idDir, version, "manifest.json");
        if (!exists(manifestPath)) continue;
        try {
          const manifest = JSON.parse(read(manifestPath, "utf8"));
          const name = typeof manifest.name === "string" && !manifest.name.startsWith("__MSG_") ? manifest.name : id;
          found.push({ id, version, name: name.slice(0, 120), profile: profileDir, enabled });
        } catch { /* ignore unreadable manifests */ }
      }
    }
  }
  return found;
}

/**
 * @param profile - Owned profile name, such as `browser` or `browser-use`.
 * @returns The Chrome user-data directory for that profile.
 */
export function ownedProfileDir(profile) {
  return join(homedir(), ".dsh", "dsh-codex-tools", typeof profile === "string" && profile.length > 0 ? profile : "browser");
}

/** Extensions in both owned profiles. */
export function listInstalledExtensions() {
  return ["browser", "browser-use"].flatMap((name) => {
    const dir = join(ROOT(), name);
    return extensionsInProfile(dir).map((item) => ({ ...item, profile: name }));
  });
}

let lockCache = { at: 0, locked: false };

/**
 * Whether the interactive desktop is currently the lock screen.
 * A failure to probe is treated as unlocked so a probe error cannot block every action.
 * @returns True when a lock-screen process or session flag is visible.
 */
export function sessionLocked() {
  const now = Date.now();
  if (now - lockCache.at < 1500) return lockCache.locked;
  let locked = false;
  try {
    if (process.platform === "win32") {
      const output = execFileSync("tasklist", ["/FI", "IMAGENAME eq LogonUI.exe", "/NH"], { encoding: "utf8", windowsHide: true, timeout: 3000 });
      locked = /LogonUI\.exe/i.test(output);
    } else if (process.platform === "darwin") {
      const output = execFileSync("python3", ["-c", "import Quartz; d=Quartz.CGSessionCopyCurrentDictionary(); print('locked' if d and d.get('CGSSessionScreenIsLocked') else 'open')"], { encoding: "utf8", timeout: 3000 });
      locked = /locked/i.test(output);
    }
  } catch {
    locked = false;
  }
  lockCache = { at: now, locked };
  return locked;
}

/** @param dir - Download directory from settings, or empty for the system Downloads folder. */
export function resolveDownloadDirectory(dir) {
  const text = typeof dir === "string" ? dir.trim() : "";
  return text.length > 0 ? text : join(homedir(), "Downloads");
}

const EXTENSIONS_DIR = "Extensions";
const DISABLED_DIR = "Extensions-disabled";

/**
 * Move one extension out of the load path, or back into it.
 * Chrome loads whatever sits under Default/Extensions, so a moved directory is
 * genuinely disabled on the next launch.
 * @param profileDir - Owned Chrome user-data directory.
 * @param id - Extension id.
 * @param enabled - true to restore, false to quarantine.
 * @returns `{ enabled }` after the move.
 */
export function setExtensionEnabled(profileDir, id, enabled) {
  if (typeof id !== "string" || !/^[a-p]{16,64}$/u.test(id)) throw new Error("extension id is not valid");
  const live = join(profileDir, "Default", EXTENSIONS_DIR, id);
  const parked = join(profileDir, "Default", DISABLED_DIR, id);
  if (enabled) {
    if (!existsSync(parked)) return { enabled: existsSync(live) };
    mkdirSync(join(profileDir, "Default", EXTENSIONS_DIR), { recursive: true });
    renameSync(parked, live);
    return { enabled: true };
  }
  if (!existsSync(live)) return { enabled: false };
  mkdirSync(join(profileDir, "Default", DISABLED_DIR), { recursive: true });
  renameSync(live, parked);
  return { enabled: false };
}

/**
 * @param profileDir - Owned Chrome user-data directory.
 * @param id - Extension id.
 * @returns Whether the extension currently sits in the load path.
 */
export function isExtensionEnabled(profileDir, id) {
  return existsSync(join(profileDir, "Default", EXTENSIONS_DIR, id));
}
