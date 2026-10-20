/**
 * Computer use, an owned Chrome window, cross-session messaging, and online
 * update. Computer use is `bin/dsh-ax` on macOS and `bin/dsh-uia.exe` on Windows. The browsers
 * are Chrome windows this plugin launches over the DevTools Protocol, each
 * with its own profile. Neither path starts Codex or ChatGPT.
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
import { AxClient } from "./lib/ax-client.mjs";
import { CdpBrowser } from "./lib/cdp-browser.mjs";
import { createComputerTool } from "./lib/computer-tool.mjs";
import { createBrowserTool, createBrowserUseTool } from "./lib/browser-tool.mjs";
import { createSessionTool } from "./lib/session-tool.mjs";
import { createUpdateTool } from "./lib/update-tool.mjs";
import { UpdateService } from "./lib/update-service.mjs";
import { installUpdatePageHost } from "./lib/update-host.mjs";
import { installSettingsHost } from "./lib/settings-host.mjs";

/** Plugin name used by the loader. */
export const name = "codex-tools";

/** Services this plugin needs before it can mount. */
export const inject = ["tools"];

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
  const browserUse = new CdpBrowser({ profile: "browser-use" });

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
      updateService = new UpdateService({ currentVersion: version, manager });
    }
    return updateService;
  };

  const definitions = [];
  if (settings.computerUse !== false) {
    definitions.push(createComputerTool({ ax, defineTool: define }));
  }
  if (settings.browser !== false) {
    definitions.push(createBrowserTool({ driver: browser, defineTool: define }));
  }
  if (settings.browserUse !== false) {
    definitions.push(createBrowserUseTool({ driver: browserUse, defineTool: define }));
  }
  if (settings.sessionMessaging !== false) {
    definitions.push(createSessionTool({ defineTool: define, getService }));
  }
  if (settings.update !== false) {
    definitions.push(createUpdateTool({ defineTool: define, getService, createService }));
  }

  for (const definition of definitions) {
    ctx.tools.register(definition);
  }

  installUpdatePageHost(ctx, { getService, createService });
  installSettingsHost(ctx);

  const dispose = () => {
    updateService?.dispose();
    void ax.dispose().catch(() => {});
    void browser.dispose().catch(() => {});
    void browserUse.dispose().catch(() => {});
  };
  if (typeof ctx.on === "function") ctx.on("dispose", dispose);
  else if (typeof ctx.effect === "function") ctx.effect(() => dispose);
}
