import { homedir } from "node:os"
import { join } from "node:path"
import type { Plugin } from "@opencode-ai/plugin"
import { getConfig } from "./config.js"
import { DiscordRPCService } from "./services/discord-rpc.js"
import type { DiscordPresenceOptions, Language } from "./types/index.js"
import { getObjectParticle, getTopicParticle } from "./utils/particle.js"

let rpc: DiscordRPCService | null = null
let currentAgent = "OpenCode"
let currentModel = ""

function getPresenceDetails(agent: string, idle: boolean, language: Language): string {
  if (language === "ko") {
    if (idle) {
      return `${agent}${getTopicParticle(agent)} 휴식중`
    }
    return `${agent}${getObjectParticle(agent)} 갈구는중`
  }
  return idle ? `${agent} is idle` : `Working with ${agent}`
}

async function loadConfigFile(directory: string): Promise<DiscordPresenceOptions | undefined> {
  const paths = [
    join(directory, ".discord-presence.json"),
    join(homedir(), ".discord-presence.json"),
  ]

  for (const configPath of paths) {
    const file = Bun.file(configPath)
    if (await file.exists()) {
      try {
        return (await file.json()) as DiscordPresenceOptions
      } catch {}
    }
  }
  return undefined
}

export const OpenCodeDiscordPresence: Plugin = async (ctx) => {
  const fileOptions = await loadConfigFile(ctx.directory)
  const config = getConfig(fileOptions)
  if (!config.enabled) return {}

  rpc = new DiscordRPCService(config.clientId)

  const updatePresence = async (idle = false) => {
    if (!rpc) return
    const details = getPresenceDetails(currentAgent, idle, config.language)
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
      if (input.model?.modelID) currentModel = input.model.modelID
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
