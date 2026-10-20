import React from "react";

const h = React.createElement;
const PATH = "/api/dsh-codex-tools.settings";

const COPY = {
  zh: {
    tabs: ["电脑操控", "浏览器"],
    computerTitle: "电脑操控",
    computerSubtitle: "管理如何操作你电脑上的其他应用程序。",
    control: "控制",
    anyApp: "任意应用",
    anyAppDesc: "允许操作你电脑上的应用。",
    chrome: "Google Chrome",
    chromeDesc: "使用独立的 Chrome 窗口，不占用你正在使用的 Chrome。",
    excel: "Microsoft Excel",
    excelDesc: "没有 Excel 加载项，不能靠这一项获得更多控制。",
    locked: "锁屏操作",
    lockedDesc: "当前不能在 Mac 锁定后继续操作。",
    unavailable: "不可用",
    allowed: "始终允许的应用",
    allowedEmpty: "还没有始终允许的应用。关闭任意应用后，只有这里列出的应用可以被操作。",
    add: "添加",
    placeholder: "应用名称或标识，例如 Safari、com.apple.Safari",
    remove: "移除",
    browserTitle: "浏览器",
    browserSubtitle: "管理浏览器窗口的偏好和访问范围。",
    browserCard: "浏览器",
    browserCardDesc: "允许操作这个浏览器窗口。",
    general: "常规",
    webTarget: "网页 URL 和链接打开位置",
    webTargetDesc: "从页面点开的链接默认去哪里。",
    localTarget: "本地 URL 打开位置",
    localTargetDesc: "本机地址默认去哪里。",
    targetApp: "这个窗口",
    targetSystem: "系统浏览器",
    fullUrl: "显示完整网址",
    fullUrlDesc: "在地址里保留路径、查询参数和片段。",
    browsingData: "浏览数据",
    browsingDataDesc: "清除这两个窗口里的浏览历史、网站数据和缓存。",
    clear: "清除浏览数据",
    cleared: "已清除",
    history: "浏览历史",
    historyDesc: "历史留在对应的 Chrome 配置里，这里没有单独的历史页。",
    annotation: "批注截图",
    annotationDesc: "截图可以帮助理解页面，但会增加上下文用量。",
    annotationAlways: "始终包含",
    annotationDrag: "仅在拖选时",
    autofill: "自动填充和密码",
    passwords: "密码管理器",
    passwordsDesc: "密码不由这个插件保存。",
    contacts: "联系信息",
    contactsDesc: "联系信息不由这个插件保存。",
    extensions: "扩展程序",
    extensionManager: "扩展程序管理器",
    extensionDesc: "不使用浏览器扩展。Chrome 窗口由这里直接控制。",
    downloads: "下载",
    downloadLocation: "位置",
    downloadLocationDesc: "文件保存到系统下载目录。",
    change: "更改",
    askSave: "下载前询问保存位置",
    askSaveDesc: "对这里发起的下载显示保存对话框。当前仍使用系统下载目录。",
    downloadHistory: "下载历史记录",
    downloadHistoryDesc: "下载记录留在 Chrome 配置里。",
    permissions: "浏览器权限",
    siteSettings: "网站设置",
    siteSettingsDesc: "摄像头和麦克风沿用 Chrome 自己的网站设置。",
    historyAccess: "历史记录",
    historyAccessDesc: "是否允许读取浏览器历史。",
    always: "始终允许",
    ask: "每次询问",
    deny: "拒绝",
    siteTools: "默认使用网站工具",
    siteToolsDesc: "允许发现并调用网页声明的工具，除非网站自己关掉。",
    siteRules: "网站权限",
    siteRulesDesc: "默认权限。单独例外还没有按网站生效。",
    developer: "开发者模式",
    risk: "风险升高",
    fullCdp: "启用完整 CDP 访问权限",
    fullCdpDesc: "关闭后，浏览器操作会停止。完整访问可以检查并控制浏览器内部功能。",
    back: "返回对话",
    saving: "正在保存…",
    saved: "已保存",
    loadError: "设置没有读出来。",
    saveError: "设置没有保存。",
    clearError: "浏览数据没有清除。",
  },
};

function textFor(language) {
  return COPY.zh;
}

async function request(body) {
  const response = await fetch(PATH, {
    method: body ? "POST" : "GET",
    credentials: "same-origin",
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) throw new Error("request");
  return response.json();
}

function Icon() {
  return h("svg", { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, "aria-hidden": true },
    h("rect", { x: 3, y: 4, width: 18, height: 12, rx: 2 }),
    h("path", { d: "M8 20h8M12 16v4" }));
}

const pageStyle = { padding: "28px 32px 48px", maxWidth: 760, color: "var(--dsw-alias-fg-primary, #f5f5f5)" };
const titleStyle = { margin: "0 0 6px", fontSize: 28, fontWeight: 650 };
const subtitleStyle = { margin: "0 0 22px", color: "var(--dsw-alias-fg-secondary, #a3a3a3)", fontSize: 14 };
const labelStyle = { margin: "18px 0 8px", fontSize: 13, color: "var(--dsw-alias-fg-secondary, #a3a3a3)" };
const cardStyle = { borderRadius: 14, background: "var(--dsw-alias-bg-layer-1, #242424)", border: "1px solid var(--dsw-alias-border-subtle, #333)", overflow: "hidden" };
const rowStyle = { display: "flex", gap: 14, alignItems: "center", padding: "14px 16px" };
const nameStyle = { fontSize: 15, fontWeight: 600 };
const descStyle = { marginTop: 3, fontSize: 13, lineHeight: 1.4, color: "var(--dsw-alias-fg-secondary, #a3a3a3)" };
const hairline = { height: 1, background: "var(--dsw-alias-border-subtle, #333)" };
const controlStyle = { height: 30, padding: "0 12px", borderRadius: 8, border: 0, background: "var(--dsw-alias-interactive-bg-hover, #333)", color: "inherit", cursor: "pointer" };

function Switch({ checked, label, disabled, onChange }) {
  return h("button", {
    type: "button", role: "switch", "aria-checked": checked ? "true" : "false", "aria-label": label, disabled,
    onClick: () => onChange(!checked),
    style: { width: 42, height: 24, borderRadius: 12, border: 0, padding: 2, flex: "none", cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.45 : 1, background: checked ? "var(--dsw-alias-state-business-primary, #3b82f6)" : "#5a5a5a", display: "flex", alignItems: "center", justifyContent: checked ? "flex-end" : "flex-start" },
  }, h("span", { style: { width: 20, height: 20, borderRadius: 10, background: "#fff", display: "block" } }));
}

function Row({ title, description, control }) {
  return h("div", { style: rowStyle },
    h("div", { style: { flex: 1, minWidth: 0 } }, h("div", { style: nameStyle }, title), description ? h("div", { style: descStyle }, description) : null),
    control);
}

function Select({ value, label, options, onChange }) {
  return h("select", { "aria-label": label, value, onChange: (event) => onChange(event.target.value), style: { ...controlStyle, maxWidth: 160 } },
    options.map(([id, name]) => h("option", { key: id, value: id }, name)));
}

function Page({ returnToConversation }) {
  const text = textFor();
  const [tab, setTab] = React.useState(0);
  const [settings, setSettings] = React.useState(null);
  const [draft, setDraft] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [error, setError] = React.useState("");
  React.useEffect(() => {
    let live = true;
    request().then((value) => { if (live) setSettings(value); }).catch(() => { if (live) setError(text.loadError); });
    return () => { live = false; };
  }, [text.loadError]);
  async function commit(next) {
    setStatus(text.saving); setError("");
    try { setSettings(await request(next)); setStatus(text.saved); }
    catch { setError(text.saveError); setStatus(""); }
  }
  function patch(key, value) { if (settings) void commit({ ...settings, [key]: value }); }
  async function clearData() {
    setStatus(text.saving); setError("");
    try { const value = await request({ action: "clear-browsing-data" }); setSettings(value); setStatus(text.cleared); }
    catch { setError(text.clearError); setStatus(""); }
  }
  if (!settings) return h("section", { style: pageStyle }, h("h1", { style: titleStyle }, text.computerTitle), h("p", null, error || "…"));
  const accessOptions = [["always", text.always], ["ask", text.ask], ["deny", text.deny]];
  const targetOptions = [["app", text.targetApp], ["system", text.targetSystem]];
  return h("section", { style: pageStyle },
    h("div", { style: { display: "flex", gap: 8, marginBottom: 18 } }, text.tabs.map((name, index) => h("button", { key: name, type: "button", onClick: () => setTab(index), style: { ...controlStyle, background: tab === index ? "var(--dsw-alias-interactive-bg-hover, #333)" : "transparent", border: "1px solid var(--dsw-alias-border-subtle, #333)" } }, name))),
    tab === 0 ? h("div", null,
      h("h1", { style: titleStyle }, text.computerTitle),
      h("p", { style: subtitleStyle }, text.computerSubtitle),
      h("div", { style: labelStyle }, text.control),
      h("div", { style: cardStyle },
        Row({ title: text.anyApp, description: text.anyAppDesc, control: h(Switch, { checked: settings.anyApp, label: text.anyApp, onChange: (value) => patch("anyApp", value) }) }),
        h("div", { style: hairline }),
        Row({ title: text.chrome, description: text.chromeDesc, control: h(Switch, { checked: settings.browserEnabled, label: text.chrome, onChange: (value) => patch("browserEnabled", value) }) }),
        h("div", { style: hairline }),
        Row({ title: text.excel, description: text.excelDesc, control: h("span", { style: descStyle }, text.unavailable) }),
        h("div", { style: { height: 10 } }),
        h("div", { style: cardStyle }, Row({ title: text.locked, description: text.lockedDesc, control: h("span", { style: descStyle }, text.unavailable) }))),
      h("div", { style: labelStyle }, text.allowed),
      h("div", { style: cardStyle },
        settings.allowedApps.length === 0 ? h("div", { style: { ...descStyle, padding: 16 } }, text.allowedEmpty) : settings.allowedApps.map((name, index) => h("div", { key: name },
          index > 0 ? h("div", { style: hairline }) : null,
          h("div", { style: rowStyle },
            h("div", { style: { width: 28, height: 28, borderRadius: 8, background: "#333", display: "grid", placeItems: "center", flex: "none" } }, name.slice(0, 1).toUpperCase()),
            h("div", { style: { flex: 1 } }, name),
            h("button", { type: "button", "aria-label": text.remove, onClick: () => patch("allowedApps", settings.allowedApps.filter((item) => item !== name)), style: { ...controlStyle, color: "#f87171" } }, "删除")))),
        h("div", { style: hairline }),
        h("div", { style: { display: "flex", gap: 8, padding: 12 } },
          h("input", { value: draft, placeholder: text.placeholder, onChange: (event) => setDraft(event.target.value), onKeyDown: (event) => { if (event.key === "Enter" && draft.trim()) { patch("allowedApps", [...settings.allowedApps, draft.trim()]); setDraft(""); } }, style: { flex: 1, height: 32, borderRadius: 8, border: "1px solid var(--dsw-alias-border-subtle, #333)", background: "transparent", color: "inherit", padding: "0 10px" } }),
          h("button", { type: "button", onClick: () => { if (!draft.trim()) return; patch("allowedApps", [...settings.allowedApps, draft.trim()]); setDraft(""); }, style: controlStyle }, text.add))))
    : h("div", null,
      h("h1", { style: titleStyle }, text.browserTitle),
      h("p", { style: subtitleStyle }, text.browserSubtitle),
      h("div", { style: { ...cardStyle, marginBottom: 8 } }, Row({ title: text.browserCard, description: text.browserCardDesc, control: h(Switch, { checked: settings.browserUseEnabled, label: text.browserCard, onChange: (value) => patch("browserUseEnabled", value) }) })),
      h("div", { style: { ...labelStyle, display: "flex", justifyContent: "space-between" } }, h("span", null, text.general)),
      h("div", { style: cardStyle },
        Row({ title: text.webTarget, description: text.webTargetDesc, control: h(Select, { value: settings.webUrlTarget, label: text.webTarget, options: targetOptions, onChange: (value) => patch("webUrlTarget", value) }) }),
        h("div", { style: hairline }),
        Row({ title: text.localTarget, description: text.localTargetDesc, control: h(Select, { value: settings.localUrlTarget, label: text.localTarget, options: targetOptions, onChange: (value) => patch("localUrlTarget", value) }) }),
        h("div", { style: hairline }),
        Row({ title: text.fullUrl, description: text.fullUrlDesc, control: h(Switch, { checked: settings.showFullUrl, label: text.fullUrl, onChange: (value) => patch("showFullUrl", value) }) }),
        h("div", { style: hairline }),
        Row({ title: text.browsingData, description: text.browsingDataDesc, control: h("button", { type: "button", onClick: clearData, style: controlStyle }, text.clear) }),
        h("div", { style: hairline }),
        Row({ title: text.history, description: text.historyDesc, control: h("span", { style: descStyle }, text.unavailable) }),
        h("div", { style: hairline }),
        Row({ title: text.annotation, description: text.annotationDesc, control: h(Select, { value: settings.annotationScreenshots, label: text.annotation, options: [["always", text.annotationAlways], ["drag", text.annotationDrag]], onChange: (value) => patch("annotationScreenshots", value) }) })),
      h("div", { style: labelStyle }, text.autofill),
      h("div", { style: cardStyle },
        Row({ title: text.passwords, description: text.passwordsDesc, control: h("span", { style: descStyle }, text.unavailable) }),
        h("div", { style: hairline }),
        Row({ title: text.contacts, description: text.contactsDesc, control: h("span", { style: descStyle }, text.unavailable) })),
      h("div", { style: labelStyle }, text.extensions),
      h("div", { style: cardStyle }, Row({ title: text.extensionManager, description: text.extensionDesc, control: h("span", { style: descStyle }, text.unavailable) })),
      h("div", { style: labelStyle }, text.downloads),
      h("div", { style: cardStyle },
        Row({ title: text.downloadLocation, description: text.downloadLocationDesc, control: h("span", { style: descStyle }, text.unavailable) }),
        h("div", { style: hairline }),
        Row({ title: text.askSave, description: text.askSaveDesc, control: h(Switch, { checked: settings.askDownloadLocation, label: text.askSave, onChange: (value) => patch("askDownloadLocation", value) }) }),
        h("div", { style: hairline }),
        Row({ title: text.downloadHistory, description: text.downloadHistoryDesc, control: h("span", { style: descStyle }, text.unavailable) })),
      h("div", { style: labelStyle }, text.permissions),
      h("div", { style: cardStyle },
        Row({ title: text.siteSettings, description: text.siteSettingsDesc, control: h("span", { style: descStyle }, text.unavailable) }),
        h("div", { style: hairline }),
        Row({ title: text.historyAccess, description: text.historyAccessDesc, control: h(Select, { value: settings.historyAccess, label: text.historyAccess, options: accessOptions, onChange: (value) => patch("historyAccess", value) }) }),
        h("div", { style: hairline }),
        Row({ title: text.siteTools, description: text.siteToolsDesc, control: h(Switch, { checked: settings.siteTools, label: text.siteTools, onChange: (value) => patch("siteTools", value) }) })),
      h("div", { style: labelStyle }, text.siteRules),
      h("p", { style: { ...descStyle, marginTop: -4 } }, text.siteRulesDesc),
      h("div", { style: labelStyle }, text.developer),
      h("div", { style: cardStyle }, Row({ title: text.fullCdp, description: `${text.risk}。${text.fullCdpDesc}`, control: h(Switch, { checked: settings.fullCdp, label: text.fullCdp, onChange: (value) => patch("fullCdp", value) }) }))),
    h("div", { style: { display: "flex", gap: 12, alignItems: "center", marginTop: 18 } },
      h("button", { type: "button", onClick: returnToConversation, style: controlStyle }, text.back),
      status ? h("span", { style: descStyle }, status) : null,
      error ? h("span", null, error) : null));
}

export const inject = ["slots", "layout", "locale"];

export function apply(ctx) {
  const label = () => "电脑操控";
  ctx.slots.inject("sidebar.panellist", () => ctx.slots.register({
    name: "sidebar.panellist", id: "dsh-codex-tools", order: 46, label,
  }, Icon));
  ctx.slots.inject("main", () => ctx.slots.register({
    name: "main",
    key: "dsh-codex-tools",
    inject: () => ({ returnToConversation: () => ctx.layout.selectPanel(null) }),
  }, Page));
}
