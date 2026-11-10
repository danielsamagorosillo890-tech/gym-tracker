import { useEffect, useState } from 'react';
import { parseDecimal } from '../logic/number';
import { fmtNum } from '../logic/units';
import { IconMinus, IconPlus } from './icons';

/** Single-choice chips that wrap onto several lines. */
export function ChipGroup<T extends string | null>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="chip-group" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          role="radio"
          aria-checked={o.value === value}
          className={o.value === value ? 'on' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Number with big −/+ buttons; typing is also allowed. Empty = null when `allowEmpty`. */
export function Stepper({
  value,
  onChange,
  step = 1,
  min = 0,
  decimal = false,
  allowEmpty = false,
  label,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  step?: number;
  min?: number;
  decimal?: boolean;
  allowEmpty?: boolean;
  label: string;
}) {
  const [text, setText] = useState(value === null ? '' : fmtNum(value));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setText(value === null ? '' : fmtNum(value));
  }, [value, focused]);
  const bump = (d: number) => onChange(Math.max(min, Math.round(((value ?? min) + d) * 100) / 100));
  return (
    <div className="stepper">
      <button onClick={() => bump(-step)} aria-label={`Menos ${label}`}>
        <IconMinus size={18} />
      </button>
      <input
        className="num"
        inputMode={decimal ? 'decimal' : 'numeric'}
        aria-label={label}
        value={text}
        onFocus={(e) => {
          setFocused(true);
          e.target.select();
        }}
        onBlur={() => setFocused(false)}
        onChange={(e) => {
          setText(e.target.value);
          if (e.target.value.trim() === '') return allowEmpty && onChange(null);
          const n = parseDecimal(e.target.value);
          if (n !== null && n >= min && (decimal || Number.isInteger(n))) onChange(n);
        }}
      />
      <button onClick={() => bump(step)} aria-label={`Más ${label}`}>
        <IconPlus size={18} />
      </button>
    </div>
  );
}

/** Labeled row used across editors. */
export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="field">
      <span>{label}</span>
      {children}
      {hint && <small className="muted">{hint}</small>}
    </div>
  );
}
