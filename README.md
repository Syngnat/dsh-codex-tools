[English](<README.md>) | [简体中文](<README.zh-CN.md>)

# 电脑操控 — computer and browser tools for DeepSeek Harness

Three agent tools that act on this machine — control native apps, drive a Chrome
window the plugin owns, and message other Harness sessions — plus a fourth that
updates the plugin from its GitHub releases.

A plugin bundle for the [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)
(DSH). Everything runs in the Harness process or in helpers this plugin ships:
nothing here starts an external desktop client, connects to an MCP server, or
shells out to PowerShell.

| Tool | What it does | How it works |
| --- | --- | --- |
| `computer_use` | Reads and drives native apps through their accessibility tree and screenshots | `bin/dsh-ax` (macOS Accessibility) or `bin/dsh-uia.exe` (Windows UI Automation, built on first use) |
| `browser` | Lists the plugin's Chrome window and its tabs, binds one, reads it, clicks, types, navigates | Chrome DevTools Protocol against a Chrome the plugin launches with its own profile |
| `session_message` | Starts a session in another project with a full task brief, or steers, forks and renames existing ones | Host `sessionController` and `workspaceRegistry` |
| `codex_tools_update` | Checks for and installs a newer stable release of this plugin | Host `pluginManager` and `jobs` |

## Requirements

- **macOS or Windows.** On macOS `computer_use` needs Accessibility permission for
  `bin/dsh-ax` (and Screen Recording for screenshots). On Windows the plugin builds
  `bin/dsh-uia.exe` from `native/dsh-uia.cs` the first time it runs, with the C#
  compiler that ships inside Windows itself (`.NET Framework` 4.x). You do not
  install a .NET SDK, choose a PowerShell version, or run anything as administrator.
- **DSH `>= 0.2.1-rc.1`**, with no future-version ceiling. The plugin checks the
  Host capabilities it needs before mounting and names any missing one instead of
  guessing from a version number.
- **No browser extension.** The browser tool launches its own Chrome and does
  not attach to the Chrome you are already using, so nothing is injected into your
  browsing session.

## Install

```sh
# from the profile directory
dsh plugin install github:Syngnat/dsh-codex-tools
```

Or, from an agent session, `plugin_manager` with `action: "install_bundle"` and the
same spec. A local checkout works too:

```sh
dsh plugin install /absolute/path/to/dsh-codex-tools
```

The plugin registers itself through `cordis.patch.yml`:

```yaml
- insert:
    - id: local-codex-tools
      name: '@local/dsh-codex-tools'
      config: {}
```

## Configuration

Two layers, and they do different things.

**Bundle config** decides which tools exist at all. Set it on the patch row above:

| Key | Default | Meaning |
| --- | --- | --- |
| `computerUse` | `true` | Register the `computer_use` tool. |
| `browser` | `true` | Register the `browser` tool. |
| `sessionMessaging` | `true` | Register the `session_message` tool. |
| `update` | `true` | Register the `codex_tools_update` tool. |

**The settings page** decides what the registered tools are allowed to do. Open it
from the plugin's own page in the Harness 插件 (Plugins) page. It writes
`~/.dsh/dsh-codex-tools/settings.json`, and the tools read that file on every call:

| Setting | Default | Meaning |
| --- | --- | --- |
| `computerEnabled` | `true` | Master switch for `computer_use`. |
| `anyApp` | `true` | When off, only apps in `allowedApps` may be driven. |
| `allowedApps` | `[]` | App names allowed while `anyApp` is off. |
| `browserEnabled` | `true` | Master switch for `browser`. |

## `computer_use`

Actions: `list_apps`, `list_windows`, `get_state`, `click`, `type_text`, `paste`,
`press_key`, `scroll`, `drag`, `set_value`, `select_text`,
`perform_secondary_action`, `screenshot`.

Discover an app, read its state to get element indices, act on an index, then read
state again. Element indices are only valid for the state they came from, so every
mutating action re-reads state unless you pass `return_state: false` to batch
several actions into one call.

`get_state` returns a **diff** against the previous read by default; pass
`full_tree: true` when you need the whole tree.

### Choosing the window

`app` names the app; `pid`, `window_handle` and `window_title` pick one of its
windows. One process can own several windows showing different pages — two Chrome
profiles both answer to `chrome` — so an `app` that matches more than one window is
refused with the candidate list (pid, handle, title, session) instead of silently
taking the first match. A pid can still leave two windows, because one process may
own several; add a handle or a title fragment then. Call `list_windows` without
`app` to see every window on the machine with its identity. Element indices belong
to the window that produced them, and using one against another window is reported
instead of clicked.

Screenshots are written to a PNG in the system temporary directory and the path is
returned, so the image can be opened with the ordinary image reader.

### What you see on screen

On macOS `computer_use` does not activate the target window and does not move the
system pointer: the helper performs accessibility actions (`AXPress`, `AXValue`, …)
directly on elements, so an operation can succeed on a window that sits behind
another app.

On Windows input needs the keyboard, so `click`, `type_text`, `paste`, `set_value`,
`press_key`, `scroll` and `drag` first verify that the target window holds the
foreground — raising it, with an attach-thread retry, when it does not — and
`set_value` prefers the UI Automation `ValuePattern`, so a field can be filled
without any keystrokes. The pointer moves to the element about to be clicked, and a
small arrow flashes at that point and hides about half a second later; it is not
shown when the helper starts and does not stay on screen afterwards.

Nothing else is drawn over your desktop: there is no host overlay, because the
helper is the only participant. Actions that delete data,
transmit sensitive data, install software, solve CAPTCHAs or change system settings
are left to the model and the user to agree on — the helper does not enforce a
policy of its own.

## `browser`

Actions: `list_browsers`, `list_tabs`, `open_tab`, `get_tab`, `documentation`,
`state`, `click`, `type_text`, `paste`, `press_key`, `scroll`, `drag`, `select_text`,
`set_value`, `goto`, `back`, `forward`, `reload`, `close`, `screenshot`.

The plugin launches one Chrome window over the DevTools Protocol, with its profile
at `~/.dsh/dsh-codex-tools/browser`. `list_browsers` names that window; `list_tabs`
shows its tabs; `open_tab` or `get_tab` binds one and keeps it bound for later calls.

`state` prints one line per accessibility node with an element id, for example
`[1234567] button Submit`. Those ids stay valid for that page, so a later `state`
read does not renumber them. `press_key` takes xdotool-style names (`Return`, `Tab`,
`ArrowDown`, `super+c`) and chords. `set_value` replaces the field contents instead
of appending to them.

## `session_message`

Actions: `list_workspaces`, `list_sessions`, `dispatch`, `create`, `send`, `fork`,
`rename`.

`dispatch` is the headline: it creates a session in a target workspace and sends it
a complete brief in one call.

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

`send` delivers immediately by default: even when the target is running a turn or a
goal, the message is steered in as an `agent-message` with the `relay` form instead
of waiting for the next turn. The target message row shows "From session <sender
title or id>", and the first content line names the sender too. Only an explicit
`mode: "queue"` waits for the next turn. Subagent targets keep the Host's
ownership-checked prompt path.

`workspace` accepts a workspace id, an absolute path, or part of a title. An
absolute path that is not registered yet is created as a new workspace.

## `codex_tools_update`

Actions: `status`, `check`, `install`, `operation`.

Keeps the plugin itself current. The actions are separate steps, and only `install`
changes anything:

| Action | What it does |
| --- | --- |
| `status` | Reports the running version, the last check time, and whether this installation can be replaced online. |
| `check` | Reads the latest stable release from GitHub. Read-only: it downloads and installs nothing. |
| `install` | Replaces the bundle with the latest release. Requires `confirm: true`. |
| `operation` | Reads the state of an update job that is already running. |

Ask the user before passing `confirm: true`: the plugin is replaced in place.

### What the install guarantees

- **A fixed source.** The repository, the release endpoint and the install spec are
  constants in the plugin. No caller-supplied URL, package name, registry or
  version exemption is accepted.
- **A pinned target.** The release tag is resolved to an immutable commit, and the
  `package.json` at that commit must declare this package name, this version and a
  bundle patch. A mismatch aborts before anything is replaced.
- **No install scripts.** A manifest declaring `preinstall`, `install`,
  `postinstall` or `prepare` is refused outright.
- **Runs outside the plugin.** The replacement happens inside a Host job that does
  not belong to the plugin, so removing the plugin mid-flight cannot kill the swap.
- **Verification after the fact.** Success requires the recorded bundle row to match
  the pinned commit and the plugin's own route to answer with the new version — not
  just a manager receipt.
- **Recovery.** If the replacement fails after the profile has been mutated, the
  previously running version is reinstalled and re-enabled. If that also fails, the
  result says so and prints the manual command instead of claiming success.
- **No foreign overwrite.** An installation another manager caller made in the
  meantime is detected and left alone.

### What it will not do

Online update only handles an installation that came from this repository. A local
`link:` checkout, a fork, or a bundle that is not a removable profile installation
is refused, and `status` names the reason. There is no HTTP polling and no automatic
update: nothing happens until the tool is called.

## Layout

```
index.js                 plugin entry: apply / inject, registers the tools
client-entry.js          the settings page source the client half is built from
client.js                built client half (esbuild output)
lib/ax-client.mjs        JSON-line client for the computer-use helper
lib/computer-tool.mjs    computer_use
lib/cdp-browser.mjs      Chrome DevTools Protocol driver
lib/browser-tool.mjs     browser
lib/session-tool.mjs     session_message
lib/update-tool.mjs      codex_tools_update
lib/update-service.mjs   GitHub release check
lib/online-update.mjs    in-place bundle replacement
lib/update-host.mjs      update route for the settings page
lib/settings-store.mjs   settings file the page writes
lib/settings-host.mjs    settings route for the settings page
lib/owned-data.mjs       data the page owns besides the switches
lib/define-tool.mjs      dependency-free defineTool
lib/format-time.mjs      timestamp formatting for the settings page
lib/version.mjs          strict stable-version helpers
cordis.patch.yml         bundle patch
native/                  computer-use helper sources (Swift, C#)
bin/                     compiled computer-use helpers
docs/architecture.md     how the pieces fit together
```

## Development

```sh
npm test    # offline suite, no permissions or browsers needed
```

`lib/*.mjs` is not covered by the Harness HMR watcher. After editing a module,
remount the plugin so the running instance picks the change up:

```
plugin_manager { action: "set_plugin", target: "include:local-codex-tools", enabled: false }
plugin_manager { action: "set_plugin", target: "include:local-codex-tools", enabled: true }
```

Rebuild the client half after editing `client-entry.js`: bundle it with esbuild as
CommonJS for the browser, keeping the module-loader wrapper the Harness expects
(`window.__ModuleLoader__.load({ id: "@local/dsh-codex-tools", factory(require) { … } })`,
with `react`, `react-dom`, `react-dom/client` and `@deepseek-ai/*` left external).

## License

MIT. See [LICENSE](<LICENSE>).
