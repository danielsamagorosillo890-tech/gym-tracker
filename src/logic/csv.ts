import type { BodyWeight, Day, Exercise, Measurement, Session, SetLog } from '../data/types';
import { epley1RM } from './records';

type Cell = string | number | null | undefined;

function cell(v: Cell): string {
  if (v === null || v === undefined) return '';
  const s = typeof v === 'number' ? String(Math.round(v * 100) / 100) : v;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** RFC 4180 CSV with comma separator and dot decimals (as Mexico writes numbers). */
export function toCsv(rows: Cell[][]): string {
  return rows.map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';
}

export function localDate(t: number): string {
  const d = new Date(t);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** One row per completed work set of finished sessions, oldest first. Weight always in kg. */
export function setsCsv(sessions: Session[], logs: SetLog[], exercises: Map<string, Exercise>, days: Day[]): string {
  const byId = new Map(sessions.filter((s) => s.status === 'finished').map((s) => [s.id, s]));
  const dayName = new Map(days.map((d) => [d.id, d.name]));
  const rows: Cell[][] = [
    ['fecha', 'dia', 'semana', 'descarga', 'ejercicio', 'grupo', 'serie', 'kg', 'reps', 'segundos', 'por_lado', '1rm_estimado'],
  ];
  const list = logs
    .filter((l) => l.kind === 'work' && l.completed && byId.has(l.sessionId))
    .sort((a, b) => byId.get(a.sessionId)!.startedAt - byId.get(b.sessionId)!.startedAt || a.at - b.at);
  for (const l of list) {
    const s = byId.get(l.sessionId)!;
    const ex = exercises.get(l.exerciseId);
    rows.push([
      localDate(s.startedAt),
      dayName.get(s.dayId) ?? s.dayId,
      s.variant,
      s.deload ? 'si' : 'no',
      ex?.name ?? l.exerciseId,
      ex?.group ?? '',
      l.index + 1,
      l.kg,
      l.reps,
      l.seconds,
      ex?.perSide ? 'si' : 'no',
      ex?.metric === 'time_weight' ? null : epley1RM(l.kg, l.reps),
    ]);
  }
  return toCsv(rows);
}

/** Body weight and measurements merged by date, oldest first. */
export function bodyCsv(weights: BodyWeight[], measurements: Measurement[]): string {
  const dates = [...new Set([...weights.map((w) => w.date), ...measurements.map((m) => m.date)])].sort();
  const w = new Map(weights.map((x) => [x.date, x]));
  const m = new Map(measurements.map((x) => [x.date, x]));
  const rows: Cell[][] = [['fecha', 'peso_kg', 'cintura_cm', 'pecho_cm', 'brazo_cm', 'muslo_cm']];
  for (const d of dates) {
    const mm = m.get(d);
    rows.push([d, w.get(d)?.kg, mm?.waist, mm?.chest, mm?.arm, mm?.thigh]);
  }
  return toCsv(rows);
}
