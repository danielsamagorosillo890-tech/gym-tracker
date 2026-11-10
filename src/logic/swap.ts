import type { Session, Slot } from '../data/types';

/** 5.7 The exercise actually done for a slot: today's override, else the slot default. */
export function resolveExerciseId(slot: Slot, session: Pick<Session, 'overrides'> | null): string {
  return session?.overrides?.[slot.id] ?? slot.exerciseId;
}

/** "Dejarlo fijo": new default, and the old exercise becomes an alternative. */
export function fixSwap(slot: Slot, newExerciseId: string): Slot {
  if (newExerciseId === slot.exerciseId) return slot;
  const alternatives = [
    slot.exerciseId,
    ...slot.alternatives.filter((a) => a !== newExerciseId && a !== slot.exerciseId),
  ];
  return { ...slot, exerciseId: newExerciseId, alternatives };
}
