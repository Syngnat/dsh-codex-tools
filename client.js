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
    tabs: ["\u7535\u8111\u64CD\u63A7", "\u6D4F\u89C8\u5668"],
    computerTitle: "\u7535\u8111\u64CD\u63A7",
    computerSubtitle: "\u7BA1\u7406\u5982\u4F55\u64CD\u4F5C\u4F60\u7535\u8111\u4E0A\u7684\u5176\u4ED6\u5E94\u7528\u7A0B\u5E8F\u3002",
    control: "\u63A7\u5236",
    anyApp: "\u4EFB\u610F\u5E94\u7528",
    anyAppDesc: "\u5141\u8BB8\u64CD\u4F5C\u4F60\u7535\u8111\u4E0A\u7684\u5E94\u7528\u3002",
    chrome: "Google Chrome",
    chromeDesc: "\u4F7F\u7528\u72EC\u7ACB\u7684 Chrome \u7A97\u53E3\uFF0C\u4E0D\u5360\u7528\u4F60\u6B63\u5728\u4F7F\u7528\u7684 Chrome\u3002",
    excel: "Microsoft Excel",
    excelDesc: "\u6CA1\u6709 Excel \u52A0\u8F7D\u9879\uFF0C\u4E0D\u80FD\u9760\u8FD9\u4E00\u9879\u83B7\u5F97\u66F4\u591A\u63A7\u5236\u3002",
    locked: "\u9501\u5C4F\u64CD\u4F5C",
    lockedDesc: "\u5F53\u524D\u4E0D\u80FD\u5728 Mac \u9501\u5B9A\u540E\u7EE7\u7EED\u64CD\u4F5C\u3002",
    unavailable: "\u4E0D\u53EF\u7528",
    allowed: "\u59CB\u7EC8\u5141\u8BB8\u7684\u5E94\u7528",
    allowedEmpty: "\u8FD8\u6CA1\u6709\u59CB\u7EC8\u5141\u8BB8\u7684\u5E94\u7528\u3002\u5173\u95ED\u4EFB\u610F\u5E94\u7528\u540E\uFF0C\u53EA\u6709\u8FD9\u91CC\u5217\u51FA\u7684\u5E94\u7528\u53EF\u4EE5\u88AB\u64CD\u4F5C\u3002",
    add: "\u6DFB\u52A0",
    placeholder: "\u5E94\u7528\u540D\u79F0\u6216\u6807\u8BC6\uFF0C\u4F8B\u5982 Safari\u3001com.apple.Safari",
    remove: "\u79FB\u9664",
    browserTitle: "\u6D4F\u89C8\u5668",
    browserSubtitle: "\u7BA1\u7406\u6D4F\u89C8\u5668\u7A97\u53E3\u7684\u504F\u597D\u548C\u8BBF\u95EE\u8303\u56F4\u3002",
    browserCard: "\u6D4F\u89C8\u5668",
    browserCardDesc: "\u5141\u8BB8\u64CD\u4F5C\u8FD9\u4E2A\u6D4F\u89C8\u5668\u7A97\u53E3\u3002",
    general: "\u5E38\u89C4",
    webTarget: "\u7F51\u9875 URL \u548C\u94FE\u63A5\u6253\u5F00\u4F4D\u7F6E",
    webTargetDesc: "\u4ECE\u9875\u9762\u70B9\u5F00\u7684\u94FE\u63A5\u9ED8\u8BA4\u53BB\u54EA\u91CC\u3002",
    localTarget: "\u672C\u5730 URL \u6253\u5F00\u4F4D\u7F6E",
    localTargetDesc: "\u672C\u673A\u5730\u5740\u9ED8\u8BA4\u53BB\u54EA\u91CC\u3002",
    targetApp: "\u8FD9\u4E2A\u7A97\u53E3",
    targetSystem: "\u7CFB\u7EDF\u6D4F\u89C8\u5668",
    fullUrl: "\u663E\u793A\u5B8C\u6574\u7F51\u5740",
    fullUrlDesc: "\u5728\u5730\u5740\u91CC\u4FDD\u7559\u8DEF\u5F84\u3001\u67E5\u8BE2\u53C2\u6570\u548C\u7247\u6BB5\u3002",
    browsingData: "\u6D4F\u89C8\u6570\u636E",
    browsingDataDesc: "\u6E05\u9664\u8FD9\u4E24\u4E2A\u7A97\u53E3\u91CC\u7684\u6D4F\u89C8\u5386\u53F2\u3001\u7F51\u7AD9\u6570\u636E\u548C\u7F13\u5B58\u3002",
    clear: "\u6E05\u9664\u6D4F\u89C8\u6570\u636E",
    cleared: "\u5DF2\u6E05\u9664",
    history: "\u6D4F\u89C8\u5386\u53F2",
    historyDesc: "\u5386\u53F2\u7559\u5728\u5BF9\u5E94\u7684 Chrome \u914D\u7F6E\u91CC\uFF0C\u8FD9\u91CC\u6CA1\u6709\u5355\u72EC\u7684\u5386\u53F2\u9875\u3002",
    annotation: "\u6279\u6CE8\u622A\u56FE",
    annotationDesc: "\u622A\u56FE\u53EF\u4EE5\u5E2E\u52A9\u7406\u89E3\u9875\u9762\uFF0C\u4F46\u4F1A\u589E\u52A0\u4E0A\u4E0B\u6587\u7528\u91CF\u3002",
    annotationAlways: "\u59CB\u7EC8\u5305\u542B",
    annotationDrag: "\u4EC5\u5728\u62D6\u9009\u65F6",
    autofill: "\u81EA\u52A8\u586B\u5145\u548C\u5BC6\u7801",
    passwords: "\u5BC6\u7801\u7BA1\u7406\u5668",
    passwordsDesc: "\u5BC6\u7801\u4E0D\u7531\u8FD9\u4E2A\u63D2\u4EF6\u4FDD\u5B58\u3002",
    contacts: "\u8054\u7CFB\u4FE1\u606F",
    contactsDesc: "\u8054\u7CFB\u4FE1\u606F\u4E0D\u7531\u8FD9\u4E2A\u63D2\u4EF6\u4FDD\u5B58\u3002",
    extensions: "\u6269\u5C55\u7A0B\u5E8F",
    extensionManager: "\u6269\u5C55\u7A0B\u5E8F\u7BA1\u7406\u5668",
    extensionDesc: "\u4E0D\u4F7F\u7528\u6D4F\u89C8\u5668\u6269\u5C55\u3002Chrome \u7A97\u53E3\u7531\u8FD9\u91CC\u76F4\u63A5\u63A7\u5236\u3002",
    downloads: "\u4E0B\u8F7D",
    downloadLocation: "\u4F4D\u7F6E",
    downloadLocationDesc: "\u6587\u4EF6\u4FDD\u5B58\u5230\u7CFB\u7EDF\u4E0B\u8F7D\u76EE\u5F55\u3002",
    change: "\u66F4\u6539",
    askSave: "\u4E0B\u8F7D\u524D\u8BE2\u95EE\u4FDD\u5B58\u4F4D\u7F6E",
    askSaveDesc: "\u5BF9\u8FD9\u91CC\u53D1\u8D77\u7684\u4E0B\u8F7D\u663E\u793A\u4FDD\u5B58\u5BF9\u8BDD\u6846\u3002\u5F53\u524D\u4ECD\u4F7F\u7528\u7CFB\u7EDF\u4E0B\u8F7D\u76EE\u5F55\u3002",
    downloadHistory: "\u4E0B\u8F7D\u5386\u53F2\u8BB0\u5F55",
    downloadHistoryDesc: "\u4E0B\u8F7D\u8BB0\u5F55\u7559\u5728 Chrome \u914D\u7F6E\u91CC\u3002",
    permissions: "\u6D4F\u89C8\u5668\u6743\u9650",
    siteSettings: "\u7F51\u7AD9\u8BBE\u7F6E",
    siteSettingsDesc: "\u6444\u50CF\u5934\u548C\u9EA6\u514B\u98CE\u6CBF\u7528 Chrome \u81EA\u5DF1\u7684\u7F51\u7AD9\u8BBE\u7F6E\u3002",
    historyAccess: "\u5386\u53F2\u8BB0\u5F55",
    historyAccessDesc: "\u662F\u5426\u5141\u8BB8\u8BFB\u53D6\u6D4F\u89C8\u5668\u5386\u53F2\u3002",
    always: "\u59CB\u7EC8\u5141\u8BB8",
    ask: "\u6BCF\u6B21\u8BE2\u95EE",
    deny: "\u62D2\u7EDD",
    siteTools: "\u9ED8\u8BA4\u4F7F\u7528\u7F51\u7AD9\u5DE5\u5177",
    siteToolsDesc: "\u5141\u8BB8\u53D1\u73B0\u5E76\u8C03\u7528\u7F51\u9875\u58F0\u660E\u7684\u5DE5\u5177\uFF0C\u9664\u975E\u7F51\u7AD9\u81EA\u5DF1\u5173\u6389\u3002",
    siteRules: "\u7F51\u7AD9\u6743\u9650",
    siteRulesDesc: "\u9ED8\u8BA4\u6743\u9650\u3002\u5355\u72EC\u4F8B\u5916\u8FD8\u6CA1\u6709\u6309\u7F51\u7AD9\u751F\u6548\u3002",
    developer: "\u5F00\u53D1\u8005\u6A21\u5F0F",
    risk: "\u98CE\u9669\u5347\u9AD8",
    fullCdp: "\u542F\u7528\u5B8C\u6574 CDP \u8BBF\u95EE\u6743\u9650",
    fullCdpDesc: "\u5173\u95ED\u540E\uFF0C\u6D4F\u89C8\u5668\u64CD\u4F5C\u4F1A\u505C\u6B62\u3002\u5B8C\u6574\u8BBF\u95EE\u53EF\u4EE5\u68C0\u67E5\u5E76\u63A7\u5236\u6D4F\u89C8\u5668\u5185\u90E8\u529F\u80FD\u3002",
    back: "\u8FD4\u56DE\u5BF9\u8BDD",
    saving: "\u6B63\u5728\u4FDD\u5B58\u2026",
    saved: "\u5DF2\u4FDD\u5B58",
    loadError: "\u8BBE\u7F6E\u6CA1\u6709\u8BFB\u51FA\u6765\u3002",
    saveError: "\u8BBE\u7F6E\u6CA1\u6709\u4FDD\u5B58\u3002",
    clearError: "\u6D4F\u89C8\u6570\u636E\u6CA1\u6709\u6E05\u9664\u3002"
  }
};
function textFor(language) {
  return COPY.zh;
}
async function request(body) {
  const response = await fetch(PATH, {
    method: body ? "POST" : "GET",
    credentials: "same-origin",
    headers: body ? { "content-type": "application/json" } : void 0,
    body: body ? JSON.stringify(body) : void 0
  });
  if (!response.ok) throw new Error("request");
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
var pageStyle = { padding: "28px 32px 48px", maxWidth: 760, color: "var(--dsw-alias-fg-primary, #f5f5f5)" };
var titleStyle = { margin: "0 0 6px", fontSize: 28, fontWeight: 650 };
var subtitleStyle = { margin: "0 0 22px", color: "var(--dsw-alias-fg-secondary, #a3a3a3)", fontSize: 14 };
var labelStyle = { margin: "18px 0 8px", fontSize: 13, color: "var(--dsw-alias-fg-secondary, #a3a3a3)" };
var cardStyle = { borderRadius: 14, background: "var(--dsw-alias-bg-layer-1, #242424)", border: "1px solid var(--dsw-alias-border-subtle, #333)", overflow: "hidden" };
var rowStyle = { display: "flex", gap: 14, alignItems: "center", padding: "14px 16px" };
var nameStyle = { fontSize: 15, fontWeight: 600 };
var descStyle = { marginTop: 3, fontSize: 13, lineHeight: 1.4, color: "var(--dsw-alias-fg-secondary, #a3a3a3)" };
var hairline = { height: 1, background: "var(--dsw-alias-border-subtle, #333)" };
var controlStyle = { height: 30, padding: "0 12px", borderRadius: 8, border: 0, background: "var(--dsw-alias-interactive-bg-hover, #333)", color: "inherit", cursor: "pointer" };
function Switch({ checked, label, disabled, onChange }) {
  return h("button", {
    type: "button",
    role: "switch",
    "aria-checked": checked ? "true" : "false",
    "aria-label": label,
    disabled,
    onClick: () => onChange(!checked),
    style: { width: 42, height: 24, borderRadius: 12, border: 0, padding: 2, flex: "none", cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.45 : 1, background: checked ? "var(--dsw-alias-state-business-primary, #3b82f6)" : "#5a5a5a", display: "flex", alignItems: "center", justifyContent: checked ? "flex-end" : "flex-start" }
  }, h("span", { style: { width: 20, height: 20, borderRadius: 10, background: "#fff", display: "block" } }));
}
function Row({ title, description, control }) {
  return h(
    "div",
    { style: rowStyle },
    h("div", { style: { flex: 1, minWidth: 0 } }, h("div", { style: nameStyle }, title), description ? h("div", { style: descStyle }, description) : null),
    control
  );
}
function Select({ value, label, options, onChange }) {
  return h(
    "select",
    { "aria-label": label, value, onChange: (event) => onChange(event.target.value), style: { ...controlStyle, maxWidth: 160 } },
    options.map(([id, name]) => h("option", { key: id, value: id }, name))
  );
}
function Page({ returnToConversation }) {
  const text = textFor();
  const [tab, setTab] = import_react.default.useState(0);
  const [settings, setSettings] = import_react.default.useState(null);
  const [draft, setDraft] = import_react.default.useState("");
  const [status, setStatus] = import_react.default.useState("");
  const [error, setError] = import_react.default.useState("");
  import_react.default.useEffect(() => {
    let live = true;
    request().then((value) => {
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
      setSettings(await request(next));
      setStatus(text.saved);
    } catch {
      setError(text.saveError);
      setStatus("");
    }
  }
  function patch(key, value) {
    if (settings) void commit({ ...settings, [key]: value });
  }
  async function clearData() {
    setStatus(text.saving);
    setError("");
    try {
      const value = await request({ action: "clear-browsing-data" });
      setSettings(value);
      setStatus(text.cleared);
    } catch {
      setError(text.clearError);
      setStatus("");
    }
  }
  if (!settings) return h("section", { style: pageStyle }, h("h1", { style: titleStyle }, text.computerTitle), h("p", null, error || "\u2026"));
  const accessOptions = [["always", text.always], ["ask", text.ask], ["deny", text.deny]];
  const targetOptions = [["app", text.targetApp], ["system", text.targetSystem]];
  return h(
    "section",
    { style: pageStyle },
    h("div", { style: { display: "flex", gap: 8, marginBottom: 18 } }, text.tabs.map((name, index) => h("button", { key: name, type: "button", onClick: () => setTab(index), style: { ...controlStyle, background: tab === index ? "var(--dsw-alias-interactive-bg-hover, #333)" : "transparent", border: "1px solid var(--dsw-alias-border-subtle, #333)" } }, name))),
    tab === 0 ? h(
      "div",
      null,
      h("h1", { style: titleStyle }, text.computerTitle),
      h("p", { style: subtitleStyle }, text.computerSubtitle),
      h("div", { style: labelStyle }, text.control),
      h(
        "div",
        { style: cardStyle },
        Row({ title: text.anyApp, description: text.anyAppDesc, control: h(Switch, { checked: settings.anyApp, label: text.anyApp, onChange: (value) => patch("anyApp", value) }) }),
        h("div", { style: hairline }),
        Row({ title: text.chrome, description: text.chromeDesc, control: h(Switch, { checked: settings.browserEnabled, label: text.chrome, onChange: (value) => patch("browserEnabled", value) }) }),
        h("div", { style: hairline }),
        Row({ title: text.excel, description: text.excelDesc, control: h("span", { style: descStyle }, text.unavailable) }),
        h("div", { style: { height: 10 } }),
        h("div", { style: cardStyle }, Row({ title: text.locked, description: text.lockedDesc, control: h("span", { style: descStyle }, text.unavailable) }))
      ),
      h("div", { style: labelStyle }, text.allowed),
      h(
        "div",
        { style: cardStyle },
        settings.allowedApps.length === 0 ? h("div", { style: { ...descStyle, padding: 16 } }, text.allowedEmpty) : settings.allowedApps.map((name, index) => h(
          "div",
          { key: name },
          index > 0 ? h("div", { style: hairline }) : null,
          h(
            "div",
            { style: rowStyle },
            h("div", { style: { width: 28, height: 28, borderRadius: 8, background: "#333", display: "grid", placeItems: "center", flex: "none" } }, name.slice(0, 1).toUpperCase()),
            h("div", { style: { flex: 1 } }, name),
            h("button", { type: "button", "aria-label": text.remove, onClick: () => patch("allowedApps", settings.allowedApps.filter((item) => item !== name)), style: { ...controlStyle, color: "#f87171" } }, "\u5220\u9664")
          )
        )),
        h("div", { style: hairline }),
        h(
          "div",
          { style: { display: "flex", gap: 8, padding: 12 } },
          h("input", { value: draft, placeholder: text.placeholder, onChange: (event) => setDraft(event.target.value), onKeyDown: (event) => {
            if (event.key === "Enter" && draft.trim()) {
              patch("allowedApps", [...settings.allowedApps, draft.trim()]);
              setDraft("");
            }
          }, style: { flex: 1, height: 32, borderRadius: 8, border: "1px solid var(--dsw-alias-border-subtle, #333)", background: "transparent", color: "inherit", padding: "0 10px" } }),
          h("button", { type: "button", onClick: () => {
            if (!draft.trim()) return;
            patch("allowedApps", [...settings.allowedApps, draft.trim()]);
            setDraft("");
          }, style: controlStyle }, text.add)
        )
      )
    ) : h(
      "div",
      null,
      h("h1", { style: titleStyle }, text.browserTitle),
      h("p", { style: subtitleStyle }, text.browserSubtitle),
      h("div", { style: { ...cardStyle, marginBottom: 8 } }, Row({ title: text.browserCard, description: text.browserCardDesc, control: h(Switch, { checked: settings.browserUseEnabled, label: text.browserCard, onChange: (value) => patch("browserUseEnabled", value) }) })),
      h("div", { style: { ...labelStyle, display: "flex", justifyContent: "space-between" } }, h("span", null, text.general)),
      h(
        "div",
        { style: cardStyle },
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
        Row({ title: text.annotation, description: text.annotationDesc, control: h(Select, { value: settings.annotationScreenshots, label: text.annotation, options: [["always", text.annotationAlways], ["drag", text.annotationDrag]], onChange: (value) => patch("annotationScreenshots", value) }) })
      ),
      h("div", { style: labelStyle }, text.autofill),
      h(
        "div",
        { style: cardStyle },
        Row({ title: text.passwords, description: text.passwordsDesc, control: h("span", { style: descStyle }, text.unavailable) }),
        h("div", { style: hairline }),
        Row({ title: text.contacts, description: text.contactsDesc, control: h("span", { style: descStyle }, text.unavailable) })
      ),
      h("div", { style: labelStyle }, text.extensions),
      h("div", { style: cardStyle }, Row({ title: text.extensionManager, description: text.extensionDesc, control: h("span", { style: descStyle }, text.unavailable) })),
      h("div", { style: labelStyle }, text.downloads),
      h(
        "div",
        { style: cardStyle },
        Row({ title: text.downloadLocation, description: text.downloadLocationDesc, control: h("span", { style: descStyle }, text.unavailable) }),
        h("div", { style: hairline }),
        Row({ title: text.askSave, description: text.askSaveDesc, control: h(Switch, { checked: settings.askDownloadLocation, label: text.askSave, onChange: (value) => patch("askDownloadLocation", value) }) }),
        h("div", { style: hairline }),
        Row({ title: text.downloadHistory, description: text.downloadHistoryDesc, control: h("span", { style: descStyle }, text.unavailable) })
      ),
      h("div", { style: labelStyle }, text.permissions),
      h(
        "div",
        { style: cardStyle },
        Row({ title: text.siteSettings, description: text.siteSettingsDesc, control: h("span", { style: descStyle }, text.unavailable) }),
        h("div", { style: hairline }),
        Row({ title: text.historyAccess, description: text.historyAccessDesc, control: h(Select, { value: settings.historyAccess, label: text.historyAccess, options: accessOptions, onChange: (value) => patch("historyAccess", value) }) }),
        h("div", { style: hairline }),
        Row({ title: text.siteTools, description: text.siteToolsDesc, control: h(Switch, { checked: settings.siteTools, label: text.siteTools, onChange: (value) => patch("siteTools", value) }) })
      ),
      h("div", { style: labelStyle }, text.siteRules),
      h("p", { style: { ...descStyle, marginTop: -4 } }, text.siteRulesDesc),
      h("div", { style: labelStyle }, text.developer),
      h("div", { style: cardStyle }, Row({ title: text.fullCdp, description: `${text.risk}\u3002${text.fullCdpDesc}`, control: h(Switch, { checked: settings.fullCdp, label: text.fullCdp, onChange: (value) => patch("fullCdp", value) }) }))
    ),
    h(
      "div",
      { style: { display: "flex", gap: 12, alignItems: "center", marginTop: 18 } },
      h("button", { type: "button", onClick: returnToConversation, style: controlStyle }, text.back),
      status ? h("span", { style: descStyle }, status) : null,
      error ? h("span", null, error) : null
    )
  );
}
var inject = ["slots", "layout", "locale"];
function apply(ctx) {
  const label = () => "\u7535\u8111\u64CD\u63A7";
  ctx.slots.inject("sidebar.panellist", () => ctx.slots.register({
    name: "sidebar.panellist",
    id: "dsh-codex-tools",
    order: 46,
    label
  }, Icon));
  ctx.slots.inject("main", () => ctx.slots.register({
    name: "main",
    key: "dsh-codex-tools",
    inject: () => ({ returnToConversation: () => ctx.layout.selectPanel(null) })
  }, Page));
}
return module.exports;}});
