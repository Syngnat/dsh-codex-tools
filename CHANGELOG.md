# Changelog

All notable changes to this plugin are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.41] - 2026-10-27

### Fixed

- The sent record is now appended **during** the sending turn. The previous turn-end listener produced no record because a user message appended after `turn/end` is rejected by the session surface validator.
- The send result now reports `Sent record: appended | skipped: no sender session | rejected: …`, so a missing bubble can be diagnosed from the tool result instead of guessing.
- Sender session resolution falls back to `exec.agent.session`, `exec.session`, then the `sessions` service.
- Tests assert the record exists immediately after `send`.

## [2.0.40] - 2026-10-27

### Fixed

- The sender-side sent record now subscribes to the **plugin** `session/event` bus instead of `exec.agent.ctx`, whose listener did not fire in the live Host. The sender session is resolved from `exec.agent.session` or the `sessions` service.
- A 5-second fallback appends the record even when no `turn/end` event is observed, so a successful send always leaves a visible `【跨会话发送记录】` bubble in the sender's transcript. The record is still a user message and is marked as a send record.
- The send result remains `Delivered the agent message ... immediately`; target delivery is unchanged.

## [2.0.39] - 2026-10-27

### Added

- Plugin-only turn-trigger title override, no DSH source change. The client half registers a higher-priority `conversation.chat.node` / `turn-trigger` entry, so an `agent-message` card is titled `收到会话 <sender> 的消息` instead of the generic `收到任务消息`. The sender comes from the durable `source.senderSessionId`; no title falls back to `另一个会话`.
- Other trigger kinds keep distinct Chinese titles (`收到目标消息`, `子代理已完成`, `收到 Webhook 消息`, `收到定时任务消息`, `收到任务消息`). The card keeps a collapsible body with the original content.
- The override shadows the core turn-trigger renderer for all kinds at priority 1000; DSH itself is untouched.
- Tests pin the title mapping and text extraction.

## [2.0.38] - 2026-10-27

### Fixed

- The relay message prefix no longer repeats the sender when there is no session title: it was `Agent <id> (<id>) sent a message:`, now it is `Agent <id> 发来一条消息：`. When a title exists it stays `Agent <title> (<id>) 发来一条消息：`.
- The prefix is Chinese; no English `sent a message` remains in the recipient's bubble.
- Tests cover the no-title dedupe and the localized prefix.

## [2.0.37] - 2026-10-27

### Added

- The **sender** now gets a durable sent-message bubble. After a successful `send`, the tool waits for the sending turn to end, then appends a `user/message` record to the sender's own transcript: `【跨会话发送记录】已发送给会话 <id>：<text>`. It is visible in the sender's chat, survives reloads, and is appended after the turn so it is not fed into the model step that performed the send. The next turn sees it as a marked record, not a fresh instruction.
- This complements target-side delivery: the target receives the attributed `agent-message`/relay message, while the sender now has a local record instead of only a tool card.
- Tests cover the turn-end timing: no record before `turn/end`, one record after it.

## [2.0.36] - 2026-10-27

### Fixed

- An explicit `check` (UI button and `codex_tools_update` tool) now bypasses the 30-second cooldown and asks the GitHub REST API first. The release redirect can lag behind a just-published tag, which made the page show `latest 2.0.32` while running `2.0.33`; the explicit check now resolves the real latest release immediately.
- When the redirect result is **not newer** than the running version, the service consults the REST API once and prefers a genuinely newer answer. If the API is unavailable or rate-limited, the redirect result is kept. A legitimately-ahead local build still reports `ahead` rather than a fabricated update.
- Tests cover the stale-redirect API fallback and the forced, cooldown-bypassing check.

## [2.0.35] - 2026-10-27

### Added

- `session_message` gains `action: "read"`: it returns the target session's most recent user/assistant text messages, with durable source attribution, so an AI-to-AI exchange can be read back across workspaces. The Host's workspace-scoped `session_event_search`/`session_trace` tools reject a session outside the caller workspace (`session target is outside the caller workspace`); `read` goes through the Host `sessionQuery` service directly, the same trusted read path the core query tools use after their authorization layer.
- `read` accepts the same `session-<uuid>`/bare-UUID normalization as `send`, takes `limit` 1–100 (default 20), and returns `{sessionId, title?, messages:[{seq, role, source?, text}]}`. It reads the current model surface, not a full archive; pending inbox messages are not included.

## [2.0.34] - 2026-10-27

### Fixed

- `list_sessions` now lists top-level sessions only by default. Subagent rows carry a bare UUID and were mixed into the same list, which made a caller pick one and send to the wrong target on the first attempt. `include_subagents: true` explicitly includes them, and the rows carry `origin`/`parentSessionId`.

## [2.0.33] - 2026-10-27

### Fixed

- `send` accepts both the canonical `session-<uuid>` id and a bare UUID. The Host list contains both shapes (top-level sessions are normally prefixed; subagent sessions keep a bare UUID), so a caller that copied a bare top-level id failed with `session/not-found` on the first send. The tool now tries the canonical form first and falls back to the other shape **only** for a not-found result; ownership and busy failures are never retried against a different session.
- `list_sessions` returns `origin` and `parentSessionId` when the Host provides them, so a bare-UUID subagent row is distinguishable from a top-level target instead of looking like a random id. (v2.0.34 additionally hides subagents unless requested.)
- Tests cover repairing a bare UUID to `session-<uuid>`, falling back to a bare UUID when the prefixed id is absent, and the new list fields.

## [2.0.32] - 2026-10-27

### Fixed

- `session_message` with `action: "send"` now steers immediately by default. Previously the omitted `mode` became a queued follow-up, so a session running a goal received the message only after its current turn (or goal round) completed. The default is now `mode: "steer"`; `mode: "queue"` remains an explicit opt-in.
- Cross-session sends keep their sender: the target Agent is resolved and steered with a durable `agent-message` message whose source uses `form: "relay"`. The target message row shows "来自会话 <sender title or id>" (client locale: "From session …") and the recipient model sees the sender in the first content line, instead of a bare user prompt with no attribution.
- The sender title is resolved from the Host session list with the sender id as fallback. Subagent targets keep the Host's ownership-checked `sessionController.prompt` path, and Hosts without `resolveAgent`/`steer` fall back to the public prompt path with `mode: "steer"`.
- Tests cover the default steer, explicit queue, relay source and sender line, the subagent fallback, and the attributed message path.

## [2.0.31] - 2026-10-26

### Fixed

- Windows `computer_use` addresses a **window**, not just a process name. `app: "chrome"` used to resolve to whichever Chrome process the enumeration reached first, so on a machine with two Chrome windows a click landed in the other window's page and `type_text` failed with a bare localized "access denied". An `app` that matches several windows is now refused with the candidate list (pid, handle, title, session), and `pid`, `window_handle` or `window_title` chooses one. A pid is not always enough either: two windows of one process share it, and the error says so instead of picking one.
- `type_text`, `paste` and `set_value` prefer the UI Automation `ValuePattern` and otherwise verify that the target window holds the foreground, raising it with an attach-thread retry, before sending keys. Every failure carries the target window, the window that actually holds the foreground and the Win32 code, so `ambiguous_window`, `foreground_denied`, `input_denied` and `element_from_other_window` can be told apart instead of collapsing into "access denied".
- An element index taken from one window is no longer used against another window, and a source window that closed after `get_state` is reported rather than silently skipped. The focused element must belong to the target window, not merely to its process, so typing cannot land in a sibling window of the same app.
- `list_windows` reports pid, window handle, title, session, process and state per window, and works without `app` so the machine's windows can be discovered. It reads Win32 facts only: probing every window with UI Automation would block the helper behind one hung app.

## [2.0.30] - 2026-10-23

### Removed

- The 插件-page 「打开设置」 button. The settings live in the Harness settings dialog's own navigation (设置 → 电脑操控), so the extra entry point is no longer needed.

## [2.0.29] - 2026-10-23

### Changed

- `browser` and `browser_use` are one tool again. Both drove the same Chrome through the DevTools Protocol and differed only by profile, so the second registration duplicated the schema in the model context. The remaining `browser` tool keeps the profile at `~/.dsh/dsh-codex-tools/browser`. The retired `browser-use` profile is left on disk; clearing browsing data removes it. The bundle option `browserUse` and the setting `browserUseEnabled` are gone; `browser` and `browserEnabled` cover the one window.

## [2.0.28] - 2026-10-23

### Changed

- The settings now also open from the Harness settings dialog's own navigation (设置 → 电脑操控), one click instead of walking through the 插件 page. The entry on the plugin's page in 插件 stays.

## [2.0.27] - 2026-10-22

### Removed

- The MCP stdio client for an external desktop runtime (`lib/cua-repl-client.mjs`) and the live suite that drove it. The plugin's tools are native and in-process; nothing has used that module since computer use moved to its own helper.
- The dead `cua` REPL action builders in `lib/computer-tool.mjs` and `lib/browser-tool.mjs` (−334 lines), and the `surfaces` bundle option, which the plugin stopped reading.

### Fixed

- README and architecture docs described behaviour the code no longer has (an in-app browser, a Chrome extension requirement, MCP approvals, Codex-specific env vars). They now describe what the plugin actually does: a helper per platform, two Chrome profiles the plugin owns, and the settings page as the only configuration surface.

## [2.0.26] - 2026-10-21

### Changed

- 电脑操控 no longer takes a row in the sidebar. The settings open from the plugin's own page in the 插件 page, so the sidebar keeps one row for the app instead of one row per plugin.

## [2.0.25] - 2026-10-21

### Changed

- 批注截图 now marks the screenshot itself. The last click or drag is drawn on the picture as a red ring, with a dashed line for a drag, and removed again right after the capture. Before this it only added a line of text to the tool result, which the model already knew.

## [2.0.24] - 2026-10-21

### Changed

- The last-check time prints as `yyyy-MM-dd HH:mm:ss UTC+8` in 24-hour form, instead of following the machine's locale.

## [2.0.23] - 2026-10-21

### Added

- The update page says the plugin unloads itself and comes back while installing, so a page that disappears for a moment is expected.

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
