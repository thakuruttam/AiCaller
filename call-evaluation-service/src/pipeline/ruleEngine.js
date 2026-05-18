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
    case 'gte':
    case 'greater or equal': return !isNaN(n) && n >= r;
    case 'lte':
    case 'less or equal':    return !isNaN(n) && n <= r;
    case 'gt':
    case 'greater than':    return !isNaN(n) && n > r;
    case 'lt':
    case 'less than':       return !isNaN(n) && n < r;
    case 'eq':
    case 'equals':          return String(fieldVal) === String(ruleVal);
    case 'neq':
    case 'not equals':      return String(fieldVal) !== String(ruleVal);
    case 'is_any':          return fieldVal != null && String(fieldVal).trim().length > 0;
    case 'contains':        return String(fieldVal).toLowerCase().includes(String(ruleVal).toLowerCase());
    case 'does_not_contain':
    case 'does not contain': return !String(fieldVal).toLowerCase().includes(String(ruleVal).toLowerCase());
    case 'is_true':         return fieldVal === true || String(fieldVal).toLowerCase() === 'true';
    case 'is_false':        return fieldVal === false || String(fieldVal).toLowerCase() === 'false';
    default:                return false;
  }
}
