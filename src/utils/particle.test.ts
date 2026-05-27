import { describe, expect, test } from "bun:test"
import { getObjectParticle, getTopicParticle } from "./particle"

describe("getObjectParticle (을/를)", () => {
  test("Korean syllable ending in consonant → 을", () => {
    expect(getObjectParticle("프로메테우스")).toBe("를")
    expect(getObjectParticle("학생")).toBe("을")
    expect(getObjectParticle("책")).toBe("을")
  })

  test("Korean syllable ending in vowel → 를", () => {
    expect(getObjectParticle("나")).toBe("를")
    expect(getObjectParticle("커피")).toBe("를")
  })

  test("empty string defaults to 를", () => {
    expect(getObjectParticle("")).toBe("를")
  })

  test("English letters: heuristic matches only l/m/n/r (lowercase or upper)", () => {
    expect(getObjectParticle("Karl")).toBe("을")
    expect(getObjectParticle("AdamN")).toBe("을")
    expect(getObjectParticle("Claude")).toBe("를")
    expect(getObjectParticle("Sonnet")).toBe("를")
  })

  test("trailing digit treated by digit rule", () => {
    expect(getObjectParticle("GPT3")).toBe("을")
    expect(getObjectParticle("Claude5")).toBe("를")
    expect(getObjectParticle("GPT7")).toBe("을")
    expect(getObjectParticle("GPT2")).toBe("를")
  })
})

describe("getTopicParticle (은/는)", () => {
  test("Korean syllable ending in consonant → 은", () => {
    expect(getTopicParticle("학생")).toBe("은")
    expect(getTopicParticle("선생님")).toBe("은")
  })

  test("Korean syllable ending in vowel → 는", () => {
    expect(getTopicParticle("나")).toBe("는")
    expect(getTopicParticle("프로메테우스")).toBe("는")
  })

  test("empty string defaults to 는", () => {
    expect(getTopicParticle("")).toBe("는")
  })

  test("English ending in 'm','n','l','r' → 은", () => {
    expect(getTopicParticle("Claude")).toBe("는")
    expect(getTopicParticle("Codex")).toBe("는")
    expect(getTopicParticle("AdamN")).toBe("은")
    expect(getTopicParticle("Karl")).toBe("은")
  })
})
