import React, { useEffect, useId, useState } from 'react';

// Small shared building blocks for the simulator UI.

export const Card: React.FC<{ title?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode; className?: string }> = ({
  title,
  actions,
  children,
  className = '',
}) => (
  <section className={`bg-slate-900 border border-slate-800 rounded-xl ${className}`}>
    {(title || actions) && (
      <div className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-2">
        {title && <h2 className="text-sm font-semibold text-slate-100">{title}</h2>}
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    )}
    <div className="px-4 pb-4 pt-1">{children}</div>
  </section>
);

const inputClass =
  'w-full min-w-0 bg-slate-950 border border-slate-700 rounded-md px-2.5 py-1.5 text-sm text-slate-100 ' +
  'focus:outline-none focus:ring-2 focus:ring-cyan-500/60 focus:border-cyan-500 placeholder:text-slate-600';

interface NumFieldProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  unit?: string;
  step?: number;
  min?: number;
  hint?: string;
}

/**
 * Numeric input that keeps the text being typed ("0.", "-", empty) and only reports
 * valid numbers, so editing never snaps the field back to a default.
 */
export const NumField: React.FC<NumFieldProps> = ({ label, value, onChange, unit, step = 0.01, min, hint }) => {
  const id = useId();
  const [text, setText] = useState(String(value));

  useEffect(() => {
    if (parseFloat(text) !== value) setText(String(value));
    // Only resync when the value changes from outside
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const invalid = text.trim() === '' || isNaN(Number(text)) || (min !== undefined && Number(text) < min);

  return (
    <label htmlFor={id} className="block min-w-0" title={hint}>
      <span className="block text-xs text-slate-400 mb-1 truncate">
        {label}
        {unit && <span className="text-slate-500"> ({unit})</span>}
      </span>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        step={step}
        min={min}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          const n = Number(e.target.value);
          if (e.target.value.trim() !== '' && !isNaN(n) && (min === undefined || n >= min)) onChange(n);
        }}
        onBlur={() => invalid && setText(String(value))}
        aria-invalid={invalid}
        className={`${inputClass} font-mono tabular-nums ${invalid ? 'border-rose-500 focus:ring-rose-500/50' : ''}`}
      />
    </label>
  );
};

export const TextField: React.FC<{ label: string; value: string; onChange: (value: string) => void; placeholder?: string }> = ({
  label,
  value,
  onChange,
  placeholder,
}) => {
  const id = useId();
  return (
    <label htmlFor={id} className="block min-w-0">
      <span className="block text-xs text-slate-400 mb-1">{label}</span>
      <input id={id} type="text" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={inputClass} />
    </label>
  );
};

export const SelectField: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}> = ({ label, value, onChange, children }) => {
  const id = useId();
  return (
    <label htmlFor={id} className="block min-w-0">
      <span className="block text-xs text-slate-400 mb-1">{label}</span>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={`${inputClass} cursor-pointer`}>
        {children}
      </select>
    </label>
  );
};

type ButtonVariant = 'primary' | 'secondary' | 'ghost';

const buttonVariants: Record<ButtonVariant, string> = {
  primary: 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold',
  secondary: 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700',
  ghost: 'text-slate-300 hover:text-white hover:bg-slate-800',
};

export const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }> = ({
  variant = 'secondary',
  className = '',
  type = 'button',
  ...props
}) => (
  <button
    type={type}
    className={`inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition cursor-pointer
      disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400
      ${buttonVariants[variant]} ${className}`}
    {...props}
  />
);

/** Segmented control for a small set of mutually exclusive views. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="inline-flex flex-wrap bg-slate-950 border border-slate-800 rounded-lg p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={`px-2.5 py-1 rounded-md text-xs transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
            value === o.value ? 'bg-slate-700 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
