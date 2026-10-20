/**
 * Settings for computer use and the two owned browser windows.
 * The page writes this file; the tools read it on every call.
 *
 * @module dsh-codex-tools/settings-store
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export const DEFAULT_SETTINGS = Object.freeze({
  computerEnabled: true,
  anyApp: true,
  allowedApps: [],
  browserEnabled: true,
  browserUseEnabled: true,
});

/** @returns Absolute path of the settings file. */
export function settingsPath() {
  return join(homedir(), ".dsh", "dsh-codex-tools", "settings.json");
}

/**
 * Keep only the fields the page is allowed to change.
 * @param value - Untrusted JSON.
 * @returns A complete settings object.
 */
export function normalizeSettings(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const allowedApps = [];
  if (Array.isArray(source.allowedApps)) {
    for (const item of source.allowedApps) {
      if (typeof item !== "string") continue;
      const name = item.trim();
      if (name.length === 0 || name.length > 200 || allowedApps.some((existing) => existing.toLowerCase() === name.toLowerCase())) continue;
      allowedApps.push(name);
      if (allowedApps.length >= 50) break;
    }
  }
  return {
    computerEnabled: source.computerEnabled !== false,
    anyApp: source.anyApp !== false,
    allowedApps,
    browserEnabled: source.browserEnabled !== false,
    browserUseEnabled: source.browserUseEnabled !== false,
  };
}

/** @returns The saved settings, or the defaults when the file is missing or unreadable. */
export function readSettings() {
  try {
    return normalizeSettings(JSON.parse(readFileSync(settingsPath(), "utf8")));
  } catch {
    return normalizeSettings(null);
  }
}

/**
 * @param value - Untrusted JSON.
 * @returns The settings that were written.
 */
export function writeSettings(value) {
  const next = normalizeSettings(value);
  const path = settingsPath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(next, null, 2)}\n`);
  return next;
}

/**
 * @param settings - Normalized settings.
 * @param app - App name for this action, if it has one.
 * @returns An error message, or null when the action may run.
 */
export function computerDenial(settings, app) {
  if (!settings.computerEnabled) return "电脑操作已在设置里关闭。";
  if (settings.anyApp || app === undefined || app === null || String(app).trim() === "") return null;
  const needle = String(app).toLowerCase();
  const allowed = settings.allowedApps.some((name) => {
    const item = name.toLowerCase();
    return needle === item || needle.includes(item) || item.includes(needle);
  });
  return allowed ? null : `「${app}」不在始终允许的应用里。到「电脑操作」里打开任意应用，或把这个应用加进去。`;
}

/**
 * @param settings - Normalized settings.
 * @param kind - `browser` or `browser-use`.
 * @returns An error message, or null when the browser may run.
 */
export function browserDenial(settings, kind) {
  if (kind === "browser-use" && !settings.browserUseEnabled) return "另一个浏览器窗口已在设置里关闭。";
  if (kind !== "browser-use" && !settings.browserEnabled) return "浏览器窗口已在设置里关闭。";
  return null;
}
