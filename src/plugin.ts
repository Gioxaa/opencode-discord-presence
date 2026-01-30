/**
 * @fileoverview Main plugin implementation for OpenCode Discord Presence
 * @module opencode-discord-presence/plugin
 */

import type { Plugin } from "@opencode-ai/plugin"
import type { DiscordPresenceConfig, TokenCount } from "./types"

// Placeholder - will be implemented in subsequent tasks
const DEFAULT_APPLICATION_ID = "YOUR_APPLICATION_ID"

/**
 * Default configuration for the Discord Presence plugin
 */
export const defaultConfig: DiscordPresenceConfig = {
  enabled: true,
  applicationId: DEFAULT_APPLICATION_ID,
  showSessionTime: true,
  showTokenUsage: true,
  showProjectName: true,
}

/**
 * OpenCode Discord Presence Plugin
 *
 * Displays your current OpenCode session status in Discord Rich Presence.
 *
 * @param _ctx - Plugin context from OpenCode (unused in skeleton)
 * @returns Plugin hooks object
 */
export const OpenCodeDiscordPresence: Plugin = async (_ctx) => {
  // Plugin implementation will be added in Task 6
  // This is the skeleton structure

  const config: DiscordPresenceConfig = {
    ...defaultConfig,
    // User config will be merged here
  }

  if (!config.enabled) {
    return {}
  }

  // State tracking (will be used in Task 6)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _currentAgent = "OpenCode"
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _currentModel = ""
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _sessionTokens: TokenCount = { input: 0, output: 0 }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _startTimestamp = Date.now()

  return {
    // Hooks will be implemented in Task 6
  }
}
