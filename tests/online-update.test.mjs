import assert from "node:assert/strict";
import test from "node:test";

import { OnlineUpdateService, UPDATE_JOB_KIND, compareStableVersions, onlineError } from "../lib/online-update.mjs";
import { BUNDLE_NAME } from "../lib/update-service.mjs";

const SHA = "b".repeat(40);
const TARGET = "2.1.0";
const CURRENT = "2.0.0";

function managerStub({ installed = true, enabled = true, removable = true } = {}) {
  const state = {
    name: BUNDLE_NAME,
    version: CURRENT,
    source: `github:Syngnat/dsh-codex-tools#${"a".repeat(40)}`,
    installed,
    enabled,
    availability: "profile",
    removable,
  };
  const calls = [];
  const manager = {
    calls,
    state,
    async listBundles() {
      return [{ ...state }];
    },
    async listPlugins() {
      return [{ moduleName: BUNDLE_NAME, enabled: state.enabled, fiberPhase: "active" }];
    },
    async removeBundle() {
      calls.push(["removeBundle"]);
      state.installed = false;
      return { application: "applied" };
    },
    async installBundle(spec) {
      calls.push(["installBundle", spec]);
      // The target commit carries the target version, the restore commit the old one.
      const version = spec.includes("b".repeat(40)) ? TARGET : CURRENT;
      state.installed = true;
      state.version = version;
      state.source = spec;
      state.enabled = false;
      return { application: "applied", bundle: BUNDLE_NAME, version };
    },
    async setBundleEnabled(_name, value) {
      calls.push(["setBundleEnabled", value]);
      state.enabled = value;
      return { application: "applied" };
    },
    async cancelInstall() {
      calls.push(["cancelInstall"]);
      return { application: "applied" };
    },
  };
  return manager;
}

function jobsStub() {
  const records = new Map();
  let seq = 0;
  const jobs = {
    list: () => [...records.values()].map((job) => ({ id: job.id, kind: job.kind, status: job.status, owner: job.owner })),
    readAt(id) {
      const job = records.get(id);
      return { chunks: job ? job.chunks : [] };
    },
    attachController: () => () => {},
    start(spec) {
      const id = `job-${++seq}`;
      const job = { id, kind: spec.kind, status: "running", owner: undefined, chunks: [] };
      records.set(id, job);
      const handle = {
        id,
        updateProgress: () => {},
        append: (text) => job.chunks.push({ text }),
      };
      const control = spec.run(handle);
      control.done.then((result) => {
        job.status = result.status === "completed" ? "done" : result.status;
        job.result = result;
      });
      return id;
    },
  };
  return { jobs, records };
}

function updatesStub({ latest = TARGET, status = "update-available" } = {}) {
  return {
    currentVersion: CURRENT,
    status: () => ({ currentVersion: CURRENT, status, latestVersion: latest, releaseUrl: null, checkedAt: 1, error: null }),
    check: async () => ({ currentVersion: CURRENT, status, latestVersion: latest, releaseUrl: null, checkedAt: 1, error: null }),
    resolveSpec: async (version) => `github:Syngnat/dsh-codex-tools#${version === TARGET ? SHA : "a".repeat(40)}`,
  };
}

function service(overrides = {}) {
  const manager = overrides.manager ?? managerStub();
  const { jobs, records } = overrides.jobs ?? jobsStub();
  const online = new OnlineUpdateService({
    manager,
    jobs,
    currentVersion: CURRENT,
    updates: overrides.updates ?? updatesStub(),
    hasHmr: overrides.hasHmr ?? true,
    readLoadedVersion: overrides.readLoadedVersion ?? (async () => TARGET),
    activationAttempts: overrides.activationAttempts ?? 3,
    wait: async () => {},
    clock: () => Date.now(),
  });
  return { online, manager, jobs, records };
}

const waitFor = async (records) => {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const job = [...records.values()][0];
    if (job && job.status !== "running") return job;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error("the update job never finished");
};

test("a confirmed update replaces the bundle and reports the new version as live", async () => {
  const { online, manager, records } = service();
  const plan = await online.prepare();
  assert.equal(plan.targetVersion, TARGET);
  assert.match(plan.targetSpec, /#[a-f0-9]{40}$/u);

  const initial = await online.confirm({ token: plan.token, targetVersion: plan.targetVersion, consent: true });
  assert.equal(initial.jobId.startsWith("job-"), true);
  assert.equal(initial.phase, "queued");

  const job = await waitFor(records);
  const last = JSON.parse(job.chunks[job.chunks.length - 1].text);
  assert.equal(last.phase, "updated");
  assert.equal(last.installedVersion, TARGET);
  assert.equal(last.restartRequired, false);
  assert.deepEqual(
    manager.calls.map((call) => call[0]),
    ["removeBundle", "installBundle", "setBundleEnabled"],
  );
});

test("the update job survives the plugin it replaces", async () => {
  const { online, records } = service();
  const plan = await online.prepare();
  // The plugin is removed while the job is still running; the job keeps going.
  await online.confirm({ token: plan.token, targetVersion: plan.targetVersion, consent: true });
  const job = await waitFor(records);
  const last = JSON.parse(job.chunks[job.chunks.length - 1].text);
  assert.equal(last.phase, "updated");
  assert.equal(job.kind, UPDATE_JOB_KIND);
});

test("a version that never becomes active asks for a restart instead of claiming success", async () => {
  const { online, records } = service({ readLoadedVersion: async () => CURRENT });
  const plan = await online.prepare();
  await online.confirm({ token: plan.token, targetVersion: plan.targetVersion, consent: true });
  const job = await waitFor(records);
  const last = JSON.parse(job.chunks[job.chunks.length - 1].text);
  assert.equal(last.phase, "restart-required");
  assert.equal(last.restartRequired, true);
});

test("a failed install restores the previous version", async () => {
  const manager = managerStub();
  const original = manager.installBundle.bind(manager);
  manager.installBundle = async (spec, options) => {
    if (spec.includes("b".repeat(40))) {
      manager.calls.push(["installBundle", spec]);
      throw Object.assign(new Error("nope"), { code: "install-failed" });
    }
    return original(spec, options);
  };
  const { online, records } = service({ manager });
  const plan = await online.prepare();
  await online.confirm({ token: plan.token, targetVersion: plan.targetVersion, consent: true });
  const job = await waitFor(records);
  const last = JSON.parse(job.chunks[job.chunks.length - 1].text);
  assert.equal(last.phase, "restored");
  assert.equal(last.installedVersion, CURRENT);
});

test("a plan cannot be confirmed twice, and consent is required", async () => {
  const { online } = service();
  const plan = await online.prepare();
  await assert.rejects(() => online.confirm({ token: plan.token, targetVersion: plan.targetVersion, consent: false }), /confirmation-required/u);
  await online.confirm({ token: plan.token, targetVersion: plan.targetVersion, consent: true });
  await assert.rejects(() => online.confirm({ token: plan.token, targetVersion: plan.targetVersion, consent: true }), /confirmation-expired/u);
});

test("a plan for a different version is refused", async () => {
  const { online } = service();
  const plan = await online.prepare();
  await assert.rejects(
    () => online.confirm({ token: plan.token, targetVersion: "9.9.9", consent: true }),
    /confirmation-expired/u,
  );
});

test("the status explains why an update is not possible", async () => {
  const { online } = service({ manager: managerStub({ installed: false }) });
  const status = await online.status();
  assert.equal(status.available, false);
  assert.equal(status.reason, "unsupported-installation");
  const stale = managerStub();
  stale.state.version = "2.0.9";
  const linked = service({ manager: stale });
  const refused = await linked.online.status();
  assert.equal(refused.reason, "restart-required");
  assert.equal(refused.installedVersion, "2.0.9");
});

test("versions compare numerically, not as text", () => {
  assert.ok(compareStableVersions("2.0.10", "2.0.9") > 0);
  assert.ok(compareStableVersions("2.0.0", "2.0.0") === 0);
  assert.ok(compareStableVersions("1.9.0", "2.0.0") < 0);
});

test("an error carries its reason code", () => {
  assert.equal(onlineError("busy").code, "busy");
});
