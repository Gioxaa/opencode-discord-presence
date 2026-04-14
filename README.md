# opencode-discord-presence

[![npm version](https://img.shields.io/npm/v/opencode-discord-presence.svg)](https://www.npmjs.com/package/opencode-discord-presence)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[한국어](README.ko.md) | English

Display your current OpenCode session status in Discord Rich Presence. Show which AI agent you're using, the current model, session time, and more.

<img width="293" height="119" alt="image" src="https://github.com/user-attachments/assets/879207e0-4759-477d-ba34-f79f927737bd" />


## Features

- **Real-time agent display** - Shows which AI agent (Claude, Prometheus, etc.) you're currently using
- **Model information** - Displays the active model (Claude Sonnet, GPT-4, etc.)
- **Session time tracking** - Shows how long you've been coding
- **Korean language support** - Proper Korean particle handling (을/를, 은/는)
- **Idle detection** - Automatically shows when you're taking a break
- **Live File Spotlight** - Shows the file currently being edited, read, or diagnosed by the agent, with language-specific Discord icons
- **Task Mission Board** - Displays active todo progress with task labels and completion counts (e.g., "Implementing dark mode (2/5)")
- **Diagnostics-aware presence** - Automatically shows error/warning counts when LSP diagnostics are present (see [limitations](#limitations))
- **Smart rotation** - Critical states (errors, idle, all-done) pin; informational cards (file spotlight, mission board, session stats) rotate every 20 seconds by default
- **Session recap** - When a session ends, a recap card shows total prompts, files touched, and active duration for 30 seconds

## Installation

```bash
# Using bun
bun add opencode-discord-presence

# Using npm
npm install opencode-discord-presence

# Using pnpm
pnpm add opencode-discord-presence
```

## Quick Start

Add the plugin to your `opencode.json`:

```json
{
  "plugins": ["opencode-discord-presence"]
}
```

That's it! The plugin will automatically connect to Discord and display your session status.

## Configuration

Create a `.discord-presence.json` file in your home directory or project root:

```json
{
  "enabled": true,
  "applicationId": "YOUR_DISCORD_APP_ID",
  "language": "ko"
}
```

Or use environment variables:

```bash
OPENCODE_DISCORD_ENABLED=true
OPENCODE_DISCORD_CLIENT_ID=YOUR_APP_ID
OPENCODE_DISCORD_LANGUAGE=ko
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | `boolean` | `true` | Enable or disable the plugin |
| `applicationId` | `string` | (built-in) | Custom Discord Application ID for your own branding |
| `language` | `string` | `"en"` | Display language (`"en"` or `"ko"`) |
| `richPresence.enableFileSpotlight` | `boolean` | `true` | Show live file spotlight card |
| `richPresence.enableMissionBoard` | `boolean` | `true` | Show task mission board card |
| `richPresence.rotationIntervalSeconds` | `number` | `20` | How often informational cards rotate (10–60 seconds) |
| `richPresence.diagnostics.errorsOnly` | `boolean` | `true` | Pin error diagnostics; warnings appear in rotation |

### Config File Priority

1. Project directory: `.discord-presence.json`
2. Home directory: `~/.discord-presence.json`
3. Environment variables

## Custom Discord Application

For custom branding (your own images and app name):

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application" and give it a name
3. Go to "Rich Presence" → "Art Assets"
4. Upload your images (at least one named `opencode-logo`)
5. Copy the Application ID from "General Information"
6. Add it to your config:

```json
{
  "discordPresence": {
    "applicationId": "YOUR_APPLICATION_ID"
  }
}
```

## How It Works

The plugin hooks into OpenCode's event system:

- **chat.message** - Updates presence when you send/receive messages, tracking the current agent and model
- **tool.execute.before** / **tool.execute.after** - Captures file context and tool operation labels (edit, read, search, build, test, etc.)
- **file.edited** - Updates the live file spotlight with the edited file path and language icon
- **todo.updated** - Drives mission board progress with active task labels and completion counts
- **session.idle** - Triggers idle state with the last active task shown in the state line
- **session.deleted** - Triggers session recap showing total prompts, files touched, and active duration for 30 seconds

### Limitations

- **lsp.client.diagnostics** is listened for, but error/warning counts are not available through the OpenCode plugin API v1. Diagnostic counts shown in presence require external LSP configuration. The plugin logs diagnostics events but does not fabricate counts.

### Presence States

| State | English | Korean | Description |
|-------|---------|--------|-------------|
| Active editing | `✍️ Working with {agent}` | Same | File being edited |
| Active reading | `📖 Working with {agent}` | Same | File being read |
| Task active | `🎯 Working with {agent}` | Same | With mission progress |
| Diagnostics error | `🔴 Working with {agent}` | Same | Errors detected |
| Idle | `😴 {agent} is idle` | Same | No activity |
| Session complete | `📊 Session Complete!` | Same | Session ended (30s) |
| All tasks done | `🎉 All tasks complete!` | Same | No pending tasks |

Korean particles (을/를, 은/는) are automatically selected based on whether the agent name ends with a consonant (받침).

## Visual Sample Matrix

The following states are fully supported in v1 (runtime-backed):

| Condition | Headline | State line | Large image |
|-----------|----------|------------|-------------|
| Editing file | `✍️ Working with Claude` | `src/plugin.ts` | language icon |
| Reading file | `📖 Working with Claude` | `src/services/discord-rpc.ts` | action-reading |
| Task active | `🎯 Working with Claude` | `Implementing dark mode (2/5)` | task |
| Diagnostics error | `🔴 Working with Claude` | `5 errors, 2 warnings` | state-error |
| Idle | `😴 Claude is idle` | `Last task: Add theme toggle` | state-idle |
| Session recap | `📊 Session Complete!` | `27 prompts • 3 files • 1h 42m` | state-recap |
| All tasks complete | `🎉 All tasks complete!` | `5/5 finished` | state-complete |

Illustrative-only states (not implemented in v1):

| Condition | Headline | State line | Notes |
|-----------|----------|------------|-------|
| Night mode | `🌙 Burning the midnight oil` | `📄 src/index.ts • 1h 42m` | Not in v1 unless time-based config added |

## Development

```bash
# Install dependencies
bun install

# Run tests
bun test

# Run tests in watch mode
bun test --watch

# Type check
bun run typecheck

# Lint
bun run lint

# Format
bun run format

# Build
bun run build
```

## Architecture

```
src/
├── index.ts              # Main entry point & exports
├── plugin.ts             # OpenCode hook registration + presence engine
├── config.ts             # Configuration management
├── types/
│   └── index.ts          # TypeScript type definitions
├── services/
│   └── discord-rpc.ts    # Discord RPC service (hardened lifecycle)
├── state/
│   └── presence-state.ts # Instance-scoped presence snapshot + reducer
└── utils/
    ├── activity-rotation.ts # Precedence + rotation engine
    ├── file-label.ts        # Path sanitization + truncation
    ├── file-icons.ts        # Language → icon mapping
    ├── session-metrics.ts   # Session counters + recap
    ├── tool-label.ts        # Tool → operation label mapping
    └── particle.ts          # Korean particle handling (을/를, 은/는)
```

## Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) for details.

### Quick Contribution Guide

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Run tests (`bun test`)
4. Commit your changes (`git commit -m 'feat: add amazing feature'`)
5. Push to the branch (`git push origin feature/amazing-feature`)
6. Open a Pull Request

## License

MIT License - see [LICENSE](LICENSE) for details.

## Related Projects

- [OpenCode](https://github.com/opencode-ai/opencode) - The AI coding assistant this plugin extends
- [@xhayper/discord-rpc](https://github.com/xhayper/discord-rpc) - Discord RPC library used by this plugin

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for release history.
