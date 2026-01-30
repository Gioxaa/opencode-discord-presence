/**
 * @fileoverview Type definitions for OpenCode Discord Presence plugin
 * @module opencode-discord-presence/types
 */

/**
 * Configuration options for the Discord Rich Presence plugin
 */
export interface DiscordPresenceConfig {
  /** Whether the plugin is enabled */
  enabled: boolean
  /** Discord Application ID for Rich Presence */
  applicationId: string
  /** Show elapsed time since session started */
  showSessionTime: boolean
  /** Show token usage count */
  showTokenUsage: boolean
  /** Show current project name */
  showProjectName: boolean
}

/**
 * Token count structure for tracking usage
 */
export interface TokenCount {
  /** Input tokens consumed */
  input: number
  /** Output tokens generated */
  output: number
}

/**
 * Model information from OpenCode
 */
export interface ModelInfo {
  /** Provider ID (e.g., "anthropic", "openai") */
  providerID: string
  /** Model ID (e.g., "claude-sonnet-4-20250514") */
  modelID: string
}

/**
 * Presence state for Discord Rich Presence
 */
export interface PresenceState {
  /** Main text line (details) */
  details: string
  /** Secondary text line (state) */
  state?: string
  /** Timestamp when activity started */
  startTimestamp?: number
  /** Large image asset key */
  largeImageKey: string
  /** Tooltip for large image */
  largeImageText?: string
  /** Small image asset key */
  smallImageKey?: string
  /** Tooltip for small image */
  smallImageText?: string
}
