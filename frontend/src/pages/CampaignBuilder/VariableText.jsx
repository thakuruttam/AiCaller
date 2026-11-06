import React, { useContext, useRef, useState } from 'react';
import { Input, Textarea } from '../../components/ui';
import { NAME_VARIABLE, VARIABLE_HINT, formatValue, parseValue } from '../../lib/contactVariables';
import { TRIGGER, VariablesContext, insertVariable, matchVariables } from './variablesContext';

/**
 * An Input or Textarea that opens a variable picker when "##" or "{{" is
 * typed: arrows to move, Enter or Tab to insert {{name}}, Esc to close.
 * Without a VariablesContext it is just the field.
 */
export default function VariableText({ as = 'input', value, onChange, onKeyDown, hint = false, className = '', ...props }) {
  const ctx = useContext(VariablesContext);
  const [picker, setPicker] = useState(null); // { query, index }
  const fieldRef = useRef(null);
  // 'input'/'textarea': the design-system fields; '*-raw': bare elements for
  // editors that style their own (script lines).
  const Field = { input: Input, textarea: Textarea, 'input-raw': 'input', 'textarea-raw': 'textarea' }[as] || as;

  const sampleOf = (v) => {
    if (!ctx?.person) return '';
    if (v.id === NAME_VARIABLE.id) return ctx.person.name || '';
    return formatValue(parseValue(ctx.person.vars?.[v.id], v.type).value, v.type);
  };

  const options = picker ? matchVariables(ctx?.variables || [], picker.query) : [];

  const look = (el) => {
    fieldRef.current = el;
    if (!ctx) return;
    const m = el.value.slice(0, el.selectionStart ?? el.value.length).match(TRIGGER);
    setPicker(m ? { query: m[2], index: 0 } : null);
  };

  const choose = (v) => {
    const el = fieldRef.current;
    if (!el) return;
    const { text, caret } = insertVariable(el.value, el.selectionStart ?? el.value.length, v.key);
    onChange(text);
    setPicker(null);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange?.(caret, caret); });
  };

  const keyDown = (e) => {
    if (picker && options.length) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const step = e.key === 'ArrowDown' ? 1 : -1;
        setPicker(p => ({ ...p, index: (p.index + step + options.length) % options.length }));
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        fieldRef.current = e.currentTarget;
        choose(options[picker.index] || options[0]);
        return;
      }
      if (e.key === 'Escape') { e.preventDefault(); setPicker(null); return; }
    }
    onKeyDown?.(e);
  };

  return (
    <div className="relative">
      <Field
        {...props}
        value={value}
        className={className}
        onChange={(e) => { onChange(e.target.value); look(e.target); }}
        onKeyDown={keyDown}
        onClick={(e) => look(e.currentTarget)}
        onBlur={() => setTimeout(() => setPicker(null), 150)}
        aria-autocomplete={ctx ? 'list' : undefined}
        aria-expanded={ctx ? !!(picker && options.length) : undefined}
      />
      {picker && options.length > 0 && (
        <ul
          role="listbox"
          aria-label="Variables"
          className="absolute z-30 left-0 mt-1 w-72 max-w-full rounded-xl border border-border bg-card dark:bg-muted shadow-overlay py-1"
        >
          {options.map((v, i) => (
            <li
              key={v.id}
              role="option"
              aria-selected={i === picker.index}
              onMouseDown={(e) => { e.preventDefault(); choose(v); }}
              className={`flex items-center justify-between gap-3 px-3 py-1.5 text-xs cursor-pointer
                ${i === picker.index ? 'bg-brand-500/10 text-foreground' : 'text-muted-foreground hover:bg-paper-400 dark:hover:bg-white/5'}`}
            >
              <span className="font-mono text-foreground">{`{{${v.key}}}`}</span>
              <span className="truncate">{sampleOf(v) || v.label}</span>
            </li>
          ))}
        </ul>
      )}
      {hint && ctx && <p className="mt-1 text-[11px] text-muted-foreground">{VARIABLE_HINT}</p>}
    </div>
  );
}
