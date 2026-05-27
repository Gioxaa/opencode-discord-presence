# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Config compatibility: `applicationId` remains the recommended top-level key, and `discordPresence.applicationId` is accepted as a backward-compatible fallback when parsing config files.
- **Korean localization for Rich Presence** — runtime presence states support `language: "ko"` with proper Korean particle handling (을/를, 은/는)
  - Idle state: `{agent}는 휴식중` / `{agent}은 휴식중` based on final consonant check
  - File spotlight: `{agent}을/를 작업중`
  - Task mission board: `{agent}을/를 작업중`
  - Diagnostics and warnings: `오류 {n}개, 경고 {m}개` / `경고 {n}개`
  - Session recap and stats line: `{n}개 프롬프트 • {m}개 파일`
  - All tasks complete: `모든 작업 완료!`, `{n}/{m} 완료`
  - English (`"en"`) remains default with `language: Language = "en"` parameter
- **Enhanced Rich Presence** — major feature update with Live File Spotlight, Task Mission Board, diagnostics-ready display scaffolding, session recap, and smart rotation
  - Live File Spotlight shows the file currently being edited/read/diagnosed with language-specific Discord icons
  - Task Mission Board displays active todo progress with completion counts (e.g., "Implementing dark mode (2/5)")
  - Diagnostics display scaffolding is present, but OpenCode plugin API v1 does not currently provide counts through `lsp.client.diagnostics`
  - Session recap shows total prompts and files touched for 30 seconds after session end
  - Informational cards rotate every 20 seconds by default (configurable 10–60s)
  - Critical states (errors, idle, all-done, recap) pin until resolved
- Added new configuration options: `richPresence.enableFileSpotlight`, `richPresence.enableMissionBoard`, `richPresence.rotationIntervalSeconds`, `richPresence.diagnostics.errorsOnly`
- Refactored plugin to use instance-scoped presence state (no more module-level mutable globals)
- Hardened Discord RPC service with explicit disconnect, throttled updates, and stale-replay prevention

### Changed

- All `[discord-presence]` lifecycle logs (connect / disconnect / failures) flow through `this.log` / `this.warn` and are gated on `config.debug` — preserved from 0.3.0, so the plugin remains silent by default after this PR merges.

### Fixed

- Empty catch blocks in RPC service — replaced with structured error logging
- Potential stale replay after session deletion — guarded by `cleared` flag
- Infinite reconnect loop — `disconnect()` now prevents further reconnect attempts

## [0.3.0] - 2026-05-27

### Added

- `PresenceOrchestrator` class encapsulating the busy/idle state machine (testable, no module-level state leaks).
- Monotonic update sequence on `DiscordRPCService` to drop stale `setActivity` calls during in-process races.
- Graceful shutdown via `SIGINT` / `SIGTERM` / `exit` hooks that disconnect cleanly from Discord IPC.
- `debug` config option (file / env `OPENCODE_DISCORD_DEBUG=true`). When **false** (default), the plugin emits **zero** logs to the OpenCode console. When **true**, `[discord-presence]` lifecycle messages are printed via `console.log` / `console.warn`.
- 37 unit / integration tests across particle, config, discord-rpc, and presence-orchestrator.
- `scripts/smoke-test.ts` and `scripts/multi-window-test.ts` for live Discord IPC verification.

### Changed

- **Silent by default.** Previous versions always printed `[discord-presence] Connected to Discord` and reconnect messages. Set `debug: true` (or `OPENCODE_DISCORD_DEBUG=true`) to restore the old behavior.
- Every `chat.message` (main session OR sub-agent spawned by `task`) updates Rich Presence with the responding agent's name. Last writer wins — naturally surfaces whichever agent is currently active.
- Plugin now subscribes to `session.status` events so request completion (`status.type === "idle"`) swaps the presence to the idle text. `session.idle` is still handled as a fallback.
- Idle text (`"X is idle"` / `"X는 휴식중"`) is shown only when **every** tracked session reports idle. Single-session-idle while others are still busy keeps the latest agent's busy text.
- Multi-window setups: every plugin instance writes its own presence directly to Discord. Last writer wins through Discord IPC, so the most-recently-active window's agent is displayed.
- `src/plugin.ts` reduced to thin wiring (orchestrator + lifecycle hooks). Architecture lives in `src/services/`.

### Fixed

- Idle state is now driven by `session.status: idle` instead of waiting for `session.deleted`. The presence transitions to the idle text as soon as the request completes.
- Reconnect / disconnect logging is silenced on intentional shutdown — no more spurious `Max retries reached` line at process exit.

## [0.1.0] - 2026-01-30

### Added

- Initial release of opencode-discord-presence plugin
- Discord Rich Presence integration with OpenCode
- Real-time agent and model display
- Session time tracking with elapsed time
- Token usage tracking and formatting (e.g., "12.5k tokens")
- Project name detection from Git remote URL or directory path
- Korean particle support (을/를, 은/는) for proper Korean grammar
- Idle/active state detection
- Configuration options:
  - `enabled` - Enable/disable the plugin
  - `applicationId` - Custom Discord Application ID
  - `showSessionTime` - Toggle session time display
  - `showTokenUsage` - Toggle token usage display
  - `showProjectName` - Toggle project name display
- Singleton Discord RPC service with:
  - Automatic reconnection with exponential backoff
  - Debounced presence updates to avoid rate limiting
- Comprehensive test suite with 42+ tests
- Full TypeScript support with type definitions
- Biome linting and formatting

### Technical Details

- Built with Bun runtime
- Uses @xhayper/discord-rpc for Discord integration
- Follows OpenCode plugin architecture with `@opencode-ai/plugin`
- TDD development approach

[Unreleased]: https://github.com/Puri12/opencode-discord-presence/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/Puri12/opencode-discord-presence/compare/v0.1.0...v0.3.0
[0.1.0]: https://github.com/Puri12/opencode-discord-presence/releases/tag/v0.1.0
