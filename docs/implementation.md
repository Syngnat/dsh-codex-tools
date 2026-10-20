# How the Codex client implements the three capabilities

Findings from reverse-engineering the local ChatGPT/Codex desktop client
(`/Applications/ChatGPT.app`, Codex CLI 0.162.1, bundled plugin marketplaces
under `~/.codex/.tmp/bundled-marketplaces/openai-bundled/plugins/`).

Everything below was confirmed by running the components on this machine, not by
reading marketing copy. Where a plausible-looking route turned out to be a dead
end, it is recorded too, because the dead ends are the expensive part.

---

## 1. Computer use

### The stack

```
ChatGPT.app/Contents/Resources/cua_node/
  bin/node                    pinned Node 24.21.0
  bin/node_repl               the REPL kernel
  lib/node_modules/@oai/cua-repl        MCP launcher + banner + instructions
  lib/node_modules/@oai/sky             native-app provider (75 MB, bundles the helper app)
  lib/node_modules/@oai/browser-desktop browser provider
  lib/node_modules/@oai/cua             tinyskyAlt, the `cua` API implementation
  lib/node_modules/playwright-core      for DOM-only tabs
```

The native engine lives outside the app bundle, installed on first use:

```
~/.codex/computer-use/Codex Computer Use.app/
  Contents/MacOS/SkyComputerUseService                     the daemon
  Contents/SharedSupport/SkyComputerUseClient.app/.../SkyComputerUseClient
                                                           the CLI, 15.5 MB
```

`SkyComputerUseClient` is a Swift CLI with subcommands `mcp`, `event-stream`,
`computer-history`, `calendar`, `messages`, `turn-ended`.

### How the model actually drives it

Not through `SkyComputerUseClient mcp`. Codex launches `@oai/cua-repl`, which
spawns `node_repl` with two trusted services bound and speaks MCP over stdio:

```js
// @oai/cua-repl/dist/.../launch.js, decompiled
const trusted = {};
if (surfaces.has("browser")) trusted.browser = "@oai/browser-desktop/service";
if (surfaces.has("computer")) trusted.sky = "@oai/sky/service";
spawn(process.env.CUA_REPL_NODE_REPL_PATH, [], {
  env: {
    ...process.env,
    CUA_REPL_ENABLED_SURFACES: [...surfaces].join(","),
    NODE_REPL_TRUSTED_SERVICES: JSON.stringify(trusted),
    NODE_REPL_JS_BANNER: readFileSync(banner.js, "utf8"),
    NODE_REPL_TOOL_OVERRIDES: JSON.stringify({ server_instructions, tools }),
  },
  stdio: "inherit",
});
```

The launcher itself is the MCP server: it hands its own stdio to the kernel. It
advertises four tools — `js`, `js_reset`, `js_add_node_module_dir`,
`turn_ended` — and `js` evaluates JavaScript in a persistent REPL whose global
`cua` object is the whole API.

The banner is one line:

```js
await import("@oai/cua/tinyskyAlt");
```

### The `cua` API

```ts
cua.getState()                    // { apps, browsers, errors? }
cua.listApps() / cua.getApp(name | { windowId })
cua.listBrowsers() / cua.getBrowser({ id?, url? })
cua.listTabs({ browser }) / cua.getTab(id | { mention } | { url }, { browser })
cua.createBrowserTab(browserId, url?, { visible?, sessionName? })

interface Target {                // App and Tab both implement this
  getAXState({ disableDiffing? }): Promise<string>
  getScreenshot(): Promise<Uint8Array>
  getAXStateAndScreenshot(): Promise<{ state, screenshot? }>
  click(index | [x, y], { mouseButton?, clickCount?, key?, durationMs? })
  drag(from: [x, y], to: [x, y])
  scroll(index | [x, y], direction, pages?)
  selectText(index, text, { prefix?, suffix?, selectionType? })
  setValue(index, value)
  performSecondaryAction(index, action)
}
interface App extends Target { paste(text, { format? }); pressKey(key); typeText(text) }
interface Tab extends Target { paste(index | null, text); pressKey(index | null, key); typeText(index | null, text)
                               goto?; back?; forward?; reload?; close? }
```

Two design details matter:

- **The REPL is persistent**, so an app or tab binding survives between calls and
  accessibility element indices stay meaningful. Codex's own instruction file
  tells the model to re-read state after every action rather than reuse indices.
- **`getAXState()` returns a diff** against the previous read. `disableDiffing:
  true` forces a full tree.

### Dead ends (verified, do not repeat)

| Route | Result |
| --- | --- |
| `SkyComputerUseClient mcp` standalone | `bootstrapTimedOut`. It waits for an XPC bootstrap handshake from the ChatGPT host (`Could not get XPC bootstrap mach port from Apple event`), and rejects responses from unexpected processes. |
| `import("@oai/sky")` from a plain Node process | `SkyComputerUseTransportError: Sky Computer Use requires the trusted nodeRepl runtime`. |
| `@oai/cua-repl` without module-dir env | Kernel dies: `Trusted RPC package must resolve within a configured trusted module directory: @oai/sky/service`. Fixed by `NODE_REPL_NODE_MODULE_DIRS` and `NODE_REPL_TRUSTED_CODE_PATHS`. |

### Approvals

`@oai/sky` asks the client to approve an app before it will read or drive that
app's UI, through MCP form elicitation (`nodeRepl.createElicitation`). A client
that does not declare the `elicitation` capability gets:

```
nodeRepl.createElicitation is unavailable because the MCP client does not support form elicitation
```

The confirmation taxonomy — delete data, transmit sensitive data, install
software, solve CAPTCHAs, change system settings — lives in the tool description
(`instructions/macos/computer.md` plus the shared confirmation policy), so it is
a *model* obligation rather than something the runtime enforces.

---

## 2. Browser control

The browser surface is the same REPL, bound to `@oai/browser-desktop/service`.
There is no separate protocol.

### The extension

Codex installs a Chrome extension and a native messaging host:

```
~/.codex/chrome-native-hosts-v2.json
  extensionIds:      hehggadaopoacecdllhhajmbjkdcmajg, ...
  nativeHostNames:   com.openai.codexextension
  paths.browserClientPath   .../browser-client.mjs   (169 KB)
  paths.browserServicePath  .../browser-service.mjs  (1.4 MB)
  paths.extensionHostPath   .../extension-host/macos/arm64/ChatGPT for Chrome
  paths.nodePath            the cua_node node binary
```

The extension talks to the native host over Chrome's native-messaging channel;
the host exposes tabs to the REPL as `type: "extension"` browsers. Other browser
types are `iab` (in-app browser), `dot`, `cdp` and `mcpapps`.

### The turn-metadata requirement

Every MCP call must carry Codex turn metadata, or the browser service refuses:

```js
// browser-service.mjs
function readTurnMetadata(request) {
  const raw = request.requestMeta?.["x-codex-turn-metadata"];
  if (typeof raw === "string") { try { return JSON.parse(raw); } catch { return; } }
}
function missingKeys(request) {
  const meta = readTurnMetadata(request);
  return ["session_id", "turn_id"].filter((k) => typeof meta?.[k] !== "string");
}
function requireTurnMetadata(request) {
  const missing = missingKeys(request);
  if (missing.length !== 0) throw new Error(`Missing required Codex turn metadata: ${missing.join(", ")}`);
}
```

So the client sends `params._meta["x-codex-turn-metadata"] =
JSON.stringify({ session_id, turn_id })` on every `tools/call`.

### Page interaction

For tabs that expose accessibility, the same `Target` interface applies. For
DOM-only tabs, `getAXState()` returns a DOM snapshot with no numeric indices and
the native input wrappers throw before sending input; the documented path there
is Playwright locators, which is why `playwright-core` ships inside `cua_node`.

The provider also emits a sizeable first-use manual (about 33 KB) the first time
a browser is selected, and the Computer Use manual (about 21 KB) the first time
`cua` is touched. Both are per-kernel, so a client that warms up once gets clean
results afterwards.

---

## 3. Cross-session messaging

This is the one capability that is **not** in `cua_node`. It lives in the bundled
plugin `codex-app-tools`:

```
~/.codex/.tmp/bundled-marketplaces/openai-bundled/plugins/codex-app-tools/
  server.mjs                      950 KB bundled MCP stdio server
  scripts/launch_codex_app_tools_mcp
```

### Transport

A local MCP stdio server that proxies to the ChatGPT app over an internal
JSON-RPC 2.0 pipe:

```
CODEX_APP_TOOLS_PIPE_PATH          the pipe
CODEX_APP_TOOLS_CALLER_HOST_ID     which host is calling
CODEX_APP_TOOLS_DEFERRED           whether instructions are deferred
MAX_FRAME_BYTES                    8 MB
```

`NativePipeClient` frames JSON-RPC over that pipe; `createCodexAppToolsMcpServer`
exposes the tools.

### Tools

| Tool | Purpose |
| --- | --- |
| `create_thread` | start a new conversation |
| `send_message_to_thread` | deliver a prompt to an existing conversation |
| `fork_thread` | branch a conversation |
| `handoff_thread` | move a conversation to another project |
| `move_thread_to_project` | re-home a conversation |
| `automation_update` | manage scheduled automations |

The user-visible effect is the "sent from another chat" attribution: a session
started this way is an ordinary conversation in the target project, with the
full brief as its first user message.

### The Harness equivalent

The Harness already has the same seam as first-class services, so the plugin uses
them directly instead of reimplementing a pipe:

```
workspaceRegistry.list() / get(id) / create(path, title) / resolveByPath(path)
sessionController.create({ workspaceId | cwd, sessionId?, agentPreset? })
sessionController.prompt({ sessionId, requestId, content: [{ type: "text", text }], mode? })
sessionController.fork({ sessionId, atSeq? })
sessionController.rename({ sessionId, title })
sessionController.list({}) / search({ query })
```

Two behaviours worth knowing, both found by testing:

- `create` accepts `workspaceId` **or** `cwd`, never both.
- Renaming a session resumes its Agent and leaves it busy, so a prompt issued
  immediately afterwards is rejected with `session/agent-busy` / "prompt
  rejected". Prompt first, rename second.

---

## Reproducing the runtime by hand

```sh
CUA_NODE=/Applications/ChatGPT.app/Contents/Resources/cua_node
CUA_REPL_NODE_REPL_PATH=$CUA_NODE/bin/node_repl \
CUA_REPL_ENABLED_SURFACES=computer,browser \
NODE_REPL_NODE_MODULE_DIRS=$CUA_NODE/lib/node_modules \
NODE_REPL_TRUSTED_CODE_PATHS=$CUA_NODE/lib/node_modules \
  $CUA_NODE/bin/node \
  $CUA_NODE/lib/node_modules/@oai/cua-repl/bin/cua-repl.mjs
```

Then speak MCP on stdio. `initialize` reports `rmcp 1.5.0`; `tools/list` returns
`js`, `js_add_node_module_dir`, `js_reset`, `turn_ended`.
