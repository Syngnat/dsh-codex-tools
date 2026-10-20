import React from "react";
import { UPDATE_PAGE_PATH } from "./lib/update-host.mjs";

const h = React.createElement;
const zh = (typeof navigator !== "undefined" ? navigator.language : "en").toLowerCase().startsWith("zh");
const text = zh
  ? {
      title: "本机工具",
      heading: "在线更新",
      check: "检查更新",
      checking: "正在检查…",
      install: "安装更新",
      installing: "正在安装…",
      consent: "我确认用 GitHub 上的稳定版替换当前安装",
      current: "当前版本",
      latest: "最新版本",
      source: "安装来源",
      unavailable: "这里不能在线更新",
      link: "本地 link: 目录不会被在线更新替换。要使用这个按钮，请改成从 GitHub 安装：dsh plugin install github:Syngnat/dsh-codex-tools",
      currentAlready: "已经是最新稳定版。",
      available: "有新版本可以安装。",
      restart: "安装完成。请完全退出并重新打开 DeepSeek Harness。",
      updated: "已更新，当前进程里已经是新版本。",
      back: "返回对话",
    }
  : {
      title: "本机工具",
      heading: "Online update",
      check: "Check for updates",
      checking: "Checking…",
      install: "Install update",
      installing: "Installing…",
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
      back: "Back to chat",
    };

function Icon() {
  return h("svg", { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, "aria-hidden": true },
    h("path", { d: "M12 3v12m0 0 4-4m-4 4-4-4M5 21h14" }));
}

async function call(connection, body) {
  const handler = connection.createSharedFetchHandler("/api");
  const response = await handler.fetch(new Request(`http://connection.invalid${UPDATE_PAGE_PATH}`, {
    method: body ? "POST" : "GET",
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  }), connection.browserPeer);
  const value = await response.json();
  if (!response.ok) throw new Error(value?.error || `http-${response.status}`);
  return value;
}

function Page({ connection, returnToConversation }) {
  const [data, setData] = React.useState(null);
  const [consent, setConsent] = React.useState(false);
  const [pending, setPending] = React.useState(null);
  const [message, setMessage] = React.useState("");
  const [error, setError] = React.useState("");
  React.useEffect(() => {
    let live = true;
    call(connection).then((value) => { if (live) setData(value); }).catch((reason) => { if (live) setError(String(reason.message || reason)); });
    return () => { live = false; };
  }, [connection]);
  async function check() {
    setPending("check"); setError(""); setMessage("");
    try { setData(await call(connection, { action: "check" })); }
    catch (reason) { setError(String(reason.message || reason)); }
    finally { setPending(null); }
  }
  async function install() {
    setPending("install"); setError(""); setMessage("");
    try {
      const result = await call(connection, { action: "install", confirm: true });
      setMessage(result.outcome === "restart-required" ? text.restart : text.updated);
      setData(await call(connection));
    } catch (reason) { setError(String(reason.message || reason)); }
    finally { setPending(null); }
  }
  const canInstall = data?.status === "update-available" && data?.available === true;
  return h("section", { style: { padding: 24, maxWidth: 640, display: "grid", gap: 12 } },
    h("h1", { style: { margin: 0 } }, text.heading),
    data ? h("p", null, `${text.current}: ${data.currentVersion || "—"}`, data.latestVersion ? ` · ${text.latest}: ${data.latestVersion}` : "", data.source ? ` · ${text.source}: ${data.source}` : "") : h("p", null, "…"),
    data?.status === "update-available" ? h("p", null, text.available) : null,
    data?.status === "current" ? h("p", null, text.currentAlready) : null,
    data && data.available === false ? h("p", null, `${text.unavailable}${data.reason ? ` (${data.reason})` : ""}`) : null,
    data?.reason === "unsupported-source" ? h("p", null, text.link) : null,
    message ? h("p", null, message) : null,
    error ? h("p", null, error) : null,
    canInstall ? h("label", null, h("input", { type: "checkbox", checked: consent, onChange: (event) => setConsent(event.target.checked) }), " ", text.consent) : null,
    h("div", { style: { display: "flex", gap: 8 } },
      h("button", { type: "button", onClick: check, disabled: pending !== null }, pending === "check" ? text.checking : text.check),
      canInstall ? h("button", { type: "button", onClick: install, disabled: !consent || pending !== null }, pending === "install" ? text.installing : text.install) : null,
      h("button", { type: "button", onClick: returnToConversation }, text.back)));
}

export const inject = ["connection", "slots", "layout"];

export function apply(ctx) {
  const label = () => text.title;
  ctx.slots.inject("sidebar.panellist", () => ctx.slots.register({
    name: "sidebar.panellist", id: "dsh-codex-tools", order: 46, label,
  }, Icon));
  ctx.slots.inject("main", () => ctx.slots.register({
    name: "main",
    key: "dsh-codex-tools",
    inject: () => ({ connection: ctx.connection, returnToConversation: () => ctx.layout.selectPanel(null) }),
  }, Page));
}
