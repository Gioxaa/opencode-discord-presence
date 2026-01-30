/**
 * @fileoverview OpenCode Discord Presence Plugin
 * @module opencode-discord-presence
 *
 * This plugin displays your current OpenCode session status in Discord Rich Presence.
 *
 * Features:
 * - Shows current AI agent (Prometheus, Sisyphus, etc.)
 * - Shows current model (Claude Sonnet 4, GPT-4o, etc.)
 * - Status messages in Korean with proper particles
 * - Configurable display options
 *
 * @example
 * ```json
 * // opencode.json
 * {
 *   "plugins": ["opencode-discord-presence"],
 *   "discordPresence": {
 *     "enabled": true,
 *     "showSessionTime": true,
 *     "showTokenUsage": true,
 *     "showProjectName": true
 *   }
 * }
 * ```
 */

export { getAvailableLanguages, getLocale, supportedLanguages } from "./i18n"
export { OpenCodeDiscordPresence } from "./plugin"
export type {
  DiscordPresenceConfig,
  ModelInfo,
  PresenceState,
  SupportedLanguage,
  TokenCount,
} from "./types"
