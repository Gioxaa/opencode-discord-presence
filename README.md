# opencode-discord-presence

[![npm version](https://img.shields.io/npm/v/opencode-discord-presence.svg)](https://www.npmjs.com/package/opencode-discord-presence)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[한국어](README.ko.md) | English

Display your current OpenCode session status in Discord Rich Presence. Show which AI agent you're using, the current model, session time, and more.

## Features

- **Real-time agent display** - Shows which AI agent (Claude, Prometheus, etc.) you're currently using
- **Model information** - Displays the active model (Claude Sonnet, GPT-4, etc.)
- **Session time tracking** - Shows how long you've been coding
- **Token usage** - Track input/output tokens consumed in your session
- **Project name** - Display your current project from Git or directory
- **Korean language support** - Proper Korean particle handling (을/를, 은/는)
- **Idle detection** - Automatically shows when you're taking a break

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

Customize the plugin behavior in your `opencode.json`:

```json
{
  "plugins": ["opencode-discord-presence"],
  "discordPresence": {
    "enabled": true,
    "applicationId": "YOUR_DISCORD_APP_ID",
    "showSessionTime": true,
    "showTokenUsage": true,
    "showProjectName": true
  }
}
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | `boolean` | `true` | Enable or disable the plugin |
| `applicationId` | `string` | (built-in) | Custom Discord Application ID for your own branding |
| `showSessionTime` | `boolean` | `true` | Show elapsed time since session start |
| `showTokenUsage` | `boolean` | `true` | Display token usage (e.g., "12.5k tokens") |
| `showProjectName` | `boolean` | `true` | Show current project name from Git/directory |

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
- **event** - Listens for session state changes (idle, active) and token usage updates

### Presence States

| State | Display | Description |
|-------|---------|-------------|
| Active | "Prometheus를 갈구는중" | You're actively coding with an agent |
| Idle | "Prometheus는 휴식중" | Session is idle |

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
├── plugin.ts             # Core plugin implementation
├── config.ts             # Configuration management
├── types/
│   └── index.ts          # TypeScript type definitions
├── services/
│   └── discord-rpc.ts    # Discord RPC service (singleton)
└── utils/
    ├── format.ts         # Token & model name formatting
    ├── particle.ts       # Korean particle detection
    └── project.ts        # Project name detection
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
