import type { Day, Session } from '../data/types';

/**
 * 5.1 Rotating cycle: the next day follows the last day closed (finished or skipped),
 * regardless of calendar weekday. With no history the cycle starts at the first day.
 */
export function nextDayId(days: Day[], sessions: Session[]): string {
  const ordered = [...days].sort((a, b) => a.order - b.order);
  if (ordered.length === 0) throw new Error('No days defined');
  const closed = sessions
    .filter((s) => s.status === 'finished' || s.status === 'skipped')
    .sort((a, b) => (a.endedAt ?? a.startedAt) - (b.endedAt ?? b.startedAt));
  const last = closed[closed.length - 1];
  if (!last) return ordered[0].id;
  const i = ordered.findIndex((d) => d.id === last.dayId);
  if (i === -1) return ordered[0].id;
  return ordered[(i + 1) % ordered.length].id;
}
