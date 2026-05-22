// src/pipeline/extractor.js — Stage 2: per-question LLM extraction + deterministic scoring
import { config } from '../config.js';
import { logger } from '../logger.js';
import { scoreAllQuestions } from './scorer.js';

/**
 * Extract answers and score them per question using Groq LLM.
 * Handles both implicit (whole-question answer) and explicit (sub-field) extraction.
 *
 * @param {Array}  turns          — clean [{role, text}] turns from normalizer
 * @param {Array}  dataToCollect  — campaign questions/info items with weights & optional fieldsToExtract
 * @returns {object} { questionResults, extractedFields, missingFields, summary, sentiment, modelVersion }
 */
export async function extract(turns, dataToCollect = []) {
  if (!turns || turns.length === 0) {
    return emptyResult(dataToCollect);
  }

  const questions = dataToCollect.filter(q => q.itemType === 'question');
  if (!questions.length) {
    return emptyResult(dataToCollect);
  }

  // Build a clean transcript — user turns only for extraction, but full for context
  const transcript = turns.map(t => `${t.role === 'agent' ? 'Agent' : 'User'}: ${t.text}`).join('\n');

  // Build per-question extraction spec
  const questionSpecs = questions.map(q => {
    const hasSubFields = q.fieldsToExtract && q.fieldsToExtract.length > 0;
    const expectedDesc = buildExpectedDesc(q.expectedAnswer);
    const isBooleanExpected = q.expectedAnswer?.condition === 'is_true' || q.expectedAnswer?.condition === 'is_false';

    return {
      questionId: q.id,
      questionText: q.text,
      weight: q.weight || 0,
      expectedDescription: expectedDesc,
      isBooleanScoring: isBooleanExpected,
      hasSubFields,
      subFields: hasSubFields ? q.fieldsToExtract : [],
    };
  });

  const questionSpecJson = JSON.stringify(questionSpecs, null, 2);

  const prompt = `You are an expert call transcript evaluator. Analyze this call transcript and for each question, extract and score the user's response.

CRITICAL RULES:
- All extracted values and quotes MUST come strictly from the USER's replies, not from the Agent's questions.
- NEVER extract a value the Agent stated unless the User explicitly confirmed it.
- The "raw" quote must be exact text from a User turn only.

TRANSCRIPT:
${transcript}

QUESTIONS TO EVALUATE:
${questionSpecJson}

For each question, return:
1. "answerExtracted": The user's answer in a concise normalized form (null if not answered or question was never asked).
2. "subFieldsExtracted": If the question has "hasSubFields: true", extract each sub-field from the user's reply. For each sub-field: { "value": <value or null>, "confidence": "high"|"medium"|"low", "raw": "<exact user quote or null>" }

Return a single valid JSON object:
{
  "summary": "<one sentence summary of the overall call>",
  "sentiment": "positive"|"neutral"|"negative",
  "questionResults": [
    {
      "questionId": "<id>",
      "answerExtracted": "<normalized answer or null>",
      "subFieldsExtracted": {
        "<fieldName>": { "value": <value or null>, "confidence": "high"|"medium"|"low", "raw": "<user quote or null>" }
      }
    }
  ]
}

Return ONLY the JSON object. No explanations, no markdown.`;

  const start = Date.now();
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.groq.apiKey}`
    },
    body: JSON.stringify({
      model: config.groq.model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      stream: false
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Groq extraction failed: ${response.status} ${err}`);
  }

  const data = await response.json();
  const rawJson = data.choices[0].message.content.trim();

  let questionResults = [];
  let summary = null;
  let sentiment = 'neutral';

  try {
    const jsonStr = rawJson.replace(/^```json?\s*/i, '').replace(/\s*```$/, '');
    const parsed = JSON.parse(jsonStr);
    questionResults = parsed.questionResults || [];
    summary = parsed.summary || null;
    sentiment = parsed.sentiment || 'neutral';
  } catch (e) {
    logger.warn({ rawJson, err: e.message }, '[Extractor] Failed to parse LLM JSON — returning empty');
  }

  // Deterministic weighted scoring from campaign config
  const scored = scoreAllQuestions(dataToCollect, questionResults, turns);
  const scoredResults = scored.questionResults;

  // Build flat extractedFields map (for report display & backwards compat)
  const extractedFields = {};
  const missingFields = [];

  for (const qr of scoredResults) {
    const spec = questionSpecs.find(s => s.questionId === qr.questionId);
    if (!spec) continue;

    if (spec.hasSubFields) {
      for (const sf of spec.subFields) {
        const key = sf.field;
        const extracted = qr.subFieldsExtracted?.[key];
        if (extracted?.value != null) {
          extractedFields[key] = extracted;
        } else {
          missingFields.push(key);
        }
      }
    } else {
      // Implicit field — question answer
      if (qr.answerExtracted != null) {
        extractedFields[spec.questionText] = {
          value: qr.answerExtracted,
          confidence: 'high',
          raw: qr.answerExtracted
        };
      } else {
        missingFields.push(spec.questionText);
      }
    }
  }

  logger.info({
    durationMs: Date.now() - start,
    questions: scoredResults.length,
    totalScore: scoredResults.reduce((sum, q) => sum + (q.questionScore || 0), 0).toFixed(1),
    missingFields,
    modelVersion: config.groq.model
  }, '[Extractor] Extraction complete');

  return {
    questionResults: scoredResults,
    extractedFields,
    missingFields,
    summary,
    sentiment,
    score: scored.score,
    breakdown: scored.breakdown,
    modelVersion: config.groq.model
  };
}

function buildExpectedDesc(expectedAnswer) {
  if (!expectedAnswer) return 'Any answer is acceptable';
  const { condition, value } = expectedAnswer;
  if (condition === 'is any value') return 'Any answer is acceptable';
  if (condition === 'is_true' || condition === 'is_true') return 'The answer should be YES / affirmative (boolean)';
  if (condition === 'is_false') return 'The answer should be NO / negative (boolean)';
  if (condition === 'contains') return `The answer should contain: "${value}"`;
  if (condition === 'does not contain') return `The answer should NOT contain: "${value}"`;
  if (condition === 'equals') return `The answer should be exactly: "${value}"`;
  if (condition === 'starts with') return `The answer should start with: "${value}"`;
  if (condition === 'ends with') return `The answer should end with: "${value}"`;
  if (condition === 'is greater than') return `The answer should be greater than ${value}`;
  if (condition === 'is less than') return `The answer should be less than ${value}`;
  return value ? `Expected: ${condition} "${value}"` : 'Any answer is acceptable';
}

function emptyResult(dataToCollect) {
  const questions = (dataToCollect || []).filter(q => q.itemType === 'question');
  const scored = scoreAllQuestions(dataToCollect, [], []);
  return {
    questionResults: scored.questionResults,
    extractedFields: {},
    missingFields: questions.flatMap(q =>
      q.fieldsToExtract?.length ? q.fieldsToExtract.map(f => f.field) : [q.text]
    ),
    summary: null,
    sentiment: 'neutral',
    score: 0,
    breakdown: scored.breakdown,
    modelVersion: config.groq.model
  };
}
