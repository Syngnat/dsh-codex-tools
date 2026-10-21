import assert from "node:assert/strict";
import test from "node:test";

import {
  browserDenial,
  computerDenial,
  normalizeSettings,
} from "../lib/settings-store.mjs";
import {
  extensionLaunchFlags,
  extensionsInProfile,
  openTargetFor,
  presentUrl,
  resolveDownloadDirectory,
  setExtensionEnabled,
} from "../lib/owned-data.mjs";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const base = normalizeSettings(null);

test("任意应用 controls which apps may be operated", () => {
  const open = normalizeSettings({ anyApp: true });
  assert.equal(computerDenial(open, "Notes", {}), null);
  const restricted = normalizeSettings({ anyApp: false, allowedApps: ["Safari"] });
  assert.equal(computerDenial(restricted, "Safari", {}), null);
  assert.match(computerDenial(restricted, "Notes", {}), /不在始终允许的应用里/u);
});

test("Excel and lock screen switches are enforced", () => {
  assert.match(computerDenial(normalizeSettings({ excelEnabled: false }), "Microsoft Excel", {}), /Excel/u);
  assert.equal(computerDenial(normalizeSettings({ excelEnabled: false }), "Safari", {}), null);
  assert.match(computerDenial(base, "Safari", { locked: true }), /锁屏/u);
  assert.equal(computerDenial(normalizeSettings({ lockScreen: true }), "Safari", { locked: true }), null);
});

test("full CDP and each browser window switch are enforced", () => {
  assert.match(browserDenial(normalizeSettings({ fullCdp: false }), "browser"), /CDP/u);
  assert.match(browserDenial(normalizeSettings({ browserEnabled: false }), "browser"), /Chrome/u);
  assert.equal(browserDenial(normalizeSettings({ browserEnabled: false }), "browser-use"), null);
  assert.match(browserDenial(normalizeSettings({ browserUseEnabled: false }), "browser-use"), /浏览器/u);
});

test("URL target settings pick this window or the system browser", () => {
  const app = normalizeSettings(null);
  assert.equal(openTargetFor("https://example.com", app), "app");
  const system = normalizeSettings({ webUrlTarget: "system" });
  assert.equal(openTargetFor("https://example.com", system), "system");
  assert.equal(openTargetFor("http://localhost:3000", system), "app");
  const localSystem = normalizeSettings({ localUrlTarget: "system" });
  assert.equal(openTargetFor("http://127.0.0.1:8080/x", localSystem), "system");
  assert.equal(openTargetFor("file:///tmp/a.html", localSystem), "system");
});

test("showFullUrl and the download directory take effect", () => {
  assert.equal(presentUrl("https://example.com/a?b=1#c", true), "https://example.com/a?b=1#c");
  assert.equal(presentUrl("https://example.com/a?b=1#c", false), "https://example.com");
  assert.match(resolveDownloadDirectory("/tmp/out"), /tmp\/out/u);
  assert.match(resolveDownloadDirectory(""), /Downloads$/u);
});

test("extension switches reach the Chrome launch flags", () => {
  assert.deepEqual(extensionLaunchFlags(normalizeSettings({ extensionsEnabled: false })), ["--disable-extensions"]);
  assert.deepEqual(extensionLaunchFlags(normalizeSettings({ extraExtensionPaths: ["/tmp/ext"] })), ["--load-extension=/tmp/ext"]);
  assert.deepEqual(extensionLaunchFlags(normalizeSettings(null)), []);
});

test("annotation screenshots and URL targets survive a save round-trip", () => {
  const saved = normalizeSettings({ annotationScreenshots: "drag", webUrlTarget: "system", localUrlTarget: "system" });
  assert.equal(saved.annotationScreenshots, "drag");
  assert.equal(saved.webUrlTarget, "system");
  assert.equal(saved.localUrlTarget, "system");
  assert.equal(normalizeSettings({ annotationScreenshots: "nope" }).annotationScreenshots, "always");
});

test("a stop button really moves the extension out of the load path", () => {
  const profile = mkdtempSync(join(tmpdir(), "dsh-ext-"));
  const id = "abcdefghijklmnopabcdefghijklmnop";
  const dir = join(profile, "Default", "Extensions", id, "1.0");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "manifest.json"), JSON.stringify({ name: "Probe", version: "1.0" }));

  const before = extensionsInProfile(profile);
  assert.equal(before.length, 1);
  assert.equal(before[0].enabled, true);

  assert.deepEqual(setExtensionEnabled(profile, id, false), { enabled: false });
  const stopped = extensionsInProfile(profile);
  assert.equal(stopped.length, 1);
  assert.equal(stopped[0].enabled, false);

  assert.deepEqual(setExtensionEnabled(profile, id, true), { enabled: true });
  assert.equal(extensionsInProfile(profile)[0].enabled, true);
  assert.throws(() => setExtensionEnabled(profile, "../escape", false), /not valid/u);
});

