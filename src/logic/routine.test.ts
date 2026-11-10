import { describe, expect, it } from 'vitest';
import { seedSlots } from '../data/seed';
import { appendOrder, copyVariant, moveSlot, newSlotId, normalizeRange, slugify, variantDefined } from './routine';
import { slotsForVariant } from './variant';

const all = seedSlots();
const day = (id: string) => all.filter((s) => s.dayId === id);

function apply(daySlots: ReturnType<typeof day>, changed: ReturnType<typeof moveSlot>) {
  const m = new Map(changed.map((s) => [s.id, s]));
  return daySlots.map((s) => m.get(s.id) ?? s);
}

describe('routine editing', () => {
  it('slugify: accents removed, unique', () => {
    expect(slugify('Press inclinado (máquina)', new Set())).toBe('press-inclinado-maquina');
    expect(slugify('Bench press', new Set(['bench-press']))).toBe('bench-press-2');
    expect(slugify('¿¿', new Set())).toBe('ejercicio');
  });

  it('newSlotId is unique per day', () => {
    expect(newSlotId('push', all)).toBe('push-n1');
    const more = [...all, { ...all[0], id: 'push-n1' }];
    expect(newSlotId('push', more)).toBe('push-n2');
  });

  it('appendOrder goes after the last slot of the block', () => {
    const push = day('push');
    expect(appendOrder(push, 'work')).toBe(Math.max(...push.filter((s) => s.block === 'work').map((s) => s.order)) + 1);
    expect(appendOrder([], 'work')).toBe(0);
  });

  it('moves a slot down and up within its block', () => {
    let push = day('push');
    const names = () => slotsForVariant(push, 'A').filter((s) => s.block === 'work').map((s) => s.exerciseId);
    push = apply(push, moveSlot(push, 'push-x1', 1, 'A'));
    expect(names().slice(0, 2)).toEqual(['incline-dumbbell-press', 'bench-press']);
    push = apply(push, moveSlot(push, 'push-x1', -1, 'A'));
    expect(names().slice(0, 2)).toEqual(['bench-press', 'incline-dumbbell-press']);
  });

  it('cannot move past the ends or across blocks', () => {
    const push = day('push');
    expect(moveSlot(push, 'push-x1', -1, 'A')).toEqual([]); // first work slot
    expect(moveSlot(push, 'push-w6', 1, 'A')).toEqual([]); // last warm-up
  });

  it('moves within the visible variant (Pull B skips A slots)', () => {
    let pull = day('pull');
    const namesB = () => slotsForVariant(pull, 'B').filter((s) => s.block === 'work').map((s) => s.exerciseId);
    const before = namesB();
    pull = apply(pull, moveSlot(pull, 'pull-b1', 1, 'B'));
    const after = namesB();
    expect(after[0]).toBe(before[1]);
    expect(after[1]).toBe('wide-grip-lat-pulldown');
    // A is unchanged in relative order of its own slots
    expect(slotsForVariant(pull, 'A').filter((s) => s.block === 'work')[0].exerciseId).toBe('close-grip-lat-pulldown');
  });

  it('copies A into an undefined B (Lower)', () => {
    const lower = day('lower');
    expect(variantDefined(lower, 'B')).toBe(false);
    const copies = copyVariant(lower, 'A', 'B', (i) => `lower-c${i}`);
    expect(copies).toHaveLength(6);
    expect(copies.every((s) => s.week === 'B')).toBe(true);
    expect(copies.map((s) => s.exerciseId)).toEqual(
      lower.filter((s) => s.week === 'A').sort((a, b) => a.order - b.order).map((s) => s.exerciseId),
    );
    expect(variantDefined([...lower, ...copies], 'B')).toBe(true);
  });

  it('normalizeRange swaps inverted ranges and fills a missing end', () => {
    expect(normalizeRange(12, 8)).toEqual([8, 12]);
    expect(normalizeRange(10, null)).toEqual([10, 10]);
    expect(normalizeRange(null, null)).toEqual([null, null]);
  });
});
