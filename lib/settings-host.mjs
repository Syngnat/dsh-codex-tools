/**
 * Settings route for the 电脑操作 page.
 *
 * @module dsh-codex-tools/settings-host
 */

import { clearBrowsingData, normalizeSettings, readSettings, writeSettings } from "./settings-store.mjs";

export const SETTINGS_PATH = "/api/dsh-codex-tools.settings";

const headers = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};

function json(value, status = 200) {
  return new Response(JSON.stringify(value), { status, headers });
}

/**
 * Register the settings route.
 * @param ctx - Plugin context.
 */
export function installSettingsHost(ctx) {
  if (typeof ctx.connection?.fetch?.register !== "function" || typeof ctx.effect !== "function") return;
  ctx.effect(() => {
    const unregister = ctx.connection.fetch.register({
      path: SETTINGS_PATH,
      methods: ["GET", "POST"],
      requestBody: "buffered",
      async fetch(request) {
        try {
          request.signal?.throwIfAborted?.();
          if (request.method === "GET") return json(readSettings());
          if (request.method !== "POST") return new Response(null, { status: 405, headers: { Allow: "GET, POST" } });
          const body = await request.json();
          if (body?.action === "clear-browsing-data") {
            clearBrowsingData();
            return json({ ...readSettings(), cleared: true });
          }
          return json(writeSettings(normalizeSettings(body)));
        } catch {
          return json({ error: "invalid-request" }, 400);
        }
      },
    });
    return async () => {
      await unregister?.();
    };
  });
}
