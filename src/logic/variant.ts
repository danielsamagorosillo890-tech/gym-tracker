import type { Session, SetLog, Slot, Variant } from '../data/types';

/** A session counts for A/B parity only if finished with at least one completed work set. */
export function countsForParity(session: Session, logs: SetLog[]): boolean {
  return (
    session.status === 'finished' &&
    logs.some((l) => l.sessionId === session.id && l.kind === 'work' && l.completed)
  );
}

/**
 * 5.2 Variant by parity of finished sessions of that day: 0, 2, 4… → A; 1, 3, 5… → B.
 * `excludeSessionId` lets the in-progress session not count itself.
 */
export function variantFor(
  dayId: string,
  sessions: Session[],
  logs: SetLog[],
  excludeSessionId?: number,
): Variant {
  const n = sessions.filter(
    (s) => s.dayId === dayId && s.id !== excludeSessionId && countsForParity(s, logs),
  ).length;
  return n % 2 === 0 ? 'A' : 'B';
}

export interface EffectiveVariant {
  variant: Variant;
  /** True when the requested variant had no own exercises and A was used instead. */
  fellBack: boolean;
}

/** If a variant has no work slots of its own (e.g. Lower B), use A. */
export function effectiveVariant(daySlots: Slot[], requested: Variant): EffectiveVariant {
  const work = daySlots.filter((s) => s.block === 'work');
  const has = (v: Variant) => work.some((s) => s.week === v);
  if (requested === 'B' && !has('B') && has('A')) return { variant: 'A', fellBack: true };
  return { variant: requested, fellBack: false };
}

/** Slots visible for a variant, sorted for display. */
export function slotsForVariant(daySlots: Slot[], variant: Variant): Slot[] {
  return daySlots
    .filter((s) => s.week === 'both' || s.week === variant)
    .sort((a, b) => (a.block === b.block ? a.order - b.order : a.block === 'warmup' ? -1 : 1));
}
