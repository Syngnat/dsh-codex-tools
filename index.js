/**
 * Computer use, an owned Chrome window, cross-session messaging, and online
 * update. Computer use is `bin/dsh-ax` on macOS and `bin/dsh-uia.exe` on Windows. The browsers
 * are Chrome windows this plugin launches over the DevTools Protocol, each
 * with its own profile. Neither path starts an external desktop client.
 *
 * Cross-session messaging uses the Host's `sessionController` and
 * `workspaceRegistry`. Online update uses the Host's `pluginManager`.
 *
 * @module dsh-codex-tools
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { defineTool } from "./lib/define-tool.mjs";
import { AxClient, helperLocked, legacyWindowsHelperPath } from "./lib/ax-client.mjs";
import { CdpBrowser } from "./lib/cdp-browser.mjs";
import { createComputerTool } from "./lib/computer-tool.mjs";
import { createBrowserTool } from "./lib/browser-tool.mjs";
import { createSessionTool } from "./lib/session-tool.mjs";
import { createUpdateTool } from "./lib/update-tool.mjs";
import { UpdateService } from "./lib/update-service.mjs";
import { OnlineUpdateService } from "./lib/online-update.mjs";
import { installUpdatePageHost, UPDATE_PAGE_PATH } from "./lib/update-host.mjs";
import { installSettingsHost } from "./lib/settings-host.mjs";

/** Plugin name used by the loader. */
export const name = "codex-tools";

/**
 * Services this plugin needs before it can mount.
 * `connection` is required: the settings and update routes read
 * `ctx.connection.fetch`, and Cordis throws if that property was not injected.
 */
export const inject = ["tools", "connection"];

/** The version of the code that is actually loaded, read from the shipped manifest. */
function readOwnVersion() {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    const manifest = JSON.parse(readFileSync(join(here, "package.json"), "utf8"));
    return typeof manifest.version === "string" ? manifest.version : null;
  } catch {
    return null;
  }
}

/**
 * Install the tools.
 * @param ctx - Cordis context owning the registrations.
 * @param config - Optional plugin configuration.
 */
export function apply(ctx, config = {}) {
  const settings = config ?? {};
  const ax = new AxClient();
  const browser = new CdpBrowser({ profile: "browser" });

  const define = (options) => defineTool(options);
  const getService = (serviceName) => ctx.get(serviceName);

  // One service per mount, so the check cooldown and the last result survive
  // across tool calls. Built on first use because the plugin manager may mount
  // after this plugin does.
  let updateService = null;
  const createService = (manager) => {
    if (updateService === null) {
      const version = readOwnVersion();
      if (version === null) throw new Error("codex-tools: cannot read the plugin's own version from package.json");
      updateService = new UpdateService({
        currentVersion: version,
        manager,
        // Stop our own helper before the package is replaced. Windows keeps an
        // image lock on a running dsh-uia.exe; while it is held, removing the
        // old bundle and installing the new one both fail with EPERM, which is
        // how a plugin update could remove the plugin and then never come back.
        prepare: async () => {
          await ax.dispose();
          if (helperLocked(legacyWindowsHelperPath())) {
            throw Object.assign(new Error("helper-in-use"), { code: "helper-in-use" });
          }
        },
      });
    }
    return updateService;
  };

  // The probe reads the version the update route serves right now. After a
  // live swap the new instance answers with the new version, which is how the
  // job knows the new code is really running and not merely on disk.
  const readLoadedVersion =
    typeof ctx.connection?.createSharedFetchHandler === "function" && ctx.connection.browserPeer
      ? async () => {
          const response = await ctx.connection
            .createSharedFetchHandler("/api")
            .fetch(new Request(`http://connection.invalid${UPDATE_PAGE_PATH}`), ctx.connection.browserPeer);
          if (!response.ok) return null;
          try {
            return (await response.json()).currentVersion ?? null;
          } catch {
            return null;
          }
        }
      : undefined;

  // One online update service per mount, shared by the tool and the page.
  // It is built on first use: the plugin manager and the job service may mount
  // after this plugin does, and a service that is not there yet must not stop
  // the route from answering.
  let online = null;
  const getOnline = () => {
    if (online === null) {
      const version = readOwnVersion();
      if (version === null) throw new Error("codex-tools: cannot read the plugin's own version from package.json");
      online = new OnlineUpdateService({
        manager: getService("pluginManager"),
        jobs: getService("jobs"),
        currentVersion: version,
        updates: createService(getService("pluginManager")),
        hasHmr: Boolean(getService("hmr")),
        readLoadedVersion,
      });
    }
    return online;
  };

  const definitions = [];
  if (settings.computerUse !== false) {
    definitions.push(createComputerTool({ ax, defineTool: define }));
  }
  if (settings.browser !== false) {
    definitions.push(createBrowserTool({ driver: browser, defineTool: define }));
  }
  if (settings.sessionMessaging !== false) {
    definitions.push(createSessionTool({
      defineTool: define,
      getService,
      onSessionEvent: (handler) => ctx.on("session/event", handler),
    }));
  }
  if (settings.update !== false) {
    definitions.push(createUpdateTool({ defineTool: define, getOnline }));
  }

  for (const definition of definitions) {
    ctx.tools.register(definition);
  }

  installUpdatePageHost(ctx, { getOnline });
  installSettingsHost(ctx);

  const dispose = () => {
    online?.dispose();
    updateService?.dispose();
    void ax.dispose().catch(() => {});
    void browser.dispose().catch(() => {});
  };
  if (typeof ctx.on === "function") ctx.on("dispose", dispose);
  else if (typeof ctx.effect === "function") ctx.effect(() => dispose);
}
