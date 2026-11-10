import type { BodyWeight } from '../data/types';

/** Local midday of a YYYY-MM-DD date (midday avoids DST edge cases). */
export function dateToTime(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d, 12).getTime();
}

export interface WeightTrend {
  latest: BodyWeight;
  /** Change vs. the entry closest to 4 weeks before the latest (null if none that old). */
  change4w: number | null;
}

export function weightTrend(weights: BodyWeight[]): WeightTrend | null {
  if (weights.length === 0) return null;
  const sorted = [...weights].sort((a, b) => a.date.localeCompare(b.date));
  const latest = sorted[sorted.length - 1];
  const target = dateToTime(latest.date) - 28 * 86_400_000;
  const older = sorted.filter((w) => dateToTime(w.date) <= target + 3 * 86_400_000);
  if (older.length === 0) return { latest, change4w: null };
  const ref = older.reduce((a, b) => (Math.abs(dateToTime(b.date) - target) < Math.abs(dateToTime(a.date) - target) ? b : a));
  return { latest, change4w: Math.round((latest.kg - ref.kg) * 10) / 10 };
}
