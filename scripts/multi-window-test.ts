#!/usr/bin/env bun
import { DiscordRPCService } from "../src/services/discord-rpc.ts"
import { PresenceOrchestrator, type OpencodeEvent } from "../src/services/presence-orchestrator.ts"

const DEFAULT_CLIENT_ID = process.env.OPENCODE_DISCORD_CLIENT_ID || "1466770544748662819"
const HOLD = Number(process.env.HOLD_SECONDS || "5")

function makeWindow() {
  const rpc = new DiscordRPCService(DEFAULT_CLIENT_ID)
  const orchestrator = new PresenceOrchestrator({ rpc, language: "en" })
  return { rpc, orchestrator }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const ts = () => new Date().toISOString().slice(11, 19)

async function main() {
  const A = makeWindow()
  const B = makeWindow()

  console.log(`[mw ${ts()}] WindowA → 'Working with Prometheus'`)
  await A.orchestrator.onChatMessage({
    sessionID: "ses_a",
    agent: "Prometheus",
    model: { providerID: "anthropic", modelID: "claude-sonnet-4" },
  })
  await sleep(HOLD * 1000)

  console.log(`[mw ${ts()}] WindowB → overwrite 'Working with Claude'`)
  await B.orchestrator.onChatMessage({
    sessionID: "ses_b",
    agent: "Claude",
    model: { providerID: "anthropic", modelID: "claude-opus-4" },
  })
  await sleep(HOLD * 1000)

  console.log(`[mw ${ts()}] WindowA → 'Working with Prometheus' again (last writer wins)`)
  await A.orchestrator.onChatMessage({
    sessionID: "ses_a",
    agent: "Prometheus",
    model: { providerID: "anthropic", modelID: "claude-sonnet-4" },
  })
  await sleep(HOLD * 1000)

  console.log(`[mw ${ts()}] WindowA idle → A clears its activity slot`)
  await A.orchestrator.onEvent({
    type: "session.idle",
    properties: { sessionID: "ses_a" },
  } as OpencodeEvent)
  await sleep(HOLD * 1000)

  console.log(`[mw ${ts()}] WindowB idle → 'Claude is idle'`)
  await B.orchestrator.onEvent({
    type: "session.idle",
    properties: { sessionID: "ses_b" },
  } as OpencodeEvent)
  await sleep(HOLD * 1000)

  console.log(`[mw ${ts()}] shutting down both windows`)
  await A.orchestrator.shutdown()
  await B.orchestrator.shutdown()
}

main().catch((err) => {
  console.error("[mw] error:", err)
  process.exit(1)
})
