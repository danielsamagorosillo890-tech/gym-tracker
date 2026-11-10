import type { Slot, SlotWeek, Variant } from '../data/types';
import { slotsForVariant } from './variant';

/** URL-safe id from a name, unique against `existing`. */
export function slugify(name: string, existing: Set<string>): string {
  const base =
    name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'ejercicio';
  let id = base;
  for (let n = 2; existing.has(id); n++) id = `${base}-${n}`;
  return id;
}

/** New slot id for a day, unique against all slots: `${dayId}-n1`, `-n2`… */
export function newSlotId(dayId: string, allSlots: Slot[]): string {
  const ids = new Set(allSlots.map((s) => s.id));
  let n = 1;
  while (ids.has(`${dayId}-n${n}`)) n++;
  return `${dayId}-n${n}`;
}

/** Order value to append a slot at the end of a block. */
export function appendOrder(daySlots: Slot[], block: Slot['block']): number {
  const inBlock = daySlots.filter((s) => s.block === block);
  return inBlock.length ? Math.max(...inBlock.map((s) => s.order)) + 1 : 0;
}

/**
 * Moves a slot one place up or down among the slots visible in `variant` within its block.
 * Returns the slots whose order changed (empty if it cannot move).
 */
export function moveSlot(daySlots: Slot[], slotId: string, dir: -1 | 1, variant: Variant): Slot[] {
  const slot = daySlots.find((s) => s.id === slotId);
  if (!slot) return [];
  const visible = slotsForVariant(daySlots, variant).filter((s) => s.block === slot.block);
  const i = visible.findIndex((s) => s.id === slotId);
  const neighbor = visible[i + dir];
  if (i < 0 || !neighbor) return [];
  if (neighbor.order === slot.order) {
    // Shared position (A/B pair): nudge past the neighbor.
    return [{ ...slot, order: neighbor.order + dir * 0.5 }];
  }
  return [
    { ...slot, order: neighbor.order },
    { ...neighbor, order: slot.order },
  ];
}

/** True if the variant has work slots of its own (not counting "both"). */
export function variantDefined(daySlots: Slot[], variant: Variant): boolean {
  return daySlots.some((s) => s.block === 'work' && s.week === variant);
}

/** Copies the work slots of one variant into the other, keeping order and sections. */
export function copyVariant(daySlots: Slot[], from: Variant, to: Variant, makeId: (i: number) => string): Slot[] {
  return daySlots
    .filter((s) => s.block === 'work' && s.week === from)
    .sort((a, b) => a.order - b.order)
    .map((s, i) => ({ ...s, id: makeId(i), week: to as SlotWeek, alternatives: [...s.alternatives] }));
}

/** Rounds repMin/repMax into a valid range. */
export function normalizeRange(repMin: number | null, repMax: number | null): [number | null, number | null] {
  if (repMin === null && repMax === null) return [null, null];
  const a = repMin ?? repMax!;
  const b = repMax ?? repMin!;
  return a <= b ? [a, b] : [b, a];
}
