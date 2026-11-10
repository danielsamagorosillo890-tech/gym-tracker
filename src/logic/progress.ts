import type { Metric, Session, SetLog } from '../data/types';
import { epley1RM, findPRs, type PrReason } from './records';

export interface SessionPoint {
  sessionId: number;
  t: number;
  dayId: string;
  /** Best set of the session: heaviest kg, then most reps / longest time. */
  best: SetLog;
  /** Best estimated 1RM in the session (only sets ≤ 12 reps). */
  e1rm: number | null;
}

export type Range = '4w' | '12w' | 'all';

const WEEK = 7 * 24 * 60 * 60 * 1000;

export function rangeStart(range: Range, now: number): number {
  return range === '4w' ? now - 4 * WEEK : range === '12w' ? now - 12 * WEEK : -Infinity;
}

function better(a: SetLog, b: SetLog, metric: Metric): boolean {
  if ((a.kg ?? 0) !== (b.kg ?? 0)) return (a.kg ?? 0) > (b.kg ?? 0);
  return metric === 'time_weight' ? (a.seconds ?? 0) > (b.seconds ?? 0) : (a.reps ?? 0) > (b.reps ?? 0);
}

/** Completed work sets of one exercise in finished sessions, optionally limited to one day. */
export function exerciseSets(logs: SetLog[], sessions: Session[], exerciseId: string, dayId?: string): SetLog[] {
  const ok = new Map(sessions.filter((s) => s.status === 'finished' && !s.deload).map((s) => [s.id, s]));
  return logs.filter(
    (l) =>
      l.exerciseId === exerciseId &&
      l.kind === 'work' &&
      l.completed &&
      ok.has(l.sessionId) &&
      (!dayId || ok.get(l.sessionId)!.dayId === dayId),
  );
}

/** One point per finished session: its best set and best e1RM, oldest first. */
export function sessionPoints(sets: SetLog[], sessions: Session[], metric: Metric): SessionPoint[] {
  const byId = new Map(sessions.map((s) => [s.id, s]));
  const groups = new Map<number, SetLog[]>();
  for (const s of sets) groups.set(s.sessionId, [...(groups.get(s.sessionId) ?? []), s]);
  const points: SessionPoint[] = [];
  for (const [sessionId, list] of groups) {
    const session = byId.get(sessionId);
    if (!session) continue;
    const best = list.reduce((a, b) => (better(b, a, metric) ? b : a));
    const e = metric === 'time_weight' ? [] : list.map((s) => epley1RM(s.kg, s.reps)).filter((x): x is number => x !== null);
    points.push({ sessionId, t: session.startedAt, dayId: session.dayId, best, e1rm: e.length ? Math.max(...e) : null });
  }
  return points.sort((a, b) => a.t - b.t);
}

/** "Mejor marca": best e1RM set when available, else heaviest set. */
export function bestMark(sets: SetLog[], metric: Metric): { set: SetLog; e1rm: number | null } | null {
  if (sets.length === 0) return null;
  if (metric !== 'time_weight') {
    let top: { set: SetLog; e1rm: number } | null = null;
    for (const s of sets) {
      const e = epley1RM(s.kg, s.reps);
      if (e !== null && (!top || e > top.e1rm)) top = { set: s, e1rm: e };
    }
    if (top) return top;
  }
  return { set: sets.reduce((a, b) => (better(b, a, metric) ? b : a)), e1rm: null };
}

export interface PrEntry {
  set: SetLog;
  reasons: PrReason[];
  t: number;
}

/** PRs computed over the full history of the exercise (never over a filtered subset). */
export function prList(allSets: SetLog[], sessions: Session[], metric: Metric): PrEntry[] {
  const byId = new Map(sessions.map((s) => [s.id, s]));
  const map = findPRs(allSets, metric);
  return allSets
    .filter((s) => map.has(s.id))
    .map((s) => ({ set: s, reasons: map.get(s.id)!, t: byId.get(s.sessionId)?.startedAt ?? s.at }))
    .sort((a, b) => b.t - a.t);
}
