# Architecture

How the pieces of this plugin fit together, and what each boundary promises.

## Halves

| Half | Entry | Runs in |
| --- | --- | --- |
| Host | `index.js`, `lib/*.mjs` | the Harness process, Node |
| Client | `client-entry.js` → `client.js` | the Harness Web UI, React |

The Host half registers the four tools and two HTTP routes. The Client half only
renders the settings page: it reads and writes through those routes, so the page
never touches the filesystem or the machine directly.

## Boundaries this plugin keeps

- **No external desktop client.** Nothing here starts ChatGPT, Codex, or any of
  their runtimes; the helpers and the browser driver are this plugin's own code.
- **No MCP.** The tools are registered in-process with `ctx.tools.register`; there
  is no MCP server, no stdio handshake and no `mcp__` name.
- **No shell.** Windows support does not depend on PowerShell, and the plugin never
  shells out to run a tool call. The one process it does run is its own compiled
  helper.

## `computer_use`

```
tool call → lib/computer-tool.mjs → lib/ax-client.mjs → helper process (stdio)
                                                          ├─ macOS:   bin/dsh-ax  (Accessibility)
                                                          └─ Windows: bin/dsh-uia.exe (UI Automation)
```

`AxClient` speaks one JSON object per line over the helper's stdin/stdout, keeps a
single child per plugin instance, and correlates replies by request id.

**macOS** uses `bin/dsh-ax`, a Swift helper built on the Accessibility API. The app
running the Harness needs Accessibility permission; screenshots additionally need
Screen Recording.

**Windows** uses `bin/dsh-uia.exe`, built from `native/dsh-uia.cs` the first time a
call needs it. The compiler is `csc.exe` from the .NET Framework 4.x that ships
inside Windows (`%SystemRoot%\Microsoft.NET\Framework64\v4.0.30319`), so no SDK and
no PowerShell are involved. The built binary lands in the installed package's `bin/`
directory, which means a reinstall compiles it once more.

**Element indices** belong to the last `get_state` the helper produced. A mutating
action re-reads state afterwards (unless `return_state: false`), and every state
read is a diff against the previous one unless `full_tree: true`. An index from a
stale tree is rejected by the helper rather than applied to the wrong element.

## `browser`

```
tool call → lib/browser-tool.mjs → lib/cdp-browser.mjs → Chrome (DevTools Protocol)
```

`CdpBrowser` owns one Chrome instance. It starts Chrome with a private profile
directory at `~/.dsh/dsh-codex-tools/browser`, waits for the DevTools endpoint
(reading `DevToolsActivePort` from that profile), and talks to it over CDP. It
does not attach to a Chrome the user already runs, so no debugging flag, extension
or remote-debugging port is imposed on the user's browser session.

A bound tab stays bound for later calls, which is what keeps element ids stable
between a `state` read and the action that uses them. While an action runs the
driver may draw a short-lived ring around the target element for the benefit of a
screenshot; it removes that marker again before the next read.

## `session_message`

Pure Host plumbing: `sessionController` and `workspaceRegistry` from the Context.
No storage access, no filesystem walk, no helper process. A dispatched session is an
ordinary Harness session — it shows up in the sidebar and runs on its own.

`send` resolves the target Agent (`sessionController.resolveAgent`) and steers a
durable `agent-message` message whose source uses `form: "relay"` and the sender's
title (or id) as `senderSessionId`. This preserves the sender in the target's
message row and bypasses the next-turn queue even while the target is running a
goal. The public `sessionController.prompt` path remains the fallback for Hosts
without `resolveAgent`/`steer`, for subagent targets (ownership checks), and when a
caller explicitly asks for `mode: "queue"`.

## `codex_tools_update`

Two halves that must not be confused:

- **Check** is read-only and rate-limit friendly. The stable version comes from the
  GitHub release redirect, the tag→commit mapping from the repository's git refs, and
  the manifest from `raw.githubusercontent.com`; the REST API is only a fallback, so
  an exhausted quota does not break the check.
- **Install** replaces the bundle from inside an unowned Host job. A job does not
  belong to the plugin, so unloading the plugin mid-flight cannot kill the swap.
  Afterwards the plugin does not trust the manager's receipt: it polls until its own
  bundle row is active and its own route reports the new version.

If the replacement fails after the profile was mutated, the previous version is
reinstalled and re-enabled. A failure that not even that recovers is reported as a
failure with the manual command, never as success.

## Settings

`~/.dsh/dsh-codex-tools/settings.json` holds what the page owns: the two master
switches and the any-app/allowed-apps restriction for `computer_use`. The tools
read the file on every call, so a switch takes effect on the next tool call without
a restart.

The Host Config on the patch row is a different layer: it decides which tools are
registered at all (`computerUse`, `browser`, `sessionMessaging`, `update`).

## Pages

The settings page is a panel registered in the Client half, not a sidebar row. It is
reached from this plugin's own page in the 插件 (Plugins) page, so the sidebar keeps
one row for the app instead of one row per plugin.
