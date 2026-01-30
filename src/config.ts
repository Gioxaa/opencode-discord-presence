/**
 * @fileoverview Configuration management for Discord Presence plugin
 * @module opencode-discord-presence/config
 *
 * Handles plugin configuration with sensible defaults and user overrides.
 * Configuration is typically passed from opencode.json.
 */

import type { DiscordPresenceConfig } from "./types"

/**
 * Default Discord Application ID
 * Users can override this with their own Application ID if needed.
 * This ID should be replaced with the actual shared Application ID
 * created in Discord Developer Portal.
 */
export const DEFAULT_APPLICATION_ID = "1466770544748662819"

/**
 * Default configuration for the Discord Presence plugin
 *
 * All options are enabled by default for the best out-of-box experience.
 */
export const defaultConfig: DiscordPresenceConfig = {
  enabled: true,
  applicationId: DEFAULT_APPLICATION_ID,
  showSessionTime: true,
  showTokenUsage: true,
  showProjectName: true,
  language: "auto",
}

/**
 * Merge user configuration with defaults
 *
 * @param userConfig - Partial user configuration from opencode.json
 * @returns Complete configuration with defaults applied
 *
 * @example
 * ```typescript
 * // User wants to disable token usage display
 * const config = getConfig({ showTokenUsage: false })
 * // config.enabled === true (default)
 * // config.showTokenUsage === false (user override)
 * // config.showSessionTime === true (default)
 * ```
 */
export function getConfig(userConfig: Partial<DiscordPresenceConfig>): DiscordPresenceConfig {
  return {
    ...defaultConfig,
    ...userConfig,
  }
}

/**
 * Validate configuration and return warnings for invalid values
 *
 * @param config - Configuration to validate
 * @returns Array of warning messages
 */
export function validateConfig(config: DiscordPresenceConfig): string[] {
  const warnings: string[] = []

  if (config.applicationId === DEFAULT_APPLICATION_ID) {
    warnings.push(
      "Using default Discord Application ID. For custom branding, create your own app at https://discord.com/developers/applications",
    )
  }

  if (!config.applicationId) {
    warnings.push("Discord Application ID is required for Rich Presence to work")
  }

  return warnings
}
