import React from 'react';

export default function ToggleSwitch({ checked, onChange, disabled = false, title }) {
  return (
    <label
      title={title}
      className={`relative inline-flex items-center ${disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'}`}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={e => onChange(e.target.checked)}
        className="sr-only peer"
      />
      <div className="w-9 h-5 rounded-full bg-paper-500 dark:bg-ink-400 peer-checked:bg-brand-500 transition-colors duration-150 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-500/40" />
      <div className="absolute left-0.5 top-0.5 w-4 h-4 rounded-full bg-paper-100 shadow-card transition-transform duration-150 peer-checked:translate-x-4" />
    </label>
  );
}
