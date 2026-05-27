import { homedir } from "node:os"
import { join } from "node:path"
import type { Plugin } from "@opencode-ai/plugin"
import { getConfig } from "./config.js"
import { DiscordRPCService } from "./services/discord-rpc.js"
import { PresenceOrchestrator } from "./services/presence-orchestrator.js"
import type { DiscordPresenceOptions } from "./types/index.js"

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

let orchestrator: PresenceOrchestrator | null = null
let shutdownInstalled = false

function installShutdownHooks(): void {
  if (shutdownInstalled) return
  shutdownInstalled = true
  const shutdown = () => {
    orchestrator?.shutdown().catch(() => {})
  }
  process.on("exit", shutdown)
  process.on("SIGINT", () => {
    shutdown()
    process.exit(130)
  })
  process.on("SIGTERM", () => {
    shutdown()
    process.exit(143)
  })
}

export const OpenCodeDiscordPresence: Plugin = async (ctx) => {
  const fileOptions = await loadConfigFile(ctx.directory)
  const config = getConfig(fileOptions)
  if (!config.enabled) return {}

  installShutdownHooks()

  if (!orchestrator) {
    orchestrator = new PresenceOrchestrator({
      rpc: new DiscordRPCService(config.clientId, { debug: config.debug }),
      language: config.language,
    })
  }

  return {
    "chat.message": async (input) => {
      await orchestrator?.onChatMessage(input)
    },
    event: async ({ event }) => {
      await orchestrator?.onEvent(event)
    },
  }
}
