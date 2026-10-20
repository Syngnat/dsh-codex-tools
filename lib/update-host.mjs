/**
 * Settings-page route for online update. The page is for the person using the
 * Harness; the model tool remains available, but this is the same kind of
 * check-and-confirm entry the prompt-assist plugin shows.
 *
 * @module dsh-codex-tools/update-host
 */

export const UPDATE_PAGE_PATH = "/api/dsh-codex-tools.update";

const headers = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};

function json(value, status = 200) {
  return new Response(JSON.stringify(value), { status, headers });
}

/**
 * Accept only the two page actions. Install still requires confirm: true.
 * @param value - Parsed request body.
 * @returns The action name.
 */
export function updatePageAction(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  if (value.action === "check" && Object.keys(value).length === 1) return "check";
  if (value.action === "install" && Object.keys(value).length === 2 && value.confirm === true) return "install";
  return null;
}

/**
 * Register the page route on the Host connection.
 * @param ctx - Plugin context.
 * @param options - Shared update service factory.
 */
export function installUpdatePageHost(ctx, { getService, createService }) {
  if (typeof ctx.connection?.fetch?.register !== "function" || typeof ctx.effect !== "function") return;
  ctx.effect(() => {
    const unregister = ctx.connection.fetch.register({
      path: UPDATE_PAGE_PATH,
      methods: ["GET", "POST"],
      requestBody: "buffered",
      async fetch(request) {
        try {
          request.signal?.throwIfAborted?.();
          const manager = getService("pluginManager");
          const service = createService(manager);
          if (request.method === "GET") return json(await service.statusWithEligibility());
          if (request.method !== "POST") return new Response(null, { status: 405, headers: { Allow: "GET, POST" } });
          const action = updatePageAction(await request.json());
          if (action === "check") {
            const checked = await service.check();
            const eligibility = await service.statusWithEligibility();
            return json({ ...eligibility, ...checked, available: eligibility.available });
          }
          if (action === "install") {
            return json(await service.install({ confirm: true, signal: request.signal }));
          }
          return json({ error: "invalid-request" }, 400);
        } catch (error) {
          const code = typeof error?.code === "string" ? error.code : "host-error";
          return json({ error: code }, error?.code ? 409 : 500);
        }
      },
    });
    return async () => {
      await unregister?.();
    };
  });
}
