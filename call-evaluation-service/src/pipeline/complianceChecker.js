// src/pipeline/complianceChecker.js — Stage 4: script adherence analysis
/**
 * Checks how well the agent followed the configured script.
 * Pure JS — walks agent turns against the campaign's dataToCollect list.
 *
 * @param {Array} turns          — clean [{role, text}] turns
 * @param {Array} dataToCollect  — campaign questions/info items (from job payload)
 * @returns {object} compliance report
 */
export function checkCompliance(turns, dataToCollect = []) {
  const agentTurns = turns.filter(t => t.role === 'agent').map(t => t.text.toLowerCase());
  const userTurns  = turns.filter(t => t.role === 'user');

  // Detect identity verification — agent asked "am i speaking with"
  const identityVerified = agentTurns.some(t =>
    t.includes('am i speaking') || t.includes('is this') || t.includes('speaking with')
  );

  // Detect closure — agent said the sign-off phrase
  const closureDelivered = agentTurns.some(t =>
    t.includes('thank you for your time') || t.includes('have a great day') || t.includes('goodbye')
  );

  // Check which questions were actually asked by the agent
  const questions = dataToCollect.filter(item => item.itemType === 'question');
  const questionsAsked   = [];
  const questionsSkipped = [];

  for (const q of questions) {
    const qText = q.text?.toLowerCase() ?? '';
    const wasAsked = agentTurns.some(t => {
      // Check for significant word overlap (agent paraphrases are ok)
      const qWords = qText.split(' ').filter(w => w.length > 3);
      return qWords.length > 0 && qWords.some(w => t.includes(w));
    });

    if (wasAsked) {
      questionsAsked.push(q.text);
    } else {
      questionsSkipped.push(q.text);
    }
  }

  const questionCoverage = questions.length > 0
    ? questionsAsked.length / questions.length
    : 1.0;

  // Detect interruptions — user spoke mid-agent sentence (heuristic: very short user turn)
  const interruptionsHandled = userTurns.filter(t => t.text.split(' ').length <= 3).length;

  // Script adherence score (simple weighted formula)
  let scriptAdherenceScore = 0;
  if (identityVerified) scriptAdherenceScore += 20;
  if (closureDelivered)  scriptAdherenceScore += 20;
  scriptAdherenceScore += Math.round(questionCoverage * 60);

  return {
    identityVerified,
    questionsAsked,
    questionsSkipped,
    questionCoverage: parseFloat(questionCoverage.toFixed(2)),
    closureDelivered,
    interruptionsHandled,
    scriptAdherenceScore: Math.min(100, scriptAdherenceScore)
  };
}
