import type { Plugin } from "@opencode-ai/plugin"
import { getConfig } from "./config.js"
import { DiscordRPCService } from "./services/discord-rpc.js"

let rpc: DiscordRPCService | null = null
let currentAgent = "OpenCode"
let currentModel = ""

export const OpenCodeDiscordPresence: Plugin = async (ctx) => {
  const config = getConfig()
  if (!config.enabled) return {}

  rpc = new DiscordRPCService(config.clientId)

  const updatePresence = async (idle = false) => {
    if (!rpc) return
    const details = idle ? `${currentAgent} is idle` : `Working with ${currentAgent}`
    const state = currentModel || undefined
    await rpc.setPresence(details, state)
  }

  const connected = await rpc.connect()
  if (connected) {
    await updatePresence(false)
  }

  return {
    "chat.message": async (input) => {
      if (input.agent) currentAgent = input.agent
      if (input.model) currentModel = String(input.model).split("-")[0]
      await updatePresence(false)
    },

    event: async ({ event }) => {
      if (event.type === "session.idle") {
        await updatePresence(true)
      }
      if (event.type === "session.deleted") {
        await rpc?.clear()
      }
    },
  }
}
