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
var PATH = "/api/dsh-codex-tools.settings";
var COPY = {
  zh: {
    title: "\u7535\u8111\u64CD\u4F5C",
    subtitle: "\u7BA1\u7406\u5982\u4F55\u64CD\u4F5C\u8FD9\u53F0\u7535\u8111\u4E0A\u7684\u5176\u4ED6\u5E94\u7528\u548C\u6D4F\u89C8\u5668\u3002",
    computer: "\u7535\u8111\u64CD\u4F5C",
    anyApp: "\u4EFB\u610F\u5E94\u7528",
    anyAppDesc: "\u5141\u8BB8\u64CD\u4F5C\u8FD9\u53F0\u7535\u8111\u4E0A\u7684\u5E94\u7528\u3002\u5173\u95ED\u540E\uFF0C\u53EA\u6709\u4E0B\u9762\u5217\u51FA\u7684\u5E94\u7528\u53EF\u4EE5\u88AB\u64CD\u4F5C\u3002",
    allowed: "\u59CB\u7EC8\u5141\u8BB8\u7684\u5E94\u7528",
    allowedDesc: "\u586B\u5199\u5E94\u7528\u663E\u793A\u540D\uFF0C\u4F8B\u5982 Safari\u3001\u8BBF\u8FBE\u3002\u548C\u64CD\u4F5C\u65F6\u4F7F\u7528\u7684\u540D\u5B57\u4E00\u81F4\u5373\u53EF\u3002",
    add: "\u6DFB\u52A0",
    placeholder: "\u5E94\u7528\u540D\u79F0",
    remove: "\u79FB\u9664",
    empty: "\u8FD8\u6CA1\u6709\u5141\u8BB8\u7684\u5E94\u7528\u3002",
    browser: "\u6D4F\u89C8\u5668",
    browserWindow: "Chrome \u7A97\u53E3",
    browserWindowDesc: "\u6253\u5F00\u4E00\u4E2A\u7531\u8FD9\u91CC\u7BA1\u7406\u7684 Chrome \u7A97\u53E3\uFF0C\u4E0D\u4F1A\u5360\u7528\u4F60\u6B63\u5728\u4F7F\u7528\u7684\u90A3\u4E2A Chrome\u3002",
    browserUse: "\u53E6\u4E00\u4E2A\u6D4F\u89C8\u5668\u7A97\u53E3",
    browserUseDesc: "\u518D\u5F00\u4E00\u4E2A\u4E92\u4E0D\u5E72\u6270\u7684\u7A97\u53E3\uFF0C\u9002\u5408\u5355\u72EC\u7684\u7F51\u9875\u4EFB\u52A1\u3002",
    back: "\u8FD4\u56DE\u5BF9\u8BDD",
    saving: "\u6B63\u5728\u4FDD\u5B58\u2026",
    saved: "\u5DF2\u4FDD\u5B58",
    loadError: "\u8BBE\u7F6E\u6CA1\u6709\u8BFB\u51FA\u6765\u3002",
    saveError: "\u8BBE\u7F6E\u6CA1\u6709\u4FDD\u5B58\u3002"
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
    saving: "Saving\u2026",
    saved: "Saved",
    loadError: "The settings could not be read.",
    saveError: "The settings could not be saved."
  }
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
    body: JSON.stringify(value)
  });
  if (!response.ok) throw new Error("save");
  return response.json();
}
function Icon() {
  return h(
    "svg",
    { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, "aria-hidden": true },
    h("rect", { x: 3, y: 4, width: 18, height: 12, rx: 2 }),
    h("path", { d: "M8 20h8M12 16v4" })
  );
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
      width: 44,
      height: 26,
      borderRadius: 13,
      border: 0,
      padding: 2,
      cursor: disabled ? "default" : "pointer",
      background: checked ? "var(--dsw-alias-state-business-primary, #3b82f6)" : "var(--dsw-alias-interactive-bg-hover, #3a3a3a)",
      display: "flex",
      alignItems: "center",
      justifyContent: checked ? "flex-end" : "flex-start"
    }
  }, h("span", { style: { width: 22, height: 22, borderRadius: 11, background: "#fff", display: "block" } }));
}
function Row({ title, description, control }) {
  return h(
    "div",
    { style: { display: "flex", gap: 16, alignItems: "center", padding: "14px 0" } },
    h(
      "div",
      { style: { flex: 1, minWidth: 0 } },
      h("div", { style: { fontSize: 15, fontWeight: 600 } }, title),
      description ? h("div", { style: { marginTop: 4, fontSize: 13, lineHeight: 1.45, color: "var(--dsw-alias-fg-secondary, #a3a3a3)" } }, description) : null
    ),
    control
  );
}
function Page({ getLocale, returnToConversation }) {
  const text = copyFor(getLocale?.());
  const [settings, setSettings] = import_react.default.useState(null);
  const [draft, setDraft] = import_react.default.useState("");
  const [status, setStatus] = import_react.default.useState("");
  const [error, setError] = import_react.default.useState("");
  import_react.default.useEffect(() => {
    let live = true;
    loadSettings().then((value) => {
      if (live) setSettings(value);
    }).catch(() => {
      if (live) setError(text.loadError);
    });
    return () => {
      live = false;
    };
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
  return h(
    "section",
    { style: { padding: "28px 32px", maxWidth: 760, color: "var(--dsw-alias-fg-primary, inherit)" } },
    h("h1", { style: { margin: "0 0 8px", fontSize: 28, fontWeight: 650 } }, text.title),
    h("p", { style: { margin: "0 0 24px", color: "var(--dsw-alias-fg-secondary, #a3a3a3)" } }, text.subtitle),
    !settings ? h("p", null, error || "\u2026") : h(
      "div",
      { style: { display: "grid", gap: 18 } },
      h(
        "section",
        { style: cardStyle },
        h("h2", { style: headingStyle }, text.computer),
        Row({ title: text.anyApp, description: text.anyAppDesc, control: h(Switch, { checked: settings.anyApp, label: text.anyApp, onChange: () => toggle("anyApp") }) }),
        settings.anyApp ? null : h(
          "div",
          { style: { borderTop: "1px solid var(--dsw-alias-border-subtle, #2e2e2e)", paddingTop: 12 } },
          h("div", { style: { fontSize: 15, fontWeight: 600 } }, text.allowed),
          h("div", { style: { margin: "4px 0 10px", fontSize: 13, color: "var(--dsw-alias-fg-secondary, #a3a3a3)" } }, text.allowedDesc),
          h(
            "div",
            { style: { display: "flex", gap: 8 } },
            h("input", { value: draft, placeholder: text.placeholder, onChange: (event) => setDraft(event.target.value), onKeyDown: (event) => {
              if (event.key === "Enter") addApp();
            }, style: inputStyle }),
            h("button", { type: "button", onClick: addApp, style: buttonStyle }, text.add)
          ),
          settings.allowedApps.length === 0 ? h("p", { style: { color: "var(--dsw-alias-fg-secondary, #a3a3a3)" } }, text.empty) : h(
            "ul",
            { style: { listStyle: "none", padding: 0, margin: "10px 0 0" } },
            settings.allowedApps.map((name) => h(
              "li",
              { key: name, style: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0" } },
              h("span", null, name),
              h("button", { type: "button", onClick: () => removeApp(name), style: buttonStyle }, text.remove)
            ))
          )
        )
      ),
      h(
        "section",
        { style: cardStyle },
        h("h2", { style: headingStyle }, text.browser),
        Row({ title: text.browserWindow, description: text.browserWindowDesc, control: h(Switch, { checked: settings.browserEnabled, label: text.browserWindow, onChange: () => toggle("browserEnabled") }) }),
        h(
          "div",
          { style: { borderTop: "1px solid var(--dsw-alias-border-subtle, #2e2e2e)" } },
          Row({ title: text.browserUse, description: text.browserUseDesc, control: h(Switch, { checked: settings.browserUseEnabled, label: text.browserUse, onChange: () => toggle("browserUseEnabled") }) })
        )
      ),
      h(
        "div",
        { style: { display: "flex", gap: 12, alignItems: "center" } },
        h("button", { type: "button", onClick: returnToConversation, style: buttonStyle }, text.back),
        status ? h("span", { style: { color: "var(--dsw-alias-fg-secondary, #a3a3a3)" } }, status) : null,
        error ? h("span", null, error) : null
      )
    )
  );
}
var cardStyle = { padding: "4px 18px 8px", borderRadius: 12, background: "var(--dsw-alias-bg-layer-1, #1c1c1c)", border: "1px solid var(--dsw-alias-border-subtle, #2e2e2e)" };
var headingStyle = { margin: "14px 0 0", fontSize: 13, fontWeight: 650, letterSpacing: "0.04em", textTransform: "none", color: "var(--dsw-alias-fg-secondary, #a3a3a3)" };
var buttonStyle = { height: 32, padding: "0 12px", borderRadius: 8, border: "1px solid var(--dsw-alias-border-subtle, #3a3a3a)", background: "transparent", color: "inherit", cursor: "pointer" };
var inputStyle = { flex: 1, height: 32, padding: "0 10px", borderRadius: 8, border: "1px solid var(--dsw-alias-border-subtle, #3a3a3a)", background: "transparent", color: "inherit" };
var inject = ["slots", "layout", "locale"];
function apply(ctx) {
  const label = () => {
    try {
      return String(ctx.locale.getLocale().active).toLowerCase().startsWith("en") ? "Computer and browser" : "\u7535\u8111\u64CD\u4F5C";
    } catch {
      return "\u7535\u8111\u64CD\u4F5C";
    }
  };
  ctx.slots.inject("sidebar.panellist", () => ctx.slots.register({
    name: "sidebar.panellist",
    id: "dsh-codex-tools",
    order: 46,
    label
  }, Icon));
  ctx.slots.inject("main", () => ctx.slots.register({
    name: "main",
    key: "dsh-codex-tools",
    inject: () => ({
      getLocale: () => {
        try {
          return ctx.locale.getLocale().active;
        } catch {
          return "zh";
        }
      },
      returnToConversation: () => ctx.layout.selectPanel(null)
    })
  }, Page));
}
return module.exports;}});
