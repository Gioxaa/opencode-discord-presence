/**
 * @fileoverview Tests for Korean particle utility
 * @description TDD tests for withParticle function that automatically selects
 *              correct Korean particles (을/를, 은/는) based on final consonant (받침)
 */

import { describe, expect, test } from "bun:test"
import { withParticle } from "./particle"

describe("withParticle", () => {
  describe("을/를 particle (object marker)", () => {
    test("should use '을' for words ending with consonant (받침 있음)", () => {
      // 한글 with 받침
      expect(withParticle("빌드", "을/를")).toBe("빌드를") // ㄷ -> 받침 있음 but 드 has no 받침

      // 영어 ending with consonant sound (l, n, m, d, t, etc.)
      expect(withParticle("build", "을/를")).toBe("build을") // d -> 받침
      expect(withParticle("Agent", "을/를")).toBe("Agent을") // t -> 받침
      expect(withParticle("model", "을/를")).toBe("model을") // l -> 받침
    })

    test("should use '를' for words ending without consonant (받침 없음)", () => {
      // 한글 without 받침
      expect(withParticle("프로메테우스", "을/를")).toBe("프로메테우스를")
      expect(withParticle("시시포스", "을/를")).toBe("시시포스를")

      // 영어 ending with vowel sound
      expect(withParticle("Prometheus", "을/를")).toBe("Prometheus를") // s -> no 받침
      expect(withParticle("Sisyphus", "을/를")).toBe("Sisyphus를") // s -> no 받침
      expect(withParticle("oracle", "을/를")).toBe("oracle를") // e -> no 받침
      expect(withParticle("Claude", "을/를")).toBe("Claude를") // e -> no 받침
    })

    test("should handle agent names correctly", () => {
      expect(withParticle("Prometheus", "을/를")).toBe("Prometheus를")
      expect(withParticle("Sisyphus", "을/를")).toBe("Sisyphus를")
      expect(withParticle("Oracle", "을/를")).toBe("Oracle를") // e -> no 받침
      expect(withParticle("build", "을/를")).toBe("build을") // d -> 받침
      expect(withParticle("general", "을/를")).toBe("general을") // l -> 받침
    })
  })

  describe("은/는 particle (topic marker)", () => {
    test("should use '은' for words ending with consonant (받침 있음)", () => {
      expect(withParticle("빌드", "은/는")).toBe("빌드는") // 드 -> no 받침
      expect(withParticle("model", "은/는")).toBe("model은") // l -> 받침
      expect(withParticle("Agent", "은/는")).toBe("Agent은") // t -> 받침
    })

    test("should use '는' for words ending without consonant (받침 없음)", () => {
      expect(withParticle("프로메테우스", "은/는")).toBe("프로메테우스는")
      expect(withParticle("Prometheus", "은/는")).toBe("Prometheus는")
      expect(withParticle("oracle", "은/는")).toBe("oracle는") // e -> no 받침
    })
  })

  describe("edge cases", () => {
    test("should handle empty string", () => {
      expect(withParticle("", "을/를")).toBe("를")
      expect(withParticle("", "은/는")).toBe("는")
    })

    test("should handle single character", () => {
      expect(withParticle("A", "을/를")).toBe("A를") // vowel -> no 받침
      expect(withParticle("한", "을/를")).toBe("한을") // ㄴ -> 받침
    })

    test("should handle numbers", () => {
      expect(withParticle("123", "을/를")).toBe("123을") // 3 -> 삼 -> 받침
      expect(withParticle("GPT-4o", "을/를")).toBe("GPT-4o를") // o -> vowel
      expect(withParticle("GPT-4", "을/를")).toBe("GPT-4를") // 4 -> 사 -> no 받침
    })

    test("should handle mixed Korean and English", () => {
      expect(withParticle("Claude4", "을/를")).toBe("Claude4를") // 4 -> no 받침
      expect(withParticle("시스템1", "을/를")).toBe("시스템1을") // 1 -> 일 -> 받침
    })
  })
})
