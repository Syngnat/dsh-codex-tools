/**
 * `codex_tools_update` — check for and install a newer release of this plugin.
 *
 * The actions match the steps of the flow: `status` reports what is running
 * and whether an install is possible, `check` reads public release metadata
 * without installing anything, `install` replaces the bundle after an
 * explicit `confirm: true`, and `operation` reads the state of the update
 * job. The install itself runs in a Host job, so it survives the swap.
 *
 * @module dsh-codex-tools/update-tool
 */

import { BUNDLE_NAME, INSTALL_SPEC, REPOSITORY } from "./update-service.mjs";

/** Actions the tool exposes. */
export const UPDATE_ACTIONS = ["status", "check", "install", "operation"];

/** Parameter schema for the tool definition. */
export const UPDATE_PARAMETERS = {
  action: {
    type: "string",
    required: true,
    enum: UPDATE_ACTIONS,
    description:
      "`status` reports the running version, the last check and whether this installation can be replaced online. `check` asks GitHub for the latest stable release without installing anything. `install` replaces the bundle with a pinned, verified commit and requires `confirm: true`. `operation` reads the state of an update job that is already running.",
  },
  confirm: {
    type: "boolean",
    description:
      "For `install` only. Must be exactly true. Ask the user before setting it: the plugin is replaced in place.",
  },
};

/** Render a status object as short, readable lines. */
function describeStatus(status) {
  const release = status.release ?? {};
  const lines = [`running version: ${status.currentVersion}`];
  if (release.checkedAt !== undefined) {
    lines.push(`last check: ${release.checkedAt === null ? "never" : new Date(release.checkedAt).toISOString()} (${release.status})`);
    if (release.latestVersion) lines.push(`latest release: ${release.latestVersion}`);
    if (release.error) lines.push(`check error: ${release.error}`);
  }
  if (status.installedVersion) lines.push(`installed bundle version: ${status.installedVersion}`);
  if (status.source) lines.push(`installation source: ${status.source}`);
  lines.push(`online update available: ${status.available === true ? "yes" : `no (${status.reason})`}`);
  lines.push(`repository: https://github.com/${REPOSITORY}`);
  lines.push(`install spec: ${INSTALL_SPEC}`);
  return lines.join("\n");
}

/** Render the state of the update job. */
function describeOperation(operation) {
  if (!operation) return "no update job has run yet";
  const lines = [`job ${operation.jobId}: ${operation.phase}`];
  if (operation.installedVersion) lines.push(`installed version: ${operation.installedVersion}`);
  if (operation.restartRequired) lines.push("the Harness must be restarted before the new version runs");
  if (operation.error) lines.push(`error: ${operation.error}${operation.detailCode ? ` (${operation.detailCode})` : ""}`);
  return lines.join("\n");
}

/** Explain the reasons an install can be refused, in the user's terms. */
const REASON_HELP = {
  "manager-unavailable": "this deployment mounts no plugin manager, so the bundle cannot be replaced from here",
  "jobs-unavailable": "this deployment mounts no job service, so the replacement cannot outlive the swap",
  "readiness-unavailable": "this deployment cannot read back the running version, so a live update cannot be confirmed",
  "not-installed": "the bundle is not recorded as an installed profile dependency",
  "unsupported-installation": "the bundle is not a removable profile installation",
  "installation-error": "the recorded installation reports an error; fix that first",
  "unsupported-version": "the running or installed version is not a strict stable version",
  "restart-required": "the installed version differs from the running one; restart the Harness first",
  "unsupported-source": "the bundle was not installed from this repository (a local link or a fork), so online update is refused",
  "not-removable": "this installation cannot be removed in place, so a restart is needed",
  "check-required": "run `check` first, so the target version is known",
  "not-newer": "the installed version is already at or above the latest release",
  "inventory-changed": "the installation changed while the update was prepared; check again",
  "confirmation-expired": "the prepared update expired; prepare it again",
  "confirmation-required": "the user has not confirmed this update",
  busy: "another update is already running",
  cancelled: "the update was cancelled",
  "activation-timeout": "the new version did not become active in time",
  "enable-failed": "the new version could not be enabled",
  "remove-failed": "the old version could not be removed",
  "install-failed": "the new version could not be installed",
  "version-mismatch": "the installed version does not match the target",
  "recovery-failed": "the previous version could not be restored",
  "helper-in-use": "the computer-use helper still holds files this update must replace; restart the Harness once, then update again",
  "prepare-failed": "the plugin could not release its own helper before replacing the bundle",
  "repair-required": "the update and the automatic restore both failed; reinstall the plugin by hand",
};

/**
 * Build the `codex_tools_update` tool definition.
 * @param options - Wiring supplied by the plugin.
 * @param options.defineTool - The harness `defineTool` helper.
 * @param options.getOnline - Returns the shared online update service.
 * @returns A registry-ready tool definition.
 */
export function createUpdateTool({ defineTool, getOnline }) {
  return defineTool({
    name: "codex_tools_update",
    description:
      "Check for and install a newer release of the Codex tools plugin itself. `status` reports what is running and whether an online update is possible; `check` reads the latest stable release from GitHub without installing anything; `install` replaces the bundle with a pinned, verified commit after explicit user confirmation and the swap happens in a Host job; `operation` reads the state of that job. The install never runs package scripts and never accepts a source other than this plugin's own repository.",
    parameters: UPDATE_PARAMETERS,
    output: { schema: { type: "string" }, render: (_args, value) => [{ type: "text", text: value }] },
    isConcurrencySafe: () => false,
    timeoutMs: 600_000,
    async execute(args, exec) {
      exec.signal?.throwIfAborted?.();
      const online = getOnline();
      try {
        switch (args.action) {
          case "status": {
            const status = await online.status();
            return describeStatus({ ...status, release: online.updates.status() });
          }
          case "operation": {
            return describeOperation((await online.status()).operation);
          }
          case "check": {
            const release = await online.updates.check({ force: true });
            const status = await online.status();
            const lines = [describeStatus({ ...status, release })];
            if (release.status === "update-available") {
              lines.push("");
              lines.push(`Run this tool again with action "install" and confirm: true to install ${release.latestVersion}.`);
            } else if (release.status === "current") {
              lines.push("");
              lines.push("This is already the latest stable release.");
            }
            if (!status.available) {
              lines.push("");
              lines.push(`Online update is not possible here: ${REASON_HELP[status.reason] ?? status.reason}.`);
            }
            return lines.join("\n");
          }
          case "install": {
            if (args.confirm !== true) {
              return [
                "Refusing to install without explicit confirmation.",
                "",
                describeStatus(await online.status()),
                "",
                "Ask the user first, then call this tool again with confirm: true.",
              ].join("\n");
            }
            await online.updates.check();
            const plan = await online.prepare(exec.signal);
            const job = await online.confirm({
              token: plan.token,
              targetVersion: plan.targetVersion,
              consent: true,
            });
            return [
              `Started update job ${job.jobId}: ${BUNDLE_NAME} ${plan.fromVersion} → ${plan.targetVersion}.`,
              `Pinned to ${plan.targetSpec}.`,
              "The plugin replaces itself in place; the job outlives the swap.",
              "Call this tool with action \"operation\" to read the result.",
            ].join("\n");
          }
          default:
            throw new Error(`unsupported codex_tools_update action "${String(args.action)}"`);
        }
      } catch (error) {
        const code = typeof error?.code === "string" ? error.code : null;
        if (code === null) throw error;
        const help = REASON_HELP[code];
        const detail = help === undefined ? "" : ` — ${help}`;
        return `Cannot complete "${args.action}": ${code}${detail}`;
      }
    },
  });
}
