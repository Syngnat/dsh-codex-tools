import React from "react";

const h = React.createElement;
const PATH = "/api/dsh-codex-tools.settings";

const COPY = {
  zh: {
    title: "电脑操作",
    subtitle: "管理如何操作这台电脑上的其他应用和浏览器。",
    computer: "电脑操作",
    anyApp: "任意应用",
    anyAppDesc: "允许操作这台电脑上的应用。关闭后，只有下面列出的应用可以被操作。",
    allowed: "始终允许的应用",
    allowedDesc: "填写应用显示名，例如 Safari、访达。和操作时使用的名字一致即可。",
    add: "添加",
    placeholder: "应用名称",
    remove: "移除",
    empty: "还没有允许的应用。",
    browser: "浏览器",
    browserWindow: "Chrome 窗口",
    browserWindowDesc: "打开一个由这里管理的 Chrome 窗口，不会占用你正在使用的那个 Chrome。",
    browserUse: "另一个浏览器窗口",
    browserUseDesc: "再开一个互不干扰的窗口，适合单独的网页任务。",
    back: "返回对话",
    saving: "正在保存…",
    saved: "已保存",
    loadError: "设置没有读出来。",
    saveError: "设置没有保存。",
  },
  en: {
    title: "Computer and browser",
    subtitle: "Choose which apps and browser windows can be operated.",
    computer: "Computer",
    anyApp: "Any app",
    anyAppDesc: "Allow operating apps on this computer. When this is off, only the apps listed below can be operated.",
    allowed: "Always-allowed apps",
    allowedDesc: "Use the same display name used when operating the app, such as Safari.",
    add: "Add",
    placeholder: "App name",
    remove: "Remove",
    empty: "No apps are allowed yet.",
    browser: "Browser",
    browserWindow: "Chrome window",
    browserWindowDesc: "Open a Chrome window managed here. It does not attach to the Chrome window you already have open.",
    browserUse: "Another browser window",
    browserUseDesc: "Open a second, separate window for a different web task.",
    back: "Back to chat",
    saving: "Saving…",
    saved: "Saved",
    loadError: "The settings could not be read.",
    saveError: "The settings could not be saved.",
  },
};

function copyFor(language) {
  return String(language || "").toLowerCase().startsWith("en") ? COPY.en : COPY.zh;
}

async function loadSettings() {
  const response = await fetch(PATH, { credentials: "same-origin" });
  if (!response.ok) throw new Error("load");
  return response.json();
}

async function saveSettings(value) {
  const response = await fetch(PATH, {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(value),
  });
  if (!response.ok) throw new Error("save");
  return response.json();
}

function Icon() {
  return h("svg", { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, "aria-hidden": true },
    h("rect", { x: 3, y: 4, width: 18, height: 12, rx: 2 }),
    h("path", { d: "M8 20h8M12 16v4" }));
}

function Switch({ checked, label, disabled, onChange }) {
  return h("button", {
    type: "button",
    role: "switch",
    "aria-checked": checked ? "true" : "false",
    "aria-label": label,
    disabled,
    onClick: () => onChange(!checked),
    style: {
      width: 44, height: 26, borderRadius: 13, border: 0, padding: 2, cursor: disabled ? "default" : "pointer",
      background: checked ? "var(--dsw-alias-state-business-primary, #3b82f6)" : "var(--dsw-alias-interactive-bg-hover, #3a3a3a)",
      display: "flex", alignItems: "center", justifyContent: checked ? "flex-end" : "flex-start",
    },
  }, h("span", { style: { width: 22, height: 22, borderRadius: 11, background: "#fff", display: "block" } }));
}

function Row({ title, description, control }) {
  return h("div", { style: { display: "flex", gap: 16, alignItems: "center", padding: "14px 0" } },
    h("div", { style: { flex: 1, minWidth: 0 } },
      h("div", { style: { fontSize: 15, fontWeight: 600 } }, title),
      description ? h("div", { style: { marginTop: 4, fontSize: 13, lineHeight: 1.45, color: "var(--dsw-alias-fg-secondary, #a3a3a3)" } }, description) : null),
    control);
}

function Page({ getLocale, returnToConversation }) {
  const text = copyFor(getLocale?.());
  const [settings, setSettings] = React.useState(null);
  const [draft, setDraft] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [error, setError] = React.useState("");
  React.useEffect(() => {
    let live = true;
    loadSettings().then((value) => { if (live) setSettings(value); }).catch(() => { if (live) setError(text.loadError); });
    return () => { live = false; };
  }, [text.loadError]);
  async function commit(next) {
    setStatus(text.saving);
    setError("");
    try {
      const saved = await saveSettings(next);
      setSettings(saved);
      setStatus(text.saved);
    } catch {
      setError(text.saveError);
      setStatus("");
    }
  }
  function toggle(key) {
    if (!settings) return;
    void commit({ ...settings, [key]: !settings[key] });
  }
  function addApp() {
    const name = draft.trim();
    if (!name || !settings) return;
    setDraft("");
    void commit({ ...settings, allowedApps: [...settings.allowedApps, name] });
  }
  function removeApp(name) {
    void commit({ ...settings, allowedApps: settings.allowedApps.filter((item) => item !== name) });
  }
  return h("section", { style: { padding: "28px 32px", maxWidth: 760, color: "var(--dsw-alias-fg-primary, inherit)" } },
    h("h1", { style: { margin: "0 0 8px", fontSize: 28, fontWeight: 650 } }, text.title),
    h("p", { style: { margin: "0 0 24px", color: "var(--dsw-alias-fg-secondary, #a3a3a3)" } }, text.subtitle),
    !settings ? h("p", null, error || "…") : h("div", { style: { display: "grid", gap: 18 } },
      h("section", { style: cardStyle },
        h("h2", { style: headingStyle }, text.computer),
        Row({ title: text.anyApp, description: text.anyAppDesc, control: h(Switch, { checked: settings.anyApp, label: text.anyApp, onChange: () => toggle("anyApp") }) }),
        settings.anyApp ? null : h("div", { style: { borderTop: "1px solid var(--dsw-alias-border-subtle, #2e2e2e)", paddingTop: 12 } },
          h("div", { style: { fontSize: 15, fontWeight: 600 } }, text.allowed),
          h("div", { style: { margin: "4px 0 10px", fontSize: 13, color: "var(--dsw-alias-fg-secondary, #a3a3a3)" } }, text.allowedDesc),
          h("div", { style: { display: "flex", gap: 8 } },
            h("input", { value: draft, placeholder: text.placeholder, onChange: (event) => setDraft(event.target.value), onKeyDown: (event) => { if (event.key === "Enter") addApp(); }, style: inputStyle }),
            h("button", { type: "button", onClick: addApp, style: buttonStyle }, text.add)),
          settings.allowedApps.length === 0 ? h("p", { style: { color: "var(--dsw-alias-fg-secondary, #a3a3a3)" } }, text.empty) : h("ul", { style: { listStyle: "none", padding: 0, margin: "10px 0 0" } },
            settings.allowedApps.map((name) => h("li", { key: name, style: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0" } },
              h("span", null, name),
              h("button", { type: "button", onClick: () => removeApp(name), style: buttonStyle }, text.remove)))))),
      h("section", { style: cardStyle },
        h("h2", { style: headingStyle }, text.browser),
        Row({ title: text.browserWindow, description: text.browserWindowDesc, control: h(Switch, { checked: settings.browserEnabled, label: text.browserWindow, onChange: () => toggle("browserEnabled") }) }),
        h("div", { style: { borderTop: "1px solid var(--dsw-alias-border-subtle, #2e2e2e)" } },
          Row({ title: text.browserUse, description: text.browserUseDesc, control: h(Switch, { checked: settings.browserUseEnabled, label: text.browserUse, onChange: () => toggle("browserUseEnabled") }) }))),
      h("div", { style: { display: "flex", gap: 12, alignItems: "center" } },
        h("button", { type: "button", onClick: returnToConversation, style: buttonStyle }, text.back),
        status ? h("span", { style: { color: "var(--dsw-alias-fg-secondary, #a3a3a3)" } }, status) : null,
        error ? h("span", null, error) : null)));
}

const cardStyle = { padding: "4px 18px 8px", borderRadius: 12, background: "var(--dsw-alias-bg-layer-1, #1c1c1c)", border: "1px solid var(--dsw-alias-border-subtle, #2e2e2e)" };
const headingStyle = { margin: "14px 0 0", fontSize: 13, fontWeight: 650, letterSpacing: "0.04em", textTransform: "none", color: "var(--dsw-alias-fg-secondary, #a3a3a3)" };
const buttonStyle = { height: 32, padding: "0 12px", borderRadius: 8, border: "1px solid var(--dsw-alias-border-subtle, #3a3a3a)", background: "transparent", color: "inherit", cursor: "pointer" };
const inputStyle = { flex: 1, height: 32, padding: "0 10px", borderRadius: 8, border: "1px solid var(--dsw-alias-border-subtle, #3a3a3a)", background: "transparent", color: "inherit" };

export const inject = ["slots", "layout", "locale"];

export function apply(ctx) {
  const label = () => {
    try {
      return String(ctx.locale.getLocale().active).toLowerCase().startsWith("en") ? "Computer and browser" : "电脑操作";
    } catch {
      return "电脑操作";
    }
  };
  ctx.slots.inject("sidebar.panellist", () => ctx.slots.register({
    name: "sidebar.panellist", id: "dsh-codex-tools", order: 46, label,
  }, Icon));
  ctx.slots.inject("main", () => ctx.slots.register({
    name: "main",
    key: "dsh-codex-tools",
    inject: () => ({
      getLocale: () => {
        try { return ctx.locale.getLocale().active; } catch { return "zh"; }
      },
      returnToConversation: () => ctx.layout.selectPanel(null),
    }),
  }, Page));
}
