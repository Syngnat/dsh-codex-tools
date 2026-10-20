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
var h = import_react.default.createElement;
var React = import_react.default;
var PATH = "/api/dsh-codex-tools.settings";

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
    excelDesc: "打开后可以操作 Excel 窗口。关闭后，即使打开了任意应用，也不会操作 Excel。",
    locked: "锁屏操作",
    lockedDesc: "关闭时，检测到锁屏就拒绝电脑操控。打开后仍会尝试当前会话；系统的锁屏桌面本身不能从这里点进去。",
    lockedNow: "当前已锁屏",
    unlockedNow: "当前未锁屏",
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
    historyDesc: "这里列出这个插件打开过的地址。历史记录设为拒绝后，不再记下新地址。",
    historyEmpty: "还没有记录。",
    clearHistory: "清除记录",
    annotation: "批注截图",
    annotationDesc: "截图可以帮助理解页面，但会增加上下文用量。",
    annotationAlways: "始终包含",
    annotationDrag: "仅在拖选时",
    autofill: "自动填充和密码",
    passwords: "密码管理器",
    passwordsDesc: "打开后，进入已保存的网站时填入用户名和密码。密码只留在本机，回复里不会写出密码。",
    passwordOrigin: "网站，例如 https://example.com",
    passwordUser: "用户名",
    passwordSecret: "密码",
    contacts: "联系信息",
    contactsDesc: "打开后，进入页面时填入空白的姓名、邮箱、电话和地址栏。",
    contactName: "姓名",
    contactEmail: "邮箱",
    contactPhone: "电话",
    contactAddress: "地址",
    saveContact: "保存联系信息",
    extensions: "扩展程序",
    extensionManager: "扩展程序管理器",
    extensionDesc: "关闭后，下次打开窗口不加载扩展。已安装的扩展可以单独停用，未打包的目录会在下次启动时加载。",
    extensionEmpty: "这两个窗口里还没有已安装的扩展。",
    extensionPath: "未打包扩展的目录",
    extensionStop: "停用",
    extensionStart: "启用",
    downloads: "下载",
    downloadLocation: "位置",
    downloadLocationDesc: "关闭「下载前询问」时，文件保存到这里。留空则用系统下载目录。下次打开窗口时生效。",
    change: "更改",
    askSave: "下载前询问保存位置",
    askSaveDesc: "打开后，下载时使用浏览器自己的保存对话框。",
    downloadHistory: "下载历史记录",
    downloadHistoryDesc: "这两个窗口开始的下载会列在这里。",
    permissions: "浏览器权限",
    siteSettings: "网站设置",
    siteSettingsDesc: "进入网页时，按这里的选择允许或拒绝。每次询问则沿用 Chrome 自己的提示。",
    camera: "摄像头",
    microphone: "麦克风",
    geolocation: "位置",
    notifications: "通知",
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

const pageStyle = { padding: "28px 32px 48px", maxWidth: 760, color: "var(--dsw-alias-label-primary, #1a1a1a)" };
const titleStyle = { margin: "0 0 6px", fontSize: 28, fontWeight: 650 };
const subtitleStyle = { margin: "0 0 22px", color: "var(--dsw-alias-label-secondary, #5c6570)", fontSize: 14 };
const labelStyle = { margin: "18px 0 8px", fontSize: 13, color: "var(--dsw-alias-label-secondary, #5c6570)" };
const cardStyle = { borderRadius: 14, background: "var(--dsw-alias-bg-layer-1, #ffffff)", border: "1px solid var(--dsw-alias-border-l2, #e4e4e4)", overflow: "hidden" };
const rowStyle = { display: "flex", gap: 14, alignItems: "center", padding: "14px 16px" };
const nameStyle = { fontSize: 15, fontWeight: 600 };
const descStyle = { marginTop: 3, fontSize: 13, lineHeight: 1.4, color: "var(--dsw-alias-label-secondary, #5c6570)" };
const hairline = { height: 1, background: "var(--dsw-alias-border-l2, #e4e4e4)" };
const controlStyle = { height: 30, padding: "0 12px", borderRadius: 8, border: 0, background: "var(--dsw-alias-interactive-bg-hover, #f2f3f5)", color: "inherit", cursor: "pointer" };

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
  const [login, setLogin] = React.useState({ origin: "", username: "", password: "" });
  const [contactDraft, setContactDraft] = React.useState({ name: "", email: "", phone: "", address: "" });
  const [extensionPath, setExtensionPath] = React.useState("");
  const [downloadDir, setDownloadDir] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [error, setError] = React.useState("");
  React.useEffect(() => {
    let live = true;
    request().then((value) => {
      if (!live) return;
      setSettings(value);
      setContactDraft(value.contact ?? { name: "", email: "", phone: "", address: "" });
      setDownloadDir(value.downloadDirectory ?? "");
    }).catch(() => { if (live) setError(text.loadError); });
    return () => { live = false; };
  }, [text.loadError]);
  async function commit(next) {
    setStatus(text.saving); setError("");
    try {
      const value = await request(next);
      setSettings(value);
      if (value.contact) setContactDraft(value.contact);
      if (typeof value.downloadDirectory === "string") setDownloadDir(value.downloadDirectory);
      setStatus(text.saved);
    }
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
    h("div", { style: { display: "flex", gap: 8, marginBottom: 18 } }, text.tabs.map((name, index) => h("button", { key: name, type: "button", onClick: () => setTab(index), style: { ...controlStyle, background: tab === index ? "var(--dsw-alias-interactive-bg-hover, #f2f3f5)" : "transparent", border: "1px solid var(--dsw-alias-border-l2, #e4e4e4)" } }, name))),
    tab === 0 ? h("div", null,
      h("h1", { style: titleStyle }, text.computerTitle),
      h("p", { style: subtitleStyle }, text.computerSubtitle),
      h("div", { style: labelStyle }, text.control),
      h("div", { style: cardStyle },
        Row({ title: text.anyApp, description: text.anyAppDesc, control: h(Switch, { checked: settings.anyApp, label: text.anyApp, onChange: (value) => patch("anyApp", value) }) }),
        h("div", { style: hairline }),
        Row({ title: text.chrome, description: text.chromeDesc, control: h(Switch, { checked: settings.browserEnabled, label: text.chrome, onChange: (value) => patch("browserEnabled", value) }) }),
        h("div", { style: hairline }),
        Row({ title: text.excel, description: text.excelDesc, control: h(Switch, { checked: settings.excelEnabled !== false, label: text.excel, onChange: (value) => patch("excelEnabled", value) }) }),
        h("div", { style: { height: 10 } }),
        h("div", { style: cardStyle }, Row({ title: text.locked, description: `${text.lockedDesc} ${settings.sessionLocked ? text.lockedNow : text.unlockedNow}`, control: h(Switch, { checked: settings.lockScreen === true, label: text.locked, onChange: (value) => patch("lockScreen", value) }) }))),
      h("div", { style: labelStyle }, text.allowed),
      h("div", { style: cardStyle },
        settings.allowedApps.length === 0 ? h("div", { style: { ...descStyle, padding: 16 } }, text.allowedEmpty) : settings.allowedApps.map((name, index) => h("div", { key: name },
          index > 0 ? h("div", { style: hairline }) : null,
          h("div", { style: rowStyle },
            h("div", { style: { width: 28, height: 28, borderRadius: 8, background: "var(--dsw-alias-interactive-bg-active, #e8eaed)", color: "var(--dsw-alias-label-primary, #1a1a1a)", display: "grid", placeItems: "center", flex: "none" } }, name.slice(0, 1).toUpperCase()),
            h("div", { style: { flex: 1 } }, name),
            h("button", { type: "button", "aria-label": text.remove, onClick: () => patch("allowedApps", settings.allowedApps.filter((item) => item !== name)), style: { ...controlStyle, color: "#f87171" } }, "删除")))),
        h("div", { style: hairline }),
        h("div", { style: { display: "flex", gap: 8, padding: 12 } },
          h("input", { value: draft, placeholder: text.placeholder, onChange: (event) => setDraft(event.target.value), onKeyDown: (event) => { if (event.key === "Enter" && draft.trim()) { patch("allowedApps", [...settings.allowedApps, draft.trim()]); setDraft(""); } }, style: { flex: 1, height: 32, borderRadius: 8, border: "1px solid var(--dsw-alias-border-l2, #e4e4e4)", background: "transparent", color: "inherit", padding: "0 10px" } }),
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
        Row({ title: text.history, description: text.historyDesc, control: h("button", { type: "button", onClick: () => commit({ action: "clear-history" }), style: controlStyle }, text.clearHistory) }),
        (settings.history ?? []).length === 0 ? h("div", { style: { ...descStyle, padding: "0 16px 14px" } }, text.historyEmpty) : (settings.history ?? []).slice(0, 8).map((item) => h("div", { key: item.at + item.url, style: { ...descStyle, padding: "0 16px 8px" } }, item.url)),
        h("div", { style: hairline }),
        Row({ title: text.annotation, description: text.annotationDesc, control: h(Select, { value: settings.annotationScreenshots, label: text.annotation, options: [["always", text.annotationAlways], ["drag", text.annotationDrag]], onChange: (value) => patch("annotationScreenshots", value) }) })),
      h("div", { style: labelStyle }, text.autofill),
      h("div", { style: cardStyle },
        Row({ title: text.passwords, description: text.passwordsDesc, control: h(Switch, { checked: settings.passwordsEnabled === true, label: text.passwords, onChange: (value) => patch("passwordsEnabled", value) }) }),
        ...(settings.passwords ?? []).map((item) => h("div", { key: item.id, style: rowStyle }, h("div", { style: { flex: 1 } }, `${item.origin} · ${item.username}`), h("button", { type: "button", onClick: () => commit({ action: "delete-password", id: item.id }), style: { ...controlStyle, color: "#f87171" } }, text.remove))),
        h("div", { style: { display: "flex", gap: 8, padding: 12 } },
          h("input", { value: login.origin, placeholder: text.passwordOrigin, onChange: (event) => setLogin({ ...login, origin: event.target.value }), style: { flex: 1.4, height: 32, borderRadius: 8, border: "1px solid var(--dsw-alias-border-l2, #e4e4e4)", background: "transparent", color: "inherit", padding: "0 10px" } }),
          h("input", { value: login.username, placeholder: text.passwordUser, onChange: (event) => setLogin({ ...login, username: event.target.value }), style: { flex: 1, height: 32, borderRadius: 8, border: "1px solid var(--dsw-alias-border-l2, #e4e4e4)", background: "transparent", color: "inherit", padding: "0 10px" } }),
          h("input", { value: login.password, placeholder: text.passwordSecret, type: "password", onChange: (event) => setLogin({ ...login, password: event.target.value }), style: { flex: 1, height: 32, borderRadius: 8, border: "1px solid var(--dsw-alias-border-l2, #e4e4e4)", background: "transparent", color: "inherit", padding: "0 10px" } }),
          h("button", { type: "button", onClick: () => { if (!login.origin.trim() || !login.username.trim() || !login.password) return; commit({ action: "save-password", origin: login.origin, username: login.username, password: login.password }); setLogin({ origin: "", username: "", password: "" }); }, style: controlStyle }, text.add)),
        h("div", { style: hairline }),
        Row({ title: text.contacts, description: text.contactsDesc, control: h(Switch, { checked: settings.contactsEnabled === true, label: text.contacts, onChange: (value) => patch("contactsEnabled", value) }) }),
        h("div", { style: { display: "flex", gap: 8, padding: 12, flexWrap: "wrap" } },
          [["name", text.contactName], ["email", text.contactEmail], ["phone", text.contactPhone], ["address", text.contactAddress]].map(([key, label]) => h("input", { key, value: contactDraft[key] ?? "", placeholder: label, onChange: (event) => setContactDraft({ ...contactDraft, [key]: event.target.value }), style: { flex: "1 1 140px", height: 32, borderRadius: 8, border: "1px solid var(--dsw-alias-border-l2, #e4e4e4)", background: "transparent", color: "inherit", padding: "0 10px" } })),
          h("button", { type: "button", onClick: () => commit({ action: "save-contact", contact: contactDraft }), style: controlStyle }, text.saveContact))),
      h("div", { style: labelStyle }, text.extensions),
      h("div", { style: cardStyle },
        Row({ title: text.extensionManager, description: text.extensionDesc, control: h(Switch, { checked: settings.extensionsEnabled !== false, label: text.extensionManager, onChange: (value) => patch("extensionsEnabled", value) }) }),
        (settings.extensions ?? []).length === 0 ? h("div", { style: { ...descStyle, padding: "0 16px 12px" } }, text.extensionEmpty) : (settings.extensions ?? []).map((item) => {
          const disabled = (settings.disabledExtensionIds ?? []).includes(item.id);
          return h("div", { key: item.profile + item.id, style: rowStyle }, h("div", { style: { flex: 1 } }, `${item.name} · ${item.profile}`), h("button", { type: "button", onClick: () => patch("disabledExtensionIds", disabled ? settings.disabledExtensionIds.filter((id) => id !== item.id) : [...(settings.disabledExtensionIds ?? []), item.id]), style: controlStyle }, disabled ? text.extensionStart : text.extensionStop));
        }),
        h("div", { style: { display: "flex", gap: 8, padding: 12 } },
          h("input", { value: extensionPath, placeholder: text.extensionPath, onChange: (event) => setExtensionPath(event.target.value), style: { flex: 1, height: 32, borderRadius: 8, border: "1px solid var(--dsw-alias-border-l2, #e4e4e4)", background: "transparent", color: "inherit", padding: "0 10px" } }),
          h("button", { type: "button", onClick: () => { if (!extensionPath.trim()) return; patch("extraExtensionPaths", [...(settings.extraExtensionPaths ?? []), extensionPath.trim()]); setExtensionPath(""); }, style: controlStyle }, text.add))),
      h("div", { style: labelStyle }, text.downloads),
      h("div", { style: cardStyle },
        Row({ title: text.downloadLocation, description: text.downloadLocationDesc, control: h("input", { value: downloadDir, placeholder: text.downloadLocation, onChange: (event) => setDownloadDir(event.target.value), onBlur: () => patch("downloadDirectory", downloadDir), style: { width: 220, height: 32, borderRadius: 8, border: "1px solid var(--dsw-alias-border-l2, #e4e4e4)", background: "transparent", color: "inherit", padding: "0 10px" } }) }),
        h("div", { style: hairline }),
        Row({ title: text.askSave, description: text.askSaveDesc, control: h(Switch, { checked: settings.askDownloadLocation, label: text.askSave, onChange: (value) => patch("askDownloadLocation", value) }) }),
        h("div", { style: hairline }),
        Row({ title: text.downloadHistory, description: text.downloadHistoryDesc, control: null }),
        (settings.downloads ?? []).length === 0 ? h("div", { style: { ...descStyle, padding: "0 16px 14px" } }, text.historyEmpty) : (settings.downloads ?? []).slice(0, 8).map((item) => h("div", { key: item.guid, style: { ...descStyle, padding: "0 16px 8px" } }, `${item.filename || item.url} · ${item.state}`))),
      h("div", { style: labelStyle }, text.permissions),
      h("div", { style: cardStyle },
        Row({ title: text.siteSettings, description: text.siteSettingsDesc, control: null }),
        ...[["camera", text.camera], ["microphone", text.microphone], ["geolocation", text.geolocation], ["notifications", text.notifications]].map(([key, label]) => h("div", { key }, h("div", { style: hairline }), Row({ title: label, control: h(Select, { value: settings.sitePermissions?.[key] ?? "ask", label, options: [["allow", text.always], ["ask", text.ask], ["deny", text.deny]], onChange: (value) => patch("sitePermissions", { ...settings.sitePermissions, [key]: value }) }) }))),
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

var inject = ["slots", "layout", "locale"];

function apply(ctx) {
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

return module.exports;}});
