// Small builders for unit tests.
import { SEED_DAYS } from '../data/seed';
import type { Exercise, Session, SetLog, Slot } from '../data/types';

let nextLogId = 1;

export const days = SEED_DAYS;

export function session(id: number, dayId: string, status: Session['status'], t: number, variant: 'A' | 'B' = 'A'): Session {
  return {
    id,
    dayId,
    variant,
    startedAt: t,
    endedAt: status === 'in_progress' ? null : t + 3600_000,
    status,
    note: '',
    overrides: {},
  };
}

export function log(
  sessionId: number,
  slotId: string,
  exerciseId: string,
  index: number,
  kg: number | null,
  reps: number | null,
  opts: Partial<SetLog> = {},
): SetLog {
  return {
    id: nextLogId++,
    sessionId,
    slotId,
    exerciseId,
    index,
    kind: 'work',
    kg,
    reps,
    seconds: null,
    completed: true,
    at: sessionId * 1_000_000 + index,
    ...opts,
  };
}

export function slot(over: Partial<Slot> = {}): Slot {
  return {
    id: 'push-x1',
    dayId: 'push',
    block: 'work',
    section: 'PECHO',
    order: 0,
    exerciseId: 'bench-press',
    sets: 3,
    repMin: 8,
    repMax: 10,
    seconds: null,
    week: 'both',
    alternatives: [],
    note: '',
    ...over,
  };
}

export function exercise(over: Partial<Exercise> = {}): Exercise {
  return {
    id: 'bench-press',
    name: 'Bench press',
    group: 'Pecho',
    type: 'compound',
    metric: 'weight_reps',
    perSide: false,
    weightBasis: 'total',
    inputUnit: 'kg',
    step: 2.5,
    restSec: null,
    notes: '',
    machineSettings: '',
    ...over,
  };
}
