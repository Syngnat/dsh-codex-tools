import React from "react";

import { formatTimestamp } from "./lib/format-time.mjs";

const h = React.createElement;
const PATH = "/api/dsh-codex-tools.settings";

const COPY = {
  zh: {
    tabs: ["电脑操控", "浏览器", "更新"],
    computerTitle: "电脑操控",
    computerSubtitle: "管理如何操作你电脑上的其他应用程序。",
    control: "控制",
    anyApp: "任意应用",
    anyAppDesc: "允许操作你电脑上的应用。",
    excel: "Microsoft Excel",
    excelDesc: "打开后可以操作 Excel 窗口。关闭后，即使打开了任意应用，也不会操作 Excel。",
    locked: "锁屏操作",
    lockedDesc: "关闭时，检测到锁屏就拒绝电脑操控。打开后仍会尝试当前会话；系统的锁屏桌面本身不能从这里点进去。",
    lockedNow: "当前已锁屏",
    unlockedNow: "当前未锁屏",
    allowed: "始终允许的应用",
    allowedEmpty: "还没有始终允许的应用。关闭任意应用后，只有这里列出的应用可以被操作。",
    add: "添加",
    placeholder: "应用名称或标识，例如 notepad、explorer",
    addMissing: "先输入应用名称或标识。",
    remove: "移除",
    browserTitle: "浏览器",
    browserSubtitle: "管理浏览器窗口的偏好和访问范围。",
    browserCard: "浏览器",
    browserCardDesc: "使用独立的 Chrome 窗口，不占用你正在使用的 Chrome。",
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
    browsingDataDesc: "清除这个窗口里的浏览历史、网站数据和缓存。",
    clear: "清除浏览数据",
    cleared: "已清除",
    history: "浏览历史",
    historyDesc: "这里列出这个插件打开过的地址。历史记录设为拒绝后，不再记下新地址。",
    historyEmpty: "还没有记录。",
    clearHistory: "清除记录",
    annotation: "批注截图",
    annotationDesc: "截图会在图上标出最后一次点击或拖拽的位置，方便对照。",
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
    extensionDesc: "关闭后，下次打开窗口不加载任何扩展。未打包的目录会在下次启动时加载。",
    extensionEmpty: "这个窗口里还没有已安装的扩展。",
    extensionStop: "停用",
    extensionStart: "启用",
    extensionHint: "停用会把扩展目录移出加载路径，下次打开窗口才生效。",
    downloads: "下载",
    downloadLocation: "位置",
    downloadLocationDesc: "关闭「下载前询问」时，文件保存到这里。留空则用系统下载目录。下次打开窗口时生效。",
    change: "更改",
    askSave: "下载前询问保存位置",
    askSaveDesc: "打开后，下载时使用浏览器自己的保存对话框。",
    downloadHistory: "下载历史记录",
    downloadHistoryDesc: "这个窗口开始的下载会列在这里。",
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
    siteToolsUnavailable: "当前 Chrome 还没有网页工具接口，这一项无法开启。",
    siteRules: "网站权限",
    siteRulesDesc: "默认权限。单独例外还没有按网站生效。",
    developer: "开发者模式",
    risk: "风险升高",
    fullCdp: "启用完整 CDP 访问权限",
    fullCdpDesc: "关闭后，浏览器操作会停止。完整访问可以检查并控制浏览器内部功能。",
    updateTitle: "更新",
    updateSubtitle: "检查 GitHub 上的稳定版，确认后替换现在装的这一份。",
    currentVersion: "当前运行版本",
    installedVersion: "已安装版本",
    latestVersion: "最新版本",
    source: "安装来源",
    check: "检查更新",
    checking: "正在检查…",
    install: "安装更新",
    installing: "正在安装…",
    consent: "我确认用 GitHub 上的稳定版替换当前安装",
    upToDate: "已经是最新稳定版。",
    hasUpdate: "有新版本可以安装。",
    installUpdated: "已更新，当前进程里已经是新版本。",
    installStart: "开始安装",
    targetCommit: "目标提交",
    releaseNotes: "更新说明",
    swapHint: "安装时插件会先卸载自己再装回来，页面可能短暂消失；回来后这里会显示结果。",
    notChecked: "还没有检查过",
    lastCheck: "上次检查",
    replacing: "插件正在替换中…",
    phaseLabels: {
      queued: "排队中",
      checking: "核对当前安装",
      removing: "卸载旧版本",
      installing: "安装新版本",
      activating: "启用新版本",
      verifying: "确认新版本已生效",
      recovering: "出错，正在恢复旧版本",
      updated: "更新完成，新版本已经自己加载回来了",
      "restart-required": "更新完成，需要完全退出并重新打开 DeepSeek Harness",
      restored: "更新失败，已恢复旧版本",
      "repair-required": "更新失败，自动恢复也失败，请手动重装",
      failed: "更新失败",
      cancelled: "已取消",
      unknown: "状态未知",
    },
    installRestart: "安装完成。请完全退出并重新打开 DeepSeek Harness。",
    installRestored: "更新失败，已恢复上一版本。",
    installRepair: "更新失败，自动恢复也失败，请用命令行重新安装。",
    cannotUpdate: "这里不能在线更新",
    reasonUnsupportedSource: "现在装的不是从 GitHub 来的那一份。",
    reasonRestartRequired: "已经装上新版本，重启后才会运行。",
    restartPending: "已经装好 {version}。完全退出并重新打开 DeepSeek Harness 后生效，关掉窗口不算。",
    reasonDisabled: "插件当前是禁用状态。",
    reasonNotInstalled: "没有在插件列表里找到这个插件。",
    reasonUnsupportedVersion: "版本号不是标准稳定版。",
    reasonInstallationError: "这次安装本身有问题。",
    reasonUnsupportedInstallation: "这个安装位置不支持在线替换。",
    reasonManagerUnavailable: "插件管理服务还没准备好。",
    reasonServiceUnavailable: "插件管理服务还没准备好，稍后再试。",
    checkFailed: "检查没有成功，稍后再试。",
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

const pageStyle = { boxSizing: "border-box", width: "100%", height: "100%", maxHeight: "100vh", overflowY: "auto", overflowX: "hidden", color: "var(--dsw-alias-label-primary, #1a1a1a)" };
const frameStyle = { boxSizing: "border-box", maxWidth: 760, padding: "28px 32px 48px" };
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
  const draftRef = React.useRef("");
  const [addHint, setAddHint] = React.useState("");
  function rememberDraft(value) {
    draftRef.current = value;
    setDraft(value);
  }
  function addAllowed() {
    const name = draftRef.current.trim();
    if (!name) {
      setAddHint(text.addMissing);
      return;
    }
    setAddHint("");
    patch("allowedApps", [...(settings.allowedApps ?? []), name]);
    rememberDraft("");
  }
  const [login, setLogin] = React.useState({ origin: "", username: "", password: "" });
  const [contactDraft, setContactDraft] = React.useState({ name: "", email: "", phone: "", address: "" });
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
  if (!settings) return h("section", { style: pageStyle }, h("div", { style: frameStyle }, h("h1", { style: titleStyle }, text.computerTitle), h("p", null, error || "…")));
  const accessOptions = [["always", text.always], ["ask", text.ask], ["deny", text.deny]];
  const targetOptions = [["app", text.targetApp], ["system", text.targetSystem]];
  return h("section", { style: pageStyle }, h("div", { style: frameStyle },
    h("div", { style: { display: "flex", gap: 8, marginBottom: 18 } }, text.tabs.map((name, index) => h("button", { key: name, type: "button", onClick: () => setTab(index), style: { ...controlStyle, background: tab === index ? "var(--dsw-alias-interactive-bg-hover, #f2f3f5)" : "transparent", border: "1px solid var(--dsw-alias-border-l2, #e4e4e4)" } }, name))),
    tab === 0 ? h("div", null,
      h("h1", { style: titleStyle }, text.computerTitle),
      h("p", { style: subtitleStyle }, text.computerSubtitle),
      h("div", { style: labelStyle }, text.control),
      h("div", { style: cardStyle },
        Row({ title: text.anyApp, description: text.anyAppDesc, control: h(Switch, { checked: settings.anyApp, label: text.anyApp, onChange: (value) => patch("anyApp", value) }) }),
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
          h("input", { value: draft, placeholder: text.placeholder, onChange: (event) => { setAddHint(""); rememberDraft(event.target.value); }, onKeyDown: (event) => { if (event.key === "Enter") addAllowed(); }, style: { flex: 1, height: 32, borderRadius: 8, border: "1px solid var(--dsw-alias-border-l2, #e4e4e4)", background: "transparent", color: "inherit", padding: "0 10px" } }),
          h("button", { type: "button", onClick: addAllowed, style: controlStyle }, text.add)),
        addHint ? h("div", { style: { ...descStyle, padding: "0 12px 12px", color: "var(--dsw-alias-state-error-primary, #b91c1c)" } }, addHint) : null))
    : tab === 1 ? h("div", null,
      h("h1", { style: titleStyle }, text.browserTitle),
      h("p", { style: subtitleStyle }, text.browserSubtitle),
      h("div", { style: { ...cardStyle, marginBottom: 8 } }, Row({ title: text.browserCard, description: text.browserCardDesc, control: h(Switch, { checked: settings.browserEnabled, label: text.browserCard, onChange: (value) => patch("browserEnabled", value) }) })),
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
        (settings.extensions ?? []).length === 0 ? h("div", { style: { ...descStyle, padding: "0 16px 12px" } }, text.extensionEmpty) : (settings.extensions ?? []).map((item) => h("div", { key: item.profile + item.id, style: rowStyle },
          h("div", { style: { flex: 1 } }, item.name),
          h("button", { type: "button", onClick: () => commit({ action: "set-extension", profile: item.profile, id: item.id, enabled: !item.enabled }), style: controlStyle }, item.enabled ? text.extensionStop : text.extensionStart))),
        h("div", { style: { ...descStyle, padding: "0 16px 12px" } }, text.extensionHint)),
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
        Row({ title: text.siteTools, description: text.siteToolsUnavailable, control: null })),
      h("div", { style: labelStyle }, text.siteRules),
      h("p", { style: { ...descStyle, marginTop: -4 } }, text.siteRulesDesc),
      h("div", { style: labelStyle }, text.developer),
      h("div", { style: cardStyle }, Row({ title: text.fullCdp, description: `${text.risk}。${text.fullCdpDesc}`, control: h(Switch, { checked: settings.fullCdp, label: text.fullCdp, onChange: (value) => patch("fullCdp", value) }) })))
    : h(UpdatePanel, { text }),
    h("div", { style: { display: "flex", gap: 12, alignItems: "center", marginTop: 18 } },
      returnToConversation ? h("button", { type: "button", onClick: returnToConversation, style: controlStyle }, text.back) : null,
      status ? h("span", { style: descStyle }, status) : null,
      error ? h("span", null, error) : null)));
}

const UPDATE_PATH = "/api/dsh-codex-tools.update";

function reasonText(text, reason) {
  switch (reason) {
    case "unsupported-source": return text.reasonUnsupportedSource;
    case "restart-required": return text.reasonRestartRequired;
    case "disabled": return text.reasonDisabled;
    case "not-installed": return text.reasonNotInstalled;
    case "unsupported-version": return text.reasonUnsupportedVersion;
    case "installation-error": return text.reasonInstallationError;
    case "unsupported-installation": return text.reasonUnsupportedInstallation;
    case "manager-unavailable": return text.reasonManagerUnavailable;
    case "service-unavailable": return text.reasonServiceUnavailable;
    default: return reason ? String(reason) : "";
  }
}

async function callUpdate(body) {
  const response = await fetch(UPDATE_PATH, {
    method: body ? "POST" : "GET",
    credentials: "same-origin",
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  let value = null;
  try { value = await response.json(); } catch { value = null; }
  if (!response.ok) throw new Error(value?.error ?? "request");
  return value;
}

function UpdatePanel({ text }) {
  const [data, setData] = React.useState(null);
  const [consent, setConsent] = React.useState(false);
  const [pending, setPending] = React.useState("");
  const [note, setNote] = React.useState("");
  const [error, setError] = React.useState("");
  const pollRef = React.useRef(null);

  const stopPolling = () => {
    if (pollRef.current !== null) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };
  React.useEffect(() => () => stopPolling(), []);

  const applyStatus = (value) => {
    setData(value);
    const operation = value?.operation ?? null;
    if (operation?.phase) {
      const label = text.phaseLabels[operation.phase] ?? operation.phase;
      const reason = operation.error
        ? ` · ${operation.error}${operation.detailCode ? ` / ${operation.detailCode}` : ""}`
        : "";
      setNote(`${operation.terminal ? label : `${text.replacing}${label}`}${reason}`);
    }
    return operation;
  };

  React.useEffect(() => {
    let live = true;
    callUpdate()
      .then((value) => { if (live) applyStatus(value); })
      .catch(() => { if (live) setError(text.checkFailed); });
    return () => { live = false; stopPolling(); };
  }, [text.checkFailed]);

  async function check() {
    setPending("check"); setNote(""); setError("");
    try { applyStatus(await callUpdate({ action: "check" })); }
    catch { setError(text.checkFailed); }
    finally { setPending(""); }
  }

  async function install() {
    setPending("install"); setNote(""); setError("");
    try {
      const plan = await callUpdate({ action: "prepare" });
      await callUpdate({ action: "confirm", token: plan.token, targetVersion: plan.targetVersion, consent: true });
      setConsent(false);
      setNote(text.replacing);
      stopPolling();
      pollRef.current = setInterval(() => {
        void callUpdate().then((value) => {
          const operation = applyStatus(value);
          if (operation?.terminal) { stopPolling(); setPending(""); }
        }).catch(() => { /* the route is gone while the plugin is replaced */ });
      }, 1000);
    } catch (failure) {
      const code = String(failure?.message ?? "");
      setError(code ? `${text.cannotUpdate}（${code}）` : text.cannotUpdate);
      setPending("");
    }
  }

  const running = typeof data?.currentVersion === "string" ? data.currentVersion : null;
  const latest = typeof data?.release?.latestVersion === "string" ? data.release.latestVersion : null;
  const installed = typeof data?.installedVersion === "string" ? data.installedVersion : null;
  const canInstall = data?.available === true && data?.release?.status === "update-available";
  const restartPending = data?.reason === "restart-required";
  const busy = data?.reason === "busy";
  return h("div", null,
    h("h1", { style: titleStyle }, text.updateTitle),
    h("p", { style: subtitleStyle }, text.updateSubtitle),
    h("div", { style: cardStyle },
      Row({ title: text.currentVersion, description: running ?? "…", control: null }),
      h("div", { style: hairline }),
      Row({ title: text.installedVersion, description: installed ?? "…", control: null }),
      h("div", { style: hairline }),
      Row({ title: text.latestVersion, description: latest ?? text.notChecked, control: null }),
      h("div", { style: hairline }),
      Row({ title: text.lastCheck, description: formatTimestamp(data?.release?.checkedAt) || text.notChecked, control: null }),
      data?.source ? h("div", null, h("div", { style: hairline }), Row({ title: text.source, description: data.source, control: null })) : null),
    restartPending
      ? h("p", { style: { ...descStyle, marginTop: 12 } }, text.restartPending.replace("{version}", installed ?? latest ?? "新版本"))
      : data?.release?.status === "current" ? h("p", { style: { ...descStyle, marginTop: 12 } }, text.upToDate) : null,
    !restartPending && canInstall ? h("p", { style: { ...descStyle, marginTop: 12 } }, text.hasUpdate) : null,
    !restartPending && !canInstall && !busy && data?.available === false
      ? h("p", { style: { ...descStyle, marginTop: 12 } }, `${text.cannotUpdate}：${reasonText(text, data.reason)}`)
      : null,
    canInstall ? h("label", { style: { display: "flex", gap: 8, alignItems: "center", marginTop: 14, fontSize: 13 } },
      h("input", { type: "checkbox", checked: consent, onChange: (event) => setConsent(event.target.checked) }), text.consent) : null,
    canInstall ? h("p", { style: { ...descStyle, marginTop: 8 } }, text.swapHint) : null,
    h("div", { style: { display: "flex", gap: 8, marginTop: 14 } },
      h("button", { type: "button", onClick: check, disabled: pending !== "", style: controlStyle }, pending === "check" ? text.checking : text.check),
      canInstall ? h("button", { type: "button", onClick: install, disabled: !consent || pending !== "", style: controlStyle }, pending === "install" ? text.installing : text.install) : null),
    data?.operation?.targetSpec
      ? h("p", { style: { ...descStyle, marginTop: 12 } }, `${text.targetCommit} ${data.operation.targetSpec}`)
      : null,
    data?.release?.releaseUrl
      ? h("p", { style: { ...descStyle, marginTop: 12 } },
        h("a", { href: data.release.releaseUrl, target: "_blank", rel: "noreferrer" }, text.releaseNotes))
      : null,
    note ? h("p", { style: { ...descStyle, marginTop: 12 } }, note) : null,
    error ? h("p", { style: { ...descStyle, marginTop: 12, color: "var(--dsw-alias-state-error-primary, #b91c1c)" } }, error) : null);
}

// ---------------------------------------------------------------- turn trigger
//
// The core turn-trigger card titles every agent-message as the generic
// "收到任务消息". The client slot `conversation.chat.node` is keyed by node kind,
// so a higher-priority `turn-trigger` registration can shadow the core renderer
// without touching DSH itself. Keep the card's shape and only derive the title
// from the durable source; non-agent-message kinds keep their original wording.

const triggerCardStyle = {
  margin: "12px 0",
  border: "1px solid var(--dsw-alias-border-secondary, #e5e7eb)",
  borderRadius: 12,
  background: "var(--dsw-alias-bg-secondary, #f7f8fa)",
  overflow: "hidden",
};
const triggerHeaderStyle = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  width: "100%",
  padding: "10px 12px",
  background: "transparent",
  border: 0,
  cursor: "pointer",
  color: "var(--dsw-alias-label-primary, #1a1a1a)",
  font: "inherit",
  textAlign: "left",
};
const triggerTitleStyle = { flex: 1, fontSize: 13, fontWeight: 600 };
const triggerTimeStyle = { fontSize: 11, color: "var(--dsw-alias-label-secondary, #5c6570)" };
const triggerChevronStyle = { fontSize: 12, color: "var(--dsw-alias-label-secondary, #5c6570)" };
const triggerBodyStyle = { padding: "0 12px 12px 34px" };
const triggerExplanationStyle = {
  margin: "0 0 8px",
  fontSize: 12,
  color: "var(--dsw-alias-label-secondary, #5c6570)",
};
const triggerContentStyle = { fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap", overflowWrap: "anywhere" };

export function turnTriggerTitle(source) {
  const kind = source?.kind;
  if (kind === "agent-message") {
    const sender = typeof source.senderSessionId === "string" && source.senderSessionId.length > 0
      ? source.senderSessionId
      : "另一个会话";
    return `收到会话 ${sender} 的消息`;
  }
  switch (kind) {
    case "goal": return "收到目标消息";
    case "subagent-settled": return "子代理已完成";
    case "webhook": return "收到 Webhook 消息";
    case "schedule": return "收到定时任务消息";
    case "cordis-host-runner": return "收到插件消息";
    default: return "收到任务消息";
  }
}

export function turnTriggerText(content) {
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => (part !== null && typeof part === "object" && typeof part.text === "string" ? part.text : ""))
    .filter((text) => text.length > 0)
    .join("\n");
}

function turnTriggerClock(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
}

function CodexTurnTriggerView({ node }) {
  const [open, setOpen] = React.useState(false);
  const data = node?.data ?? {};
  const text = turnTriggerText(data.content);
  return h("section", { style: triggerCardStyle },
    h("button", {
      type: "button",
      style: triggerHeaderStyle,
      "aria-expanded": open,
      onClick: () => setOpen(!open),
    },
      h("span", { style: triggerTitleStyle }, turnTriggerTitle(data.source)),
      h("time", { style: triggerTimeStyle }, turnTriggerClock(data.time)),
      h("span", { style: triggerChevronStyle }, open ? "⌃" : "⌄")),
    open
      ? h("div", { style: triggerBodyStyle },
        h("p", { style: triggerExplanationStyle }, "这条通知触发了本轮回复。"),
        text.length > 0 ? h("div", { style: triggerContentStyle }, text) : null)
      : null);
}

export const inject = ["slots", "layout", "locale"];

export function apply(ctx) {
  const label = () => "电脑操控";
  // The same page also opens from the settings dialog's own nav, so the
  // settings are one click away instead of buried under the Plugins page.
  ctx.slots.inject("settings.section", () => ctx.slots.register({
    name: "settings.section", id: "dsh-codex-tools", order: 90, label,
  }, Page));
  ctx.slots.inject("main", () => ctx.slots.register({
    name: "main",
    key: "dsh-codex-tools",
    inject: () => ({ returnToConversation: () => ctx.layout.selectPanel(null) }),
  }, Page));
  // Shadow the core turn-trigger renderer for agent messages only in title;
  // the higher priority selects this entry for the keyed node slot.
  ctx.slots.inject("conversation.chat.node", () => ctx.slots.register({
    name: "conversation.chat.node",
    key: "turn-trigger",
    priority: 1000,
    locale: "dsh-codex-tools",
  }, CodexTurnTriggerView));
}
