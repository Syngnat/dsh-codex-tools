[English](<README.md>) | [简体中文](<README.zh-CN.md>)

# Codex Tools for DeepSeek Harness

Computer use, browser control, cross-session messaging and online self-update as four agent tools, ported from the Codex desktop client.

A plugin bundle for the [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (DSH). The first two tools ride on the same runtime Codex itself uses; the third is the Harness equivalent of Codex's cross-session messaging; the fourth updates this plugin from its GitHub releases.

| Tool | What it does | Where it comes from |
| --- | --- | --- |
| `computer_use` | Reads and drives native apps through their accessibility tree and screenshots | macOS Accessibility, or Windows UI Automation |
| `browser` | Lists browsers and tabs, binds one, reads it, clicks, types, navigates | Codex Chrome automation (ChatGPT extension) |
| `browser_use` | Same actions, defaulting to Codex's in-app browser (`iab`) | Codex Browser / browser-use (IAB) |
| `session_message` | Starts a session in another project with a full task brief, or steers, forks and renames existing ones | Harness-native services |
| `codex_tools_update` | Checks for and installs a newer stable release of this plugin | Host `pluginManager` |

## Requirements

- **macOS or Windows.** `computer_use` on macOS needs Accessibility permission for `bin/dsh-ax`. On Windows the plugin builds `bin/dsh-uia.exe` from its own source the first time it runs, using the C# compiler that comes with Windows. You do not install or choose a PowerShell version.
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
| `browserUse` | `true` | Register the `browser_use` tool (in-app browser).
| `update` | `true` | Register the `codex_tools_update` tool. |
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

### What you see on screen

`computer_use` does not activate the target window and does not move the system
pointer: on macOS the runtime performs accessibility actions (`AXPress`,
`AXValue`, …) directly on elements. An operation can succeed on a window that is
behind another app.

The ChatGPT host overlay ("ChatGPT is using your computer") is not drawn,
because this plugin talks to the runtime directly. The runtime *does* show its
own small software cursor while an action runs. Codex dismisses that cursor
with the hidden `turn_ended` tool at the end of a turn; this plugin fires the
same notification when `computer_use` or `browser` returns, so the cursor does
not stay on screen afterwards.

## `browser`

Actions: `list_browsers`, `list_tabs`, `open_tab`, `get_tab`, `documentation`,
`state`, `click`, `type_text`, `paste`, `press_key`, `scroll`, `drag`,
`select_text`, `set_value`, `goto`, `back`, `forward`, `reload`, `close`,
`screenshot`.

The plugin launches its own Chrome over the DevTools Protocol. `list_browsers`
shows the owned windows; `list_tabs` shows tabs; `open_tab` or `get_tab` binds
one and keeps it bound for later calls.

`state` prints one line per accessibility node with an element id, for example
`[1234567] button Submit`. Those ids stay valid for that page, so a later
`state` read does not renumber them, and an id can still be used after the page
changed. `press_key` takes xdotool-style names (`Return`, `Tab`, `ArrowDown`,
`super+c`) and chords. `set_value` replaces the field contents instead of
appending to them.

## `browser_use`

Same actions as `browser`, but the default browser id is `iab` — Codex's
in-app browser, the surface Codex itself calls Browser / browser-use. It lives
inside ChatGPT.app (which must be running). It does **not** attach to your
Chrome, so Chrome will not show a ChatGPT debugging infobar.

```
browser_use { action: "list_browsers" }
browser_use { action: "open_tab", url: "http://127.0.0.1:3000" }
```

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

## `codex_tools_update`

Actions: `status`, `check`, `install`.

Keeps the plugin itself current. The three actions are the three separate steps
of the flow, and only the last one changes anything:

| Action | What it does |
| --- | --- |
| `status` | Reports the running version, the last check, and whether this installation can be replaced online. |
| `check` | Reads the latest stable release from GitHub. Read-only: it downloads and installs nothing. |
| `install` | Replaces the bundle with the latest release. Requires `confirm: true`. |

Ask the user before passing `confirm: true`: the plugin is replaced in place and
the Harness may need a restart.

### What the install guarantees

- **A fixed source.** The repository, the release endpoint and the install spec
  are constants in the plugin. No caller-supplied URL, package name, registry or
  version exemption is accepted.
- **A pinned target.** The release tag is resolved to an immutable commit, and
  the `package.json` at that commit must declare this package name, this version
  and a bundle patch. A mismatch aborts before anything is replaced.
- **No install scripts.** A manifest declaring `preinstall`, `install`,
  `postinstall` or `prepare` is refused outright.
- **Verification after the fact.** Success requires the recorded bundle row to
  match the pinned commit, not just a manager receipt.
- **Recovery.** If the replacement fails after the profile has been mutated, the
  previously running version is reinstalled and re-enabled. If that also fails,
  the result says so and prints the manual command instead of claiming success.
- **No foreign overwrite.** An installation another manager caller made in the
  meantime is detected and left alone.

### What it will not do

Online update only handles an installation that came from this repository. A
local `link:` checkout, a fork, or a bundle that is not a removable profile
installation is refused, and `status` names the reason. There is no HTTP route,
no background polling and no automatic update: nothing happens until the tool is
called.

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
index.js                 plugin entry: apply / inject, registers the four tools
lib/cua-repl-client.mjs  MCP stdio client for the Codex REPL server
lib/computer-tool.mjs    computer_use
lib/browser-tool.mjs     browser
lib/session-tool.mjs     session_message
lib/update-tool.mjs      codex_tools_update
lib/update-service.mjs   GitHub release check and bundle replacement
lib/version.mjs          strict stable-version helpers
lib/define-tool.mjs      dependency-free defineTool
cordis.patch.yml         bundle patch
docs/implementation.md   reverse-engineering report
```

## Development

```sh
npm test          # 50 offline tests, no Codex runtime needed
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
