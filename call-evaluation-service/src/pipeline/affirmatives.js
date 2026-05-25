// Shared affirmative / negative word lists used for boolean question scoring
// and trivial-turn detection throughout the evaluation pipeline.

export const AFFIRMATIVE_WORDS = [
  // Direct yes
  'yes', 'yeah', 'yep', 'yup', 'yah', 'ya', 'aye',
  // Sounds / fillers that mean yes
  'hmm', 'hm', 'mhm', 'mmhm', 'mm', 'uhuh', 'uh-huh',
  // Identity / presence
  'speaking', 'present',
  // Confirmations
  'correct', 'right', 'true', 'sure', 'certainly', 'definitely',
  'absolutely', 'exactly', 'indeed', 'affirmative', 'agreed',
  'confirmed', 'obviously', 'naturally', 'surely',
  // Casual / colloquial
  'ok', 'okay', 'alright', 'fine', 'totally', 'of course',
  'go ahead', 'please', 'sure thing', 'no problem',
];

// Multi-word phrases that mean "yes, I am the person" — for identity confirmation
export const AFFIRMATIVE_PHRASES = [
  "that's me", "thats me", "it's me", "its me",
  "this is me", "this is he", "this is she", "this is they",
  "yes it is", "yes it's me", "yes that's me",
  "speaking", "yes speaking", "yeah speaking",
  "that's right", "thats right", "you're right",
  "of course", "go ahead", "sure go ahead",
];

export const NEGATIVE_WORDS = [
  'no', 'nope', 'nah', 'nay', 'negative',
  'false', 'incorrect', 'wrong', 'never',
  'not really', 'not exactly', 'not quite',
];

/**
 * Returns true if the given text is an affirmative response.
 * Handles single words, fillers, and multi-word phrases.
 */
export function isAffirmative(text) {
  if (!text) return false;
  const normalized = text.toLowerCase().replace(/[^\w\s'-]/g, '').trim();
  if (AFFIRMATIVE_PHRASES.some(p => normalized.includes(p))) return true;
  const words = normalized.split(/\s+/).filter(Boolean);
  return words.length > 0 && words.every(w => AFFIRMATIVE_WORDS.includes(w));
}

/**
 * Returns true if the given text is a negative response.
 */
export function isNegative(text) {
  if (!text) return false;
  const normalized = text.toLowerCase().replace(/[^\w\s'-]/g, '').trim();
  if (NEGATIVE_WORDS.some(n => normalized === n)) return true;
  const words = normalized.split(/\s+/).filter(Boolean);
  return words.length <= 4 && NEGATIVE_WORDS.some(n => normalized.includes(n));
}

/**
 * Returns true if the turn contains ONLY identity-confirmation content
 * (i.e. a short affirmative/negative with no substantive information).
 * Used to detect calls where the user never gave real answers.
 */
export function isTrivialTurn(text) {
  if (!text) return true;
  const normalized = text.toLowerCase().replace(/[^\w\s'-]/g, '').trim();
  // Short phrases that are pure affirmatives / identity signals
  if (AFFIRMATIVE_PHRASES.some(p => normalized === p)) return true;
  const words = normalized.split(/\s+/).filter(Boolean);
  // Turns <= 5 words where every word is a known trivial word
  const TRIVIAL_WORDS = new Set([
    ...AFFIRMATIVE_WORDS, ...NEGATIVE_WORDS,
    'i', 'am', 'me', 'my', 'hi', 'hello', 'hey', 'bye', 'goodbye',
    'ok', 'okay', 'thanks', 'thank', 'you', 'its', 'it', 'is',
  ]);
  return words.length <= 5 && words.every(w => TRIVIAL_WORDS.has(w));
}
