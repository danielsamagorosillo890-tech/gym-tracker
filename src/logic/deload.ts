import type { Exercise, Settings } from '../data/types';
import type { RowValues } from './prefill';
import { fromKg, roundToStep, toKg } from './units';

/** Deload: about 60% of the usual weight and half the sets (rounded up). */
export const DELOAD_WEIGHT = 0.6;
export const DELOAD_DAYS = 7;

export function deloadActive(settings: Pick<Settings, 'deloadUntil'>, now: number): boolean {
  return !!settings.deloadUntil && settings.deloadUntil > now;
}

export function deloadSets(sets: number): number {
  return Math.max(1, Math.ceil(sets / 2));
}

/** Lighter prefill rows: fewer sets and ~60% weight, snapped to the exercise step. */
export function deloadRows(rows: RowValues[], ex: Pick<Exercise, 'inputUnit' | 'step'>, sets: number): RowValues[] {
  return rows.slice(0, deloadSets(sets)).map((r) => {
    if (r.kg === null) return r;
    const light = roundToStep(fromKg(r.kg, ex.inputUnit) * DELOAD_WEIGHT, ex.step);
    return { ...r, kg: toKg(light, ex.inputUnit) };
  });
}
