import type { Exercise, SetLog, Slot } from '../data/types';
import { fromKg, toKg } from './units';

export type Progression =
  | { kind: 'increase'; kg: number; reps: number | null }
  | { kind: 'more_reps'; kg: number }
  | { kind: 'hold'; kg: number }
  | null;

/**
 * 5.4 Double progression (suggestion only), evaluated per slot on the last session's
 * completed work sets. Requires at least the planned number of sets.
 * - All sets at repMax with the same kg or more → increase by the exercise step.
 * - All within [repMin, repMax] → keep kg, aim for more reps.
 * - Any below repMin → keep kg.
 * time_weight: all sets reached the target seconds → increase.
 */
export function suggestProgression(slot: Slot, exercise: Exercise, lastSets: SetLog[]): Progression {
  const sets = lastSets.filter((s) => s.kind === 'work' && s.completed && s.kg !== null);
  if (sets.length === 0 || sets.length < slot.sets) return null;
  const firstKg = sets[0].kg!;
  const maxKg = Math.max(...sets.map((s) => s.kg!));
  const sameOrMore = sets.every((s) => s.kg! >= firstKg);

  const increased = (): Progression => {
    // Not snapped to the step grid: real equipment (e.g. 24 kg dumbbells) may be off-grid.
    const current = fromKg(maxKg, exercise.inputUnit);
    const next = Math.round((current + exercise.step) * 100) / 100;
    return { kind: 'increase', kg: toKg(next, exercise.inputUnit), reps: slot.seconds ? null : slot.repMin };
  };

  if (exercise.metric === 'time_weight') {
    const target = slot.seconds;
    if (target && sameOrMore && sets.every((s) => (s.seconds ?? 0) >= target)) return increased();
    return { kind: 'hold', kg: maxKg };
  }

  if (slot.repMin === null || slot.repMax === null) return null;
  const reps = sets.map((s) => s.reps ?? 0);
  if (sameOrMore && reps.every((r) => r >= slot.repMax!)) return increased();
  if (reps.some((r) => r < slot.repMin!)) return { kind: 'hold', kg: maxKg };
  return { kind: 'more_reps', kg: maxKg };
}
