/**
 * Online update that replaces this plugin while the Harness keeps running.
 *
 * The install runs inside a Host job, so removing this plugin does not kill
 * the work that replaces it. After the swap the job reads the running version
 * back through the plugin's own route, so "updated" means the new code is
 * actually live, not merely on disk.
 *
 * @module dsh-codex-tools/online-update
 */

import { randomBytes } from "node:crypto";

import { BUNDLE_NAME, INSTALL_SPEC, supportedSource } from "./update-service.mjs";

export const UPDATE_JOB_KIND = "dsh-codex-tools-update";
export const OPERATION_FIELDS = [
  "jobId",
  "fromVersion",
  "targetVersion",
  "targetSpec",
  "phase",
  "terminal",
  "installedVersion",
  "error",
  "detailCode",
  "restartRequired",
  "cancelRequested",
];
export const ONLINE_PHASES = [
  "queued",
  "checking",
  "removing",
  "installing",
  "activating",
  "verifying",
  "recovering",
  "updated",
  "restart-required",
  "restored",
  "repair-required",
  "failed",
  "cancelled",
  "unknown",
];

const LIVE = new Set(["running", "stopping"]);
const TERMINAL = new Set(["updated", "restart-required", "restored", "repair-required", "failed", "cancelled", "unknown"]);
const PLAN_TTL_MS = 180_000;
const MAX_PLANS = 8;

/** @param code - Reason code. @returns An error carrying that code. */
export function onlineError(code) {
  return Object.assign(new Error(code), { code });
}

const ok = (result) => result && !result.error && ["applied", "restart-required"].includes(result.application);
const fingerprint = (row) =>
  JSON.stringify([row?.name, row?.version, row?.source, row?.installed, row?.enabled, row?.availability, row?.error?.code]);
const safeCode = (value) => (typeof value === "string" && /^[a-z][a-z0-9-]{0,79}$/.test(value) ? value : null);
const diagnostic = (result) => safeCode(result?.error?.code) || safeCode(result?.packageResult?.kind) || safeCode(result?.application);

/**
 * Compare two stable versions.
 * @param left - First version.
 * @param right - Second version.
 * @returns Negative, zero, or positive.
 */
export function compareStableVersions(left, right) {
  const parse = (value) => String(value).split(".").map((part) => Number.parseInt(part, 10) || 0);
  const a = parse(left);
  const b = parse(right);
  for (let index = 0; index < 3; index += 1) {
    const diff = (a[index] ?? 0) - (b[index] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/**
 * Unowned profile jobs are Host-owned and outlive this producer's fiber.
 */
export class OnlineUpdateService {
  /**
   * @param options - Wiring.
   * @param options.manager - Host `pluginManager` service.
   * @param options.jobs - Host `jobs` service.
   * @param options.currentVersion - Version this instance was loaded from.
   * @param options.updates - Release metadata service.
   * @param options.hasHmr - Whether the Host can reload a plugin in place.
   * @param options.readLoadedVersion - Reads the version the route serves now.
   */
  constructor({
    manager,
    jobs,
    currentVersion,
    updates,
    hasHmr = true,
    clock = Date.now,
    token = () => randomBytes(32).toString("hex"),
    schedule = (fn) => setImmediate(fn),
    wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    activationAttempts = 40,
    readLoadedVersion,
  } = {}) {
    Object.assign(this, {
      manager,
      jobs,
      currentVersion,
      updates,
      hasHmr,
      clock,
      token,
      schedule,
      wait,
      activationAttempts,
      readLoadedVersion,
    });
    this.plans = new Map();
    this.disposed = false;
    this.abort = new AbortController();
  }

  /** @returns The bundle row for this plugin. */
  async bundle() {
    return (await this.manager.listBundles()).find((row) => row.name === BUNDLE_NAME);
  }

  /** @returns Every job this plugin started. */
  records() {
    return this.jobs?.list().filter((job) => job.kind === UPDATE_JOB_KIND && !job.owner) ?? [];
  }

  /** @returns The job that is still running, if any. */
  active() {
    return this.records().find((job) => LIVE.has(job.status));
  }

  /**
   * Read the last published state of one job.
   * @param job - Job row.
   * @returns The operation snapshot.
   */
  snapshot(job) {
    if (!job) return null;
    const chunks = this.jobs.readAt(job.id, 0).chunks;
    for (let index = chunks.length - 1; index >= 0; index -= 1) {
      try {
        const value = JSON.parse(chunks[index].text);
        if (value?.jobId !== job.id || value.protocol !== 1) continue;
        const valid =
          value.fromVersion &&
          value.targetVersion &&
          ONLINE_PHASES.includes(value.phase) &&
          ["terminal", "restartRequired", "cancelRequested"].every((key) => typeof value[key] === "boolean");
        if (!valid) break;
        const snapshot = Object.fromEntries(OPERATION_FIELDS.map((key) => [key, value[key]]));
        return {
          ...snapshot,
          terminal: !LIVE.has(job.status) || snapshot.terminal,
          phase: !LIVE.has(job.status) && !snapshot.terminal ? "unknown" : snapshot.phase,
        };
      } catch {
        /* an unreadable chunk is skipped */
      }
    }
    return {
      jobId: job.id,
      fromVersion: this.currentVersion,
      targetVersion: this.currentVersion,
      targetSpec: null,
      phase: "unknown",
      terminal: !LIVE.has(job.status),
      installedVersion: null,
      error: "state-unavailable",
      detailCode: null,
      restartRequired: false,
      cancelRequested: false,
    };
  }

  /**
   * Decide whether this installation may be replaced online.
   * @returns `{ reason, row }`; `reason` is null when an install may proceed.
   */
  async eligibility() {
    if (!this.manager) return { reason: "manager-unavailable" };
    if (!this.jobs) return { reason: "jobs-unavailable" };
    if (typeof this.readLoadedVersion !== "function") return { reason: "readiness-unavailable" };
    const row = await this.bundle();
    if (!row?.installed || row.availability !== "profile" || row.readOnlyReason || row.error) {
      return { reason: "unsupported-installation", row };
    }
    if (row.version !== this.currentVersion) return { reason: "restart-required", row };
    if (!supportedSource(row.source, row.version)) return { reason: "unsupported-source", row };
    if (!row.enabled) return { reason: "disabled", row };
    if (this.hasHmr && !row.removable) return { reason: "not-removable", row };
    return { reason: null, row };
  }

  /**
   * Report what the page needs to show.
   * @returns The status payload.
   */
  async status() {
    const { reason, row } = await this.eligibility();
    const records = this.records();
    const record = records.find((job) => LIVE.has(job.status)) ?? records.at(-1);
    const busy = records.some((job) => LIVE.has(job.status));
    return {
      currentVersion: this.currentVersion,
      available: reason === null && !busy,
      reason: busy ? "busy" : reason,
      source: typeof row?.source === "string" ? row.source : null,
      installedVersion: typeof row?.version === "string" ? row.version : null,
      operation: this.snapshot(record),
    };
  }

  /**
   * Fix the target and the restore point to immutable commits.
   * @param signal - Caller lifetime.
   * @returns The plan the user then confirms.
   */
  async prepare(signal) {
    if (this.disposed) throw onlineError("unavailable");
    const lifetime = signal ? AbortSignal.any([signal, this.abort.signal]) : this.abort.signal;
    if (this.active()) throw onlineError("busy");
    const { reason, row } = await this.eligibility();
    if (reason) throw onlineError(reason);
    const checked = this.updates.status();
    if (checked.status !== "update-available" || !checked.latestVersion) throw onlineError("check-required");
    if (compareStableVersions(checked.latestVersion, row.version) <= 0) throw onlineError("not-newer");
    const targetVersion = checked.latestVersion;
    const targetSpec = await this.updates.resolveSpec(targetVersion, lifetime);
    const restoreSpec = await this.updates.resolveSpec(row.version, lifetime, row.source);
    lifetime.throwIfAborted();
    if (this.disposed) throw onlineError("unavailable");
    if (this.active() || fingerprint(await this.bundle()) !== fingerprint(row)) throw onlineError("inventory-changed");
    for (const [key, plan] of this.plans) if (plan.expiresAt <= this.clock()) this.plans.delete(key);
    if (this.plans.size >= MAX_PLANS) this.plans.delete(this.plans.keys().next().value);
    const token = this.token();
    const plan = {
      token,
      fromVersion: row.version,
      targetVersion,
      targetSpec,
      restoreSpec,
      expiresAt: this.clock() + PLAN_TTL_MS,
      row: { ...row },
    };
    this.plans.set(token, plan);
    return {
      token: plan.token,
      fromVersion: plan.fromVersion,
      targetVersion: plan.targetVersion,
      targetSpec: plan.targetSpec,
      restoreSpec: plan.restoreSpec,
      expiresAt: plan.expiresAt,
    };
  }

  /**
   * Accept a confirmed plan and start the Host job that applies it.
   * @param request - The confirmed request.
   * @returns The initial job state.
   */
  async confirm({ token, targetVersion, consent }) {
    if (this.disposed || consent !== true) throw onlineError("confirmation-required");
    const plan = this.plans.get(token);
    if (!plan || plan.expiresAt <= this.clock() || targetVersion !== plan.targetVersion) {
      throw onlineError("confirmation-expired");
    }
    this.plans.delete(token);
    if (this.active()) throw onlineError("busy");
    if (fingerprint(await this.bundle()) !== fingerprint(plan.row)) throw onlineError("inventory-changed");
    if (this.disposed) throw onlineError("unavailable");
    let initial;
    const detach = this.jobs.attachController("dsh-codex-tools-online-update");
    try {
      this.jobs.start({
        kind: UPDATE_JOB_KIND,
        label: `Update ${BUNDLE_NAME} ${plan.fromVersion} → ${plan.targetVersion}`,
        outputLimitBytes: 16384,
        run: (handle) => {
          let cancelled = false;
          const control = { requestId: null, recovery: false };
          const state = {
            jobId: handle.id,
            fromVersion: plan.fromVersion,
            targetVersion: plan.targetVersion,
            targetSpec: plan.targetSpec,
            phase: "queued",
            terminal: false,
            installedVersion: null,
            error: null,
            detailCode: null,
            restartRequired: false,
            cancelRequested: false,
          };
          const publish = (phase, patch = {}) => {
            Object.assign(state, patch, { phase, terminal: TERMINAL.has(phase), cancelRequested: cancelled });
            handle.updateProgress(phase);
            handle.append(`${JSON.stringify({ protocol: 1, ...state })}\n`, { channel: "log" });
          };
          publish("queued");
          initial = { ...state };
          const done = new Promise((resolve) => {
            this.schedule(() => {
              void this.run(plan, control, publish, () => cancelled)
                .catch(() => publish("repair-required", { error: "host-error" }))
                .then(() =>
                  resolve({
                    status:
                      state.phase === "cancelled"
                        ? "killed"
                        : ["failed", "repair-required", "unknown", "restored"].includes(state.phase)
                          ? "failed"
                          : "completed",
                    detail: state.phase,
                    result: JSON.stringify(state),
                  }),
                );
            });
          });
          return {
            done,
            cancel: () => {
              cancelled = true;
              if (control.requestId && !control.recovery) {
                void this.manager.cancelInstall(control.requestId).catch(() => {});
              }
            },
          };
        },
      });
    } finally {
      detach();
    }
    return initial;
  }

  /**
   * Wait until the plugin is live again on the target version.
   * @param version - Version that must be running.
   * @returns True when it is running.
   */
  async activeHost(version) {
    let loaded = null;
    for (let attempt = 0; attempt < this.activationAttempts; attempt += 1) {
      const rows = (await this.manager.listPlugins()).filter((row) => row.moduleName === BUNDLE_NAME);
      if (rows.length === 1 && rows[0].enabled && rows[0].fiberPhase === "active") {
        loaded = await this.readLoadedVersion();
        if (loaded === version) return true;
      }
      if (rows.some((row) => !row.enabled || row.fiberPhase === "failed")) throw onlineError("enable-failed");
      await this.wait(250);
    }
    if (loaded && loaded !== version) return false;
    throw onlineError("activation-timeout");
  }

  /**
   * The job body. It owns the swap and the recovery.
   * @param plan - The confirmed plan.
   * @param control - Cancellation and request tracking.
   * @param publish - Phase publisher.
   * @param cancelled - Whether the user asked to stop.
   */
  async run(plan, control, publish, cancelled) {
    let mutated = false;
    let primaryError = null;
    const fail = (code, result) => {
      const error = onlineError(code);
      error.result = result;
      throw error;
    };
    const inspect = async (version, spec) => {
      const row = await this.bundle();
      if (
        !row?.installed ||
        row.availability !== "profile" ||
        row.error ||
        row.version !== version ||
        row.source !== spec
      ) {
        fail("version-mismatch");
      }
      return row;
    };
    const install = async (spec, version, recovery = false) => {
      control.recovery = recovery;
      control.requestId = this.token();
      let result;
      try {
        result = await this.manager.installBundle(spec, { enabled: false, requestId: control.requestId });
      } finally {
        control.requestId = null;
      }
      if (!ok(result) || result.bundle !== BUNDLE_NAME || result.version !== version) fail("install-failed", result);
      let restart = result.application === "restart-required";
      await inspect(version, spec);
      if (!recovery && cancelled()) fail("cancelled");
      if (!recovery) publish("activating");
      const enabled = await this.manager.setBundleEnabled(BUNDLE_NAME, plan.row.enabled);
      if (!ok(enabled)) fail("enable-failed", enabled);
      restart = restart || enabled.application === "restart-required";
      const row = await inspect(version, spec);
      if (row.enabled !== plan.row.enabled) fail("enable-failed", enabled);
      return restart;
    };
    try {
      publish("checking");
      if (cancelled()) {
        publish("cancelled");
        return;
      }
      if (fingerprint(await this.bundle()) !== fingerprint(plan.row)) fail("inventory-changed");
      if (cancelled()) fail("cancelled");
      mutated = true;
      if (this.hasHmr) {
        publish("removing");
        const removed = await this.manager.removeBundle(BUNDLE_NAME);
        if (!ok(removed)) fail("remove-failed", removed);
        const remaining = await this.bundle();
        if (remaining?.installed) fail("remove-failed", removed);
      }
      if (cancelled()) fail("cancelled");
      publish("installing");
      let restart = await install(plan.targetSpec, plan.targetVersion);
      publish("verifying");
      await inspect(plan.targetVersion, plan.targetSpec);
      if (!restart) restart = !(await this.activeHost(plan.targetVersion));
      publish(restart ? "restart-required" : "updated", {
        installedVersion: plan.targetVersion,
        restartRequired: restart,
      });
    } catch (error) {
      primaryError = safeCode(error?.code) || "host-error";
      const detailCode = diagnostic(error?.result);
      if (!mutated) {
        publish(primaryError === "cancelled" ? "cancelled" : "failed", { error: primaryError, detailCode });
        return;
      }
      publish("recovering", { error: primaryError, detailCode });
      control.recovery = true;
      try {
        let row = await this.bundle();
        if (
          row?.installed &&
          !([plan.fromVersion, plan.targetVersion].includes(row.version) &&
            [plan.row.source, plan.targetSpec, plan.restoreSpec].includes(row.source))
        ) {
          fail("inventory-changed");
        }
        let restart = false;
        if (
          row?.installed &&
          row.version === plan.fromVersion &&
          !row.error &&
          row.availability === "profile" &&
          row.source === plan.row.source
        ) {
          const enabled = await this.manager.setBundleEnabled(BUNDLE_NAME, plan.row.enabled);
          if (!ok(enabled)) fail("recovery-failed", enabled);
          restart = enabled.application === "restart-required";
        } else {
          if (row?.installed && this.hasHmr) {
            const removed = await this.manager.removeBundle(BUNDLE_NAME);
            if (!ok(removed)) fail("recovery-failed", removed);
          }
          restart = await install(plan.restoreSpec, plan.fromVersion, true);
        }
        row = await this.bundle();
        if (
          !row?.installed ||
          row.version !== plan.fromVersion ||
          row.enabled !== plan.row.enabled ||
          row.error ||
          row.availability !== "profile"
        ) {
          fail("recovery-failed");
        }
        if (!restart) restart = !(await this.activeHost(plan.fromVersion));
        publish("restored", { installedVersion: plan.fromVersion, restartRequired: restart });
      } catch (recovery) {
        publish("repair-required", {
          error: primaryError,
          detailCode: diagnostic(recovery?.result) || safeCode(recovery?.code) || "recovery-failed",
        });
      }
    }
  }

  /** The Host owns accepted jobs; this plugin only stops accepting new ones. */
  dispose() {
    this.disposed = true;
    this.abort.abort();
    this.plans.clear();
  }
}

export { BUNDLE_NAME, INSTALL_SPEC };
