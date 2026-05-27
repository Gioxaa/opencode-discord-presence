import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test"
import { DiscordRPCService } from "./discord-rpc"

describe("DiscordRPCService logging", () => {
  const originalLog = console.log
  const originalWarn = console.warn
  let logSpy: ReturnType<typeof mock>
  let warnSpy: ReturnType<typeof mock>

  beforeEach(() => {
    logSpy = mock(() => {})
    warnSpy = mock(() => {})
    console.log = logSpy as unknown as typeof console.log
    console.warn = warnSpy as unknown as typeof console.warn
  })

  afterEach(() => {
    console.log = originalLog
    console.warn = originalWarn
  })

  test("default (no options): setPresence/clear/disconnect are silent", async () => {
    const svc = new DiscordRPCService("fake-id")
    await svc.setPresence("x", "y")
    await svc.clear()
    await svc.disconnect()
    expect(logSpy.mock.calls.length).toBe(0)
    expect(warnSpy.mock.calls.length).toBe(0)
  })

  test("debug=false suppresses log() helper", () => {
    const svc = new DiscordRPCService("fake-id", { debug: false })
    type WithPrivates = { log: (m: string) => void; warn: (m: string) => void }
    const inner = svc as unknown as WithPrivates
    inner.log("hello")
    inner.warn("world")
    expect(logSpy.mock.calls.length).toBe(0)
    expect(warnSpy.mock.calls.length).toBe(0)
  })

  test("debug=true routes through console.log/warn with prefix", () => {
    const svc = new DiscordRPCService("fake-id", { debug: true })
    type WithPrivates = { log: (m: string) => void; warn: (m: string) => void }
    const inner = svc as unknown as WithPrivates
    inner.log("hello")
    inner.warn("world")
    expect(logSpy.mock.calls.length).toBe(1)
    expect(logSpy.mock.calls[0][0]).toBe("[discord-presence] hello")
    expect(warnSpy.mock.calls.length).toBe(1)
    expect(warnSpy.mock.calls[0][0]).toBe("[discord-presence] world")
  })
})

describe("DiscordRPCService basics", () => {
  test("isConnected() is false before connect()", () => {
    const svc = new DiscordRPCService("fake-id")
    expect(svc.isConnected()).toBe(false)
  })

  test("setPresence before connect caches but does not error", async () => {
    const svc = new DiscordRPCService("fake-id")
    await svc.setPresence("details", "state")
    expect(svc.isConnected()).toBe(false)
  })

  test("clear before connect is a no-op", async () => {
    const svc = new DiscordRPCService("fake-id")
    await svc.clear()
    expect(svc.isConnected()).toBe(false)
  })

  test("disconnect on unconnected service is safe", async () => {
    const svc = new DiscordRPCService("fake-id")
    await svc.disconnect()
    expect(svc.isConnected()).toBe(false)
  })
})
