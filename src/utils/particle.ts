/**
 * @fileoverview Korean particle utility for proper grammar
 * @module opencode-discord-presence/utils/particle
 *
 * Korean particles (조사) change based on whether the preceding syllable
 * ends with a consonant (받침) or not.
 *
 * - 을/를 (object marker): 을 after 받침, 를 after no 받침
 * - 은/는 (topic marker): 은 after 받침, 는 after no 받침
 *
 * @example
 * ```typescript
 * withParticle("빌드", "을/를")     // "빌드를" (ㄷ has 받침)
 * withParticle("프로메테우스", "을/를") // "프로메테우스를" (스 has no 받침)
 * withParticle("oracle", "은/는")   // "oracle은" (e is consonant-like)
 * ```
 */

/** Supported particle types */
export type ParticleType = "을/를" | "은/는"

/**
 * Adds the correct Korean particle to a word based on its final character
 *
 * @param word - The word to add a particle to
 * @param particle - The particle type ("을/를" or "은/는")
 * @returns The word with the correct particle appended
 *
 * @example
 * ```typescript
 * withParticle("Prometheus", "을/를") // "Prometheus를"
 * withParticle("build", "은/는")      // "build는"
 * ```
 */
export function withParticle(word: string, particle: ParticleType): string {
  const hasBatchim = checkBatchim(word)

  if (particle === "을/를") {
    return word + (hasBatchim ? "을" : "를")
  }
  return word + (hasBatchim ? "은" : "는")
}

/**
 * Checks if the last character of a word has a 받침 (final consonant)
 *
 * For Korean characters (Hangul), we check if the Unicode code point
 * indicates a final consonant. Korean syllables in Unicode are structured as:
 *   (initial * 21 + medial) * 28 + final + 0xAC00
 * where final = 0 means no 받침.
 *
 * For English and other characters, we use a heuristic based on
 * whether the character sounds like it ends with a consonant.
 *
 * @param word - The word to check
 * @returns true if the last character has a 받침-like ending
 */
function checkBatchim(word: string): boolean {
  if (word.length === 0) {
    return false
  }

  const lastChar = word.charAt(word.length - 1)
  const code = lastChar.charCodeAt(0)

  // Korean Hangul syllables range: 0xAC00 (가) to 0xD7A3 (힣)
  if (code >= 0xac00 && code <= 0xd7a3) {
    // Korean syllable structure: (initial * 21 + medial) * 28 + final + 0xAC00
    // final = 0 means no 받침
    return (code - 0xac00) % 28 !== 0
  }

  // For numbers, check if it's a digit that sounds like it ends with a consonant
  // 1(일), 3(삼), 6(육), 7(칠), 8(팔), 0(영/공) have 받침
  if (/[0-9]/.test(lastChar)) {
    return ["1", "3", "6", "7", "8", "0"].includes(lastChar)
  }

  // For English/Latin characters, consonants that typically sound like 받침
  // when pronounced in Korean context:
  // - l, m, n, ng, r (liquid/nasal sounds) -> 받침
  // - b, c, d, g, k, p, t (stop consonants) -> 받침
  // - vowels (a, e, i, o, u) -> no 받침
  // - s, x, z -> can be either, but typically no 받침 in Korean pronunciation
  const consonantsWithBatchim = "lmnrbcdgkpt"
  const lowerChar = lastChar.toLowerCase()

  if (/[a-z]/i.test(lastChar)) {
    return consonantsWithBatchim.includes(lowerChar)
  }

  // Default: no 받침 for other characters
  return false
}
