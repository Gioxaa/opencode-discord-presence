import type { Plugin } from "@opencode-ai/plugin"
import type { Language } from "../types/index.js"
import { getObjectParticle, getTopicParticle } from "../utils/particle.js"
import type { DiscordRPCService } from "./discord-rpc.js"

type OpencodeEvent = Parameters<NonNullable<Awaited<ReturnType<Plugin>>["event"]>>[0]["event"]
type ChatMessageInput = Parameters<NonNullable<Awaited<ReturnType<Plugin>>["chat.message"]>>[0]

export interface PresenceDeps {
  rpc: DiscordRPCService
  language: Language
}

function getPresenceDetails(agent: string, language: Language, idle: boolean): string {
  if (language === "ko") {
    return idle
      ? `${agent}${getTopicParticle(agent)} 휴식중`
      : `${agent}${getObjectParticle(agent)} 갈구는중`
  }
  return idle ? `${agent} is idle` : `Working with ${agent}`
}

/**
 * Tracks the latest active agent (main or sub-agent) and pushes it to Discord.
 * Every chat.message overwrites the presence; the last agent to speak wins.
 * Idle text appears only when every tracked session reports idle.
 */
export class PresenceOrchestrator {
  private readonly rpc: DiscordRPCService
  private readonly language: Language
  private lastAgent = ""
  private lastModel = ""
  private readonly busySessions = new Set<string>()

  constructor(deps: PresenceDeps) {
    this.rpc = deps.rpc
    this.language = deps.language
  }

  getBusyCount(): number {
    return this.busySessions.size
  }

  getLastAgent(): string {
    return this.lastAgent
  }

  async onChatMessage(input: ChatMessageInput): Promise<void> {
    if (!input.sessionID) return
    const agent = input.agent || this.lastAgent || "OpenCode"
    const modelID = input.model?.modelID ?? this.lastModel ?? ""
    await this.onBusy(input.sessionID, agent, modelID)
  }

  async onEvent(event: OpencodeEvent): Promise<void> {
    if (event.type === "session.deleted") {
      await this.onIdle(event.properties.info.id)
      return
    }
    if (event.type === "session.status") {
      const status = event.properties.status.type
      if (status === "idle") {
        await this.onIdle(event.properties.sessionID)
      } else if (status === "busy") {
        await this.onBusy(event.properties.sessionID, this.lastAgent || "OpenCode", this.lastModel)
      }
      return
    }
    if (event.type === "session.idle") {
      await this.onIdle(event.properties.sessionID)
    }
  }

  async shutdown(): Promise<void> {
    this.busySessions.clear()
    await this.rpc.disconnect()
  }

  private async onBusy(sessionID: string, agent: string, modelID: string): Promise<void> {
    const wasIdle = this.busySessions.size === 0
    this.busySessions.add(sessionID)
    this.lastAgent = agent
    this.lastModel = modelID

    await this.ensureConnected()
    if (wasIdle) this.rpc.resetSessionStart()
    await this.rpc.setPresence(
      getPresenceDetails(agent, this.language, false),
      modelID || undefined,
    )
  }

  private async onIdle(sessionID: string): Promise<void> {
    this.busySessions.delete(sessionID)
    if (this.busySessions.size > 0) return
    if (!this.lastAgent) return
    await this.ensureConnected()
    await this.rpc.setPresence(
      getPresenceDetails(this.lastAgent, this.language, true),
      this.lastModel || undefined,
    )
  }

  private async ensureConnected(): Promise<void> {
    if (this.rpc.isConnected()) return
    await this.rpc.connect()
  }
}

export type { ChatMessageInput, OpencodeEvent }
