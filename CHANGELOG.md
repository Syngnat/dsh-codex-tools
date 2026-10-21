# Changelog

All notable changes to this plugin are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.10] - 2026-10-21

### Added

- The settings page has a third tab, 更新. It checks GitHub for the latest stable release, shows the running and latest version, and installs after an explicit confirmation, the same flow as the prompt-assist plugin.

[2.0.10]: https://github.com/Syngnat/dsh-codex-tools/releases/tag/v2.0.10

## [2.0.9] - 2026-10-20

### Fixed

- Windows `computer_use` compiles. The helper now references `WindowsBase.dll`, which defines the rectangles UI Automation returns. The tool description no longer says it only controls macOS apps.
- A small pointer appears at the click or drag point and hides about half a second after the action. It is not shown when the helper starts, and it does not stay on screen after computer use ends. The same pointer is used in the owned browser window.
- The settings page scrolls with the main pane. The scrollbar is no longer stuck in the middle of the blank area.
- Adding an always-allowed app with an empty name says so, instead of doing nothing.

[2.0.9]: https://github.com/Syngnat/dsh-codex-tools/releases/tag/v2.0.9

## [2.0.8] - 2026-10-20

### Fixed

- Settings text uses the host label and border tokens. In the light theme the title, row names, and selected tab no longer fall back to near-white.

### Changed

- Rows that were only labeled unavailable now do something. Excel can be turned off even when any app is allowed. Lock-screen mode refuses computer use while the session is locked, and still cannot type on the secure lock desktop.
- The browser page records addresses this plugin opens, can clear that list, and stops recording when history access is deny.
- Saved logins stay on this machine and fill the matching site. The reply and the settings list do not show the password. Contact fields fill empty name, email, phone, and address inputs.
- Extensions can be disabled as a group or one by one, and an unpacked extension directory is loaded the next time the owned Chrome window starts.
- Download location and the save dialog are applied to that window. Download history is listed. Camera, microphone, location, and notification choices are applied when a page opens.

[2.0.8]: https://github.com/Syngnat/dsh-codex-tools/releases/tag/v2.0.8

## [2.0.7] - 2026-10-20

### Fixed

- Declare `connection` in the host plugin inject list. Without it, Cordis throws `cannot get property "connection" without inject` while registering the settings and update routes, and `local-codex-tools` does not activate. Optional chaining does not prevent that read.

[2.0.7]: https://github.com/Syngnat/dsh-codex-tools/releases/tag/v2.0.7

## [2.0.6] - 2026-10-20

### Changed

- The settings page now follows the two Codex pages: 电脑操控 and 浏览器. Any app, the allow list, both browser windows, full CDP access, and clearing the owned Chrome profiles take effect. Excel, lock-screen control, passwords, extensions, and per-site permissions stay visible and marked unavailable.

[2.0.6]: https://github.com/Syngnat/dsh-codex-tools/releases/tag/v2.0.6

## [2.0.5] - 2026-10-20

### Added

- The 电脑操作 page is now the settings page. It has an Any App switch, an always-allowed app list, and separate switches for the two Chrome windows. The tools read those settings on every call.

### Fixed

- The page no longer calls `connection.createSharedFetchHandler`, which the web client does not provide.

[2.0.5]: https://github.com/Syngnat/dsh-codex-tools/releases/tag/v2.0.5

## [2.0.4] - 2026-10-20

### Changed

- The visible name is 电脑操作, in the sidebar and in the plugin list. The list description no longer mentions Codex.

[2.0.4]: https://github.com/Syngnat/dsh-codex-tools/releases/tag/v2.0.4

## [2.0.3] - 2026-10-20

### Changed

- The sidebar entry is named 本机工具. It no longer says Codex Tools.

[2.0.3]: https://github.com/Syngnat/dsh-codex-tools/releases/tag/v2.0.3

## [2.0.2] - 2026-10-20

### Fixed

- Declare the `./client` package export. Without it the web client never loads `client.js`, so the Codex Tools sidebar entry does not appear.

[2.0.2]: https://github.com/Syngnat/dsh-codex-tools/releases/tag/v2.0.2

## [2.0.1] - 2026-10-20

### Added

- A sidebar page for online update, the same kind of check-and-confirm entry used by the prompt-assist plugin. It calls the Host route `/api/dsh-codex-tools.update`. Installing still requires an explicit confirmation and still refuses a local `link:` checkout.

[2.0.1]: https://github.com/Syngnat/dsh-codex-tools/releases/tag/v2.0.1

## [2.0.0] - 2026-10-20

### Changed

- `computer_use`, `browser`, and `browser_use` no longer start Codex or ChatGPT.app.
- macOS `computer_use` is the bundled `bin/dsh-ax` helper (Accessibility and Quartz).
- Windows `computer_use` is `bin/dsh-uia.exe`. The first call builds it from `native/dsh-uia.cs` with the C# compiler that ships with Windows. No PowerShell version is required.
- `browser` and `browser_use` each launch their own Chrome window over the DevTools Protocol, with separate profiles under `~/.dsh/dsh-codex-tools/`.

### Breaking

- A logged-in Chrome window and the ChatGPT extension are no longer used. Sign in again inside the window this plugin opens.
- Installations that came from GitHub can move to this release with `codex_tools_update`. A local `link:` checkout still has to be remounted and is not replaced by the updater.

[2.0.0]: https://github.com/Syngnat/dsh-codex-tools/releases/tag/v2.0.0

## [1.0.2] - 2026-10-20

### Added

- `browser_use`: Codex's in-app browser (IAB), the surface Codex calls Browser /
  browser-use. Same actions as `browser`, but defaults to browser id `iab` so
  Chrome is not attached and the ChatGPT debugging infobar does not appear.

[1.0.2]: https://github.com/Syngnat/dsh-codex-tools/releases/tag/v1.0.2

## [1.0.1] - 2026-10-20

### Added

- `codex_tools_update`: three actions — `status`, `check`, `install` — so an
  agent can keep this plugin current from its GitHub releases. `check` is
  read-only. `install` requires `confirm: true`, pins the target to an immutable
  commit, refuses install scripts, verifies the recorded bundle row, and
  restores the previous version if the replacement fails.
- 30 offline tests covering version parsing, release-metadata validation, source
  policy, eligibility, the replacement flow with recovery, and the tool surface.
- After `computer_use` and `browser` return, the plugin calls the runtime's
  `turn_ended` hook so Sky's software cursor is dismissed. Leaving that call out
  left the small overlay cursor on screen after the tool finished.


### Notes

- Online update only handles an installation that came from this repository. A
  local `link:` checkout is refused, and `status` names the reason.

## [1.0.0] - 2026-10-20

First release.

### Added

- `computer_use`: 13 actions over the Codex Computer Use runtime — `list_apps`,
  `list_windows`, `get_state`, `click`, `type_text`, `paste`, `press_key`,
  `scroll`, `drag`, `set_value`, `select_text`, `perform_secondary_action`,
  `screenshot`. Reads and drives native macOS apps through their accessibility
  tree, with diffed state reads and screenshots written to disk.
- `browser`: 20 actions over the Codex browser-desktop provider — `list_browsers`,
  `list_tabs`, `open_tab`, `get_tab`, `documentation`, `state`, `click`,
  `type_text`, `paste`, `press_key`, `scroll`, `drag`, `select_text`, `set_value`,
  `goto`, `back`, `forward`, `reload`, `close`, `screenshot`.
- `session_message`: 7 actions over the Host's own `sessionController` and
  `workspaceRegistry` — `list_workspaces`, `list_sessions`, `dispatch`, `create`,
  `send`, `fork`, `rename`. `dispatch` creates a session in another workspace and
  delivers a complete task brief in one call.
- MCP stdio client for the Codex REPL server, including the trusted-module
  environment the kernel needs, the Codex turn metadata the browser provider
  requires, one-time first-use documentation absorption, and elicitation-based
  app approvals.
- 20 unit tests and 5 live tests.

### Notes

- `lib/*.mjs` is not covered by the Harness HMR watcher; remount the plugin after
  editing a module.
- `computer_use` does not activate windows or move the pointer, and draws no
  overlay.

[1.0.2]: https://github.com/Syngnat/dsh-codex-tools/releases/tag/v1.0.2
[1.0.1]: https://github.com/Syngnat/dsh-codex-tools/releases/tag/v1.0.1
[1.0.0]: https://github.com/Syngnat/dsh-codex-tools/releases/tag/v1.0.0
