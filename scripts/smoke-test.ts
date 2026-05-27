#!/usr/bin/env bun
import { DiscordRPCService } from "../src/services/discord-rpc.ts"
import { PresenceOrchestrator, type OpencodeEvent } from "../src/services/presence-orchestrator.ts"

const DEFAULT_CLIENT_ID = process.env.OPENCODE_DISCORD_CLIENT_ID || "1466770544748662819"
const HOLD = Number(process.env.HOLD_SECONDS || "6")

const rpc = new DiscordRPCService(DEFAULT_CLIENT_ID)
const orchestrator = new PresenceOrchestrator({ rpc, language: "ko" })

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const ts = () => new Date().toISOString().slice(11, 19)

async function main() {
  console.log(`[smoke ${ts()}] clientId=${DEFAULT_CLIENT_ID} HOLD=${HOLD}s`)

  console.log(`[smoke ${ts()}] step 1: MAIN busy → 'Sisyphus를 갈구는중'`)
  await orchestrator.onChatMessage({
    sessionID: "ses_main",
    agent: "Sisyphus",
    model: { providerID: "anthropic", modelID: "claude-sonnet-4" },
  })
  await sleep(HOLD * 1000)

  console.log(`[smoke ${ts()}] step 2: SUB busy → overwrite to 'planner를 갈구는중'`)
  await orchestrator.onChatMessage({
    sessionID: "ses_sub",
    agent: "planner",
    model: { providerID: "anthropic", modelID: "claude-opus-4" },
  })
  await sleep(HOLD * 1000)

  console.log(`[smoke ${ts()}] step 3: SUB idle → main still busy, presence STAYS planner`)
  await orchestrator.onEvent({
    type: "session.idle",
    properties: { sessionID: "ses_sub" },
  } as OpencodeEvent)
  await sleep(HOLD * 1000)

  console.log(`[smoke ${ts()}] step 4: MAIN sends again → 'Sisyphus를 갈구는중'`)
  await orchestrator.onChatMessage({
    sessionID: "ses_main",
    agent: "Sisyphus",
    model: { providerID: "anthropic", modelID: "claude-sonnet-4" },
  })
  await sleep(HOLD * 1000)

  console.log(`[smoke ${ts()}] step 5: MAIN idle → 'Sisyphus는 휴식중'`)
  await orchestrator.onEvent({
    type: "session.idle",
    properties: { sessionID: "ses_main" },
  } as OpencodeEvent)
  await sleep(HOLD * 1000)

  console.log(`[smoke ${ts()}] DONE — shutting down`)
  await orchestrator.shutdown()
}

main().catch((err) => {
  console.error("[smoke] error:", err)
  process.exit(1)
})
