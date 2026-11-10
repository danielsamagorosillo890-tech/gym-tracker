import type { Metric, SetLog } from '../data/types';

/** 5.5 Epley estimated 1RM, only for 1..12 reps. */
export function epley1RM(kg: number | null, reps: number | null): number | null {
  if (kg === null || reps === null || reps < 1 || reps > 12) return null;
  return kg * (1 + reps / 30);
}

export type PrReason = 'e1rm' | 'reps' | 'time';

function chronological(a: SetLog, b: SetLog): number {
  return a.at - b.at || a.sessionId - b.sessionId || a.index - b.index;
}

/**
 * 5.5 PRs for one exercise. `sets` are that exercise's logs (any order); only completed
 * work sets are considered. A set is a PR when, versus all earlier sets:
 *  (a) its estimated 1RM beats the best previous one, or
 *  (b) it has more reps than any previous set with the same kg or more, or
 *  (c) time_weight: it lasts longer than any previous set with the same kg or more.
 * (b) and (c) need at least one earlier set at that kg or heavier to compare against.
 * The very first record is never a PR, ties never count, warm-ups never count.
 * Returns a map setLogId → reasons.
 */
export function findPRs(sets: SetLog[], metric: Metric): Map<number, PrReason[]> {
  const ordered = sets.filter((s) => s.kind === 'work' && s.completed && s.kg !== null).sort(chronological);
  const result = new Map<number, PrReason[]>();
  const prior: SetLog[] = [];
  let best1RM: number | null = null;

  for (const s of ordered) {
    const reasons: PrReason[] = [];
    if (prior.length > 0) {
      const heavierOrEqual = prior.filter((p) => p.kg! >= s.kg!);
      if (metric === 'time_weight') {
        const bestTime = Math.max(...heavierOrEqual.map((p) => p.seconds ?? 0));
        if (heavierOrEqual.length > 0 && (s.seconds ?? 0) > bestTime) reasons.push('time');
      } else {
        const e = epley1RM(s.kg, s.reps);
        if (e !== null && best1RM !== null && e > best1RM + 1e-9) reasons.push('e1rm');
        const bestReps = Math.max(...heavierOrEqual.map((p) => p.reps ?? 0));
        if (heavierOrEqual.length > 0 && (s.reps ?? 0) > bestReps) reasons.push('reps');
      }
    }
    if (reasons.length) result.set(s.id, reasons);
    prior.push(s);
    const e = metric === 'time_weight' ? null : epley1RM(s.kg, s.reps);
    if (e !== null && (best1RM === null || e > best1RM)) best1RM = e;
  }
  return result;
}
