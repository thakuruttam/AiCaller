import { createContext } from 'react';
import { NAME_VARIABLE } from '../../lib/contactVariables';

/**
 * The campaign's variables and a person to show sample values from — given
 * by the builder so any text box can offer the ## / {{ picker without new
 * props threaded through every editor.
 */
export const VariablesContext = createContext(null);

export const TRIGGER = /(##|\{\{)\s*([A-Za-z0-9_]*)$/;

/** Which picker options match what was typed after the trigger. */
export function matchVariables(variables, query) {
  const q = query.toLowerCase();
  const all = [NAME_VARIABLE, ...variables];
  const starts = all.filter(v => v.key.startsWith(q));
  const contains = all.filter(v => !v.key.startsWith(q) && (v.key.includes(q) || String(v.label).toLowerCase().includes(q)));
  return [...starts, ...contains].slice(0, 8);
}

/**
 * Replaces the trigger and partial name before `caret` with {{key}}.
 * Returns the new text and where the caret goes.
 */
export function insertVariable(text, caret, key) {
  const before = text.slice(0, caret);
  const m = before.match(TRIGGER);
  if (!m) return { text, caret };
  const start = caret - m[0].length;
  const token = `{{${key}}}`;
  // Don't double a closing "}}" the person already typed.
  const after = text.slice(caret).replace(/^\s*\}\}/, '');
  return { text: text.slice(0, start) + token + after, caret: start + token.length };
}

