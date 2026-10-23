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

// lib/format-time.mjs
var OFFSET_MS = 8 * 60 * 60 * 1e3;
var pad = (value) => String(value).padStart(2, "0");
function formatTimestamp(value) {
  const date = value instanceof Date ? value : new Date(value ?? Number.NaN);
  const time = date.getTime();
  if (!Number.isFinite(time)) return "";
  const shifted = new Date(time + OFFSET_MS);
  const day = `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
  const clock = `${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}:${pad(shifted.getUTCSeconds())}`;
  return `${day} ${clock} UTC+8`;
}

// client-entry.js
var h = import_react.default.createElement;
var PATH = "/api/dsh-codex-tools.settings";
var COPY = {
  zh: {
    tabs: ["\u7535\u8111\u64CD\u63A7", "\u6D4F\u89C8\u5668", "\u66F4\u65B0"],
    computerTitle: "\u7535\u8111\u64CD\u63A7",
    computerSubtitle: "\u7BA1\u7406\u5982\u4F55\u64CD\u4F5C\u4F60\u7535\u8111\u4E0A\u7684\u5176\u4ED6\u5E94\u7528\u7A0B\u5E8F\u3002",
    control: "\u63A7\u5236",
    anyApp: "\u4EFB\u610F\u5E94\u7528",
    anyAppDesc: "\u5141\u8BB8\u64CD\u4F5C\u4F60\u7535\u8111\u4E0A\u7684\u5E94\u7528\u3002",
    excel: "Microsoft Excel",
    excelDesc: "\u6253\u5F00\u540E\u53EF\u4EE5\u64CD\u4F5C Excel \u7A97\u53E3\u3002\u5173\u95ED\u540E\uFF0C\u5373\u4F7F\u6253\u5F00\u4E86\u4EFB\u610F\u5E94\u7528\uFF0C\u4E5F\u4E0D\u4F1A\u64CD\u4F5C Excel\u3002",
    locked: "\u9501\u5C4F\u64CD\u4F5C",
    lockedDesc: "\u5173\u95ED\u65F6\uFF0C\u68C0\u6D4B\u5230\u9501\u5C4F\u5C31\u62D2\u7EDD\u7535\u8111\u64CD\u63A7\u3002\u6253\u5F00\u540E\u4ECD\u4F1A\u5C1D\u8BD5\u5F53\u524D\u4F1A\u8BDD\uFF1B\u7CFB\u7EDF\u7684\u9501\u5C4F\u684C\u9762\u672C\u8EAB\u4E0D\u80FD\u4ECE\u8FD9\u91CC\u70B9\u8FDB\u53BB\u3002",
    lockedNow: "\u5F53\u524D\u5DF2\u9501\u5C4F",
    unlockedNow: "\u5F53\u524D\u672A\u9501\u5C4F",
    allowed: "\u59CB\u7EC8\u5141\u8BB8\u7684\u5E94\u7528",
    allowedEmpty: "\u8FD8\u6CA1\u6709\u59CB\u7EC8\u5141\u8BB8\u7684\u5E94\u7528\u3002\u5173\u95ED\u4EFB\u610F\u5E94\u7528\u540E\uFF0C\u53EA\u6709\u8FD9\u91CC\u5217\u51FA\u7684\u5E94\u7528\u53EF\u4EE5\u88AB\u64CD\u4F5C\u3002",
    add: "\u6DFB\u52A0",
    placeholder: "\u5E94\u7528\u540D\u79F0\u6216\u6807\u8BC6\uFF0C\u4F8B\u5982 notepad\u3001explorer",
    addMissing: "\u5148\u8F93\u5165\u5E94\u7528\u540D\u79F0\u6216\u6807\u8BC6\u3002",
    remove: "\u79FB\u9664",
    browserTitle: "\u6D4F\u89C8\u5668",
    browserSubtitle: "\u7BA1\u7406\u6D4F\u89C8\u5668\u7A97\u53E3\u7684\u504F\u597D\u548C\u8BBF\u95EE\u8303\u56F4\u3002",
    browserCard: "\u6D4F\u89C8\u5668",
    browserCardDesc: "\u4F7F\u7528\u72EC\u7ACB\u7684 Chrome \u7A97\u53E3\uFF0C\u4E0D\u5360\u7528\u4F60\u6B63\u5728\u4F7F\u7528\u7684 Chrome\u3002",
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
    browsingDataDesc: "\u6E05\u9664\u8FD9\u4E2A\u7A97\u53E3\u91CC\u7684\u6D4F\u89C8\u5386\u53F2\u3001\u7F51\u7AD9\u6570\u636E\u548C\u7F13\u5B58\u3002",
    clear: "\u6E05\u9664\u6D4F\u89C8\u6570\u636E",
    cleared: "\u5DF2\u6E05\u9664",
    history: "\u6D4F\u89C8\u5386\u53F2",
    historyDesc: "\u8FD9\u91CC\u5217\u51FA\u8FD9\u4E2A\u63D2\u4EF6\u6253\u5F00\u8FC7\u7684\u5730\u5740\u3002\u5386\u53F2\u8BB0\u5F55\u8BBE\u4E3A\u62D2\u7EDD\u540E\uFF0C\u4E0D\u518D\u8BB0\u4E0B\u65B0\u5730\u5740\u3002",
    historyEmpty: "\u8FD8\u6CA1\u6709\u8BB0\u5F55\u3002",
    clearHistory: "\u6E05\u9664\u8BB0\u5F55",
    annotation: "\u6279\u6CE8\u622A\u56FE",
    annotationDesc: "\u622A\u56FE\u4F1A\u5728\u56FE\u4E0A\u6807\u51FA\u6700\u540E\u4E00\u6B21\u70B9\u51FB\u6216\u62D6\u62FD\u7684\u4F4D\u7F6E\uFF0C\u65B9\u4FBF\u5BF9\u7167\u3002",
    annotationAlways: "\u59CB\u7EC8\u5305\u542B",
    annotationDrag: "\u4EC5\u5728\u62D6\u9009\u65F6",
    autofill: "\u81EA\u52A8\u586B\u5145\u548C\u5BC6\u7801",
    passwords: "\u5BC6\u7801\u7BA1\u7406\u5668",
    passwordsDesc: "\u6253\u5F00\u540E\uFF0C\u8FDB\u5165\u5DF2\u4FDD\u5B58\u7684\u7F51\u7AD9\u65F6\u586B\u5165\u7528\u6237\u540D\u548C\u5BC6\u7801\u3002\u5BC6\u7801\u53EA\u7559\u5728\u672C\u673A\uFF0C\u56DE\u590D\u91CC\u4E0D\u4F1A\u5199\u51FA\u5BC6\u7801\u3002",
    passwordOrigin: "\u7F51\u7AD9\uFF0C\u4F8B\u5982 https://example.com",
    passwordUser: "\u7528\u6237\u540D",
    passwordSecret: "\u5BC6\u7801",
    contacts: "\u8054\u7CFB\u4FE1\u606F",
    contactsDesc: "\u6253\u5F00\u540E\uFF0C\u8FDB\u5165\u9875\u9762\u65F6\u586B\u5165\u7A7A\u767D\u7684\u59D3\u540D\u3001\u90AE\u7BB1\u3001\u7535\u8BDD\u548C\u5730\u5740\u680F\u3002",
    contactName: "\u59D3\u540D",
    contactEmail: "\u90AE\u7BB1",
    contactPhone: "\u7535\u8BDD",
    contactAddress: "\u5730\u5740",
    saveContact: "\u4FDD\u5B58\u8054\u7CFB\u4FE1\u606F",
    extensions: "\u6269\u5C55\u7A0B\u5E8F",
    extensionManager: "\u6269\u5C55\u7A0B\u5E8F\u7BA1\u7406\u5668",
    extensionDesc: "\u5173\u95ED\u540E\uFF0C\u4E0B\u6B21\u6253\u5F00\u7A97\u53E3\u4E0D\u52A0\u8F7D\u4EFB\u4F55\u6269\u5C55\u3002\u672A\u6253\u5305\u7684\u76EE\u5F55\u4F1A\u5728\u4E0B\u6B21\u542F\u52A8\u65F6\u52A0\u8F7D\u3002",
    extensionEmpty: "\u8FD9\u4E2A\u7A97\u53E3\u91CC\u8FD8\u6CA1\u6709\u5DF2\u5B89\u88C5\u7684\u6269\u5C55\u3002",
    extensionStop: "\u505C\u7528",
    extensionStart: "\u542F\u7528",
    extensionHint: "\u505C\u7528\u4F1A\u628A\u6269\u5C55\u76EE\u5F55\u79FB\u51FA\u52A0\u8F7D\u8DEF\u5F84\uFF0C\u4E0B\u6B21\u6253\u5F00\u7A97\u53E3\u624D\u751F\u6548\u3002",
    downloads: "\u4E0B\u8F7D",
    downloadLocation: "\u4F4D\u7F6E",
    downloadLocationDesc: "\u5173\u95ED\u300C\u4E0B\u8F7D\u524D\u8BE2\u95EE\u300D\u65F6\uFF0C\u6587\u4EF6\u4FDD\u5B58\u5230\u8FD9\u91CC\u3002\u7559\u7A7A\u5219\u7528\u7CFB\u7EDF\u4E0B\u8F7D\u76EE\u5F55\u3002\u4E0B\u6B21\u6253\u5F00\u7A97\u53E3\u65F6\u751F\u6548\u3002",
    change: "\u66F4\u6539",
    askSave: "\u4E0B\u8F7D\u524D\u8BE2\u95EE\u4FDD\u5B58\u4F4D\u7F6E",
    askSaveDesc: "\u6253\u5F00\u540E\uFF0C\u4E0B\u8F7D\u65F6\u4F7F\u7528\u6D4F\u89C8\u5668\u81EA\u5DF1\u7684\u4FDD\u5B58\u5BF9\u8BDD\u6846\u3002",
    downloadHistory: "\u4E0B\u8F7D\u5386\u53F2\u8BB0\u5F55",
    downloadHistoryDesc: "\u8FD9\u4E2A\u7A97\u53E3\u5F00\u59CB\u7684\u4E0B\u8F7D\u4F1A\u5217\u5728\u8FD9\u91CC\u3002",
    permissions: "\u6D4F\u89C8\u5668\u6743\u9650",
    siteSettings: "\u7F51\u7AD9\u8BBE\u7F6E",
    siteSettingsDesc: "\u8FDB\u5165\u7F51\u9875\u65F6\uFF0C\u6309\u8FD9\u91CC\u7684\u9009\u62E9\u5141\u8BB8\u6216\u62D2\u7EDD\u3002\u6BCF\u6B21\u8BE2\u95EE\u5219\u6CBF\u7528 Chrome \u81EA\u5DF1\u7684\u63D0\u793A\u3002",
    camera: "\u6444\u50CF\u5934",
    microphone: "\u9EA6\u514B\u98CE",
    geolocation: "\u4F4D\u7F6E",
    notifications: "\u901A\u77E5",
    historyAccess: "\u5386\u53F2\u8BB0\u5F55",
    historyAccessDesc: "\u662F\u5426\u5141\u8BB8\u8BFB\u53D6\u6D4F\u89C8\u5668\u5386\u53F2\u3002",
    always: "\u59CB\u7EC8\u5141\u8BB8",
    ask: "\u6BCF\u6B21\u8BE2\u95EE",
    deny: "\u62D2\u7EDD",
    siteTools: "\u9ED8\u8BA4\u4F7F\u7528\u7F51\u7AD9\u5DE5\u5177",
    siteToolsUnavailable: "\u5F53\u524D Chrome \u8FD8\u6CA1\u6709\u7F51\u9875\u5DE5\u5177\u63A5\u53E3\uFF0C\u8FD9\u4E00\u9879\u65E0\u6CD5\u5F00\u542F\u3002",
    siteRules: "\u7F51\u7AD9\u6743\u9650",
    siteRulesDesc: "\u9ED8\u8BA4\u6743\u9650\u3002\u5355\u72EC\u4F8B\u5916\u8FD8\u6CA1\u6709\u6309\u7F51\u7AD9\u751F\u6548\u3002",
    developer: "\u5F00\u53D1\u8005\u6A21\u5F0F",
    risk: "\u98CE\u9669\u5347\u9AD8",
    fullCdp: "\u542F\u7528\u5B8C\u6574 CDP \u8BBF\u95EE\u6743\u9650",
    fullCdpDesc: "\u5173\u95ED\u540E\uFF0C\u6D4F\u89C8\u5668\u64CD\u4F5C\u4F1A\u505C\u6B62\u3002\u5B8C\u6574\u8BBF\u95EE\u53EF\u4EE5\u68C0\u67E5\u5E76\u63A7\u5236\u6D4F\u89C8\u5668\u5185\u90E8\u529F\u80FD\u3002",
    updateTitle: "\u66F4\u65B0",
    updateSubtitle: "\u68C0\u67E5 GitHub \u4E0A\u7684\u7A33\u5B9A\u7248\uFF0C\u786E\u8BA4\u540E\u66FF\u6362\u73B0\u5728\u88C5\u7684\u8FD9\u4E00\u4EFD\u3002",
    currentVersion: "\u5F53\u524D\u8FD0\u884C\u7248\u672C",
    installedVersion: "\u5DF2\u5B89\u88C5\u7248\u672C",
    latestVersion: "\u6700\u65B0\u7248\u672C",
    source: "\u5B89\u88C5\u6765\u6E90",
    check: "\u68C0\u67E5\u66F4\u65B0",
    checking: "\u6B63\u5728\u68C0\u67E5\u2026",
    install: "\u5B89\u88C5\u66F4\u65B0",
    installing: "\u6B63\u5728\u5B89\u88C5\u2026",
    consent: "\u6211\u786E\u8BA4\u7528 GitHub \u4E0A\u7684\u7A33\u5B9A\u7248\u66FF\u6362\u5F53\u524D\u5B89\u88C5",
    upToDate: "\u5DF2\u7ECF\u662F\u6700\u65B0\u7A33\u5B9A\u7248\u3002",
    hasUpdate: "\u6709\u65B0\u7248\u672C\u53EF\u4EE5\u5B89\u88C5\u3002",
    installUpdated: "\u5DF2\u66F4\u65B0\uFF0C\u5F53\u524D\u8FDB\u7A0B\u91CC\u5DF2\u7ECF\u662F\u65B0\u7248\u672C\u3002",
    installStart: "\u5F00\u59CB\u5B89\u88C5",
    targetCommit: "\u76EE\u6807\u63D0\u4EA4",
    releaseNotes: "\u66F4\u65B0\u8BF4\u660E",
    swapHint: "\u5B89\u88C5\u65F6\u63D2\u4EF6\u4F1A\u5148\u5378\u8F7D\u81EA\u5DF1\u518D\u88C5\u56DE\u6765\uFF0C\u9875\u9762\u53EF\u80FD\u77ED\u6682\u6D88\u5931\uFF1B\u56DE\u6765\u540E\u8FD9\u91CC\u4F1A\u663E\u793A\u7ED3\u679C\u3002",
    notChecked: "\u8FD8\u6CA1\u6709\u68C0\u67E5\u8FC7",
    lastCheck: "\u4E0A\u6B21\u68C0\u67E5",
    replacing: "\u63D2\u4EF6\u6B63\u5728\u66FF\u6362\u4E2D\u2026",
    phaseLabels: {
      queued: "\u6392\u961F\u4E2D",
      checking: "\u6838\u5BF9\u5F53\u524D\u5B89\u88C5",
      removing: "\u5378\u8F7D\u65E7\u7248\u672C",
      installing: "\u5B89\u88C5\u65B0\u7248\u672C",
      activating: "\u542F\u7528\u65B0\u7248\u672C",
      verifying: "\u786E\u8BA4\u65B0\u7248\u672C\u5DF2\u751F\u6548",
      recovering: "\u51FA\u9519\uFF0C\u6B63\u5728\u6062\u590D\u65E7\u7248\u672C",
      updated: "\u66F4\u65B0\u5B8C\u6210\uFF0C\u65B0\u7248\u672C\u5DF2\u7ECF\u81EA\u5DF1\u52A0\u8F7D\u56DE\u6765\u4E86",
      "restart-required": "\u66F4\u65B0\u5B8C\u6210\uFF0C\u9700\u8981\u5B8C\u5168\u9000\u51FA\u5E76\u91CD\u65B0\u6253\u5F00 DeepSeek Harness",
      restored: "\u66F4\u65B0\u5931\u8D25\uFF0C\u5DF2\u6062\u590D\u65E7\u7248\u672C",
      "repair-required": "\u66F4\u65B0\u5931\u8D25\uFF0C\u81EA\u52A8\u6062\u590D\u4E5F\u5931\u8D25\uFF0C\u8BF7\u624B\u52A8\u91CD\u88C5",
      failed: "\u66F4\u65B0\u5931\u8D25",
      cancelled: "\u5DF2\u53D6\u6D88",
      unknown: "\u72B6\u6001\u672A\u77E5"
    },
    installRestart: "\u5B89\u88C5\u5B8C\u6210\u3002\u8BF7\u5B8C\u5168\u9000\u51FA\u5E76\u91CD\u65B0\u6253\u5F00 DeepSeek Harness\u3002",
    installRestored: "\u66F4\u65B0\u5931\u8D25\uFF0C\u5DF2\u6062\u590D\u4E0A\u4E00\u7248\u672C\u3002",
    installRepair: "\u66F4\u65B0\u5931\u8D25\uFF0C\u81EA\u52A8\u6062\u590D\u4E5F\u5931\u8D25\uFF0C\u8BF7\u7528\u547D\u4EE4\u884C\u91CD\u65B0\u5B89\u88C5\u3002",
    cannotUpdate: "\u8FD9\u91CC\u4E0D\u80FD\u5728\u7EBF\u66F4\u65B0",
    reasonUnsupportedSource: "\u73B0\u5728\u88C5\u7684\u4E0D\u662F\u4ECE GitHub \u6765\u7684\u90A3\u4E00\u4EFD\u3002",
    reasonRestartRequired: "\u5DF2\u7ECF\u88C5\u4E0A\u65B0\u7248\u672C\uFF0C\u91CD\u542F\u540E\u624D\u4F1A\u8FD0\u884C\u3002",
    restartPending: "\u5DF2\u7ECF\u88C5\u597D {version}\u3002\u5B8C\u5168\u9000\u51FA\u5E76\u91CD\u65B0\u6253\u5F00 DeepSeek Harness \u540E\u751F\u6548\uFF0C\u5173\u6389\u7A97\u53E3\u4E0D\u7B97\u3002",
    reasonDisabled: "\u63D2\u4EF6\u5F53\u524D\u662F\u7981\u7528\u72B6\u6001\u3002",
    reasonNotInstalled: "\u6CA1\u6709\u5728\u63D2\u4EF6\u5217\u8868\u91CC\u627E\u5230\u8FD9\u4E2A\u63D2\u4EF6\u3002",
    reasonUnsupportedVersion: "\u7248\u672C\u53F7\u4E0D\u662F\u6807\u51C6\u7A33\u5B9A\u7248\u3002",
    reasonInstallationError: "\u8FD9\u6B21\u5B89\u88C5\u672C\u8EAB\u6709\u95EE\u9898\u3002",
    reasonUnsupportedInstallation: "\u8FD9\u4E2A\u5B89\u88C5\u4F4D\u7F6E\u4E0D\u652F\u6301\u5728\u7EBF\u66FF\u6362\u3002",
    reasonManagerUnavailable: "\u63D2\u4EF6\u7BA1\u7406\u670D\u52A1\u8FD8\u6CA1\u51C6\u5907\u597D\u3002",
    reasonServiceUnavailable: "\u63D2\u4EF6\u7BA1\u7406\u670D\u52A1\u8FD8\u6CA1\u51C6\u5907\u597D\uFF0C\u7A0D\u540E\u518D\u8BD5\u3002",
    checkFailed: "\u68C0\u67E5\u6CA1\u6709\u6210\u529F\uFF0C\u7A0D\u540E\u518D\u8BD5\u3002",
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
var pageStyle = { boxSizing: "border-box", width: "100%", height: "100%", maxHeight: "100vh", overflowY: "auto", overflowX: "hidden", color: "var(--dsw-alias-label-primary, #1a1a1a)" };
var frameStyle = { boxSizing: "border-box", maxWidth: 760, padding: "28px 32px 48px" };
var titleStyle = { margin: "0 0 6px", fontSize: 28, fontWeight: 650 };
var subtitleStyle = { margin: "0 0 22px", color: "var(--dsw-alias-label-secondary, #5c6570)", fontSize: 14 };
var labelStyle = { margin: "18px 0 8px", fontSize: 13, color: "var(--dsw-alias-label-secondary, #5c6570)" };
var cardStyle = { borderRadius: 14, background: "var(--dsw-alias-bg-layer-1, #ffffff)", border: "1px solid var(--dsw-alias-border-l2, #e4e4e4)", overflow: "hidden" };
var rowStyle = { display: "flex", gap: 14, alignItems: "center", padding: "14px 16px" };
var nameStyle = { fontSize: 15, fontWeight: 600 };
var descStyle = { marginTop: 3, fontSize: 13, lineHeight: 1.4, color: "var(--dsw-alias-label-secondary, #5c6570)" };
var hairline = { height: 1, background: "var(--dsw-alias-border-l2, #e4e4e4)" };
var controlStyle = { height: 30, padding: "0 12px", borderRadius: 8, border: 0, background: "var(--dsw-alias-interactive-bg-hover, #f2f3f5)", color: "inherit", cursor: "pointer" };
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
  const draftRef = import_react.default.useRef("");
  const [addHint, setAddHint] = import_react.default.useState("");
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
    patch("allowedApps", [...settings.allowedApps ?? [], name]);
    rememberDraft("");
  }
  const [login, setLogin] = import_react.default.useState({ origin: "", username: "", password: "" });
  const [contactDraft, setContactDraft] = import_react.default.useState({ name: "", email: "", phone: "", address: "" });
  const [downloadDir, setDownloadDir] = import_react.default.useState("");
  const [status, setStatus] = import_react.default.useState("");
  const [error, setError] = import_react.default.useState("");
  import_react.default.useEffect(() => {
    let live = true;
    request().then((value) => {
      if (!live) return;
      setSettings(value);
      setContactDraft(value.contact ?? { name: "", email: "", phone: "", address: "" });
      setDownloadDir(value.downloadDirectory ?? "");
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
      const value = await request(next);
      setSettings(value);
      if (value.contact) setContactDraft(value.contact);
      if (typeof value.downloadDirectory === "string") setDownloadDir(value.downloadDirectory);
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
  if (!settings) return h("section", { style: pageStyle }, h("div", { style: frameStyle }, h("h1", { style: titleStyle }, text.computerTitle), h("p", null, error || "\u2026")));
  const accessOptions = [["always", text.always], ["ask", text.ask], ["deny", text.deny]];
  const targetOptions = [["app", text.targetApp], ["system", text.targetSystem]];
  return h("section", { style: pageStyle }, h(
    "div",
    { style: frameStyle },
    h("div", { style: { display: "flex", gap: 8, marginBottom: 18 } }, text.tabs.map((name, index) => h("button", { key: name, type: "button", onClick: () => setTab(index), style: { ...controlStyle, background: tab === index ? "var(--dsw-alias-interactive-bg-hover, #f2f3f5)" : "transparent", border: "1px solid var(--dsw-alias-border-l2, #e4e4e4)" } }, name))),
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
        Row({ title: text.excel, description: text.excelDesc, control: h(Switch, { checked: settings.excelEnabled !== false, label: text.excel, onChange: (value) => patch("excelEnabled", value) }) }),
        h("div", { style: { height: 10 } }),
        h("div", { style: cardStyle }, Row({ title: text.locked, description: `${text.lockedDesc} ${settings.sessionLocked ? text.lockedNow : text.unlockedNow}`, control: h(Switch, { checked: settings.lockScreen === true, label: text.locked, onChange: (value) => patch("lockScreen", value) }) }))
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
            h("div", { style: { width: 28, height: 28, borderRadius: 8, background: "var(--dsw-alias-interactive-bg-active, #e8eaed)", color: "var(--dsw-alias-label-primary, #1a1a1a)", display: "grid", placeItems: "center", flex: "none" } }, name.slice(0, 1).toUpperCase()),
            h("div", { style: { flex: 1 } }, name),
            h("button", { type: "button", "aria-label": text.remove, onClick: () => patch("allowedApps", settings.allowedApps.filter((item) => item !== name)), style: { ...controlStyle, color: "#f87171" } }, "\u5220\u9664")
          )
        )),
        h("div", { style: hairline }),
        h(
          "div",
          { style: { display: "flex", gap: 8, padding: 12 } },
          h("input", { value: draft, placeholder: text.placeholder, onChange: (event) => {
            setAddHint("");
            rememberDraft(event.target.value);
          }, onKeyDown: (event) => {
            if (event.key === "Enter") addAllowed();
          }, style: { flex: 1, height: 32, borderRadius: 8, border: "1px solid var(--dsw-alias-border-l2, #e4e4e4)", background: "transparent", color: "inherit", padding: "0 10px" } }),
          h("button", { type: "button", onClick: addAllowed, style: controlStyle }, text.add)
        ),
        addHint ? h("div", { style: { ...descStyle, padding: "0 12px 12px", color: "var(--dsw-alias-state-error-primary, #b91c1c)" } }, addHint) : null
      )
    ) : tab === 1 ? h(
      "div",
      null,
      h("h1", { style: titleStyle }, text.browserTitle),
      h("p", { style: subtitleStyle }, text.browserSubtitle),
      h("div", { style: { ...cardStyle, marginBottom: 8 } }, Row({ title: text.browserCard, description: text.browserCardDesc, control: h(Switch, { checked: settings.browserEnabled, label: text.browserCard, onChange: (value) => patch("browserEnabled", value) }) })),
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
        Row({ title: text.history, description: text.historyDesc, control: h("button", { type: "button", onClick: () => commit({ action: "clear-history" }), style: controlStyle }, text.clearHistory) }),
        (settings.history ?? []).length === 0 ? h("div", { style: { ...descStyle, padding: "0 16px 14px" } }, text.historyEmpty) : (settings.history ?? []).slice(0, 8).map((item) => h("div", { key: item.at + item.url, style: { ...descStyle, padding: "0 16px 8px" } }, item.url)),
        h("div", { style: hairline }),
        Row({ title: text.annotation, description: text.annotationDesc, control: h(Select, { value: settings.annotationScreenshots, label: text.annotation, options: [["always", text.annotationAlways], ["drag", text.annotationDrag]], onChange: (value) => patch("annotationScreenshots", value) }) })
      ),
      h("div", { style: labelStyle }, text.autofill),
      h(
        "div",
        { style: cardStyle },
        Row({ title: text.passwords, description: text.passwordsDesc, control: h(Switch, { checked: settings.passwordsEnabled === true, label: text.passwords, onChange: (value) => patch("passwordsEnabled", value) }) }),
        ...(settings.passwords ?? []).map((item) => h("div", { key: item.id, style: rowStyle }, h("div", { style: { flex: 1 } }, `${item.origin} \xB7 ${item.username}`), h("button", { type: "button", onClick: () => commit({ action: "delete-password", id: item.id }), style: { ...controlStyle, color: "#f87171" } }, text.remove))),
        h(
          "div",
          { style: { display: "flex", gap: 8, padding: 12 } },
          h("input", { value: login.origin, placeholder: text.passwordOrigin, onChange: (event) => setLogin({ ...login, origin: event.target.value }), style: { flex: 1.4, height: 32, borderRadius: 8, border: "1px solid var(--dsw-alias-border-l2, #e4e4e4)", background: "transparent", color: "inherit", padding: "0 10px" } }),
          h("input", { value: login.username, placeholder: text.passwordUser, onChange: (event) => setLogin({ ...login, username: event.target.value }), style: { flex: 1, height: 32, borderRadius: 8, border: "1px solid var(--dsw-alias-border-l2, #e4e4e4)", background: "transparent", color: "inherit", padding: "0 10px" } }),
          h("input", { value: login.password, placeholder: text.passwordSecret, type: "password", onChange: (event) => setLogin({ ...login, password: event.target.value }), style: { flex: 1, height: 32, borderRadius: 8, border: "1px solid var(--dsw-alias-border-l2, #e4e4e4)", background: "transparent", color: "inherit", padding: "0 10px" } }),
          h("button", { type: "button", onClick: () => {
            if (!login.origin.trim() || !login.username.trim() || !login.password) return;
            commit({ action: "save-password", origin: login.origin, username: login.username, password: login.password });
            setLogin({ origin: "", username: "", password: "" });
          }, style: controlStyle }, text.add)
        ),
        h("div", { style: hairline }),
        Row({ title: text.contacts, description: text.contactsDesc, control: h(Switch, { checked: settings.contactsEnabled === true, label: text.contacts, onChange: (value) => patch("contactsEnabled", value) }) }),
        h(
          "div",
          { style: { display: "flex", gap: 8, padding: 12, flexWrap: "wrap" } },
          [["name", text.contactName], ["email", text.contactEmail], ["phone", text.contactPhone], ["address", text.contactAddress]].map(([key, label]) => h("input", { key, value: contactDraft[key] ?? "", placeholder: label, onChange: (event) => setContactDraft({ ...contactDraft, [key]: event.target.value }), style: { flex: "1 1 140px", height: 32, borderRadius: 8, border: "1px solid var(--dsw-alias-border-l2, #e4e4e4)", background: "transparent", color: "inherit", padding: "0 10px" } })),
          h("button", { type: "button", onClick: () => commit({ action: "save-contact", contact: contactDraft }), style: controlStyle }, text.saveContact)
        )
      ),
      h("div", { style: labelStyle }, text.extensions),
      h(
        "div",
        { style: cardStyle },
        Row({ title: text.extensionManager, description: text.extensionDesc, control: h(Switch, { checked: settings.extensionsEnabled !== false, label: text.extensionManager, onChange: (value) => patch("extensionsEnabled", value) }) }),
        (settings.extensions ?? []).length === 0 ? h("div", { style: { ...descStyle, padding: "0 16px 12px" } }, text.extensionEmpty) : (settings.extensions ?? []).map((item) => h(
          "div",
          { key: item.profile + item.id, style: rowStyle },
          h("div", { style: { flex: 1 } }, item.name),
          h("button", { type: "button", onClick: () => commit({ action: "set-extension", profile: item.profile, id: item.id, enabled: !item.enabled }), style: controlStyle }, item.enabled ? text.extensionStop : text.extensionStart)
        )),
        h("div", { style: { ...descStyle, padding: "0 16px 12px" } }, text.extensionHint)
      ),
      h("div", { style: labelStyle }, text.downloads),
      h(
        "div",
        { style: cardStyle },
        Row({ title: text.downloadLocation, description: text.downloadLocationDesc, control: h("input", { value: downloadDir, placeholder: text.downloadLocation, onChange: (event) => setDownloadDir(event.target.value), onBlur: () => patch("downloadDirectory", downloadDir), style: { width: 220, height: 32, borderRadius: 8, border: "1px solid var(--dsw-alias-border-l2, #e4e4e4)", background: "transparent", color: "inherit", padding: "0 10px" } }) }),
        h("div", { style: hairline }),
        Row({ title: text.askSave, description: text.askSaveDesc, control: h(Switch, { checked: settings.askDownloadLocation, label: text.askSave, onChange: (value) => patch("askDownloadLocation", value) }) }),
        h("div", { style: hairline }),
        Row({ title: text.downloadHistory, description: text.downloadHistoryDesc, control: null }),
        (settings.downloads ?? []).length === 0 ? h("div", { style: { ...descStyle, padding: "0 16px 14px" } }, text.historyEmpty) : (settings.downloads ?? []).slice(0, 8).map((item) => h("div", { key: item.guid, style: { ...descStyle, padding: "0 16px 8px" } }, `${item.filename || item.url} \xB7 ${item.state}`))
      ),
      h("div", { style: labelStyle }, text.permissions),
      h(
        "div",
        { style: cardStyle },
        Row({ title: text.siteSettings, description: text.siteSettingsDesc, control: null }),
        ...[["camera", text.camera], ["microphone", text.microphone], ["geolocation", text.geolocation], ["notifications", text.notifications]].map(([key, label]) => h("div", { key }, h("div", { style: hairline }), Row({ title: label, control: h(Select, { value: settings.sitePermissions?.[key] ?? "ask", label, options: [["allow", text.always], ["ask", text.ask], ["deny", text.deny]], onChange: (value) => patch("sitePermissions", { ...settings.sitePermissions, [key]: value }) }) }))),
        h("div", { style: hairline }),
        Row({ title: text.historyAccess, description: text.historyAccessDesc, control: h(Select, { value: settings.historyAccess, label: text.historyAccess, options: accessOptions, onChange: (value) => patch("historyAccess", value) }) }),
        h("div", { style: hairline }),
        Row({ title: text.siteTools, description: text.siteToolsUnavailable, control: null })
      ),
      h("div", { style: labelStyle }, text.siteRules),
      h("p", { style: { ...descStyle, marginTop: -4 } }, text.siteRulesDesc),
      h("div", { style: labelStyle }, text.developer),
      h("div", { style: cardStyle }, Row({ title: text.fullCdp, description: `${text.risk}\u3002${text.fullCdpDesc}`, control: h(Switch, { checked: settings.fullCdp, label: text.fullCdp, onChange: (value) => patch("fullCdp", value) }) }))
    ) : h(UpdatePanel, { text }),
    h(
      "div",
      { style: { display: "flex", gap: 12, alignItems: "center", marginTop: 18 } },
      returnToConversation ? h("button", { type: "button", onClick: returnToConversation, style: controlStyle }, text.back) : null,
      status ? h("span", { style: descStyle }, status) : null,
      error ? h("span", null, error) : null
    )
  ));
}
var UPDATE_PATH = "/api/dsh-codex-tools.update";
function reasonText(text, reason) {
  switch (reason) {
    case "unsupported-source":
      return text.reasonUnsupportedSource;
    case "restart-required":
      return text.reasonRestartRequired;
    case "disabled":
      return text.reasonDisabled;
    case "not-installed":
      return text.reasonNotInstalled;
    case "unsupported-version":
      return text.reasonUnsupportedVersion;
    case "installation-error":
      return text.reasonInstallationError;
    case "unsupported-installation":
      return text.reasonUnsupportedInstallation;
    case "manager-unavailable":
      return text.reasonManagerUnavailable;
    case "service-unavailable":
      return text.reasonServiceUnavailable;
    default:
      return reason ? String(reason) : "";
  }
}
async function callUpdate(body) {
  const response = await fetch(UPDATE_PATH, {
    method: body ? "POST" : "GET",
    credentials: "same-origin",
    headers: body ? { "content-type": "application/json" } : void 0,
    body: body ? JSON.stringify(body) : void 0
  });
  let value = null;
  try {
    value = await response.json();
  } catch {
    value = null;
  }
  if (!response.ok) throw new Error(value?.error ?? "request");
  return value;
}
function UpdatePanel({ text }) {
  const [data, setData] = import_react.default.useState(null);
  const [consent, setConsent] = import_react.default.useState(false);
  const [pending, setPending] = import_react.default.useState("");
  const [note, setNote] = import_react.default.useState("");
  const [error, setError] = import_react.default.useState("");
  const pollRef = import_react.default.useRef(null);
  const stopPolling = () => {
    if (pollRef.current !== null) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };
  import_react.default.useEffect(() => () => stopPolling(), []);
  const applyStatus = (value) => {
    setData(value);
    const operation = value?.operation ?? null;
    if (operation?.phase) {
      const label = text.phaseLabels[operation.phase] ?? operation.phase;
      const reason = operation.error ? ` \xB7 ${operation.error}${operation.detailCode ? ` / ${operation.detailCode}` : ""}` : "";
      setNote(`${operation.terminal ? label : `${text.replacing}${label}`}${reason}`);
    }
    return operation;
  };
  import_react.default.useEffect(() => {
    let live = true;
    callUpdate().then((value) => {
      if (live) applyStatus(value);
    }).catch(() => {
      if (live) setError(text.checkFailed);
    });
    return () => {
      live = false;
      stopPolling();
    };
  }, [text.checkFailed]);
  async function check() {
    setPending("check");
    setNote("");
    setError("");
    try {
      applyStatus(await callUpdate({ action: "check" }));
    } catch {
      setError(text.checkFailed);
    } finally {
      setPending("");
    }
  }
  async function install() {
    setPending("install");
    setNote("");
    setError("");
    try {
      const plan = await callUpdate({ action: "prepare" });
      await callUpdate({ action: "confirm", token: plan.token, targetVersion: plan.targetVersion, consent: true });
      setConsent(false);
      setNote(text.replacing);
      stopPolling();
      pollRef.current = setInterval(() => {
        void callUpdate().then((value) => {
          const operation = applyStatus(value);
          if (operation?.terminal) {
            stopPolling();
            setPending("");
          }
        }).catch(() => {
        });
      }, 1e3);
    } catch (failure) {
      const code = String(failure?.message ?? "");
      setError(code ? `${text.cannotUpdate}\uFF08${code}\uFF09` : text.cannotUpdate);
      setPending("");
    }
  }
  const running = typeof data?.currentVersion === "string" ? data.currentVersion : null;
  const latest = typeof data?.release?.latestVersion === "string" ? data.release.latestVersion : null;
  const installed = typeof data?.installedVersion === "string" ? data.installedVersion : null;
  const canInstall = data?.available === true && data?.release?.status === "update-available";
  const restartPending = data?.reason === "restart-required";
  const busy = data?.reason === "busy";
  return h(
    "div",
    null,
    h("h1", { style: titleStyle }, text.updateTitle),
    h("p", { style: subtitleStyle }, text.updateSubtitle),
    h(
      "div",
      { style: cardStyle },
      Row({ title: text.currentVersion, description: running ?? "\u2026", control: null }),
      h("div", { style: hairline }),
      Row({ title: text.installedVersion, description: installed ?? "\u2026", control: null }),
      h("div", { style: hairline }),
      Row({ title: text.latestVersion, description: latest ?? text.notChecked, control: null }),
      h("div", { style: hairline }),
      Row({ title: text.lastCheck, description: formatTimestamp(data?.release?.checkedAt) || text.notChecked, control: null }),
      data?.source ? h("div", null, h("div", { style: hairline }), Row({ title: text.source, description: data.source, control: null })) : null
    ),
    restartPending ? h("p", { style: { ...descStyle, marginTop: 12 } }, text.restartPending.replace("{version}", installed ?? latest ?? "\u65B0\u7248\u672C")) : data?.release?.status === "current" ? h("p", { style: { ...descStyle, marginTop: 12 } }, text.upToDate) : null,
    !restartPending && canInstall ? h("p", { style: { ...descStyle, marginTop: 12 } }, text.hasUpdate) : null,
    !restartPending && !canInstall && !busy && data?.available === false ? h("p", { style: { ...descStyle, marginTop: 12 } }, `${text.cannotUpdate}\uFF1A${reasonText(text, data.reason)}`) : null,
    canInstall ? h(
      "label",
      { style: { display: "flex", gap: 8, alignItems: "center", marginTop: 14, fontSize: 13 } },
      h("input", { type: "checkbox", checked: consent, onChange: (event) => setConsent(event.target.checked) }),
      text.consent
    ) : null,
    canInstall ? h("p", { style: { ...descStyle, marginTop: 8 } }, text.swapHint) : null,
    h(
      "div",
      { style: { display: "flex", gap: 8, marginTop: 14 } },
      h("button", { type: "button", onClick: check, disabled: pending !== "", style: controlStyle }, pending === "check" ? text.checking : text.check),
      canInstall ? h("button", { type: "button", onClick: install, disabled: !consent || pending !== "", style: controlStyle }, pending === "install" ? text.installing : text.install) : null
    ),
    data?.operation?.targetSpec ? h("p", { style: { ...descStyle, marginTop: 12 } }, `${text.targetCommit} ${data.operation.targetSpec}`) : null,
    data?.release?.releaseUrl ? h(
      "p",
      { style: { ...descStyle, marginTop: 12 } },
      h("a", { href: data.release.releaseUrl, target: "_blank", rel: "noreferrer" }, text.releaseNotes)
    ) : null,
    note ? h("p", { style: { ...descStyle, marginTop: 12 } }, note) : null,
    error ? h("p", { style: { ...descStyle, marginTop: 12, color: "var(--dsw-alias-state-error-primary, #b91c1c)" } }, error) : null
  );
}
var inject = ["slots", "layout", "locale"];
function apply(ctx) {
  const label = () => "\u7535\u8111\u64CD\u63A7";
  ctx.slots.inject("settings.section", () => ctx.slots.register({
    name: "settings.section",
    id: "dsh-codex-tools",
    order: 90,
    label
  }, Page));
  ctx.slots.inject("main", () => ctx.slots.register({
    name: "main",
    key: "dsh-codex-tools",
    inject: () => ({ returnToConversation: () => ctx.layout.selectPanel(null) })
  }, Page));
}
return module.exports;}});
