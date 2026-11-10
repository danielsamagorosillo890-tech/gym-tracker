import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { db } from '../data/db';
import type { Exercise, Slot, Variant } from '../data/types';
import { slotsForVariant } from '../logic/variant';
import { goalText } from './ExerciseCard';

const TYPE = { compound: 'compuesto', isolation: 'aislamiento' };
const BASIS = { total: 'peso total', dumbbell: 'por mancuerna', stack: 'pila' };

/** Read-only routine view (editing arrives in Phase 1b). */
export function Routine() {
  const days = useLiveQuery(() => db.days.orderBy('order').toArray());
  const slots = useLiveQuery(() => db.slots.toArray());
  const exList = useLiveQuery(() => db.exercises.toArray());
  const [dayId, setDayId] = useState('push');
  const [variant, setVariant] = useState<Variant>('A');
  if (!days || !slots || !exList) return null;
  const exercises = new Map(exList.map((e) => [e.id, e]));
  const daySlots = slots.filter((s) => s.dayId === dayId);
  const visible = slotsForVariant(daySlots, variant);
  const hasB = daySlots.some((s) => s.block === 'work' && s.week === 'B');
  const hasA = daySlots.some((s) => s.block === 'work' && s.week === 'A');

  return (
    <div className="screen">
      <h2 className="screen-title">Rutina</h2>
      <p className="note">Por ahora solo lectura. La edición llega en la Fase 1b.</p>
      <div className="tabs-row" role="tablist">
        {days.map((d) => (
          <button key={d.id} role="tab" aria-selected={d.id === dayId} className={d.id === dayId ? 'on' : ''} onClick={() => setDayId(d.id)}>
            {d.name}
          </button>
        ))}
      </div>
      <div className="segmented" role="group" aria-label="Variante">
        {(['A', 'B'] as const).map((v) => (
          <button key={v} className={variant === v ? 'on' : ''} aria-pressed={variant === v} onClick={() => setVariant(v)}>
            Semana {v}
          </button>
        ))}
      </div>
      {variant === 'B' && hasA && !hasB && <p className="note">Semana B: por definir. Mientras tanto se usa la A.</p>}
      <ul className="routine-list">
        {visible.map((s) => (
          <RoutineRow key={s.id} slot={s} ex={exercises.get(s.exerciseId)} exercises={exercises} />
        ))}
      </ul>
    </div>
  );
}

function RoutineRow({ slot, ex, exercises }: { slot: Slot; ex: Exercise | undefined; exercises: Map<string, Exercise> }) {
  if (!ex) return null;
  return (
    <li className={`routine-item${slot.block === 'warmup' ? ' warm' : ''}`}>
      <div className="routine-name">
        <strong>{ex.name}</strong>
        <span className="muted">
          {slot.block === 'warmup' ? 'Calentamiento' : slot.section} · {goalText(slot, ex)}
          {slot.week !== 'both' ? ` · solo ${slot.week}` : ''}
        </span>
      </div>
      {slot.block === 'work' && (
        <div className="routine-meta">
          {ex.group} · {TYPE[ex.type]} · {BASIS[ex.weightBasis]} · {ex.inputUnit}
          {slot.alternatives.length > 0 && (
            <> · alternativas: {slot.alternatives.map((a) => exercises.get(a)?.name ?? a).join(', ')}</>
          )}
        </div>
      )}
    </li>
  );
}
