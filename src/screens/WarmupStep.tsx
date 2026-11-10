import { useEffect, useState } from 'react';
import { toggleWarmup } from '../data/actions';
import type { Exercise, Session, Slot, WarmupCheck } from '../data/types';
import { IconCheck } from '../ui/icons';
import { fmtClock } from '../ui/RestTimer';

function target(slot: Slot, ex: Exercise | undefined): string {
  const side = ex?.perSide ? ' por lado' : '';
  if (slot.seconds) return `${slot.seconds} s${side}`;
  if (slot.repMin === null) return side.trim();
  const r = slot.repMax !== null && slot.repMax !== slot.repMin ? `${slot.repMin}-${slot.repMax}` : `${slot.repMin}`;
  return slot.sets > 1 ? `${slot.sets} × ${r}${side}` : `${r} reps${side}`;
}

function Countdown({ seconds, onDone }: { seconds: number; onDone: () => void }) {
  const [endsAt] = useState(() => Date.now() + seconds * 1000);
  const [, tick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => {
      tick((n) => n + 1);
      if (Date.now() >= endsAt) {
        window.clearInterval(id);
        try {
          navigator.vibrate?.(200);
        } catch {
          /* ignored */
        }
        onDone();
      }
    }, 200);
    return () => window.clearInterval(id);
  }, [endsAt, onDone]);
  return <span className="countdown">{fmtClock((endsAt - Date.now()) / 1000)}</span>;
}

export function WarmupStep({
  slots,
  exercises,
  session,
  checks,
  ensureSession,
  onNext,
  nextName,
}: {
  slots: Slot[];
  exercises: Map<string, Exercise>;
  session: Session | null;
  checks: WarmupCheck[];
  ensureSession: () => Promise<number>;
  onNext: () => void;
  nextName: string;
}) {
  const doneIds = new Set(checks.filter((c) => c.done).map((c) => c.slotId));
  const done = slots.filter((s) => doneIds.has(s.id)).length;
  const [running, setRunning] = useState<string | null>(null);

  const set = async (slotId: string, value: boolean) => {
    const sid = await ensureSession();
    await toggleWarmup(sid, slotId, value);
  };

  return (
    <div className="step">
      <div className="step-kicker">Calentamiento</div>
      <h2 className="step-title">Prepárate</h2>
      <p className="step-sub">
        {done} de {slots.length} listos. Toca cada uno al terminarlo.
      </p>

      <ul className="warm-list">
        {slots.map((slot) => {
          const ex = exercises.get(session?.overrides[slot.id] ?? slot.exerciseId);
          const isDone = doneIds.has(slot.id);
          return (
            <li key={slot.id} className={isDone ? 'done' : ''}>
              <button className="warm-item" onClick={() => set(slot.id, !isDone)} aria-pressed={isDone}>
                <span className="warm-box">{isDone && <IconCheck size={20} />}</span>
                <span className="warm-text">
                  <span className="warm-name">{ex?.name ?? slot.exerciseId}</span>
                  {target(slot, ex) && <span className="warm-target">{target(slot, ex)}</span>}
                </span>
              </button>
              {slot.seconds && !isDone && (
                <button
                  className="btn secondary small timer-btn"
                  onClick={() => setRunning(running === slot.id ? null : slot.id)}
                  aria-label={running === slot.id ? 'Detener cuenta regresiva' : `Iniciar ${slot.seconds} segundos`}
                >
                  {running === slot.id ? (
                    <Countdown
                      seconds={slot.seconds}
                      onDone={() => {
                        setRunning(null);
                        set(slot.id, true);
                      }}
                    />
                  ) : (
                    'Iniciar'
                  )}
                </button>
              )}
            </li>
          );
        })}
      </ul>

      <button className={`btn ${done === slots.length ? 'primary' : 'secondary'} next-cta`} onClick={onNext}>
        {done === slots.length ? `Empezar: ${nextName}` : 'Saltar al primer ejercicio'}
      </button>
    </div>
  );
}
