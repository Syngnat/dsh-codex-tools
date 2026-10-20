/**
 * `codex_tools_update` — check for and install a newer release of this plugin.
 *
 * Three separate actions, matching the three separate steps of the flow:
 * `status` reports what is running and whether an install is possible, `check`
 * reads public release metadata without installing anything, and `install`
 * replaces the bundle and requires an explicit `confirm: true`.
 *
 * @module dsh-codex-tools/update-tool
 */

import { BUNDLE_NAME, INSTALL_SPEC, REPOSITORY } from "./update-service.mjs";

/** Actions the tool exposes. */
export const UPDATE_ACTIONS = ["status", "check", "install"];

/** Parameter schema for the tool definition. */
export const UPDATE_PARAMETERS = {
  action: {
    type: "string",
    required: true,
    enum: UPDATE_ACTIONS,
    description:
      "`status` reports the running version, the last check and whether this installation can be replaced online. `check` asks GitHub for the latest stable release without installing anything. `install` replaces the bundle with the latest release and requires `confirm: true`.",
  },
  confirm: {
    type: "boolean",
    description:
      "For `install` only. Must be exactly true. Ask the user before setting it: the plugin is replaced in place and the Harness may need a restart.",
  },
  version: {
    type: "string",
    description: "For `install`, an exact stable version to install. Omit to install the latest release found by `check`.",
  },
};

/** Render a status object as short, readable lines. */
function describeStatus(status) {
  const lines = [
    `running version: ${status.currentVersion}`,
    `last check: ${status.checkedAt === null ? "never" : new Date(status.checkedAt).toISOString()} (${status.status})`,
  ];
  if (status.latestVersion !== null) lines.push(`latest release: ${status.latestVersion}${status.releaseUrl === null ? "" : ` (${status.releaseUrl})`}`);
  if (status.error !== null) lines.push(`check error: ${status.error}`);
  if (status.installedVersion !== null) lines.push(`installed bundle version: ${status.installedVersion}`);
  if (status.source !== null && status.source !== undefined) lines.push(`installation source: ${status.source}`);
  lines.push(`online update available: ${status.available === true ? "yes" : `no (${status.reason})`}`);
  lines.push(`repository: https://github.com/${REPOSITORY}`);
  lines.push(`install spec: ${INSTALL_SPEC}`);
  return lines.join("\n");
}

/** Explain the reasons an install can be refused, in the user's terms. */
const REASON_HELP = {
  "manager-unavailable": "this deployment mounts no plugin manager, so the bundle cannot be replaced from here",
  "not-installed": "the bundle is not recorded as an installed profile dependency",
  "unsupported-installation": "the bundle is not a removable profile installation",
  "installation-error": "the recorded installation reports an error; fix that first",
  "unsupported-version": "the running or installed version is not a strict stable version",
  "restart-required": "the installed version differs from the running one; restart the Harness first",
  "unsupported-source": "the bundle was not installed from this repository (a local link or a fork), so online update is refused",
  disabled: "the bundle is disabled in this profile",
};

/**
 * Build the `codex_tools_update` tool definition.
 * @param options - Wiring supplied by the plugin.
 * @param options.defineTool - The harness `defineTool` helper.
 * @param options.getService - `ctx.get` bound to the plugin context.
 * @param options.createService - Builds an `UpdateService` for the current manager.
 * @returns A registry-ready tool definition.
 */
export function createUpdateTool({ defineTool, getService, createService }) {
  return defineTool({
    name: "codex_tools_update",
    description:
      "Check for and install a newer release of the Codex tools plugin itself. `status` reports what is running and whether an online update is possible; `check` reads the latest stable release from GitHub without installing anything; `install` replaces the bundle with a pinned, verified commit and requires explicit user confirmation. The install never runs package scripts and never accepts a source other than this plugin's own repository.",
    parameters: UPDATE_PARAMETERS,
    output: { schema: { type: "string" }, render: (_args, value) => [{ type: "text", text: value }] },
    isConcurrencySafe: () => false,
    timeoutMs: 600_000,
    async execute(args, exec) {
      exec.signal?.throwIfAborted?.();
      const manager = getService("pluginManager");
      const service = createService(manager);
      try {
        switch (args.action) {
          case "status": {
            const status = await service.statusWithEligibility();
            return describeStatus(status);
          }
          case "check": {
            const status = await service.check();
            const eligibility = await service.statusWithEligibility();
            const lines = [describeStatus({ ...status, ...eligibility, status: status.status })];
            if (status.status === "update-available") {
              lines.push("");
              lines.push(`Run this tool again with action "install" and confirm: true to install ${status.latestVersion}.`);
            } else if (status.status === "current") {
              lines.push("");
              lines.push("This is already the latest stable release.");
            }
            if (!eligibility.available) {
              lines.push("");
              lines.push(`Online update is not possible here: ${REASON_HELP[eligibility.reason] ?? eligibility.reason}.`);
            }
            return lines.join("\n");
          }
          case "install": {
            if (args.confirm !== true) {
              const status = await service.statusWithEligibility();
              return [
                "Refusing to install without explicit confirmation.",
                "",
                describeStatus(status),
                "",
                "Ask the user first, then call this tool again with confirm: true.",
              ].join("\n");
            }
            const result = await service.install({ confirm: true, version: args.version, signal: exec.signal });
            if (result.outcome === "updated") {
              return [
                `Updated ${BUNDLE_NAME} from ${result.previousVersion} to ${result.installedVersion}.`,
                `Pinned to ${result.spec}.`,
                "The plugin is live now; no restart was required.",
              ].join("\n");
            }
            if (result.outcome === "restored") {
              return [
                `The update failed (${result.error}) and the previous version ${result.restoredVersion} was restored.`,
                "Nothing is broken, but the update did not take effect. Try again, or update manually:",
                `  dsh plugin install ${INSTALL_SPEC}`,
              ].join("\n");
            }
            return [
              `Installed ${result.installedVersion} from ${result.previousVersion}, but the Harness must be restarted before it runs.`,
              `Pinned to ${result.spec}.`,
              "Fully quit and reopen the Harness, then call this tool with action \"status\" to confirm the running version.",
            ].join("\n");
          }
          default:
            throw new Error(`unsupported codex_tools_update action "${String(args.action)}"`);
        }
      } catch (error) {
        const code = typeof error?.code === "string" ? error.code : null;
        if (code === null) throw error;
        const help = REASON_HELP[code];
        if (error.outcome === "repair-required") {
          return [
            `The update failed (${error.error}) and the automatic restore also failed (${error.detailCode ?? "unknown"}).`,
            "This installation may now be inconsistent. Reinstall it manually:",
            `  dsh plugin install ${INSTALL_SPEC}`,
          ].join("\n");
        }
        const detail = help === undefined ? "" : ` — ${help}`;
        return `Cannot complete "${args.action}": ${code}${detail}`;
      }
    },
  });
}
