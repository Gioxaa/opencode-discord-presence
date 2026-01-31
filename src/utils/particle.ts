/**
 * Korean particle utilities
 * Handles proper particle selection based on whether the preceding character
 * ends with a consonant (받침) or not.
 */

/**
 * Check if a character has a final consonant (받침)
 */
function hasFinalConsonant(char: string): boolean {
  const code = char.charCodeAt(0)
  // Korean syllable block range: 0xAC00 ~ 0xD7A3
  if (code < 0xac00 || code > 0xd7a3) {
    // Non-Korean character: treat numbers/letters as having no final consonant
    // except for certain consonant-ending letters
    const consonantEndingChars = /[lmnr136780]$/i
    return consonantEndingChars.test(char)
  }
  // Korean syllable: check if it has a final consonant
  // (code - 0xAC00) % 28 === 0 means no final consonant
  return (code - 0xac00) % 28 !== 0
}

/**
 * Get the appropriate particle for 을/를 (object marker)
 * 을 after consonant, 를 after vowel
 */
export function getObjectParticle(word: string): string {
  if (!word || word.length === 0) return "를"
  const lastChar = word[word.length - 1]
  return hasFinalConsonant(lastChar) ? "을" : "를"
}

/**
 * Get the appropriate particle for 은/는 (topic marker)
 * 은 after consonant, 는 after vowel
 */
export function getTopicParticle(word: string): string {
  if (!word || word.length === 0) return "는"
  const lastChar = word[word.length - 1]
  return hasFinalConsonant(lastChar) ? "은" : "는"
}
