# PROJECT KNOWLEDGE BASE

**Generated:** 2026-05-27 09:49 UTC
**Commit:** f885548 (working tree contains unreleased orchestrator + session-tracker refactor)
**Branch:** main

## OVERVIEW

OpenCode plugin that ships Rich Presence to Discord via IPC. Bun + TS, ESM-only, single npm package (`opencode-discord-presence`). Every `chat.message` (main session OR sub-agent) overwrites the presence — last writer wins.

## STRUCTURE

```
.
├── src/
│   ├── index.ts                              # Re-export of default plugin (3 lines)
│   ├── plugin.ts                             # Plugin factory + signal hooks + wiring (entry)
│   ├── config.ts                             # File/env/option merge -> PresenceConfig
│   ├── services/
│   │   ├── discord-rpc.ts                    # @xhayper/discord-rpc wrapper + reconnect + seq counter
│   │   └── presence-orchestrator.ts          # Busy/idle state machine (no session filtering)
│   ├── utils/particle.ts                     # Korean 을/를, 은/는 selector
│   └── types/index.ts                        # Public types + SetActivity re-export
├── scripts/
│   ├── smoke-test.ts                         # Live Discord IPC end-to-end demo
│   └── multi-window-test.ts                  # Two-instance overwrite demo
├── opencode.json                             # Loads plugin from file:// for in-repo dogfooding
├── biome.json                                # Lint+format scoped to src/**
└── .github/workflows/                        # ci.yml = typecheck+lint+build, publish.yml = on release
```

## WHERE TO LOOK

| Task | Location |
|------|----------|
| OpenCode lifecycle hooks (`chat.message`, `event`) | src/plugin.ts |
| Busy/idle state transitions + presence text | src/services/presence-orchestrator.ts |
| `getPresenceDetails(agent, language, idle)` | src/services/presence-orchestrator.ts (top) |
| Config precedence (option > env > default) | src/config.ts:11-21 |
| Default Discord App ID (built-in) | src/config.ts:3 |
| Reconnect / retry (5s delay, 10 max) + seq counter | src/services/discord-rpc.ts |
| Korean particle algorithm (받침 check) | src/utils/particle.ts:10-22 |
| Public types exported to consumers | src/types/index.ts |

## CODE MAP

| Symbol | Type | Location | Role |
|--------|------|----------|------|
| `OpenCodeDiscordPresence` | `Plugin` async factory | src/plugin.ts | Default export; instantiates orchestrator once per process |
| `PresenceOrchestrator` | class | src/services/presence-orchestrator.ts | Tracks busySessions across all chat.message events; routes idle text when all idle |
| `DiscordRPCService` | class | src/services/discord-rpc.ts | Wraps `@xhayper/discord-rpc` Client; reconnect + monotonic seq |
| `getConfig` | fn | src/config.ts:11 | Resolves `PresenceConfig` from file opts + env vars |
| `getObjectParticle` / `getTopicParticle` | fn | src/utils/particle.ts:28,38 | Append correct Korean particle to agent name |
| `loadConfigFile` | fn | src/plugin.ts | Reads `.discord-presence.json` from project dir, then `$HOME` |

## CONVENTIONS

- **ESM with `.js` import suffixes**: All relative imports must end in `.js` even though sources are `.ts` (e.g. `./config.js`). Required by `moduleResolution: "bundler"` + TS ESM emit.
- **No semicolons**: Biome `semicolons: "asNeeded"`. Double-quote strings.
- **Line width 100, 2-space indent**.
- **`bun-types` only**: tsconfig `types: ["bun-types"]` — `@types/node` is NOT loaded; use `node:os`, `node:path` style imports for Node built-ins (already done in plugin.ts:1-2).
- **Logging prefix**: All RPC logs use `[discord-presence]` (see discord-rpc.ts:26,37,...).
- **State lives at module scope in `plugin.ts`**: `rpc`, `currentAgent`, `currentModel` are module-level `let`s reused across plugin invocations within the same process.

## ANTI-PATTERNS (THIS PROJECT)

- **Do not use Node tooling**: no `node`/`npm`/`pnpm`/`yarn`/`vite`/`webpack`/`jest`/`vitest`/`ts-node`/`dotenv`/`express`/`ws`/`pg`/`ioredis`/`better-sqlite3`. Bun replacements only (`bun test`, `bun run`, `Bun.file`, `Bun.serve`, etc.). See CLAUDE.md.
- **Do not throw inside RPC error paths**: `setPresence`, `clear`, `loadConfigFile` swallow errors silently or log only — Rich Presence is best-effort and must never crash the host OpenCode session.
- **Do not re-instantiate `DiscordRPCService` while connected**: plugin.ts:45-47 guards by `isConnected()`. New `Client` per process only.
- **Do not add tests under `src/`** that you expect to publish: `.npmignore` strips `*.test.ts` and `src/` itself; tests must coexist with sources but `dist/` is the only published artifact.
- **Do not loosen Biome rules silently**: `useConst` and `useTemplate` are errors, `noExplicitAny` / `noNonNullAssertion` / `noUnusedVariables` / `noUnusedImports` are warns — fix, don't ignore.

## UNIQUE STYLES

- **Korean particle handling**: Non-Korean characters fall back to a regex on `[lmnr136780]` to approximate consonant-ended romanizations/digits (particle.ts:16). Treat as a heuristic, not a guarantee.
- **Singleton via module-scope `let rpc`**: Not a class singleton — the binding lives in `plugin.ts:9` so multiple `OpenCodeDiscordPresence` invocations share one RPC client.
- **`setPresence` caches `currentPresence`** so a successful reconnect can replay the last activity (discord-rpc.ts:28-30,72).
- **`opencode.json` registers the package by its own name** (`"plugin": ["opencode-discord-presence"]`) — used for in-repo dogfooding, not consumer config.

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
