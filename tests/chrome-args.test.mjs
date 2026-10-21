import assert from "node:assert/strict";
import test from "node:test";

import { chromeLaunchArgs } from "../lib/cdp-browser.mjs";
import { normalizeSettings } from "../lib/settings-store.mjs";

test("the owned Chrome never touches the login keychain on macOS", () => {
  const args = chromeLaunchArgs({ dir: "/tmp/profile", settings: normalizeSettings(null), platform: "darwin" });
  assert.ok(args.includes("--use-mock-keychain"));
  assert.ok(args.includes("--password-store=basic"));
  assert.ok(args.includes("--user-data-dir=/tmp/profile"));
  assert.ok(args.includes("--disable-session-crashed-bubble"));
  assert.equal(args[args.length - 1], "about:blank");
});

test("the keychain flags stay off on other platforms", () => {
  for (const platform of ["linux", "win32"]) {
    const args = chromeLaunchArgs({ dir: "/tmp/profile", settings: normalizeSettings(null), platform });
    assert.equal(args.includes("--use-mock-keychain"), false);
    assert.equal(args.includes("--password-store=basic"), false);
  }
});

test("extension flags still reach the command line", () => {
  const args = chromeLaunchArgs({
    dir: "/tmp/profile",
    settings: normalizeSettings({ extensionsEnabled: false }),
    platform: "darwin",
  });
  assert.ok(args.includes("--disable-extensions"));
});
