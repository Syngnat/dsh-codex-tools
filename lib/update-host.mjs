/**
 * Online update route for the 电脑操作 page.
 *
 * The page is for the person using the Harness. The install runs inside a
 * Host job, so replacing this plugin does not abort the work that replaces
 * it, and the job reads the running version back through this same route
 * before it claims the update succeeded.
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
 * The action a request body asks for.
 *
 * `confirm` carries a one-time token, the target version, and an explicit
 * consent, so a stale page cannot start an install by itself.
 * @param value - Parsed request body.
 * @returns The action name, or null when the body is not one of them.
 */
export function updatePageAction(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  if (value.action === "check" && Object.keys(value).length === 1) return "check";
  if (value.action === "prepare" && Object.keys(value).length === 1) return "prepare";
  if (
    value.action === "confirm" &&
    Object.keys(value).length === 4 &&
    typeof value.token === "string" &&
    /^[a-f0-9]{64}$/.test(value.token) &&
    typeof value.targetVersion === "string" &&
    value.consent === true
  ) {
    return "confirm";
  }
  return null;
}

/**
 * Register the page route on the Host connection.
 * @param ctx - Plugin context.
 * @param options - Wiring.
 * @param options.getService - Host service lookup.
 * @param options.createService - Factory for the release metadata service.
 */
export function installUpdatePageHost(ctx, { getOnline }) {
  if (typeof ctx.connection?.fetch?.register !== "function" || typeof ctx.effect !== "function") return;
  ctx.effect(() => {
    const unregister = ctx.connection.fetch.register({
      path: UPDATE_PAGE_PATH,
      methods: ["GET", "POST"],
      requestBody: "buffered",
      async fetch(request) {
        try {
          request.signal?.throwIfAborted?.();
          if (request.method === "GET") {
            const status = await online.status();
            return json({ ...status, release: online.updates.status() });
          }
          if (request.method !== "POST") return new Response(null, { status: 405, headers: { Allow: "GET, POST" } });
          const body = await request.json();
          const action = updatePageAction(body);
          if (action === "check") {
            const checked = await online.updates.check();
            const status = await online.status();
            return json({ ...status, release: checked });
          }
          if (action === "prepare") return json(await online.prepare(request.signal));
          if (action === "confirm") return json(await online.confirm(body));
          return json({ error: "invalid-request" }, 400);
        } catch (error) {
          const code =
            typeof error?.code === "string" && /^[a-z][a-z0-9-]{0,79}$/.test(error.code) ? error.code : "host-error";
          return json({ error: code }, 409);
        }
      },
    });
    return async () => {
      await unregister?.();
    };
  });
}
