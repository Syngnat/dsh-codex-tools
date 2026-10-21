import assert from "node:assert/strict";
import test from "node:test";

import { installUpdatePageHost, UPDATE_PAGE_PATH } from "../lib/update-host.mjs";
import { OnlineUpdateService } from "../lib/online-update.mjs";
import { UpdateService, BUNDLE_NAME } from "../lib/update-service.mjs";

function managerStub() {
  return {
    async listBundles() {
      return [{
        name: BUNDLE_NAME,
        version: "1.0.0",
        source: `github:Syngnat/dsh-codex-tools#${"a".repeat(40)}`,
        installed: true,
        enabled: true,
        availability: "profile",
        removable: true,
      }];
    },
    async listPlugins() {
      return [{ moduleName: BUNDLE_NAME, enabled: true, fiberPhase: "active" }];
    },
  };
}

/** A host context that records the registered route. */
function hostContext({ online }) {
  const routes = new Map();
  const ctx = {
    connection: {
      fetch: {
        register(route) {
          routes.set(route.path, route);
          return async () => {};
        },
      },
    },
    effect: (fn) => fn(),
  };
  return { ctx, routes };
}

test("the update route answers with the running and installed versions", async () => {
  const manager = managerStub();
  const updates = new UpdateService({ currentVersion: "1.0.0", manager });
  const online = new OnlineUpdateService({
    manager,
    jobs: { list: () => [], readAt: () => ({ chunks: [] }), attachController: () => () => {}, start: () => "job-1" },
    currentVersion: "1.0.0",
    updates,
    hasHmr: true,
    readLoadedVersion: async () => "1.0.0",
  });
  const { ctx, routes } = hostContext({ online });
  installUpdatePageHost(ctx, { getOnline: () => online });

  const route = routes.get(UPDATE_PAGE_PATH);
  assert.ok(route, "the update route is registered");
  const response = await route.fetch(new Request(`http://connection.invalid${UPDATE_PAGE_PATH}`));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.currentVersion, "1.0.0");
  assert.equal(body.installedVersion, "1.0.0");
  assert.equal(body.available, true);
});

test("the update route is registered even when the Host services are not up yet", async () => {
  const { ctx, routes } = hostContext({ online: null });
  installUpdatePageHost(ctx, {
    getOnline: () => {
      throw new Error("the plugin manager has not mounted yet");
    },
  });
  assert.ok(routes.has(UPDATE_PAGE_PATH));
  const route = routes.get(UPDATE_PAGE_PATH);
  const response = await route.fetch(new Request(`http://connection.invalid${UPDATE_PAGE_PATH}`));
  // The route answers with a reason instead of failing the whole page.
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.available, false);
  assert.equal(body.reason, "service-unavailable");
});
