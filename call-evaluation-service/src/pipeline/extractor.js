// src/pipeline/extractor.js — Stage 2: semantic LLM extraction
import { config } from '../config.js';
import { logger } from '../logger.js';

/**
 * Extract structured fields from the clean conversation turns using Groq LLM.
 * Config-driven: fieldsToExtract comes from the campaign config in the job payload.
 *
 * @param {Array}  turns           — clean [{role, text}] turns from normalizer
 * @param {Array}  fieldsToExtract — [{ field, type, unit }]
 * @returns {object} { extractedFields, missingFields, modelVersion }
 */
export async function extract(turns, fieldsToExtract = []) {
  if (!turns || turns.length === 0) {
    return { extractedFields: {}, missingFields: fieldsToExtract.map(f => f.field), modelVersion: config.groq.model };
  }

  if (!fieldsToExtract.length) {
    return { extractedFields: {}, missingFields: [], modelVersion: config.groq.model };
  }

  const transcript = turns.map(t => `${t.role === 'agent' ? 'Agent' : 'User'}: ${t.text}`).join('\n');

  const fieldDescriptions = fieldsToExtract
    .map(f => `- ${f.field} (${f.type}${f.unit ? ', ' + f.unit : ''})`)
    .join('\n');

  const prompt = `You are a data extraction assistant. Analyze this call transcript to extract specific fields, provide a concise summary, and determine user sentiment.
  
Fields to extract:
${fieldDescriptions}

Transcript:
${transcript}

Return ONLY valid JSON with this exact structure:
{
  "summary": "<one sentence summary of the call>",
  "sentiment": "positive"|"neutral"|"negative",
  "extractedFields": {
    "fieldName": { "value": <extracted value or null>, "confidence": "high"|"medium"|"low", "raw": "<exact quote from transcript or null>" }
  }
}

Rules:
- If a field was clearly stated, confidence = "high"
- If a field was implied or inferred, confidence = "medium"  
- If a field was not discussed at all, set value to null and confidence = "low"
- For number fields, value should be a number (not a string)
- Return ONLY the JSON object, no explanation.`;

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
      temperature: 0.1, // low temp for structured extraction
      stream: false
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Groq extraction failed: ${response.status} ${err}`);
  }

  const data = await response.json();
  const rawJson = data.choices[0].message.content.trim();

  let extractedFields = {};
  let summary = null;
  let sentiment = 'neutral';

  try {
    const jsonStr = rawJson.replace(/^```json?\s*/i, '').replace(/\s*```$/, '');
    const parsed = JSON.parse(jsonStr);
    
    // Normalize keys in extractedFields (trim them)
    if (parsed.extractedFields) {
      extractedFields = Object.keys(parsed.extractedFields).reduce((acc, key) => {
        acc[key.trim()] = parsed.extractedFields[key];
        return acc;
      }, {});
    }
    
    summary = parsed.summary || null;
    sentiment = parsed.sentiment || 'neutral';
  } catch (e) {
    logger.warn({ rawJson, err: e.message }, '[Extractor] Failed to parse LLM JSON — returning empty');
  }

  const extractedKeys = Object.keys(extractedFields).filter(k => extractedFields[k]?.value != null);
  const expectedKeys  = fieldsToExtract.map(f => String(f.field || '').trim());
  const missingFields = expectedKeys.filter(k => !extractedKeys.some(ek => ek.toLowerCase() === k.toLowerCase()));

  logger.info({
    durationMs:      Date.now() - start,
    fieldsExtracted: extractedKeys,
    missingFields,
    modelVersion:    config.groq.model
  }, '[Extractor] Extraction complete');

  return {
    extractedFields,
    missingFields,
    summary,
    sentiment,
    modelVersion: config.groq.model
  };
}
