# Changelog

All notable changes to this plugin are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.22] - 2026-10-21

### Fixed

- A live update could end as "更新失败，自动恢复也失败" even though the plugin came back on the old version. The activation check treated the transient states of a remount, such as a stale enabled flag, a loading fiber, two rows at once, or a route that has not answered yet, as a fatal failure. It now waits them out, and reports "需要重启" when the bundle is active but the running version cannot be confirmed, instead of demanding a manual reinstall.
- A failed install that the plugin manager rolls back on its own is reported as a restore, not as a broken installation.

### Added

- The update page shows the failure code when a job fails, so the reason is visible instead of only the phase label.

## [2.0.21] - 2026-10-21

### Added

- The update page shows when the last check ran.

## [2.0.20] - 2026-10-21

### Fixed

- The update check no longer depends on the anonymous GitHub API quota. The version now comes from the `releases/latest` redirect and the pinned commit from the git ref advertisement, so a shared address that spent its sixty-per-hour quota still finds new releases. The REST API stays as a fallback.
- Every GitHub request retries a transport hiccup. The first connection through a proxy can hang for the whole timeout, which is why the check used to fail on a cold connection.

## [2.0.19] - 2026-10-21

### Fixed

- The latest version row said "检查更新" when no check had run yet, which read like a version number. It now says the check has not run.

## [2.0.18] - 2026-10-21

### Fixed

- The update page failed with "检查没有成功" because the route handler used an update service it never created. The route now builds the service when a request arrives, so a plugin manager or job service that mounts later no longer leaves the page empty, and a missing service is reported as a reason instead of an error.

### Added

- The update page links to the release notes of the version it found.

## [2.0.17] - 2026-10-21

### Added

- The update page shows the immutable commit the update installs, so the target is visible while the job runs.

## [2.0.16] - 2026-10-21

### Changed

- The online update now replaces the plugin in place, like the prompt-assist plugin. The install runs in a Host job, so removing this plugin no longer aborts the work that replaces it, and the job reads the running version back through the plugin's own route before it claims the update succeeded. When the new code is live the page says so and no restart is needed.
- The page shows the update job's phases while the swap runs, and reads the job's result afterwards.

### Added

- `codex_tools_update` gained an `operation` action that reports the state of the update job.

## [2.0.15] - 2026-10-21

### Fixed

- The update page no longer says both "a new version can be installed" and "online update is not possible here" at the same time. When the copy on disk is newer than the one this process loaded, it now says the new version is already installed and only needs a restart, and it shows the installed version next to the running one.

## [2.0.14] - 2026-10-21

### Fixed

- The owned Chrome no longer touches the login keychain. macOS showed a "Could not find keychain" alert on every start of the tool's window, and a second one about the keychain it wanted to store Chrome in. The window now runs with `--use-mock-keychain` and `--password-store=basic`, so it keeps its secrets in memory and never asks the keychain. The restore bubble after a killed window is off as well.

## [2.0.13] - 2026-10-21

### Fixed

- `press_key` sent the key name as the event text, so Chrome rejected every key with `Invalid 'text' parameter`. Keys and chords are now mapped to `key`, `code` and `windowsVirtualKeyCode`, text is only sent for printable keys, and `duration_ms` is honoured.
- `set_value` appended to the existing field contents. It now selects the old contents first, so the field ends up with exactly the new value.
- Element ids were array positions in the accessibility tree, so inserting one node renumbered every later element. Ids are now derived from the accessibility node id and stay valid across reads.
- A click that opens a `target=_blank` link now says which tab it opened.
- A failed focus is reported instead of being swallowed.
- A Chrome that was killed left a stale `DevToolsActivePort` file, and the plugin then talked to a dead port. The stale file is now cleared before Chrome starts.

## [2.0.12] - 2026-10-21

### Fixed

- 扩展的停用和启用现在是真的：目录在 `Default/Extensions` 与 `Default/Extensions-disabled` 之间移动，Chrome 下次启动就按新的加载。列表同时显示两种状态。

### Removed

- 未打包扩展目录的输入框。Chrome 155 已不接受 `--load-extension`，这个框加进去的扩展从来不会加载。
- 默认使用网站工具的开关。Chrome 155 没有 `navigator.modelContext`，CDP 的 WebMCP 域能启用但不会注入页面接口，这一项没有可以生效的行为。

## [2.0.11] - 2026-10-21

### Fixed

- 批注截图, 网页 URL 和链接打开位置, and 本地 URL 打开位置 were saved but never read. They now change what the browser does: screenshots carry the last click or drag, and a URL can open in this window or in the system browser.
- 默认使用网站工具 was a switch with nothing behind it. It is now shown as unavailable, and the per-extension 启用 and 停用 buttons are gone because Chrome cannot disable one extension from here.

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
