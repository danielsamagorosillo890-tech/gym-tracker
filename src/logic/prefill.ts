import type { Session, SetLog, Slot } from '../data/types';

export interface RowValues {
  kg: number | null;
  reps: number | null;
  seconds: number | null;
}

export interface PrefillResult {
  /** 'slot' = same day & exercise done before; 'exercise' = only in another slot; 'none'. */
  source: 'slot' | 'exercise' | 'none';
  /** Completed work sets from the last finished session of this slot + exercise. */
  lastSets: SetLog[];
  /** Reference only (not prefilled): last sets of this exercise in another slot. */
  reference: { slotId: string; sets: SetLog[] } | null;
  rows: RowValues[];
}

function completedWork(logs: SetLog[]): SetLog[] {
  return logs.filter((l) => l.kind === 'work' && l.completed);
}

/** Completed work logs of the latest finished session matching `match`. */
function lastSessionSets(
  sessions: Session[],
  logs: SetLog[],
  match: (l: SetLog) => boolean,
  excludeSessionId?: number,
): SetLog[] {
  const finished = new Map(
    sessions.filter((s) => s.status === 'finished' && !s.deload && s.id !== excludeSessionId).map((s) => [s.id, s]),
  );
  let best: Session | null = null;
  for (const l of completedWork(logs)) {
    if (!match(l)) continue;
    const s = finished.get(l.sessionId);
    if (s && (!best || s.startedAt > best.startedAt)) best = s;
  }
  if (!best) return [];
  const id = best.id;
  return completedWork(logs)
    .filter((l) => l.sessionId === id && match(l))
    .sort((a, b) => a.index - b.index);
}

/**
 * 5.3 Prefill: each set starts with kg and reps of the same set in the last finished
 * session of the same slot (same day and same exercise). If only another slot has
 * history, it is shown as reference without prefilling kg. No history: kg empty,
 * reps at repMin (or the slot's target seconds).
 */
export function prefillForSlot(args: {
  slot: Slot;
  exerciseId: string;
  sessions: Session[];
  logs: SetLog[];
  currentSessionId?: number;
}): PrefillResult {
  const { slot, exerciseId, sessions, logs, currentSessionId } = args;
  const lastSets = lastSessionSets(
    sessions,
    logs,
    (l) => l.slotId === slot.id && l.exerciseId === exerciseId,
    currentSessionId,
  );
  const blank: RowValues = { kg: null, reps: slot.seconds ? null : slot.repMin, seconds: slot.seconds };

  if (lastSets.length > 0) {
    const rows = Array.from({ length: slot.sets }, (_, i) => {
      const src = lastSets[i] ?? lastSets[lastSets.length - 1];
      return { kg: src.kg, reps: src.reps, seconds: src.seconds };
    });
    return { source: 'slot', lastSets, reference: null, rows };
  }

  const refSets = lastSessionSets(
    sessions,
    logs,
    (l) => l.exerciseId === exerciseId && l.slotId !== slot.id,
    currentSessionId,
  );
  const rows = Array.from({ length: slot.sets }, () => ({ ...blank }));
  if (refSets.length > 0) {
    return { source: 'exercise', lastSets: [], reference: { slotId: refSets[0].slotId, sets: refSets }, rows };
  }
  return { source: 'none', lastSets: [], reference: null, rows };
}
