// Profanity guard for voice calls: the bot must never say a cuss word (even one typed into a
// campaign's script or questions), and a caller who swears gets a polite goodbye and a hangup.
//
// Matching is whole-word only (English, Romanised Hindi and Devanagari), so ordinary words that
// merely contain a cuss word ("class", "assess", "Scunthorpe") are never flagged. Words are
// removed, not replaced with "***", because TTS would read the asterisks aloud.

const PROFANE_WORDS = new Set([
  // English
  'fuck', 'fucks', 'fucked', 'fucker', 'fuckers', 'fucking', 'fuckin', 'motherfucker', 'motherfuckers', 'motherfucking',
  'fck', 'fcking', 'shit', 'shits', 'shitty', 'bullshit', 'horseshit', 'bitch', 'bitches', 'bitching', 'bastard', 'bastards',
  'asshole', 'assholes', 'arsehole', 'arseholes', 'cunt', 'cunts', 'dickhead', 'dickheads', 'whore', 'whores', 'slut', 'sluts',
  'wanker', 'wankers', 'jackass', 'dumbass',
  // Hindi / Hinglish (Roman script, as speech-to-text writes it)
  'chutiya', 'chutiye', 'chutia', 'chootiya', 'madarchod', 'maderchod', 'madharchod', 'behenchod', 'bhenchod', 'benchod',
  'bahanchod', 'bsdk', 'bhosdike', 'bhosadike', 'bhosdi', 'bhosda', 'bhosdiwale', 'gandu', 'gaandu', 'lauda', 'laude', 'lawda',
  'lavde', 'lund', 'randi', 'harami', 'haramzada', 'haramzaade', 'haramkhor', 'kamina', 'kamine', 'kutti', 'jhatu',
  // Hindi (Devanagari)
  'चूतिया', 'चुतिया', 'चूतिये', 'मादरचोद', 'बहनचोद', 'भेनचोद', 'भोसडी', 'भोसड़ी', 'भोसडीके', 'भोसड़ीके', 'भोसड़ा',
  'गांडू', 'गाण्डू', 'लौड़ा', 'लौडा', 'लौड़े', 'लंड', 'रंडी', 'हरामी', 'हरामज़ादा', 'हरामजादा', 'हरामखोर', 'कमीना', 'कमीने', 'कुत्ती',
]);

// Speech-to-text can return a cuss word already starred out, e.g. "f***" or "s**t".
const STARRED_WORD = /^\p{L}+\*+\p{L}*$/u;
// A "word" for matching purposes: letters (any script) plus combining marks, so Devanagari
// vowel signs stay attached to their consonants; asterisks so starred words stay whole.
const WORD = /[\p{L}\p{M}*]+/gu;

function isProfane(word) {
  return PROFANE_WORDS.has(word.toLowerCase()) || STARRED_WORD.test(word);
}

export function containsProfanity(text) {
  if (!text) return false;
  return (String(text).match(WORD) || []).some(isProfane);
}

/** The text with every cuss word removed, tidied so TTS reads it naturally. */
export function maskProfanity(text) {
  if (!text || !containsProfanity(text)) return text;
  return String(text)
    .replace(WORD, (word) => (isProfane(word) ? '' : word))
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/ +([,.!?।])/g, '$1')
    .replace(/,+([.!?।])/g, '$1')
    .replace(/^[ \t,]+/gm, '')
    .trim();
}

const POLITE_HANGUP_LINES = {
  English: "I'm sorry, but I won't be able to continue this call. Thank you for your time. Goodbye.",
  Hinglish: 'Maaf kijiye, yeh call hum yahin samaapt kar rahe hain. Aapke samay ke liye dhanyavaad.',
  Hindi: 'माफ़ कीजिए, यह कॉल हम यहीं समाप्त कर रहे हैं। आपके समय के लिए धन्यवाद।',
};

/** What the bot says before hanging up on a caller who swore, in the campaign's language. */
export function politeHangupLine(language) {
  return POLITE_HANGUP_LINES[language] || POLITE_HANGUP_LINES.English;
}
