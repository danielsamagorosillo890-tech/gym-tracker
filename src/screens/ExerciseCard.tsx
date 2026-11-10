import { useMemo, useState } from 'react';
import { deleteSetRow, fillSets, upsertSet, type SetValues } from '../data/actions';
import type { Day, Exercise, Session, SetLog, Settings, Slot } from '../data/types';
import { prefillForSlot } from '../logic/prefill';
import { suggestProgression } from '../logic/progression';
import { findPRs } from '../logic/records';
import { resolveExerciseId } from '../logic/swap';
import { fmtNum, fromKg, toKg } from '../logic/units';
import { IconMore } from '../ui/icons';
import { techniqueFor } from '../data/technique';
import { TechniqueMedia } from './technique/TechniqueMedia';
import { TechniqueSheet } from './technique/TechniqueSheet';
import { useRestTimer } from '../ui/RestTimer';
import { ExerciseMenu } from './ExerciseMenu';
import { SetRow, type RowView } from './SetRow';

export function goalText(slot: Slot, ex: Exercise): string {
  let g: string;
  if (slot.seconds) {
    g = slot.seconds % 60 === 0 ? `${slot.sets} × ${slot.seconds / 60} min` : `${slot.sets} × ${slot.seconds} s`;
  } else if (slot.repMin === null) {
    g = `${slot.sets} ${slot.sets === 1 ? 'serie' : 'series'}`;
  } else {
    const r = slot.repMax !== null && slot.repMax !== slot.repMin ? `${slot.repMin}-${slot.repMax}` : `${slot.repMin}`;
    g = `${slot.sets} × ${r}`;
  }
  if (ex.perSide) g += ' por lado';
  return g;
}

function fmtClockShort(sec: number) {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

/** "60 kg × 8, 8, 7" or "60×8, 62.5×7 kg" or "24 kg × 2:00". */
export function setsSummary(sets: SetLog[], ex: Exercise): string {
  if (sets.length === 0) return '';
  const w = (l: SetLog) => (l.kg === null ? '0' : fmtNum(fromKg(l.kg, ex.inputUnit)));
  const val = (l: SetLog) => (ex.metric === 'time_weight' ? fmtClockShort(l.seconds ?? 0) : String(l.reps ?? 0));
  const sameKg = sets.every((s) => s.kg === sets[0].kg);
  if (sameKg) return `${w(sets[0])} ${ex.inputUnit} × ${sets.map(val).join(', ')}`;
  return `${sets.map((s) => `${w(s)}×${val(s)}`).join(', ')} ${ex.inputUnit}`;
}

export function ExerciseCard({
  slot,
  exercises,
  days,
  slots,
  session,
  sessions,
  logs,
  settings,
  ensureSession,
  nextLabel,
  position,
  onNext,
}: {
  slot: Slot;
  exercises: Map<string, Exercise>;
  days: Day[];
  slots: Slot[];
  session: Session | null;
  sessions: Session[];
  logs: SetLog[];
  settings: Settings;
  ensureSession: () => Promise<number>;
  /** Name of the next exercise ('' when this is the last one). */
  nextLabel: string;
  /** e.g. "2 de 12" */
  position: string;
  onNext: () => void;
}) {
  const nextName = nextLabel;
  const timer = useRestTimer();
  const [menuOpen, setMenuOpen] = useState(false);
  const [techOpen, setTechOpen] = useState(false);
  const exId = resolveExerciseId(slot, session);
  const ex = exercises.get(exId);

  const mine = useMemo(
    () =>
      session
        ? logs
            .filter((l) => l.sessionId === session.id && l.slotId === slot.id && l.exerciseId === exId)
            .sort((a, b) => a.index - b.index)
        : [],
    [logs, session, slot.id, exId],
  );
  const prefill = useMemo(
    () => prefillForSlot({ slot, exerciseId: exId, sessions, logs, currentSessionId: session?.id }),
    [slot, exId, sessions, logs, session?.id],
  );
  const prs = useMemo(
    () => (ex ? findPRs(logs.filter((l) => l.exerciseId === exId), ex.metric) : new Map()),
    [logs, exId, ex],
  );
  if (!ex) return null;

  const progression = suggestProgression(slot, ex, prefill.lastSets);
  const unit = ex.inputUnit;
  const maxIndex = mine.reduce((m, l) => Math.max(m, l.index), -1);
  const count = Math.max(slot.sets, maxIndex + 1);

  // Stored values (kg) for each row: the session's log, else the prefill.
  const stored: (SetValues & { completed: boolean; id?: number })[] = [];
  for (let i = 0; i < count; i++) {
    const l = mine.find((m) => m.index === i);
    const p = prefill.rows[i] ?? stored[i - 1] ?? prefill.rows[prefill.rows.length - 1];
    stored.push(
      l
        ? { kg: l.kg, reps: l.reps, seconds: l.seconds, completed: l.completed, id: l.id }
        : { kg: p.kg, reps: p.reps, seconds: p.seconds, completed: false },
    );
  }
  const view = (s: (typeof stored)[number]): RowView => ({
    weight: s.kg === null ? null : fromKg(s.kg, unit),
    reps: s.reps,
    seconds: s.seconds,
    completed: s.completed,
  });

  const write = async (i: number, values: Partial<SetValues> & { completed?: boolean }) => {
    const sid = await ensureSession();
    const base = stored[i];
    await upsertSet(sid, slot.id, exId, i, { kg: base.kg, reps: base.reps, seconds: base.seconds, ...values });
  };

  const onWeight = async (i: number, w: number | null) => {
    const kg = w === null ? null : toKg(w, unit);
    const old = stored[i].kg;
    await write(i, { kg });
    // Later rows that were in sync follow the change.
    for (let j = i + 1; j < count; j++) {
      if (!stored[j].completed && stored[j].kg === old) await write(j, { kg });
      else break;
    }
  };

  const onToggle = async (i: number) => {
    const s = stored[i];
    if (s.completed) return write(i, { completed: false });
    const values: Partial<SetValues> & { completed: boolean } = { completed: true, kg: s.kg ?? 0 };
    if (ex.metric === 'time_weight') values.seconds = s.seconds ?? slot.seconds ?? 0;
    else values.reps = s.reps ?? slot.repMin ?? 0;
    await write(i, values);
    const rest = ex.restSec ?? (ex.type === 'compound' ? settings.restCompoundSec : settings.restIsolationSec);
    const remaining = stored.filter((r, j) => j !== i && !r.completed).length;
    timer.start(rest, remaining > 0 ? ex.name : nextLabel);
  };

  const addRow = async () => {
    const last = stored[count - 1];
    const sid = await ensureSession();
    await upsertSet(sid, slot.id, exId, count, { kg: last?.kg ?? null, reps: last?.reps ?? slot.repMin, seconds: last?.seconds ?? slot.seconds });
  };

  const sameAsLast = async () => {
    const sid = await ensureSession();
    const rows = prefill.lastSets.map((l) => ({ kg: l.kg, reps: l.reps, seconds: l.seconds }));
    await fillSets(sid, slot.id, exId, rows);
  };

  const applyIncrease = async (kg: number, reps: number | null) => {
    const sid = await ensureSession();
    const rows = stored.map((s) => ({ kg, reps: ex.metric === 'time_weight' ? s.reps : reps, seconds: ex.metric === 'time_weight' ? slot.seconds : s.seconds }));
    await fillSets(sid, slot.id, exId, rows);
  };

  const refDay = prefill.reference ? days.find((d) => d.id === slots.find((s) => s.id === prefill.reference!.slotId)?.dayId) : null;
  const swapped = exId !== slot.exerciseId;
  const doneCount = stored.filter((s) => s.completed).length;

  const tech = techniqueFor(ex);
  const complete = doneCount >= slot.sets;
  const hasInfo = prefill.source !== 'none' || !!progression;

  return (
    <article className="step">
      <div className="step-kicker">
        {slot.section} · {position}
      </div>
      <div className="ex-head">
        <h2 className="step-title">{ex.name}</h2>
        <button className="icon-btn" onClick={() => setMenuOpen(true)} aria-label={`Opciones de ${ex.name}`}>
          <IconMore />
        </button>
      </div>
      <p className="step-sub">
        {goalText(slot, ex)}
        {slot.note && <span className="tag">{slot.note}</span>}
        {swapped && <span className="tag">cambio de hoy</span>}
      </p>

      <button className="technique" onClick={() => setTechOpen(true)} aria-label={`Ver técnica de ${ex.name}`}>
        <TechniqueMedia exerciseId={ex.id} name={ex.name} size="thumb" />
        <span className="technique-text">
          <strong>Técnica</strong>
          <small>
            {tech ? `${tech.cues.length} indicaciones · ${tech.reviewed ? 'revisado' : 'borrador'}` : 'Sin indicaciones'}
          </small>
          {tech && <small className="technique-muscle">{tech.muscle}</small>}
        </span>
      </button>

      {(ex.machineSettings || ex.notes) && (
        <button className="info-block notes" onClick={() => setMenuOpen(true)}>
          {ex.machineSettings && (
            <span>
              <b>Máquina</b> {ex.machineSettings}
            </span>
          )}
          {ex.notes && (
            <span>
              <b>Notas</b> {ex.notes}
            </span>
          )}
        </button>
      )}

      {hasInfo && (
        <div className="info-block">
          {prefill.source === 'slot' && (
            <p>
              <b>La vez pasada</b> {setsSummary(prefill.lastSets, ex)}
            </p>
          )}
          {prefill.source === 'exercise' && prefill.reference && (
            <p>
              <b>Referencia{refDay ? ` en ${refDay.name}` : ''}</b> {setsSummary(prefill.reference.sets, ex)}
            </p>
          )}
          {progression?.kind === 'increase' && (
            <button className="chip accent" onClick={() => applyIncrease(progression.kg, progression.reps)}>
              Sube a {fmtNum(fromKg(progression.kg, unit))} {unit}
            </button>
          )}
          {progression?.kind === 'more_reps' && (
            <p className="hint">
              Meta: más reps con {fmtNum(fromKg(progression.kg, unit))} {unit}
            </p>
          )}
          {progression?.kind === 'hold' && (
            <p className="hint">
              Mantén {fmtNum(fromKg(progression.kg, unit))} {unit}
            </p>
          )}
        </div>
      )}

      <div className="sets">
      <div className="set-head" aria-hidden="true">
        <span>#</span>
        <span>{unit}{ex.weightBasis === 'dumbbell' ? ' c/u' : ''}</span>
        <span>{ex.metric === 'time_weight' ? 'seg' : 'reps'}</span>
        <span />
      </div>
      {stored.map((s, i) => (
        <SetRow
          key={i}
          index={i}
          row={view(s)}
          unit={unit}
          step={ex.step}
          metric={ex.metric}
          isExtra={i >= slot.sets}
          isPR={s.completed && s.id !== undefined && prs.has(s.id)}
          onWeight={(w) => onWeight(i, w)}
          onReps={(r) => write(i, { reps: r })}
          onSeconds={(sec) => write(i, { seconds: sec })}
          onToggle={() => onToggle(i)}
          onDelete={async () => session && deleteSetRow(session.id, slot.id, exId, i)}
        />
      ))}

      </div>

      <div className="ex-actions">
        <button className="btn secondary small" onClick={addRow}>
          + serie
        </button>
        {prefill.source === 'slot' && !complete && (
          <button className="btn secondary small" onClick={sameAsLast}>
            Igual que la vez pasada
          </button>
        )}
      </div>

      {complete && (
        <button className="btn primary next-cta" onClick={onNext}>
          {nextName ? `Siguiente: ${nextName}` : 'Terminar sesión'}
        </button>
      )}

      {techOpen && <TechniqueSheet exercise={ex} onClose={() => setTechOpen(false)} />}
      {menuOpen && (
        <ExerciseMenu
          slot={slot}
          exercise={ex}
          exercises={exercises}
          session={session}
          ensureSession={ensureSession}
          onClose={() => setMenuOpen(false)}
        />
      )}
    </article>
  );
}
