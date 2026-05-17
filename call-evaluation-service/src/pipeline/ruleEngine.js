// src/pipeline/ruleEngine.js — Stage 3: deterministic scorer, zero LLM
/**
 * Evaluate scoring rules against extracted fields.
 * Fully deterministic — no AI involved.
 *
 * @param {object} extractedFields — output of extractor
 * @param {Array}  scoringRules    — [{ field, condition, value, score, label }]
 * @returns {{ score: number, breakdown: Array }}
 */
export function evaluate(extractedFields = {}, scoringRules = []) {
  let total = 0;
  const breakdown = [];

  for (const rule of scoringRules) {
    const trimmedRuleField = String(rule.field || '').trim();
    
    // Find the field in extractedFields by comparing trimmed, case-insensitive keys
    const fieldKey = Object.keys(extractedFields).find(k => k.trim().toLowerCase() === trimmedRuleField.toLowerCase());
    const field = fieldKey ? extractedFields[fieldKey] : null;

    if (!field || field.value == null) continue;

    let passed = false;
    const fieldVal = field.value;

    if (rule.contains !== undefined) {
      // Array or string contains check
      const haystack = Array.isArray(fieldVal)
        ? fieldVal.map(v => String(v).toLowerCase())
        : [String(fieldVal).toLowerCase()];
      passed = haystack.some(v => v.includes(String(rule.contains).toLowerCase()));
    } else {
      passed = checkCondition(fieldVal, rule.condition, rule.value);
    }

    if (passed) {
      total += rule.score;
      breakdown.push({
        rule:    rule.label || `${rule.field} ${rule.condition} ${rule.value}`,
        field:   rule.field,
        awarded: rule.score,
        fieldValue: fieldVal
      });
    }
  }

  return {
    score:     Math.min(100, Math.max(0, total)),
    breakdown
  };
}

function checkCondition(fieldVal, condition, ruleVal) {
  const n = parseFloat(fieldVal);
  const r = parseFloat(ruleVal);
  switch (condition) {
    case 'gte':        return !isNaN(n) && n >= r;
    case 'lte':        return !isNaN(n) && n <= r;
    case 'gt':         return !isNaN(n) && n > r;
    case 'lt':         return !isNaN(n) && n < r;
    case 'eq':         return String(fieldVal) === String(ruleVal);
    case 'neq':        return String(fieldVal) !== String(ruleVal);
    case 'is_any':     return fieldVal != null && String(fieldVal).trim().length > 0;
    default:           return false;
  }
}
