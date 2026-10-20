[English](<README.md>) | [简体中文](<README.zh-CN.md>)

# Codex Tools for DeepSeek Harness

Computer use, browser control and cross-session messaging as three agent tools, ported from the Codex desktop client.

A plugin bundle for the [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (DSH). The first two tools ride on the same runtime Codex itself uses; the third is the Harness equivalent of Codex's cross-session messaging.

| Tool | What it does | Where it comes from |
| --- | --- | --- |
| `computer_use` | Reads and drives native macOS apps through their accessibility tree and screenshots | Codex's Computer Use runtime |
| `browser` | Lists browsers and tabs, binds one, reads it, clicks, types, navigates | Codex's browser-desktop provider |
| `session_message` | Starts a session in another project with a full task brief, or steers, forks and renames existing ones | Harness-native services |

## Requirements

- **macOS**, with `ChatGPT.app` installed — the Codex Computer Use runtime lives inside it.
- **DSH `>= 0.2.1-rc.1`**, with no future-version ceiling. The plugin checks the Host capabilities it needs before mounting and names any missing one instead of guessing from a version number.
- **Accessibility and Screen Recording permission** for the app running the Harness, for `computer_use`.
- **The Codex Chrome extension**, for `browser` against Chrome.

## Install

```sh
# from the profile directory
dsh plugin install github:Syngnat/dsh-codex-tools
```

Or, from an agent session, `plugin_manager` with `action: "install_bundle"` and the same spec. A local checkout works too:

```sh
dsh plugin install /absolute/path/to/dsh-codex-tools
```

The plugin registers itself through `cordis.patch.yml`:

```yaml
- insert:
    - id: local-codex-tools
      name: '@local/dsh-codex-tools'
      config:
        surfaces: computer,browser
```

## Configuration

| Key | Default | Meaning |
| --- | --- | --- |
| `surfaces` | `computer,browser` | Which Codex providers the runtime binds. Narrow it to `computer` or `browser` to skip the other. |
| `computerUse` | `true` | Register the `computer_use` tool. |
| `browser` | `true` | Register the `browser` tool. |
| `sessionMessaging` | `true` | Register the `session_message` tool. |
| `callTimeoutMs` | `120000` | Per-call deadline for one REPL evaluation. |
| `codexSessionId` | generated | Stable `session_id` reported in the Codex turn metadata. |

Environment overrides:

| Variable | Meaning |
| --- | --- |
| `DSH_CODEX_CUA_NODE` | Absolute path to `cua_node`, when ChatGPT.app is not in `/Applications`. |
| `DSH_CODEX_APP` | Absolute path to the ChatGPT app bundle. |

## `computer_use`

Actions: `list_apps`, `list_windows`, `get_state`, `click`, `type_text`, `paste`,
`press_key`, `scroll`, `drag`, `set_value`, `select_text`,
`perform_secondary_action`, `screenshot`.

The workflow mirrors Codex's: discover an app, read its state to get element
indices, act on an index, then read state again. Element indices are only valid
for the state they came from, so every action re-reads state unless you pass
`return_state: false` to batch several actions into one call.

`get_state` returns a **diff** against the previous read by default; pass
`full_tree: true` when you need the whole tree.

Screenshots are written to a PNG in the system temporary directory and the path
is returned, so the image can be opened with the ordinary image reader.

### Approvals

The runtime asks the client to approve an app before it will read or drive that
app's UI, through MCP form elicitation. This plugin answers `accept` by default
and records every decision in `client.approvalLog`. Set `approval: "deny"` in the
plugin config to refuse instead.

The upstream confirmation policy — delete data, transmit sensitive data, install
software, solve CAPTCHAs, change system settings — is a *model* obligation, not
something the runtime enforces, so it is restated in the tool description.

### It is invisible by design

`computer_use` does not activate the target window and does not move the pointer:
on macOS the runtime performs accessibility actions (`AXPress`, `AXValue`, …)
directly on elements. The "ChatGPT is using your computer" overlay is part of the
ChatGPT host, which this plugin does not go through, so nothing is drawn on
screen. An operation can succeed on a window that is behind another app.

## `browser`

Actions: `list_browsers`, `list_tabs`, `open_tab`, `get_tab`, `documentation`,
`state`, `click`, `type_text`, `paste`, `press_key`, `scroll`, `drag`,
`select_text`, `set_value`, `goto`, `back`, `forward`, `reload`, `close`,
`screenshot`.

Browsers come from the Codex Chrome extension, the in-app browser, or any
provider the runtime advertises. `list_browsers` shows what is connected;
`list_tabs` shows tabs; `open_tab` or `get_tab` binds one and keeps it bound for
later calls.

## `session_message`

Actions: `list_workspaces`, `list_sessions`, `dispatch`, `create`, `send`,
`fork`, `rename`.

`dispatch` is the headline: it creates a session in a target workspace and sends
it a complete brief in one call.

```
session_message {
  action: "dispatch",
  workspace: "GoNavi",
  title: "Fix the reconnect loop",
  message: "Context: ... Goal: ... Files: ... Done means: ..."
}
```

The target session cannot see the calling conversation, so the brief must stand
alone. The session it creates is an ordinary Harness session: it appears in the
sidebar, runs on its own, and can be steered afterwards with `send`.

`workspace` accepts a workspace id, an absolute path, or part of a title. An
absolute path that is not registered yet is created as a new workspace.

This tool uses the Host's `sessionController` and `workspaceRegistry` services,
so it needs no storage access and no Codex runtime.

## How Codex does it

Codex ships a self-contained Node runtime inside `ChatGPT.app`:

```
/Applications/ChatGPT.app/Contents/Resources/cua_node/
  bin/node                                a pinned Node 24 binary
  bin/node_repl                           the REPL kernel that hosts the cua API
  lib/node_modules/@oai/cua-repl          the MCP launcher
  lib/node_modules/@oai/sky               native-app provider (Sky)
  lib/node_modules/@oai/browser-desktop   browser provider
```

`@oai/cua-repl`'s launcher spawns `node_repl` with two trusted services bound —
`@oai/sky/service` for native apps and `@oai/browser-desktop/service` for
browsers — and speaks MCP over stdio. It exposes four tools: `js`, `js_reset`,
`js_add_node_module_dir` and `turn_ended`. Everything else is JavaScript: the
model writes code against a global `cua` object, and the REPL keeps its bindings
alive between calls so an app or tab stays bound and element indices stay valid.

Two things are easy to get wrong, and this plugin handles both:

- **The runtime must be told where its trusted modules live.** Without
  `NODE_REPL_NODE_MODULE_DIRS` and `NODE_REPL_TRUSTED_CODE_PATHS` pointing at
  `cua_node/lib/node_modules`, the kernel dies with *"Trusted RPC package must
  resolve within a configured trusted module directory"*.
- **The browser provider requires Codex turn metadata.** Every call must carry
  `_meta["x-codex-turn-metadata"]` with a `session_id` and a `turn_id`, or the
  browser service refuses with *"Missing required Codex turn metadata"*.

The standalone `cua mcp` subcommand of `SkyComputerUseClient` is **not** a
substitute: it waits for an XPC bootstrap handshake from the ChatGPT host and
times out with `bootstrapTimedOut`. Importing `@oai/sky` directly fails too, with
*"Sky Computer Use requires the trusted nodeRepl runtime"*. The `cua-repl`
launcher is the only supported standalone entry point.

Full findings, including the dead ends, are in [docs/implementation.md](<docs/implementation.md>).

## Layout

```
index.js                 plugin entry: apply / inject, registers the three tools
lib/cua-repl-client.mjs  MCP stdio client for the Codex REPL server
lib/computer-tool.mjs    computer_use
lib/browser-tool.mjs     browser
lib/session-tool.mjs     session_message
lib/define-tool.mjs      dependency-free defineTool
cordis.patch.yml         bundle patch
docs/implementation.md   reverse-engineering report
```

## Development

```sh
npm test          # 20 unit tests, no Codex runtime needed
npm run test:live # 5 live tests, needs ChatGPT.app
```

`lib/*.mjs` is not covered by the Harness HMR watcher. After editing a module,
remount the plugin so the running instance picks the change up:

```
plugin_manager { action: "set_plugin", target: "include:local-codex-tools", enabled: false }
plugin_manager { action: "set_plugin", target: "include:local-codex-tools", enabled: true }
```

## License

MIT. See [LICENSE](<LICENSE>).
