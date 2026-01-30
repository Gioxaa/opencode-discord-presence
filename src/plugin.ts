/**
 * @fileoverview Main plugin implementation for OpenCode Discord Presence
 * @module opencode-discord-presence/plugin
 *
 * This is the core plugin that integrates with OpenCode to display
 * Rich Presence in Discord, showing:
 * - Current AI agent being used
 * - Current model
 * - Activity status (active/idle)
 * - Optional: session time, token usage, project name
 */

import type { Plugin } from "@opencode-ai/plugin"
import { getConfig, validateConfig } from "./config.js"
import { getLocale } from "./i18n/index.js"
import { DiscordRPCService } from "./services/discord-rpc.js"
import type { DiscordPresenceConfig, TokenCount } from "./types/index.js"
import { formatModelName, formatTokens } from "./utils/format.js"
import { getProjectName } from "./utils/project.js"

/**
 * OpenCode Discord Presence Plugin
 *
 * Displays your current OpenCode session status in Discord Rich Presence.
 * Integrates with OpenCode's event system to track agent changes,
 * model usage, and session state.
 *
 * @param ctx - Plugin context from OpenCode
 * @returns Plugin hooks object
 *
 * @example
 * ```typescript
 * // In opencode.json
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
export const OpenCodeDiscordPresence: Plugin = async (ctx) => {
  // Get configuration (would be passed from opencode.json in real usage)
  const config: DiscordPresenceConfig = getConfig({})

  // Validate and warn about configuration issues
  const warnings = validateConfig(config)
  for (const warning of warnings) {
    console.warn(`[discord-presence] ${warning}`)
  }

  if (!config.enabled) {
    console.log("[discord-presence] Plugin is disabled")
    return {}
  }

  // Initialize Discord RPC service
  const rpc = DiscordRPCService.getInstance(config.applicationId)

  // Connect to Discord (non-blocking, will retry on failure)
  rpc.connect().catch((error) => {
    console.warn("[discord-presence] Initial connection failed:", error)
  })

  const locale = getLocale(config.language)

  // State tracking
  let currentAgent = "OpenCode"
  let currentModel = ""
  const sessionTokens: TokenCount = { input: 0, output: 0 }
  const startTimestamp = Date.now()

  // Get project name from context
  const projectName = config.showProjectName ? getProjectName(undefined, ctx.directory) : undefined

  /**
   * Build the state line for Rich Presence
   * Combines model name, token usage, and project name as configured
   */
  const buildStateLine = (): string | undefined => {
    const parts: string[] = []

    if (currentModel) {
      parts.push(currentModel)
    }

    if (config.showTokenUsage && (sessionTokens.input > 0 || sessionTokens.output > 0)) {
      parts.push(formatTokens(sessionTokens))
    }

    if (config.showProjectName && projectName) {
      parts.push(projectName)
    }

    return parts.length > 0 ? parts.join(" | ") : undefined
  }

  const setActivePresence = async () => {
    await rpc.updatePresence({
      details: locale.presence.active(currentAgent),
      state: buildStateLine(),
      startTimestamp: config.showSessionTime ? startTimestamp : undefined,
      largeImageKey: "opencode-logo",
      largeImageText: locale.status.opencode,
    })
  }

  const setIdlePresence = async () => {
    await rpc.updatePresence({
      details: locale.presence.idle(currentAgent),
      state: buildStateLine(),
      largeImageKey: "opencode-logo",
      largeImageText: locale.status.opencode,
    })
  }

  // Return plugin hooks
  return {
    /**
     * Hook called when a new chat message is sent
     * Used to track current agent and model
     */
    "chat.message": async (input, _output) => {
      // Update agent from input
      if (input.agent) {
        currentAgent = input.agent
      }

      // Update model from input
      if (input.model) {
        currentModel = formatModelName(input.model)
      }

      // Update presence to show active state
      await setActivePresence()
    },

    /**
     * Hook for all events
     * Used to track session state and token usage
     */
    event: async ({ event }) => {
      // Handle session idle event
      if (event.type === "session.idle") {
        await setIdlePresence()
      }

      if (event.type === "message.updated") {
        const info = event.properties?.info
        if (info && info.role === "assistant" && "tokens" in info) {
          sessionTokens.input += info.tokens.input || 0
          sessionTokens.output += info.tokens.output || 0
        }
      }

      // Handle session end/completion
      if (event.type === "session.compacted") {
        // Reset token count for new session
        sessionTokens.input = 0
        sessionTokens.output = 0
      }
    },
  }
}
