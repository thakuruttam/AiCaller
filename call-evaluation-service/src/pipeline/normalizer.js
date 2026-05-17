// src/pipeline/normalizer.js — Stage 1: pure function, no LLM
/**
 * Strips all system directives and Twilio headers from the raw transcript.
 * Returns clean {role, text} turns.
 */
export function normalize(rawTranscript) {
  if (!rawTranscript) return { callSid: null, turns: [] };

  // Extract Twilio SID from header
  const callSid = rawTranscript.match(/\[Twilio_SID:([^\]]+)\]/)?.[1] ?? null;

  // Remove header line
  let cleaned = rawTranscript.replace(/\[Twilio_SID:[^\]]+\]\n*/g, '');

  // Remove (System: ...) directives — single-line and multi-line
  cleaned = cleaned.replace(/\(System:[^)]*\)/gs, '');

  // Collapse multiple blank lines
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();

  const turns = parseTurns(cleaned);

  return { callSid, turns };
}

/**
 * Parse "USER: text" / "A: text" blocks into structured turns.
 */
function parseTurns(text) {
  const turns = [];
  // Split on role markers at start of line
  const lines = text.split('\n');
  let currentRole = null;
  let currentText = [];

  for (const line of lines) {
    const userMatch  = line.match(/^USER:\s*(.*)/i);
    const agentMatch = line.match(/^(?:A|ASSISTANT|AGENT):\s*(.*)/i);

    if (userMatch) {
      if (currentRole) turns.push({ role: currentRole, text: currentText.join(' ').trim() });
      currentRole = 'user';
      currentText = [userMatch[1]];
    } else if (agentMatch) {
      if (currentRole) turns.push({ role: currentRole, text: currentText.join(' ').trim() });
      currentRole = 'agent';
      currentText = [agentMatch[1]];
    } else if (currentRole && line.trim()) {
      currentText.push(line.trim());
    }
  }

  if (currentRole) turns.push({ role: currentRole, text: currentText.join(' ').trim() });

  return turns.filter(t => t.text.length > 0);
}
