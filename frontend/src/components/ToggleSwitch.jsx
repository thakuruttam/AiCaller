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
      <div className="w-9 h-5 rounded-full bg-paper-600 dark:bg-white/15 peer-checked:bg-brand-500 transition-colors duration-200 peer-focus-visible:ring-[3px] peer-focus-visible:ring-brand-500/30" />
      <div className="absolute left-0.5 top-0.5 w-4 h-4 rounded-full bg-white shadow-[0_1px_2px_rgba(16,24,40,0.2)] transition-transform duration-200 ease-out peer-checked:translate-x-4" />
    </label>
  );
}
