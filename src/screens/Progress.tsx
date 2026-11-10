import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { db } from '../data/db';
import { MUSCLE_GROUPS, type Day, type Exercise, type MuscleGroup, type Session, type SetLog } from '../data/types';
import { bestMark, exerciseSets, prList, rangeStart, sessionPoints, type Range } from '../logic/progress';
import type { PrReason } from '../logic/records';
import { fmtNum, fromKg } from '../logic/units';
import { weeklySetsByGroup } from '../logic/volume';
import { ChipGroup } from '../ui/controls';
import { LineChart } from '../ui/LineChart';

const dateFmt = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
const shortFmt = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' });
const REASON: Record<PrReason, string> = { e1rm: '1RM estimado', reps: 'más reps', time: 'más tiempo' };

export function Progress() {
  const sessions = useLiveQuery(() => db.sessions.toArray());
  const logs = useLiveQuery(() => db.setLogs.toArray());
  const exList = useLiveQuery(() => db.exercises.toArray());
  const days = useLiveQuery(() => db.days.orderBy('order').toArray());
  const [mode, setMode] = useState<'exercises' | 'volume'>('exercises');
  const [selected, setSelected] = useState<string | null>(null);
  const exercises = useMemo(() => new Map((exList ?? []).map((e) => [e.id, e])), [exList]);
  if (!sessions || !logs || !exList || !days) return null;

  const ex = selected ? exercises.get(selected) : undefined;
  if (ex) return <ExerciseProgress ex={ex} sessions={sessions} logs={logs} days={days} onBack={() => setSelected(null)} />;

  return (
    <div className="screen roomy">
      <div className="segmented full" role="group" aria-label="Vista">
        <button className={mode === 'exercises' ? 'on' : ''} aria-pressed={mode === 'exercises'} onClick={() => setMode('exercises')}>
          Ejercicios
        </button>
        <button className={mode === 'volume' ? 'on' : ''} aria-pressed={mode === 'volume'} onClick={() => setMode('volume')}>
          Volumen
        </button>
      </div>
      {mode === 'exercises' ? (
        <ExerciseList exercises={exercises} sessions={sessions} logs={logs} onPick={setSelected} />
      ) : (
        <VolumePanel exercises={exercises} logs={logs} sessions={sessions} />
      )}
    </div>
  );
}

function ExerciseList({
  exercises,
  sessions,
  logs,
  onPick,
}: {
  exercises: Map<string, Exercise>;
  sessions: Session[];
  logs: SetLog[];
  onPick: (id: string) => void;
}) {
  const [query, setQuery] = useState('');
  const finished = new Map(sessions.filter((s) => s.status === 'finished').map((s) => [s.id, s]));
  const stats = new Map<string, { n: number; last: number }>();
  const seen = new Set<string>();
  for (const l of logs) {
    const s = finished.get(l.sessionId);
    if (!s || !l.completed || l.kind !== 'work') continue;
    const key = `${l.exerciseId}:${l.sessionId}`;
    const st = stats.get(l.exerciseId) ?? { n: 0, last: 0 };
    if (!seen.has(key)) {
      seen.add(key);
      st.n++;
    }
    st.last = Math.max(st.last, s.startedAt);
    stats.set(l.exerciseId, st);
  }
  const q = query.trim().toLowerCase();
  const list = [...exercises.values()].filter((e) => e.group !== null && (!q || e.name.toLowerCase().includes(q)));
  const groups = MUSCLE_GROUPS.map((g) => ({
    g,
    items: list.filter((e) => e.group === g).sort((a, b) => (stats.get(b.id)?.last ?? 0) - (stats.get(a.id)?.last ?? 0) || a.name.localeCompare(b.name)),
  })).filter((x) => x.items.length);

  return (
    <>
      <input className="search" placeholder="Buscar ejercicio" value={query} onChange={(e) => setQuery(e.target.value)} />
      {stats.size === 0 && !q && (
        <section className="card empty">
          <p>Aquí verás tu progreso por ejercicio en cuanto termines tu primera sesión.</p>
          <p className="muted">Para ver cómo se ve con meses de datos, prueba el modo demo en Ajustes.</p>
        </section>
      )}
      {groups.map(({ g, items }) => (
        <section key={g} className="r-block">
          <h3 className="section-title">{g}</h3>
          <ul className="r-list">
            {items.map((e) => {
              const st = stats.get(e.id);
              return (
                <li key={e.id} className="r-row">
                  <button className="r-main" onClick={() => onPick(e.id)}>
                    <strong>{e.name}</strong>
                    <span className="muted">
                      {st ? `${st.n} ${st.n === 1 ? 'sesión' : 'sesiones'} · última ${shortFmt.format(st.last)}` : 'Sin registros todavía'}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </>
  );
}

function setText(s: SetLog, ex: Exercise): string {
  const w = `${fmtNum(fromKg(s.kg ?? 0, ex.inputUnit))} ${ex.inputUnit}`;
  if (ex.metric === 'time_weight') return `${w} × ${s.seconds ?? 0} s`;
  return `${w} × ${s.reps ?? 0}`;
}

function ExerciseProgress({
  ex,
  sessions,
  logs,
  days,
  onBack,
}: {
  ex: Exercise;
  sessions: Session[];
  logs: SetLog[];
  days: Day[];
  onBack: () => void;
}) {
  const [range, setRange] = useState<Range>('12w');
  const all = exerciseSets(logs, sessions, ex.id);
  const sessionDay = new Map(sessions.map((s) => [s.id, s.dayId]));
  const dayIds = [...new Set(all.map((l) => sessionDay.get(l.sessionId)!))];
  // Same exercise on several days usually means different rep ranges (Bench 8-10 vs 15-20):
  // start on the day of the latest session so the chart compares like with like.
  const [dayFilter, setDayFilter] = useState<string | null>(() => {
    if (dayIds.length < 2) return null;
    const latest = all.reduce((a, b) => (b.at > a.at ? b : a));
    return sessionDay.get(latest.sessionId) ?? null;
  });
  const [table, setTable] = useState(false);
  const filtered = dayFilter ? all.filter((l) => sessionDay.get(l.sessionId) === dayFilter) : all;
  const from = rangeStart(range, Date.now());
  const points = sessionPoints(filtered, sessions, ex.metric).filter((p) => p.t >= from);
  const best = bestMark(filtered, ex.metric);
  const lastPoint = sessionPoints(filtered, sessions, ex.metric).at(-1);
  const prs = prList(all, sessions, ex.metric).filter((p) => !dayFilter || sessionDay.get(p.set.sessionId) === dayFilter);
  const unit = ex.inputUnit;
  const conv = (kg: number) => fromKg(kg, unit);
  const dayName = (id: string) => days.find((d) => d.id === id)?.name ?? id;
  const showE1rm = ex.metric !== 'time_weight' && points.some((p) => p.e1rm !== null);

  return (
    <div className="screen roomy">
      <button className="back" onClick={onBack}>
        ‹ Progreso
      </button>
      <div>
        <div className="step-kicker">{ex.group}</div>
        <h2 className="step-title">{ex.name}</h2>
      </div>

      {dayIds.length > 1 && (
        <ChipGroup<string | null>
          label="Día"
          value={dayFilter}
          onChange={setDayFilter}
          options={[{ value: null, label: 'Todos' }, ...dayIds.map((d) => ({ value: d as string | null, label: dayName(d) }))]}
        />
      )}

      {all.length === 0 ? (
        <section className="card empty">
          <p>Todavía no hay series de este ejercicio.</p>
          <p className="muted">Después de tu primera sesión verás aquí tu mejor marca; con dos o más, la gráfica.</p>
        </section>
      ) : (
        <>
          <div className="stat-cards">
            <div className="stat-card">
              <span>Mejor marca</span>
              <strong>{best ? setText(best.set, ex) : '—'}</strong>
              {best?.e1rm != null && (
                <small>
                  1RM est. {fmtNum(Math.round(conv(best.e1rm) * 10) / 10)} {unit}
                </small>
              )}
            </div>
            <div className="stat-card">
              <span>Último</span>
              <strong>{lastPoint ? setText(lastPoint.best, ex) : '—'}</strong>
              {lastPoint && <small>{shortFmt.format(lastPoint.t)}</small>}
            </div>
          </div>

          <ChipGroup<Range>
            label="Rango"
            value={range}
            onChange={setRange}
            options={[
              { value: '4w', label: '4 semanas' },
              { value: '12w', label: '12 semanas' },
              { value: 'all', label: 'Todo' },
            ]}
          />

          {points.length >= 2 ? (
            <section className="card chart-card">
              <h3>{ex.metric === 'time_weight' ? 'Peso de la mejor serie' : 'Mejor serie por sesión'}</h3>
              <LineChart
                unit={unit}
                series={[
                  { id: 'best', label: 'Mejor serie', colorVar: '--series-1', points: points.map((p) => ({ x: p.t, y: conv(p.best.kg ?? 0) })) },
                  ...(showE1rm
                    ? [
                        {
                          id: 'e1rm',
                          label: '1RM estimado',
                          colorVar: '--series-2',
                          dashed: true,
                          points: points.map((p) => ({ x: p.t, y: p.e1rm === null ? null : Math.round(conv(p.e1rm) * 10) / 10 })),
                        },
                      ]
                    : []),
                ]}
              />
              <button className="btn secondary small" onClick={() => setTable(!table)}>
                {table ? 'Ocultar tabla' : 'Ver tabla'}
              </button>
              {table && (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Mejor serie</th>
                      {showE1rm && <th>1RM est.</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {[...points].reverse().map((p) => (
                      <tr key={p.sessionId}>
                        <td>{shortFmt.format(p.t)}</td>
                        <td>{setText(p.best, ex)}</td>
                        {showE1rm && <td>{p.e1rm === null ? '—' : fmtNum(Math.round(conv(p.e1rm) * 10) / 10)}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          ) : (
            <section className="card empty">
              <p>{points.length === 1 ? 'Una sesión en este rango.' : 'Sin sesiones en este rango.'}</p>
              <p className="muted">La gráfica aparece con dos sesiones o más. Prueba el rango "Todo".</p>
            </section>
          )}

          <section className="r-block">
            <h3 className="section-title">Récords personales</h3>
            {prs.length === 0 ? (
              <p className="muted">Aún no hay PRs: el primer registro es tu base y los siguientes que la superen aparecerán aquí.</p>
            ) : (
              <ul className="r-list">
                {prs.slice(0, 15).map((p) => (
                  <li key={p.set.id} className="r-row pr-row">
                    <span className="pr-tag">PR</span>
                    <span className="r-main static">
                      <strong>{setText(p.set, ex)}</strong>
                      <span className="muted">
                        {dateFmt.format(p.t)} · {p.reasons.map((r) => REASON[r]).join(', ')}
                        {dayIds.length > 1 ? ` · ${dayName(sessionDay.get(p.set.sessionId)!)}` : ''}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function VolumePanel({ exercises, logs, sessions }: { exercises: Map<string, Exercise>; logs: SetLog[]; sessions: Session[] }) {
  const [sel, setSel] = useState<{ g: MuscleGroup; i: number } | null>(null);
  const finished = new Set(sessions.filter((s) => s.status === 'finished' || s.status === 'in_progress').map((s) => s.id));
  const weeks = weeklySetsByGroup(
    logs.filter((l) => finished.has(l.sessionId)),
    exercises,
    Date.now(),
    8,
  );
  const max = Math.max(1, ...weeks.flatMap((w) => Object.values(w.counts) as number[]));
  const any = weeks.some((w) => Object.keys(w.counts).length > 0);

  return (
    <>
      <p className="muted">Series de trabajo por grupo muscular, por semana (lunes a domingo). Las series por lado cuentan 1; los calentamientos no cuentan.</p>
      {!any ? (
        <section className="card empty">
          <p>Sin series en las últimas 8 semanas.</p>
          <p className="muted">Cuando termines sesiones verás aquí cuántas series le das a cada grupo por semana.</p>
        </section>
      ) : (
        <section className="card volume">
          <div className="vol-head">
            <span />
            <span className="muted small">últimas 8 semanas</span>
            <span className="muted small">esta</span>
          </div>
          {MUSCLE_GROUPS.map((g) => {
            const vals = weeks.map((w) => w.counts[g] ?? 0);
            return (
              <div key={g} className="vol-row">
                <span className="vol-name">{g}</span>
                <svg className="vol-bars" viewBox="0 0 160 36" preserveAspectRatio="none" role="img" aria-label={`${g}: ${vals.join(', ')} series por semana`}>
                  {vals.map((v, i) => {
                    const bh = v === 0 ? 0 : Math.max(3, (v / max) * 34);
                    const on = sel?.g === g && sel.i === i;
                    return (
                      <g key={i} onClick={() => setSel(on ? null : { g, i })} style={{ cursor: 'pointer' }}>
                        <rect x={i * 20} y={0} width={20} height={36} fill="transparent" />
                        {v === 0 ? (
                          <rect x={i * 20 + 3} y={34} width={14} height={2} className="vol-zero" />
                        ) : (
                          <rect x={i * 20 + 3} y={36 - bh} width={14} height={bh} rx={2} className={`vol-bar${i === 7 ? ' current' : ''}${on ? ' on' : ''}`} />
                        )}
                      </g>
                    );
                  })}
                </svg>
                <strong className="vol-now">{vals[7]}</strong>
              </div>
            );
          })}
          <p className="vol-detail muted" aria-live="polite">
            {sel
              ? `${sel.g} · semana del ${shortFmt.format(weeks[sel.i].weekStart)}: ${weeks[sel.i].counts[sel.g] ?? 0} series`
              : 'Toca una barra para ver la semana.'}
          </p>
        </section>
      )}
    </>
  );
}
