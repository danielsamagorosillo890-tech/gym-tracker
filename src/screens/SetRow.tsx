import { useEffect, useState } from 'react';
import type { Metric, Unit } from '../data/types';
import { parseDecimal } from '../logic/number';
import { fmtNum } from '../logic/units';
import { IconCheck, IconClose, IconMinus, IconPlus } from '../ui/icons';

/** Text input that keeps the user's raw text while typing ("62," is valid mid-edit). */
export function NumInput({
  value,
  onCommit,
  label,
  decimal,
  disabled,
}: {
  value: number | null;
  onCommit: (v: number | null) => void;
  label: string;
  decimal: boolean;
  disabled?: boolean;
}) {
  const [text, setText] = useState(value === null ? '' : fmtNum(value));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setText(value === null ? '' : fmtNum(value));
  }, [value, focused]);
  return (
    <input
      className="num"
      inputMode={decimal ? 'decimal' : 'numeric'}
      aria-label={label}
      value={text}
      disabled={disabled}
      onFocus={(e) => {
        setFocused(true);
        e.target.select();
      }}
      onBlur={() => setFocused(false)}
      onChange={(e) => {
        setText(e.target.value);
        if (e.target.value.trim() === '') return onCommit(null);
        const n = parseDecimal(e.target.value);
        if (n !== null && (decimal || Number.isInteger(n))) onCommit(n);
      }}
    />
  );
}

export interface RowView {
  /** Weight in the exercise's input unit. */
  weight: number | null;
  reps: number | null;
  seconds: number | null;
  completed: boolean;
}

export function SetRow({
  index,
  row,
  unit,
  step,
  metric,
  isExtra,
  isPR,
  onWeight,
  onReps,
  onSeconds,
  onToggle,
  onDelete,
}: {
  index: number;
  row: RowView;
  unit: Unit;
  step: number;
  metric: Metric;
  isExtra: boolean;
  isPR: boolean;
  onWeight: (v: number | null) => void;
  onReps: (v: number | null) => void;
  onSeconds: (v: number | null) => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const bump = (d: number) => onWeight(Math.max(0, Math.round(((row.weight ?? 0) + d) * 100) / 100));
  const timed = metric === 'time_weight';
  return (
    <div className={`set-row${row.completed ? ' done' : ''}`}>
      <div className="set-idx">
        {isExtra && !row.completed ? (
          <button className="icon-btn tiny" onClick={onDelete} aria-label={`Quitar serie ${index + 1}`}>
            <IconClose size={16} />
          </button>
        ) : (
          index + 1
        )}
      </div>
      <div className="kg-group">
        <button
          className="step-btn"
          onClick={() => bump(-step)}
          aria-label={`Bajar ${fmtNum(step)} ${unit}`}
          disabled={row.completed}
        >
          <IconMinus size={18} />
        </button>
        <NumInput value={row.weight} onCommit={onWeight} label={`${unit} serie ${index + 1}`} decimal disabled={row.completed} />
        <button
          className="step-btn"
          onClick={() => bump(step)}
          aria-label={`Subir ${fmtNum(step)} ${unit}`}
          disabled={row.completed}
        >
          <IconPlus size={18} />
        </button>
      </div>
      {timed ? (
        <NumInput value={row.seconds} onCommit={onSeconds} label={`Segundos serie ${index + 1}`} decimal={false} disabled={row.completed} />
      ) : (
        <NumInput value={row.reps} onCommit={onReps} label={`Reps serie ${index + 1}`} decimal={false} disabled={row.completed} />
      )}
      <button
        className={`check-btn${row.completed ? ' on' : ''}`}
        onClick={onToggle}
        aria-pressed={row.completed}
        aria-label={row.completed ? `Desmarcar serie ${index + 1}` : `Marcar serie ${index + 1} como hecha`}
      >
        <IconCheck />
      </button>
      {isPR && <span className="pr-tag">PR</span>}
    </div>
  );
}
