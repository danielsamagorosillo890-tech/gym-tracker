import type { Unit } from '../data/types';

export const LB_TO_KG = 0.45359237;

export function toKg(value: number, unit: Unit): number {
  return unit === 'kg' ? value : value * LB_TO_KG;
}

/** Converts stored kg to the display unit, rounded to 0.01 to hide float noise. */
export function fromKg(kg: number, unit: Unit): number {
  const v = unit === 'kg' ? kg : kg / LB_TO_KG;
  return Math.round(v * 100) / 100;
}

/** Formats a number without trailing zeros, using a dot as in the rest of the UI. */
export function fmtNum(n: number): string {
  return String(Math.round(n * 100) / 100);
}

/** Rounds to the nearest multiple of step (in the same unit). */
export function roundToStep(value: number, step: number): number {
  if (step <= 0) return value;
  return Math.round(Math.round(value / step) * step * 100) / 100;
}
