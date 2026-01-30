/**
 * @fileoverview Tests for Discord RPC Service
 *
 * NOTE: Due to Bun's module caching behavior with mock.module(), these tests
 * only verify module exports. The plugin.test.ts mocks this service and that
 * mock persists across test files. For isolated behavior tests:
 * `bun test src/services/discord-rpc.test.ts --preload=<none>`
 */

import { describe, expect, test } from "bun:test"
import { DiscordRPCService } from "./discord-rpc"

describe("DiscordRPCService", () => {
  describe("Module Export", () => {
    test("exports DiscordRPCService", () => {
      expect(DiscordRPCService).toBeDefined()
    })

    test("DiscordRPCService has getInstance method", () => {
      expect(typeof DiscordRPCService.getInstance).toBe("function")
    })

    test("DiscordRPCService has resetInstance method", () => {
      expect(typeof DiscordRPCService.resetInstance).toBe("function")
    })
  })
})
