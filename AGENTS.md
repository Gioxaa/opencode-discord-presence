# PROJECT KNOWLEDGE BASE

**Generated:** 2026-05-27 09:49 UTC
**Commit:** f885548 (working tree contains unreleased orchestrator + session-tracker refactor)
**Branch:** main

## OVERVIEW

OpenCode plugin that ships Rich Presence to Discord via IPC. Bun + TS, ESM-only, single npm package (`opencode-discord-presence`). Architecture splits into THREE layers: (1) `PresenceOrchestrator` owns busy/idle session state, (2) reducer + activity-rotation render the snapshot into a Discord activity payload, (3) `DiscordRPCService` writes to Discord IPC. `SessionTracker` is an optional fourth layer consulted only when `richPresence.mainAgentOnly: true` to filter sub-agent sessions via `parentID` lookup.

## STRUCTURE

```
.
├── src/
│   ├── index.ts                              # Re-export of default plugin (3 lines)
│   ├── plugin.ts                             # Plugin factory + signal hooks + orchestrator/tracker wiring
│   ├── config.ts                             # File/env/option merge -> PresenceConfig (incl. mainAgentOnly)
│   ├── services/
│   │   ├── discord-rpc.ts                    # @xhayper/discord-rpc wrapper + reconnect + debounce + seq counter
│   │   ├── presence-orchestrator.ts          # Pure busy/idle state machine; returns transition deltas, NO RPC
│   │   └── session-tracker.ts                # main vs sub-agent kind resolver via client.session.get + parentID
│   ├── state/presence-state.ts               # PresenceSnapshot + presenceReducer (identity, file, todo, etc.)
│   ├── utils/
│   │   ├── activity-rotation.ts              # Snapshot → ActivityPayload (precedence + rotation + model prefix)
│   │   ├── particle.ts                       # Korean 을/를, 은/는 selector
│   │   ├── session-metrics.ts                # Message count + uniqueFilesTouched accumulator
│   │   ├── session-persistence.ts            # Save/load/clear session metrics
│   │   ├── file-icons.ts / file-label.ts     # Discord icon key + path truncation
│   │   └── tool-label.ts                     # Tool name → human label (Editing, Reading, ...)
│   └── types/index.ts                        # Public types (RichPresenceOptions incl. mainAgentOnly)
├── scripts/
│   ├── smoke-test.ts                         # Live Discord IPC end-to-end demo (orchestrator transitions)
│   └── multi-window-test.ts                  # Two-instance overwrite demo
├── .discord-presence.json                    # Project dogfooding config (ko, debug, mainAgentOnly:false)
├── opencode.json                             # Loads plugin from file:// for in-repo dogfooding
├── biome.json                                # Lint+format scoped to src/**
└── .github/workflows/                        # ci.yml = typecheck+lint+build, publish.yml = on release
```

## WHERE TO LOOK

| Task | Location |
|------|----------|
| OpenCode lifecycle hooks (`chat.message`, `tool.execute.before/after`, `event`) | src/plugin.ts |
| Busy/idle state machine + lastAgent/lastModel tracking | src/services/presence-orchestrator.ts |
| Main vs sub-agent classification (`parentID`) | src/services/session-tracker.ts |
| Skip logic when `mainAgentOnly: true` | src/plugin.ts:`shouldSkipSession` (async) / `shouldSkipSessionSync` (fast-path) |
| Activity payload composition (model prefix, rotation, precedence) | src/utils/activity-rotation.ts |
| Reducer-driven snapshot updates | src/state/presence-state.ts |
| Config precedence (option > env > default) | src/config.ts:`getConfig` |
| Reconnect / retry (5s delay, 10 max) + debounce (100ms) + truncate (126) | src/services/discord-rpc.ts |
| Korean particle algorithm (받침 check) | src/utils/particle.ts |
| Public types exported to consumers | src/types/index.ts |

## CODE MAP

| Symbol | Type | Location | Role |
|--------|------|----------|------|
| `OpenCodeDiscordPresence` | `Plugin` async factory | src/plugin.ts | Default export; instantiates orchestrator + tracker + reducer state per process |
| `PresenceOrchestrator` | class | src/services/presence-orchestrator.ts | Pure state machine. `markBusy`/`markIdle` return `{wasIdle/nowAllIdle, lastAgent, lastModel}` deltas — NO RPC dependency |
| `SessionTracker` | class | src/services/session-tracker.ts | `prime` from session.created/updated, `peek` sync, `resolve` async via `client.session.get`. Coalesces concurrent lookups, 5s negative cache |
| `DiscordRPCService` | class | src/services/discord-rpc.ts | Wraps `@xhayper/discord-rpc` Client; reconnect + debounce + setPresenceFromSnapshot |
| `presenceReducer` | fn | src/state/presence-state.ts | Pure partial-update reducer over `PresenceSnapshot` |
| `getActivity` | fn | src/utils/activity-rotation.ts | Snapshot → ActivityPayload with `{model} • ` state-line prefix for active cards |
| `getConfig` | fn | src/config.ts | Resolves `PresenceConfig` from file opts + env vars (incl. `richPresence.mainAgentOnly`) |
| `getObjectParticle` / `getTopicParticle` | fn | src/utils/particle.ts | Append correct Korean particle to agent name |
| `loadConfigFile` | fn | src/plugin.ts | Reads `.discord-presence.json` from project dir, then `$HOME` |

## CONVENTIONS

- **ESM with `.js` import suffixes**: All relative imports must end in `.js` even though sources are `.ts` (e.g. `./config.js`). Required by `moduleResolution: "bundler"` + TS ESM emit.
- **No semicolons**: Biome `semicolons: "asNeeded"`. Double-quote strings.
- **Line width 100, 2-space indent**.
- **`bun-types` only**: tsconfig `types: ["bun-types"]` — `@types/node` is NOT loaded; use `node:os`, `node:path` style imports for Node built-ins (already done in plugin.ts:1-2).
- **Logging prefix**: All RPC logs use `[discord-presence]` (see discord-rpc.ts:26,37,...).
- **Instance-scoped state per plugin invocation**: `rpc`, `snapshot`, `orchestrator`, `tracker`, `sessionMetricsState` live in the `OpenCodeDiscordPresence` closure — no module-level mutable globals (changed from pre-0.4.0).
- **Orchestrator returns DELTAS, never calls RPC**: `markBusy`/`markIdle` return `{wasIdle/nowAllIdle, lastAgent, lastModel}` objects. The plugin layer interprets the delta and pushes through the reducer + `setPresenceFromSnapshot`. This is the ONLY way to avoid double-writer races between the orchestrator's busy/idle text and the reducer's rich-presence cards.
- **SessionTracker priming first, SDK resolve last**: Always handle `session.created`/`session.updated` BEFORE calling `client.session.get`. Priming is sync; SDK resolve is async + coalesced + negatively cached.

## ANTI-PATTERNS (THIS PROJECT)

- **Do not use Node tooling**: no `node`/`npm`/`pnpm`/`yarn`/`vite`/`webpack`/`jest`/`vitest`/`ts-node`/`dotenv`/`express`/`ws`/`pg`/`ioredis`/`better-sqlite3`. Bun replacements only (`bun test`, `bun run`, `Bun.file`, `Bun.serve`, etc.). See CLAUDE.md.
- **Do not throw inside RPC error paths**: `setPresence`, `clear`, `loadConfigFile` swallow errors silently or log only — Rich Presence is best-effort and must never crash the host OpenCode session.
- **Do not re-instantiate `DiscordRPCService` while connected**: plugin guards by `isConnected()`. New `Client` per process only.
- **Do not let orchestrator own RPC again**: The pre-merge 0.3.0 design had `PresenceOrchestrator` directly call `rpc.setPresence`. PR-1 added reducer-driven `setPresenceFromSnapshot`. Two writers = race. Current architecture: orchestrator returns deltas, plugin layer is the SOLE writer.
- **Do not skip the rich-presence-render path when handling session.status busy with no agent change**: A bare `markBusy(sessionID)` (status keep-alive) still needs to call `pushPresence` so the reducer-driven snapshot (file spotlight, mission board, etc.) is sent to Discord.
- **Do not add tests under `src/`** that you expect to publish: `.npmignore` strips `*.test.ts` and `src/` itself; tests must coexist with sources but `dist/` is the only published artifact.
- **Do not loosen Biome rules silently**: `useConst` and `useTemplate` are errors, `noExplicitAny` / `noNonNullAssertion` / `noUnusedVariables` / `noUnusedImports` are warns — fix, don't ignore.

## UNIQUE STYLES

- **Korean particle handling**: Non-Korean characters fall back to a regex on `[lmnr136780]` to approximate consonant-ended romanizations/digits (particle.ts). Treat as a heuristic, not a guarantee.
- **`setPresence` caches `currentPresence`** so a successful reconnect can replay the last activity.
- **`opencode.json` registers the plugin by `file://` absolute path** (`"plugin": ["file:///abs/path"]`) for in-repo dogfooding — uses the local `dist/` build, not the published npm package.
- **`.discord-presence.json` next to `opencode.json` is checked-in for this repo's own dogfooding settings** (ko, debug, mainAgentOnly:false). Consumers should NOT copy this file — they create their own.
- **Model name lives at the front of the state line** via `withModel(line)` helper in `activity-rotation.ts`. All active cards (file spotlight, mission board, diagnostics, session stats) receive it; idle and recap omit it because current model is not relevant in those states.

## COMMANDS

```bash
bun install                  # install deps
bun run --watch src/index.ts # dev (no Discord wiring; just runs entry)
bun run typecheck            # tsc --noEmit
bun run lint                 # biome check src/
bun run lint:fix             # biome check --write src/
bun run format               # biome format --write src/
bun run build                # tsc -p tsconfig.build.json -> dist/
bun test                     # bun:test runner (no tests committed yet)
```

CI mirrors: typecheck → lint → build. Release tag → `publish.yml` runs same chain then `npm publish --access public` with `NPM_TOKEN`.

## NOTES

- **No tests committed yet** despite CONTRIBUTING.md and CHANGELOG claiming "42+ tests". When adding tests, colocate as `*.test.ts` next to source; tsconfig already excludes them and `.npmignore` strips them at publish.
- **CHANGELOG drift**: `0.1.0` entry lists features (`showTokenUsage`, `showProjectName`, exponential backoff, debounce) that are NOT in the current code (linear 5s reconnect, no token/project tracking). Current `package.json` is `0.2.10`. Treat the changelog as aspirational until it is reconciled.
- **`@opencode-ai/plugin` is a peer dep marked optional** — runtime types come from there; the plugin must keep importing `type { Plugin }` only (no value imports) so consumers without the peer still resolve.
- **Default Client ID `1466770544748662819`** is the shared/public Discord app; users override via `applicationId` config or `OPENCODE_DISCORD_CLIENT_ID` env to host their own assets (notably the `opencode-logo` image key, discord-rpc.ts:68).
- **Idle is event-driven, not timer-based**: relies on OpenCode emitting `session.idle`; there is no local inactivity timeout.
