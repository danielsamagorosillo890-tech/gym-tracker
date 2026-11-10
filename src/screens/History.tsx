import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { deleteSession, deleteSetLog, updateSession, updateSetLog } from '../data/actions';
import { db } from '../data/db';
import type { Exercise, Session, SetLog, Slot } from '../data/types';
import { findPRs } from '../logic/records';
import { fmtNum, fromKg, toKg } from '../logic/units';
import { tonnage } from '../logic/volume';
import { IconClose } from '../ui/icons';
import { ConfirmInline } from '../ui/Sheet';
import { NumInput } from './SetRow';

const dayFmt = new Intl.DateTimeFormat('es-MX', { weekday: 'short', day: 'numeric', month: 'short' });
const longFmt = new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const monthFmt = new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric' });

function minutes(s: Session) {
  return s.endedAt ? Math.max(1, Math.round((s.endedAt - s.startedAt) / 60000)) : null;
}

export function History() {
  const sessions = useLiveQuery(() => db.sessions.orderBy('startedAt').reverse().toArray());
  const logs = useLiveQuery(() => db.setLogs.toArray());
  const days = useLiveQuery(() => db.days.toArray());
  const exList = useLiveQuery(() => db.exercises.toArray());
  const slots = useLiveQuery(() => db.slots.toArray());
  const [openId, setOpenId] = useState<number | null>(null);
  const exercises = useMemo(() => new Map((exList ?? []).map((e) => [e.id, e])), [exList]);

  // PR set ids across all history, per exercise.
  const prIds = useMemo(() => {
    const ids = new Set<number>();
    if (!logs) return ids;
    for (const ex of exercises.values()) {
      const mine = logs.filter((l) => l.exerciseId === ex.id);
      if (mine.length) for (const id of findPRs(mine, ex.metric).keys()) ids.add(id);
    }
    return ids;
  }, [logs, exercises]);

  if (!sessions || !logs || !days || !slots) return null;
  const dayName = (id: string) => days.find((d) => d.id === id)?.name ?? id;
  const open = sessions.find((s) => s.id === openId);
  if (open)
    return (
      <SessionDetail
        session={open}
        logs={logs.filter((l) => l.sessionId === open.id)}
        exercises={exercises}
        slots={slots}
        dayName={dayName(open.dayId)}
        prIds={prIds}
        onBack={() => setOpenId(null)}
      />
    );

  const list = sessions.filter((s) => s.status !== 'in_progress');
  let lastMonth = '';

  return (
    <div className="screen roomy">
      {list.length === 0 && (
        <section className="card empty">
          <p>Aquí aparecerá cada sesión que termines, con su duración, series y tonelaje.</p>
          <p className="muted">Toca una sesión para corregir series, notas o borrarla.</p>
        </section>
      )}
      <ul className="r-list">
        {list.map((s) => {
          const mine = logs.filter((l) => l.sessionId === s.id && l.completed && l.kind === 'work');
          const month = monthFmt.format(s.startedAt);
          const header = month !== lastMonth ? month : null;
          lastMonth = month;
          const prs = mine.filter((l) => prIds.has(l.id)).length;
          return (
            <li key={s.id} className="h-item">
              {header && <h3 className="section-title">{header}</h3>}
              <button className={`h-card${s.status === 'skipped' ? ' skipped' : ''}`} onClick={() => setOpenId(s.id)}>
                <span className="h-date">{dayFmt.format(s.startedAt)}</span>
                <span className="h-main">
                  <strong>
                    {dayName(s.dayId)}
                    {s.status === 'finished' && <span className="muted"> · Semana {s.variant}</span>}
                  </strong>
                  <span className="muted">
                    {s.status === 'skipped'
                      ? 'Saltado'
                      : `${minutes(s)} min · ${mine.length} series · ${fmtNum(Math.round(tonnage(mine)))} kg`}
                  </span>
                </span>
                {prs > 0 && <span className="pr-tag">{prs} PR</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function SessionDetail({
  session,
  logs,
  exercises,
  slots,
  dayName,
  prIds,
  onBack,
}: {
  session: Session;
  logs: SetLog[];
  exercises: Map<string, Exercise>;
  slots: Slot[];
  dayName: string;
  prIds: Set<number>;
  onBack: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const work = logs.filter((l) => l.kind === 'work' && l.completed);
  const slotOrder = new Map(slots.map((s) => [s.id, s.order]));
  const groups: { key: string; ex: Exercise | undefined; sets: SetLog[] }[] = [];
  for (const l of [...work].sort((a, b) => (slotOrder.get(a.slotId) ?? 99) - (slotOrder.get(b.slotId) ?? 99) || a.index - b.index)) {
    const key = `${l.slotId}:${l.exerciseId}`;
    const g = groups.find((x) => x.key === key);
    if (g) g.sets.push(l);
    else groups.push({ key, ex: exercises.get(l.exerciseId), sets: [l] });
  }

  return (
    <div className="screen roomy">
      <button className="back" onClick={onBack}>
        ‹ Historial
      </button>
      <div>
        <div className="step-kicker">{longFmt.format(session.startedAt)}</div>
        <h2 className="step-title">
          {dayName}
          {session.status === 'finished' ? ` · Semana ${session.variant}` : ''}
        </h2>
        {session.status === 'skipped' && <p className="step-sub">Día saltado: no cuenta para la semana A/B.</p>}
      </div>

      {session.status === 'finished' && (
        <div className="stats">
          <div>
            <strong>{minutes(session)}</strong>
            <span>min</span>
          </div>
          <div>
            <strong>{work.length}</strong>
            <span>series</span>
          </div>
          <div>
            <strong>{fmtNum(Math.round(tonnage(work)))}</strong>
            <span>kg tonelaje</span>
          </div>
        </div>
      )}

      {groups.map((g) => (
        <section key={g.key} className="card h-ex">
          <h3>{g.ex?.name ?? g.sets[0].exerciseId}</h3>
          {g.sets.map((l, i) => (
            <HistoryRow key={l.id} n={i + 1} log={l} ex={g.ex} isPR={prIds.has(l.id)} />
          ))}
        </section>
      ))}

      {session.status === 'finished' && groups.length === 0 && <p className="muted">Esta sesión no tiene series de trabajo.</p>}

      <label className="field">
        <span>Nota</span>
        <textarea rows={2} defaultValue={session.note} onChange={(e) => updateSession(session.id, { note: e.target.value })} />
      </label>

      {confirm ? (
        <ConfirmInline
          message="¿Borrar esta sesión y todas sus series? El ciclo y la semana A/B se recalculan. No se puede deshacer."
          confirmLabel="Borrar sesión"
          onConfirm={async () => {
            await deleteSession(session.id);
            onBack();
          }}
          onCancel={() => setConfirm(false)}
        />
      ) : (
        <button className="btn secondary" onClick={() => setConfirm(true)}>
          Borrar sesión
        </button>
      )}
    </div>
  );
}

function HistoryRow({ n, log, ex, isPR }: { n: number; log: SetLog; ex: Exercise | undefined; isPR: boolean }) {
  const unit = ex?.inputUnit ?? 'kg';
  const timed = ex?.metric === 'time_weight';
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="h-row">
      <span className="set-idx">{n}</span>
      <label className="h-field">
        <NumInput
          value={log.kg === null ? null : fromKg(log.kg, unit)}
          onCommit={(v) => v !== null && updateSetLog(log.id, { kg: toKg(v, unit) })}
          label={`${unit} serie ${n}`}
          decimal
        />
        <small>{unit}</small>
      </label>
      <label className="h-field">
        <NumInput
          value={timed ? log.seconds : log.reps}
          onCommit={(v) => v !== null && updateSetLog(log.id, timed ? { seconds: v } : { reps: v })}
          label={`${timed ? 'segundos' : 'reps'} serie ${n}`}
          decimal={false}
        />
        <small>{timed ? 's' : 'reps'}</small>
      </label>
      {isPR ? <span className="pr-tag">PR</span> : <span />}
      {confirm ? (
        <button className="btn danger small" onClick={() => deleteSetLog(log.id)}>
          Borrar
        </button>
      ) : (
        <button className="icon-btn" onClick={() => setConfirm(true)} aria-label={`Borrar serie ${n}`}>
          <IconClose size={18} />
        </button>
      )}
    </div>
  );
}

