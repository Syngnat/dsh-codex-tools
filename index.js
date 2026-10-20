/**
 * Codex tools for the Harness: computer use, browser control, cross-session
 * messaging, and online update of the plugin itself.
 *
 * The first two capabilities ride on the Codex Computer Use runtime that ships
 * inside ChatGPT.app: `@oai/cua-repl` launches the bundled `node_repl` kernel
 * with the `cua` API bound to the trusted Sky (native app) and browser-desktop
 * providers, and speaks MCP over stdio. This plugin owns one such child process
 * and translates tool calls into JavaScript for its persistent REPL, which is
 * exactly how Codex itself drives the machine.
 *
 * The third capability is native to the Harness: it uses the Host's own
 * `sessionController` and `workspaceRegistry` services, so sessions created here
 * are ordinary sessions that appear in the sidebar.
 *
 * The fourth replaces this bundle with a pinned commit of its own repository,
 * through the Host's `pluginManager`.
 *
 * @module dsh-codex-tools
 */

import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { CuaReplClient } from "./lib/cua-repl-client.mjs";
import { defineTool } from "./lib/define-tool.mjs";
import { createComputerTool } from "./lib/computer-tool.mjs";
import { createBrowserTool } from "./lib/browser-tool.mjs";
import { createSessionTool } from "./lib/session-tool.mjs";
import { createUpdateTool } from "./lib/update-tool.mjs";
import { UpdateService } from "./lib/update-service.mjs";

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
  const codexSessionId = settings.codexSessionId ?? randomUUID();
  const client = new CuaReplClient({
    surfaces: settings.surfaces ?? "computer,browser",
    callTimeoutMs: settings.callTimeoutMs,
    logger: ctx.logger,
    requestMeta: () => ({ session_id: codexSessionId, turn_id: randomUUID() }),
  });

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
    definitions.push(createComputerTool({ client, defineTool: define }));
  }
  if (settings.browser !== false) {
    definitions.push(createBrowserTool({ client, defineTool: define }));
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

  const dispose = () => {
    updateService?.dispose();
    void client.dispose().catch(() => {});
  };
  if (typeof ctx.on === "function") ctx.on("dispose", dispose);
  else if (typeof ctx.effect === "function") ctx.effect(() => dispose);
}
