import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useMemo, useState } from 'react';
import { deleteSession, finishSession, skipDay, startSession, updateSession } from '../data/actions';
import { backupReminderDue } from '../data/backup';
import { db } from '../data/db';
import type { Day, Exercise, Session, SetLog, Slot, Variant } from '../data/types';
import { nextDayId } from '../logic/cycle';
import { findPRs, type PrReason } from '../logic/records';
import { fmtNum, fromKg } from '../logic/units';
import { effectiveVariant, slotsForVariant, variantFor } from '../logic/variant';
import { tonnage } from '../logic/volume';
import { downloadBackup } from '../ui/backupActions';
import { ConfirmInline, Sheet } from '../ui/Sheet';
import { useRestTimer } from '../ui/RestTimer';
import { useWakeLock } from '../ui/useWakeLock';
import { ExerciseCard } from './ExerciseCard';
import { Warmups } from './Warmups';

interface Summary {
  title: string;
  minutes: number;
  sets: number;
  tonnage: number;
  prs: string[];
}

const REASON: Record<PrReason, string> = { e1rm: '1RM estimado', reps: 'más reps', time: 'más tiempo' };

function buildSummary(session: Session, endedAt: number, logs: SetLog[], exercises: Map<string, Exercise>, days: Day[]): Summary {
  const mine = logs.filter((l) => l.sessionId === session.id && l.kind === 'work' && l.completed);
  const prs: string[] = [];
  for (const exId of new Set(mine.map((l) => l.exerciseId))) {
    const ex = exercises.get(exId);
    if (!ex) continue;
    const map = findPRs(logs.filter((l) => l.exerciseId === exId), ex.metric);
    const hits = mine.filter((l) => l.exerciseId === exId && map.has(l.id));
    const best = hits[hits.length - 1];
    if (!best) continue;
    const w = `${fmtNum(fromKg(best.kg ?? 0, ex.inputUnit))} ${ex.inputUnit}`;
    const v = ex.metric === 'time_weight' ? `${best.seconds} s` : `${best.reps}`;
    prs.push(`${ex.name}: ${w} × ${v} (${map.get(best.id)!.map((r) => REASON[r]).join(', ')})`);
  }
  const day = days.find((d) => d.id === session.dayId);
  return {
    title: `${day?.name ?? session.dayId} · Semana ${session.variant}`,
    minutes: Math.max(1, Math.round((endedAt - session.startedAt) / 60000)),
    sets: mine.length,
    tonnage: tonnage(mine),
    prs,
  };
}

export function Today() {
  const days = useLiveQuery(() => db.days.orderBy('order').toArray());
  const slots = useLiveQuery(() => db.slots.toArray());
  const exList = useLiveQuery(() => db.exercises.toArray());
  const sessions = useLiveQuery(() => db.sessions.toArray());
  const logs = useLiveQuery(() => db.setLogs.toArray());
  const settings = useLiveQuery(() => db.settings.get('settings'));
  const current = sessions?.find((s) => s.status === 'in_progress') ?? null;
  const checks = useLiveQuery(
    () => (current ? db.warmupChecks.where({ sessionId: current.id }).toArray() : []),
    [current?.id],
  );

  const [draft, setDraft] = useState<{ dayId: string; variant: Variant } | null>(null);
  const [sheet, setSheet] = useState<'days' | 'finish' | null>(null);
  const [confirm, setConfirm] = useState<'skip' | 'discard' | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [undoSkip, setUndoSkip] = useState<{ id: number; name: string } | null>(null);
  const [note, setNote] = useState('');

  useWakeLock(!!current);
  const timer = useRestTimer();

  const exercises = useMemo(() => new Map((exList ?? []).map((e) => [e.id, e])), [exList]);

  const dayId = days && sessions ? (current?.dayId ?? draft?.dayId ?? nextDayId(days, sessions)) : null;
  const requested: Variant | null =
    dayId && sessions && logs ? (current?.variant ?? draft?.variant ?? variantFor(dayId, sessions, logs, current?.id)) : null;

  const ensureSession = useCallback(async () => {
    if (current) return current.id;
    if (!dayId || !requested) throw new Error('not ready');
    const id = await startSession(dayId, requested);
    setDraft(null);
    setUndoSkip(null);
    return id;
  }, [current, dayId, requested]);

  if (!days || !slots || !sessions || !logs || !settings || !dayId || !requested) return null;

  const day = days.find((d) => d.id === dayId)!;
  const daySlots = slots.filter((s) => s.dayId === dayId);
  const eff = effectiveVariant(daySlots, requested);
  const visible = slotsForVariant(daySlots, eff.variant);
  const warm = visible.filter((s) => s.block === 'warmup');
  const work = visible.filter((s) => s.block === 'work');
  const sections: { name: string; slots: Slot[] }[] = [];
  for (const s of work) {
    const last = sections[sections.length - 1];
    if (last && last.name === s.section) last.slots.push(s);
    else sections.push({ name: s.section, slots: [s] });
  }
  const hasCompleted = !!current && logs.some((l) => l.sessionId === current.id && l.completed);
  const reminder = backupReminderDue(settings, Date.now());

  const setVariant = async (v: Variant) => {
    if (current) await updateSession(current.id, { variant: v });
    else setDraft({ dayId, variant: v });
  };

  const chooseDay = async (id: string) => {
    setSheet(null);
    const v = variantFor(id, sessions, logs, current?.id);
    if (current) await updateSession(current.id, { dayId: id, variant: v });
    else setDraft({ dayId: id, variant: v });
  };

  const doSkip = async () => {
    setConfirm(null);
    const id = await skipDay(dayId, requested);
    setDraft(null);
    setUndoSkip({ id, name: day.name });
  };

  const doFinish = async () => {
    if (!current) return;
    const endedAt = Date.now();
    await finishSession(current.id, note);
    const fresh = await db.setLogs.toArray();
    setSummary(buildSummary(current, endedAt, fresh, exercises, days));
    setSheet(null);
    setNote('');
    timer.skip();
    window.scrollTo(0, 0);
  };

  const preview = current ? buildSummary(current, Date.now(), logs, exercises, days) : null;
  const allWork = work;
  const nextNameFor = (slot: Slot) => {
    const i = allWork.indexOf(slot);
    const n = allWork[i + 1];
    return n ? (exercises.get(current?.overrides[n.id] ?? n.exerciseId)?.name ?? '') : '';
  };

  return (
    <div className="screen">
      {summary && (
        <section className="card summary">
          <h2>Sesión terminada</h2>
          <p className="muted">{summary.title}</p>
          <div className="stats">
            <div>
              <strong>{summary.minutes}</strong>
              <span>min</span>
            </div>
            <div>
              <strong>{summary.sets}</strong>
              <span>series</span>
            </div>
            <div>
              <strong>{fmtNum(Math.round(summary.tonnage))}</strong>
              <span>kg tonelaje</span>
            </div>
          </div>
          {summary.prs.length > 0 && (
            <ul className="pr-list">
              {summary.prs.map((p) => (
                <li key={p}>
                  <span className="pr-tag">PR</span> {p}
                </li>
              ))}
            </ul>
          )}
          <button className="btn secondary" onClick={() => setSummary(null)}>
            Listo
          </button>
        </section>
      )}

      {undoSkip && (
        <div className="banner">
          <span>Saltaste {undoSkip.name}.</span>
          <button
            className="btn secondary small"
            onClick={async () => {
              await deleteSession(undoSkip.id);
              setUndoSkip(null);
            }}
          >
            Deshacer
          </button>
        </div>
      )}

      {reminder && !current && (
        <div className="banner warn">
          <span>Llevas más de 14 días sin respaldo.</span>
          <button className="btn secondary small" onClick={() => downloadBackup()}>
            Respaldar
          </button>
        </div>
      )}

      <section className="day-head">
        <div>
          <h2 className="day-title">
            {day.name} · Semana {requested}
          </h2>
          <p className="muted">{current ? 'Sesión en curso' : draft ? 'Elegido a mano' : 'Siguiente en tu ciclo'}</p>
        </div>
        <div className="segmented" role="group" aria-label="Variante">
          {(['A', 'B'] as const).map((v) => (
            <button key={v} className={requested === v ? 'on' : ''} aria-pressed={requested === v} onClick={() => setVariant(v)}>
              {v}
            </button>
          ))}
        </div>
      </section>

      {eff.fellBack && <p className="note">{day.name} B aún no tiene ejercicios: se usa la A.</p>}

      {!hasCompleted && (
        <div className="day-actions">
          <button className="btn secondary small" onClick={() => setSheet('days')}>
            Hacer otro día
          </button>
          {!current && (
            <button className="btn secondary small" onClick={() => setConfirm('skip')}>
              Saltar {day.name}
            </button>
          )}
          {current && (
            <button className="btn secondary small" onClick={() => setConfirm('discard')}>
              Descartar sesión
            </button>
          )}
        </div>
      )}
      {confirm === 'skip' && (
        <ConfirmInline
          message={`¿Saltar ${day.name}? No se registra nada y el siguiente será ${days[(day.order + 1) % days.length].name}.`}
          confirmLabel="Saltar"
          onConfirm={doSkip}
          onCancel={() => setConfirm(null)}
        />
      )}
      {confirm === 'discard' && current && (
        <ConfirmInline
          message="¿Descartar la sesión en curso? Se borran los calentamientos y valores escritos."
          confirmLabel="Descartar"
          onConfirm={async () => {
            await deleteSession(current.id);
            setConfirm(null);
          }}
          onCancel={() => setConfirm(null)}
        />
      )}

      <Warmups slots={warm} exercises={exercises} session={current} checks={checks ?? []} ensureSession={ensureSession} />

      {sections.map((sec) => (
        <section key={sec.name} className="section">
          <h2 className="section-title">{sec.name}</h2>
          {sec.slots.map((slot) => (
            <ExerciseCard
              key={slot.id}
              slot={slot}
              exercises={exercises}
              days={days}
              slots={slots}
              session={current}
              sessions={sessions}
              logs={logs}
              settings={settings}
              ensureSession={ensureSession}
              nextLabel={nextNameFor(slot)}
            />
          ))}
        </section>
      ))}

      {current && (
        <button className="btn primary finish" onClick={() => setSheet('finish')}>
          Terminar sesión
        </button>
      )}

      {sheet === 'days' && (
        <Sheet title="Hacer otro día" onClose={() => setSheet(null)}>
          <p className="muted">Al terminarlo, el ciclo sigue desde ese día.</p>
          <div className="menu-list">
            {days.map((d) => (
              <button key={d.id} className={`btn ${d.id === dayId ? 'primary' : 'secondary'}`} onClick={() => chooseDay(d.id)}>
                {d.name}
              </button>
            ))}
          </div>
        </Sheet>
      )}

      {sheet === 'finish' && preview && (
        <Sheet title="Terminar sesión" onClose={() => setSheet(null)}>
          <div className="stats">
            <div>
              <strong>{preview.minutes}</strong>
              <span>min</span>
            </div>
            <div>
              <strong>{preview.sets}</strong>
              <span>series</span>
            </div>
            <div>
              <strong>{fmtNum(Math.round(preview.tonnage))}</strong>
              <span>kg tonelaje</span>
            </div>
          </div>
          {preview.prs.length > 0 && (
            <ul className="pr-list">
              {preview.prs.map((p) => (
                <li key={p}>
                  <span className="pr-tag">PR</span> {p}
                </li>
              ))}
            </ul>
          )}
          {preview.sets === 0 && (
            <p className="note">No marcaste series de trabajo: el ciclo avanza, pero no cuenta para la semana A/B.</p>
          )}
          <label className="field">
            <span>Nota de la sesión (opcional)</span>
            <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          <p className="muted">Las series sin marcar no se guardan.</p>
          <button className="btn primary" onClick={doFinish}>
            Terminar
          </button>
        </Sheet>
      )}
    </div>
  );
}
