window.__ModuleLoader__.load({id:"@local/dsh-codex-tools",factory(require){var module={exports:{}};var exports=module.exports;
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// client-entry.js
var client_entry_exports = {};
__export(client_entry_exports, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(client_entry_exports);
var import_react = __toESM(require("react"), 1);

// lib/update-host.mjs
var UPDATE_PAGE_PATH = "/api/dsh-codex-tools.update";

// client-entry.js
var h = import_react.default.createElement;
var zh = (typeof navigator !== "undefined" ? navigator.language : "en").toLowerCase().startsWith("zh");
var text = zh ? {
  title: "\u7535\u8111\u64CD\u4F5C",
  heading: "\u5728\u7EBF\u66F4\u65B0",
  check: "\u68C0\u67E5\u66F4\u65B0",
  checking: "\u6B63\u5728\u68C0\u67E5\u2026",
  install: "\u5B89\u88C5\u66F4\u65B0",
  installing: "\u6B63\u5728\u5B89\u88C5\u2026",
  consent: "\u6211\u786E\u8BA4\u7528 GitHub \u4E0A\u7684\u7A33\u5B9A\u7248\u66FF\u6362\u5F53\u524D\u5B89\u88C5",
  current: "\u5F53\u524D\u7248\u672C",
  latest: "\u6700\u65B0\u7248\u672C",
  source: "\u5B89\u88C5\u6765\u6E90",
  unavailable: "\u8FD9\u91CC\u4E0D\u80FD\u5728\u7EBF\u66F4\u65B0",
  link: "\u672C\u5730 link: \u76EE\u5F55\u4E0D\u4F1A\u88AB\u5728\u7EBF\u66F4\u65B0\u66FF\u6362\u3002\u8981\u4F7F\u7528\u8FD9\u4E2A\u6309\u94AE\uFF0C\u8BF7\u6539\u6210\u4ECE GitHub \u5B89\u88C5\uFF1Adsh plugin install github:Syngnat/dsh-codex-tools",
  currentAlready: "\u5DF2\u7ECF\u662F\u6700\u65B0\u7A33\u5B9A\u7248\u3002",
  available: "\u6709\u65B0\u7248\u672C\u53EF\u4EE5\u5B89\u88C5\u3002",
  restart: "\u5B89\u88C5\u5B8C\u6210\u3002\u8BF7\u5B8C\u5168\u9000\u51FA\u5E76\u91CD\u65B0\u6253\u5F00 DeepSeek Harness\u3002",
  updated: "\u5DF2\u66F4\u65B0\uFF0C\u5F53\u524D\u8FDB\u7A0B\u91CC\u5DF2\u7ECF\u662F\u65B0\u7248\u672C\u3002",
  back: "\u8FD4\u56DE\u5BF9\u8BDD"
} : {
  title: "\u7535\u8111\u64CD\u4F5C",
  heading: "Online update",
  check: "Check for updates",
  checking: "Checking\u2026",
  install: "Install update",
  installing: "Installing\u2026",
  consent: "I confirm replacing this install with the stable GitHub release",
  current: "Running",
  latest: "Latest",
  source: "Source",
  unavailable: "Online update is not available here",
  link: "A local link: checkout is not replaced online. Install from GitHub first: dsh plugin install github:Syngnat/dsh-codex-tools",
  currentAlready: "This is already the latest stable release.",
  available: "A newer stable release can be installed.",
  restart: "Installed. Fully quit and reopen DeepSeek Harness.",
  updated: "Updated. This process is already running the new version.",
  back: "Back to chat"
};
function Icon() {
  return h(
    "svg",
    { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, "aria-hidden": true },
    h("path", { d: "M12 3v12m0 0 4-4m-4 4-4-4M5 21h14" })
  );
}
async function call(connection, body) {
  const handler = connection.createSharedFetchHandler("/api");
  const response = await handler.fetch(new Request(`http://connection.invalid${UPDATE_PAGE_PATH}`, {
    method: body ? "POST" : "GET",
    headers: body ? { "content-type": "application/json" } : void 0,
    body: body ? JSON.stringify(body) : void 0
  }), connection.browserPeer);
  const value = await response.json();
  if (!response.ok) throw new Error(value?.error || `http-${response.status}`);
  return value;
}
function Page({ connection, returnToConversation }) {
  const [data, setData] = import_react.default.useState(null);
  const [consent, setConsent] = import_react.default.useState(false);
  const [pending, setPending] = import_react.default.useState(null);
  const [message, setMessage] = import_react.default.useState("");
  const [error, setError] = import_react.default.useState("");
  import_react.default.useEffect(() => {
    let live = true;
    call(connection).then((value) => {
      if (live) setData(value);
    }).catch((reason) => {
      if (live) setError(String(reason.message || reason));
    });
    return () => {
      live = false;
    };
  }, [connection]);
  async function check() {
    setPending("check");
    setError("");
    setMessage("");
    try {
      setData(await call(connection, { action: "check" }));
    } catch (reason) {
      setError(String(reason.message || reason));
    } finally {
      setPending(null);
    }
  }
  async function install() {
    setPending("install");
    setError("");
    setMessage("");
    try {
      const result = await call(connection, { action: "install", confirm: true });
      setMessage(result.outcome === "restart-required" ? text.restart : text.updated);
      setData(await call(connection));
    } catch (reason) {
      setError(String(reason.message || reason));
    } finally {
      setPending(null);
    }
  }
  const canInstall = data?.status === "update-available" && data?.available === true;
  return h(
    "section",
    { style: { padding: 24, maxWidth: 640, display: "grid", gap: 12 } },
    h("h1", { style: { margin: 0 } }, text.heading),
    data ? h("p", null, `${text.current}: ${data.currentVersion || "\u2014"}`, data.latestVersion ? ` \xB7 ${text.latest}: ${data.latestVersion}` : "", data.source ? ` \xB7 ${text.source}: ${data.source}` : "") : h("p", null, "\u2026"),
    data?.status === "update-available" ? h("p", null, text.available) : null,
    data?.status === "current" ? h("p", null, text.currentAlready) : null,
    data && data.available === false ? h("p", null, `${text.unavailable}${data.reason ? ` (${data.reason})` : ""}`) : null,
    data?.reason === "unsupported-source" ? h("p", null, text.link) : null,
    message ? h("p", null, message) : null,
    error ? h("p", null, error) : null,
    canInstall ? h("label", null, h("input", { type: "checkbox", checked: consent, onChange: (event) => setConsent(event.target.checked) }), " ", text.consent) : null,
    h(
      "div",
      { style: { display: "flex", gap: 8 } },
      h("button", { type: "button", onClick: check, disabled: pending !== null }, pending === "check" ? text.checking : text.check),
      canInstall ? h("button", { type: "button", onClick: install, disabled: !consent || pending !== null }, pending === "install" ? text.installing : text.install) : null,
      h("button", { type: "button", onClick: returnToConversation }, text.back)
    )
  );
}
var inject = ["connection", "slots", "layout"];
function apply(ctx) {
  const label = () => text.title;
  ctx.slots.inject("sidebar.panellist", () => ctx.slots.register({
    name: "sidebar.panellist",
    id: "dsh-codex-tools",
    order: 46,
    label
  }, Icon));
  ctx.slots.inject("main", () => ctx.slots.register({
    name: "main",
    key: "dsh-codex-tools",
    inject: () => ({ connection: ctx.connection, returnToConversation: () => ctx.layout.selectPanel(null) })
  }, Page));
}
return module.exports;}});
