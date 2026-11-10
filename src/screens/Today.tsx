import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { deleteSession, finishSession, skipDay, startSession, updateSession } from '../data/actions';
import { backupReminderDue } from '../data/backup';
import { db } from '../data/db';
import type { Day, Exercise, Session, SetLog, Slot, Variant } from '../data/types';
import { nextDayId } from '../logic/cycle';
import { deloadActive, deloadSets } from '../logic/deload';
import { findPRs, withoutDeload, type PrReason } from '../logic/records';
import { resolveExerciseId } from '../logic/swap';
import { fmtNum, fromKg } from '../logic/units';
import { effectiveVariant, slotsForVariant, variantFor } from '../logic/variant';
import { tonnage } from '../logic/volume';
import { downloadBackup } from '../ui/backupActions';
import { IconCheck, IconMore } from '../ui/icons';
import { useRestTimer } from '../ui/RestTimer';
import { ConfirmInline, Sheet } from '../ui/Sheet';
import { useWakeLock } from '../ui/useWakeLock';
import { ExerciseCard } from './ExerciseCard';
import { StepBar } from './StepBar';
import { WarmupStep } from './WarmupStep';

interface Summary {
  title: string;
  minutes: number;
  sets: number;
  tonnage: number;
  prs: string[];
}

type Step = { kind: 'warmup' } | { kind: 'exercise'; slot: Slot } | { kind: 'finish' };

const REASON: Record<PrReason, string> = { e1rm: '1RM estimado', reps: 'más reps', time: 'más tiempo' };
const STEP_KEY = 'gym-step';

function buildSummary(
  session: Session,
  endedAt: number,
  logs: SetLog[],
  exercises: Map<string, Exercise>,
  days: Day[],
  sessions: Session[],
): Summary {
  const eligible = withoutDeload(logs, sessions);
  const mine = logs.filter((l) => l.sessionId === session.id && l.kind === 'work' && l.completed);
  const prs: string[] = [];
  for (const exId of new Set(mine.map((l) => l.exerciseId))) {
    const ex = exercises.get(exId);
    if (!ex) continue;
    if (session.deload) break;
    const map = findPRs(eligible.filter((l) => l.exerciseId === exId), ex.metric);
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

function loadStep(key: string): number | null {
  try {
    const raw = localStorage.getItem(STEP_KEY);
    const s = raw ? (JSON.parse(raw) as { key: string; index: number }) : null;
    return s && s.key === key ? s.index : null;
  } catch {
    return null;
  }
}

function saveStep(key: string, index: number) {
  try {
    localStorage.setItem(STEP_KEY, JSON.stringify({ key, index }));
  } catch {
    /* ignored */
  }
}

function Stats({ s }: { s: Summary }) {
  return (
    <>
      <div className="stats">
        <div>
          <strong>{s.minutes}</strong>
          <span>min</span>
        </div>
        <div>
          <strong>{s.sets}</strong>
          <span>series</span>
        </div>
        <div>
          <strong>{fmtNum(Math.round(s.tonnage))}</strong>
          <span>kg tonelaje</span>
        </div>
      </div>
      {s.prs.length > 0 && (
        <ul className="pr-list">
          {s.prs.map((p) => (
            <li key={p}>
              <span className="pr-tag">PR</span> {p}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export function Today({ onDefineVariant }: { onDefineVariant: (dayId: string, variant: Variant) => void }) {
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
  const [menu, setMenu] = useState(false);
  const [daysSheet, setDaysSheet] = useState(false);
  const [confirm, setConfirm] = useState<'skip' | 'discard' | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [undoSkip, setUndoSkip] = useState<{ id: number; name: string } | null>(null);
  const [note, setNote] = useState('');
  const [step, setStepState] = useState<number | null>(null);
  const stripRef = useRef<HTMLDivElement>(null);

  useWakeLock(!!current);
  const timer = useRestTimer();

  const exercises = useMemo(() => new Map((exList ?? []).map((e) => [e.id, e])), [exList]);
  const isDeload = current ? !!current.deload : !!settings && deloadActive(settings, Date.now());
  const planned = (slot: Slot) => (isDeload ? deloadSets(slot.sets) : slot.sets);

  const dayId = days && sessions ? (current?.dayId ?? draft?.dayId ?? nextDayId(days, sessions)) : null;
  const requested: Variant | null =
    dayId && sessions && logs ? (current?.variant ?? draft?.variant ?? variantFor(dayId, sessions, logs, current?.id)) : null;
  const stepKey = `${current?.id ?? 'draft'}:${dayId}:${requested}`;

  const ensureSession = useCallback(async () => {
    if (current) return current.id;
    if (!dayId || !requested) throw new Error('not ready');
    const id = await startSession(dayId, requested);
    setDraft(null);
    setUndoSkip(null);
    // Keep the user on the step they are on when the session is created.
    if (step !== null) saveStep(`${id}:${dayId}:${requested}`, step);
    return id;
  }, [current, dayId, requested, step]);

  // Derived plan for the day.
  const plan = useMemo(() => {
    if (!slots || !dayId || !requested) return null;
    const daySlots = slots.filter((s) => s.dayId === dayId);
    const eff = effectiveVariant(daySlots, requested);
    const visible = slotsForVariant(daySlots, eff.variant);
    const warm = visible.filter((s) => s.block === 'warmup');
    const work = visible.filter((s) => s.block === 'work');
    const steps: Step[] = [
      ...(warm.length ? [{ kind: 'warmup' } as Step] : []),
      ...work.map((slot) => ({ kind: 'exercise', slot }) as Step),
      { kind: 'finish' },
    ];
    return { eff, warm, work, steps };
  }, [slots, dayId, requested]);

  const doneBySlot = useMemo(() => {
    const m = new Map<string, number>();
    if (!current || !logs || !plan) return m;
    for (const slot of plan.work) {
      const exId = resolveExerciseId(slot, current);
      m.set(slot.id, logs.filter((l) => l.sessionId === current.id && l.slotId === slot.id && l.exerciseId === exId && l.completed).length);
    }
    return m;
  }, [current, logs, plan]);

  const warmDone = plan ? plan.warm.filter((s) => checks?.some((c) => c.slotId === s.id && c.done)).length : 0;

  // Pick the step to show: saved one for this session, else the first unfinished step.
  useEffect(() => {
    if (!plan || checks === undefined) return;
    const saved = loadStep(stepKey);
    if (saved !== null && saved < plan.steps.length) {
      setStepState(saved);
      return;
    }
    let i = plan.steps.findIndex((s) =>
      s.kind === 'warmup' ? warmDone < plan.warm.length : s.kind === 'exercise' ? (doneBySlot.get(s.slot.id) ?? 0) < planned(s.slot) : true,
    );
    if (i < 0) i = 0;
    setStepState(i);
    // Only when the plan identity changes, not on every logged set.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepKey, plan?.steps.length, checks === undefined]);

  const goTo = useCallback(
    (i: number) => {
      setStepState(i);
      saveStep(stepKey, i);
      window.scrollTo(0, 0);
    },
    [stepKey],
  );

  // Keep the active chip visible in the strip.
  useEffect(() => {
    const el = stripRef.current?.querySelector('.on');
    el?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }, [step]);

  if (!days || !slots || !sessions || !logs || !settings || !dayId || !requested || !plan || step === null) return null;

  const day = days.find((d) => d.id === dayId)!;
  const { eff, steps, work } = plan;
  const idx = Math.min(step, steps.length - 1);
  const active = steps[idx];
  const hasCompleted = !!current && logs.some((l) => l.sessionId === current.id && l.completed);
  const reminder = backupReminderDue(settings, Date.now());
  const exName = (slot: Slot) => exercises.get(resolveExerciseId(slot, current))?.name ?? '';

  const setVariant = async (v: Variant) => {
    if (current) await updateSession(current.id, { variant: v });
    else setDraft({ dayId, variant: v });
  };

  const chooseDay = async (id: string) => {
    setDaysSheet(false);
    setMenu(false);
    const v = variantFor(id, sessions, logs, current?.id);
    if (current) await updateSession(current.id, { dayId: id, variant: v });
    else setDraft({ dayId: id, variant: v });
  };

  const doSkip = async () => {
    setConfirm(null);
    setMenu(false);
    const id = await skipDay(dayId, requested);
    setDraft(null);
    setUndoSkip({ id, name: day.name });
  };

  const doFinish = async () => {
    if (!current) return;
    const endedAt = Date.now();
    await finishSession(current.id, note);
    const fresh = await db.setLogs.toArray();
    setSummary(buildSummary(current, endedAt, fresh, exercises, days, sessions));
    setNote('');
    timer.skip();
    window.scrollTo(0, 0);
  };

  const stepLabel = (s: Step) => (s.kind === 'warmup' ? 'Calentamiento' : s.kind === 'finish' ? 'Terminar' : exName(s.slot));
  const stepDone = (s: Step) =>
    s.kind === 'warmup'
      ? plan.warm.length > 0 && warmDone === plan.warm.length
      : s.kind === 'exercise'
        ? (doneBySlot.get(s.slot.id) ?? 0) >= planned(s.slot)
        : false;
  const stepStarted = (s: Step) =>
    s.kind === 'warmup' ? warmDone > 0 : s.kind === 'exercise' ? (doneBySlot.get(s.slot.id) ?? 0) > 0 : false;

  if (summary) {
    return (
      <div className="screen">
        <section className="step done-step">
          <div className="done-badge">
            <IconCheck size={36} />
          </div>
          <h2 className="step-title center">Sesión terminada</h2>
          <p className="step-sub center">{summary.title}</p>
          <Stats s={summary} />
          <button className="btn primary next-cta" onClick={() => setSummary(null)}>
            Listo
          </button>
        </section>
      </div>
    );
  }

  const exerciseIndex = active.kind === 'exercise' ? work.indexOf(active.slot) : -1;
  const preview = current ? buildSummary(current, Date.now(), logs, exercises, days, sessions) : null;

  return (
    <div className="screen today">
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
        <div className="day-head-text">
          <h2 className="day-title">{day.name}</h2>
          <p className="muted">
            Semana {requested} · {current ? 'en curso' : draft ? 'elegido a mano' : 'sigue en tu ciclo'}
          </p>
        </div>
        <div className="segmented" role="group" aria-label="Semana">
          {(['A', 'B'] as const).map((v) => (
            <button key={v} className={requested === v ? 'on' : ''} aria-pressed={requested === v} onClick={() => setVariant(v)}>
              {v}
            </button>
          ))}
        </div>
        <button className="icon-btn" onClick={() => setMenu(true)} aria-label="Opciones del día">
          <IconMore />
        </button>
      </section>

      {eff.fellBack && (
        <div className="banner">
          <span>
            {day.name} {requested} aún no tiene ejercicios; hoy se usa la A.
          </span>
          <button className="btn secondary small" onClick={() => onDefineVariant(day.id, requested)}>
            Definir {requested}
          </button>
        </div>
      )}

      {isDeload && (
        <p className="note">Semana de descarga: la mitad de series y alrededor de 60% del peso. No cuenta para progresión ni PRs.</p>
      )}

      <div className="strip" ref={stripRef} role="tablist" aria-label="Pasos">
        {steps.map((s, i) => (
          <button
            key={s.kind === 'exercise' ? s.slot.id : s.kind}
            role="tab"
            aria-selected={i === idx}
            className={`strip-chip${i === idx ? ' on' : ''}${stepDone(s) ? ' done' : stepStarted(s) ? ' started' : ''}`}
            onClick={() => goTo(i)}
          >
            {stepDone(s) && <IconCheck size={14} />}
            <span>{stepLabel(s)}</span>
          </button>
        ))}
      </div>

      {active.kind === 'warmup' && (
        <WarmupStep
          slots={plan.warm}
          exercises={exercises}
          session={current}
          checks={checks ?? []}
          ensureSession={ensureSession}
          onNext={() => goTo(idx + 1)}
          nextName={work[0] ? exName(work[0]) : ''}
        />
      )}

      {active.kind === 'exercise' && (
        <ExerciseCard
          key={active.slot.id}
          slot={active.slot}
          exercises={exercises}
          days={days}
          slots={slots}
          session={current}
          sessions={sessions}
          logs={logs}
          settings={settings}
          ensureSession={ensureSession}
          nextLabel={work[exerciseIndex + 1] ? exName(work[exerciseIndex + 1]) : ''}
          position={`${exerciseIndex + 1} de ${work.length}`}
          onNext={() => goTo(idx + 1)}
        />
      )}

      {active.kind === 'finish' && (
        <section className="step">
          <div className="step-kicker">Final</div>
          <h2 className="step-title">Terminar sesión</h2>
          {!current || !preview ? (
            <p className="step-sub">Todavía no registras nada hoy. Marca al menos un calentamiento o una serie para empezar.</p>
          ) : (
            <>
              <p className="step-sub">
                {work.filter((s) => (doneBySlot.get(s.id) ?? 0) >= planned(s)).length} de {work.length} ejercicios completos.
              </p>
              <Stats s={preview} />
              {preview.sets === 0 && (
                <p className="note">No marcaste series de trabajo: el ciclo avanza, pero no cuenta para la semana A/B.</p>
              )}
              <label className="field">
                <span>Nota de la sesión (opcional)</span>
                <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
              </label>
              <p className="muted">Las series sin marcar no se guardan.</p>
              <button className="btn primary next-cta" onClick={doFinish}>
                Terminar sesión
              </button>
            </>
          )}
        </section>
      )}

      <StepBar
        index={idx}
        total={steps.length}
        label={stepLabel(active)}
        onPrev={() => goTo(Math.max(0, idx - 1))}
        onNext={() => goTo(Math.min(steps.length - 1, idx + 1))}
      />

      {menu && (
        <Sheet
          title={`${day.name} · Semana ${requested}`}
          onClose={() => {
            setMenu(false);
            setConfirm(null);
          }}
        >
          <div className="menu-list">
            {!hasCompleted && (
              <button className="btn secondary" onClick={() => setDaysSheet(true)}>
                Hacer otro día
              </button>
            )}
            {!current && (
              <button className="btn secondary" onClick={() => setConfirm('skip')}>
                Saltar {day.name}
              </button>
            )}
            {current && (
              <button
                className="btn secondary"
                onClick={() => {
                  setMenu(false);
                  goTo(steps.length - 1);
                }}
              >
                Ir a terminar sesión
              </button>
            )}
            {current && !hasCompleted && (
              <button className="btn secondary" onClick={() => setConfirm('discard')}>
                Descartar sesión
              </button>
            )}
          </div>
          {hasCompleted && <p className="muted">Ya marcaste series en esta sesión: para cambiar de día, primero termínala.</p>}
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
                setMenu(false);
              }}
              onCancel={() => setConfirm(null)}
            />
          )}
        </Sheet>
      )}

      {daysSheet && (
        <Sheet title="Hacer otro día" onClose={() => setDaysSheet(false)}>
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
    </div>
  );
}
