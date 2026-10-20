# Changelog

All notable changes to this plugin are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[1.0.0]: https://github.com/Syngnat/dsh-codex-tools/releases/tag/v1.0.0
