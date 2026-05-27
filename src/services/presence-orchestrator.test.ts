import { beforeEach, describe, expect, mock, test } from "bun:test"
import type { DiscordRPCService } from "./discord-rpc"
import { type OpencodeEvent, PresenceOrchestrator } from "./presence-orchestrator"

interface FakeRPC {
  setPresence: ReturnType<typeof mock>
  clear: ReturnType<typeof mock>
  connect: ReturnType<typeof mock>
  disconnect: ReturnType<typeof mock>
  isConnected: ReturnType<typeof mock>
  resetSessionStart: ReturnType<typeof mock>
}

function makeRPC(): FakeRPC {
  let isConn = false
  return {
    setPresence: mock(async () => {}),
    clear: mock(async () => {}),
    connect: mock(async () => {
      isConn = true
      return true
    }),
    disconnect: mock(async () => {
      isConn = false
    }),
    isConnected: mock(() => isConn),
    resetSessionStart: mock(() => {}),
  }
}

describe("PresenceOrchestrator", () => {
  let rpc: FakeRPC

  beforeEach(() => {
    rpc = makeRPC()
  })

  test("chat.message from any session sets busy presence", async () => {
    const o = new PresenceOrchestrator({
      rpc: rpc as unknown as DiscordRPCService,
      language: "en",
    })
    await o.onChatMessage({
      sessionID: "ses_main",
      agent: "Prometheus",
      model: { providerID: "anthropic", modelID: "claude-sonnet-4" },
    })
    expect(rpc.setPresence.mock.calls.length).toBe(1)
    expect(rpc.setPresence.mock.calls[0][0]).toBe("Working with Prometheus")
    expect(rpc.setPresence.mock.calls[0][1]).toBe("claude-sonnet-4")
  })

  test("sub-agent chat.message overwrites previous presence (last writer wins)", async () => {
    const o = new PresenceOrchestrator({
      rpc: rpc as unknown as DiscordRPCService,
      language: "en",
    })
    await o.onChatMessage({
      sessionID: "ses_main",
      agent: "Prometheus",
      model: { providerID: "anthropic", modelID: "claude-sonnet-4" },
    })
    await o.onChatMessage({
      sessionID: "ses_sub",
      agent: "planner",
      model: { providerID: "anthropic", modelID: "claude-haiku-4" },
    })
    expect(rpc.setPresence.mock.calls.length).toBe(2)
    expect(rpc.setPresence.mock.calls[0][0]).toBe("Working with Prometheus")
    expect(rpc.setPresence.mock.calls[1][0]).toBe("Working with planner")
    expect(o.getLastAgent()).toBe("planner")
    expect(o.getBusyCount()).toBe(2)
  })

  test("Korean busy uses object particle", async () => {
    const o = new PresenceOrchestrator({
      rpc: rpc as unknown as DiscordRPCService,
      language: "ko",
    })
    await o.onChatMessage({ sessionID: "ses_m", agent: "Prometheus", model: undefined })
    expect(rpc.setPresence.mock.calls[0][0]).toBe("Prometheus를 갈구는중")
  })

  test("session.idle while ANOTHER session still busy keeps busy presence", async () => {
    const o = new PresenceOrchestrator({
      rpc: rpc as unknown as DiscordRPCService,
      language: "en",
    })
    await o.onChatMessage({ sessionID: "ses_a", agent: "A", model: undefined })
    await o.onChatMessage({ sessionID: "ses_b", agent: "B", model: undefined })
    rpc.setPresence.mockClear()
    await o.onEvent({
      type: "session.idle",
      properties: { sessionID: "ses_a" },
    } as OpencodeEvent)
    expect(rpc.setPresence.mock.calls.length).toBe(0)
    expect(o.getBusyCount()).toBe(1)
  })

  test("session.idle for the last busy session shows idle text with last agent", async () => {
    const o = new PresenceOrchestrator({
      rpc: rpc as unknown as DiscordRPCService,
      language: "en",
    })
    await o.onChatMessage({ sessionID: "ses_main", agent: "Prometheus", model: undefined })
    await o.onChatMessage({ sessionID: "ses_sub", agent: "planner", model: undefined })
    await o.onEvent({
      type: "session.idle",
      properties: { sessionID: "ses_sub" },
    } as OpencodeEvent)
    expect(rpc.setPresence.mock.calls.length).toBe(2)
    await o.onEvent({
      type: "session.idle",
      properties: { sessionID: "ses_main" },
    } as OpencodeEvent)
    expect(rpc.setPresence.mock.calls.length).toBe(3)
    expect(rpc.setPresence.mock.calls[2][0]).toBe("planner is idle")
  })

  test("Korean idle uses topic particle", async () => {
    const o = new PresenceOrchestrator({
      rpc: rpc as unknown as DiscordRPCService,
      language: "ko",
    })
    await o.onChatMessage({ sessionID: "ses_m", agent: "Prometheus", model: undefined })
    await o.onEvent({
      type: "session.idle",
      properties: { sessionID: "ses_m" },
    } as OpencodeEvent)
    expect(rpc.setPresence.mock.calls[1][0]).toBe("Prometheus는 휴식중")
  })

  test("session.status idle on last busy → idle text", async () => {
    const o = new PresenceOrchestrator({
      rpc: rpc as unknown as DiscordRPCService,
      language: "en",
    })
    await o.onChatMessage({ sessionID: "ses_m", agent: "Claude", model: undefined })
    await o.onEvent({
      type: "session.status",
      properties: { sessionID: "ses_m", status: { type: "idle" } },
    } as OpencodeEvent)
    expect(rpc.setPresence.mock.calls.length).toBe(2)
    expect(rpc.setPresence.mock.calls[1][0]).toBe("Claude is idle")
  })

  test("session.status retry is a no-op", async () => {
    const o = new PresenceOrchestrator({
      rpc: rpc as unknown as DiscordRPCService,
      language: "en",
    })
    await o.onChatMessage({ sessionID: "ses_m", agent: "Claude", model: undefined })
    rpc.setPresence.mockClear()
    await o.onEvent({
      type: "session.status",
      properties: { sessionID: "ses_m", status: { type: "retry" } as never },
    } as OpencodeEvent)
    expect(rpc.setPresence.mock.calls.length).toBe(0)
  })

  test("idle without any prior busy is no-op (nothing to display)", async () => {
    const o = new PresenceOrchestrator({
      rpc: rpc as unknown as DiscordRPCService,
      language: "en",
    })
    await o.onEvent({
      type: "session.idle",
      properties: { sessionID: "ses_m" },
    } as OpencodeEvent)
    expect(rpc.setPresence.mock.calls.length).toBe(0)
  })

  test("session.deleted removes session from busy set", async () => {
    const o = new PresenceOrchestrator({
      rpc: rpc as unknown as DiscordRPCService,
      language: "en",
    })
    await o.onChatMessage({ sessionID: "ses_m", agent: "A", model: undefined })
    expect(o.getBusyCount()).toBe(1)
    await o.onEvent({
      type: "session.deleted",
      properties: { info: { id: "ses_m" } as never },
    } as OpencodeEvent)
    expect(o.getBusyCount()).toBe(0)
    expect(rpc.setPresence.mock.calls[1][0]).toBe("A is idle")
  })

  test("two windows sharing RPC overwrite each other (no lock gating)", async () => {
    const sharedRpc = makeRPC()
    const a = new PresenceOrchestrator({
      rpc: sharedRpc as unknown as DiscordRPCService,
      language: "en",
    })
    const b = new PresenceOrchestrator({
      rpc: sharedRpc as unknown as DiscordRPCService,
      language: "en",
    })
    await a.onChatMessage({ sessionID: "ses_a", agent: "A", model: undefined })
    await b.onChatMessage({ sessionID: "ses_b", agent: "B", model: undefined })
    expect(sharedRpc.setPresence.mock.calls.length).toBe(2)
    expect(sharedRpc.setPresence.mock.calls[0][0]).toBe("Working with A")
    expect(sharedRpc.setPresence.mock.calls[1][0]).toBe("Working with B")
  })

  test("rapid main → sub → main updates each overwrite", async () => {
    const o = new PresenceOrchestrator({
      rpc: rpc as unknown as DiscordRPCService,
      language: "en",
    })
    await o.onChatMessage({ sessionID: "ses_main", agent: "Sisyphus", model: undefined })
    await o.onChatMessage({ sessionID: "ses_sub", agent: "explore", model: undefined })
    await o.onChatMessage({ sessionID: "ses_main", agent: "Sisyphus", model: undefined })
    expect(rpc.setPresence.mock.calls.map((c) => c[0])).toEqual([
      "Working with Sisyphus",
      "Working with explore",
      "Working with Sisyphus",
    ])
    expect(o.getLastAgent()).toBe("Sisyphus")
  })
})
