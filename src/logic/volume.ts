import type { Exercise, MuscleGroup, SetLog } from '../data/types';

/** Monday 00:00 local time of the week containing `t`. */
export function weekStart(t: number): number {
  const d = new Date(t);
  const day = (d.getDay() + 6) % 7; // Monday = 0
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day);
  return d.getTime();
}

export interface WeekVolume {
  weekStart: number;
  counts: Partial<Record<MuscleGroup, number>>;
}

/**
 * 5.6 Work sets per muscle group per calendar week (Mon–Sun) for the last `weeks` weeks
 * ending at `now`. Per-side sets count once; warm-ups never count.
 */
export function weeklySetsByGroup(
  logs: SetLog[],
  exercises: Map<string, Exercise>,
  now: number,
  weeks = 8,
): WeekVolume[] {
  const current = weekStart(now);
  const starts: number[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const d = new Date(current);
    d.setDate(d.getDate() - 7 * i);
    starts.push(d.getTime());
  }
  const buckets = new Map(starts.map((s) => [s, {} as Partial<Record<MuscleGroup, number>>]));
  for (const l of logs) {
    if (l.kind !== 'work' || !l.completed) continue;
    const group = exercises.get(l.exerciseId)?.group;
    if (!group) continue;
    const b = buckets.get(weekStart(l.at));
    if (b) b[group] = (b[group] ?? 0) + 1;
  }
  return starts.map((s) => ({ weekStart: s, counts: buckets.get(s)! }));
}

/** Tonnage: sum of kg × reps as logged (not multiplied by dumbbells or sides). */
export function tonnage(logs: SetLog[]): number {
  return logs
    .filter((l) => l.kind === 'work' && l.completed && l.kg !== null && l.reps !== null)
    .reduce((sum, l) => sum + l.kg! * l.reps!, 0);
}
