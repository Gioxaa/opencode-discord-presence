/**
 * @fileoverview Tests for OpenCode Discord Presence Plugin
 */

import { describe, expect, mock, test } from "bun:test"

// Mock discord-rpc before importing plugin
const mockUpdatePresence = mock(() => Promise.resolve())
const mockConnect = mock(() => Promise.resolve())

mock.module("./services/discord-rpc", () => ({
  DiscordRPCService: {
    getInstance: () => ({
      connect: mockConnect,
      updatePresence: mockUpdatePresence,
      isConnected: true,
    }),
    resetInstance: mock(() => {}),
  },
}))

// Now import the plugin
import { OpenCodeDiscordPresence } from "./plugin"

describe("OpenCodeDiscordPresence Plugin", () => {
  test("exports valid Plugin function", () => {
    expect(typeof OpenCodeDiscordPresence).toBe("function")
  })

  test("returns hooks object when enabled", async () => {
    const mockCtx = {
      client: {},
      project: {},
      directory: "/test/project",
      worktree: "/test/project",
      serverUrl: new URL("http://localhost:3000"),
      $: {} as never,
    }

    const hooks = await OpenCodeDiscordPresence(mockCtx)

    expect(hooks).toBeDefined()
    expect(hooks["chat.message"]).toBeDefined()
    expect(hooks.event).toBeDefined()
  })

  test("chat.message hook updates presence", async () => {
    const mockCtx = {
      client: {},
      project: {},
      directory: "/test/project",
      worktree: "/test/project",
      serverUrl: new URL("http://localhost:3000"),
      $: {} as never,
    }

    const hooks = await OpenCodeDiscordPresence(mockCtx)

    if (hooks["chat.message"]) {
      await hooks["chat.message"](
        {
          sessionID: "test",
          agent: "Prometheus",
          model: { providerID: "anthropic", modelID: "claude-sonnet-4-20250514" },
        },
        { message: { role: "user", content: "test" }, parts: [] },
      )
    }

    // Should have called updatePresence
    expect(mockUpdatePresence).toHaveBeenCalled()
  })

  test("event hook handles session.idle", async () => {
    const mockCtx = {
      client: {},
      project: {},
      directory: "/test/project",
      worktree: "/test/project",
      serverUrl: new URL("http://localhost:3000"),
      $: {} as never,
    }

    const hooks = await OpenCodeDiscordPresence(mockCtx)

    if (hooks.event) {
      await hooks.event({
        event: { type: "session.idle", properties: {} } as never,
      })
    }

    // Should have called updatePresence for idle state
    expect(mockUpdatePresence).toHaveBeenCalled()
  })
})
