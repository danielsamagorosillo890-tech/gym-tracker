import { describe, expect, it } from 'vitest';
import { seedSlots } from '../data/seed';
import { nextDayId } from './cycle';
import { days, log, session } from './testkit';
import { effectiveVariant, slotsForVariant, variantFor } from './variant';

describe('5.1 cycle', () => {
  it('starts at Push with no history', () => {
    expect(nextDayId(days, [])).toBe('push');
  });

  it('advances after the last finished day and wraps around', () => {
    expect(nextDayId(days, [session(1, 'push', 'finished', 1)])).toBe('pull');
    expect(nextDayId(days, [session(1, 'lower', 'finished', 1)])).toBe('push');
  });

  it('ignores the weekday: only order of closed sessions matters', () => {
    const s = [session(1, 'push', 'finished', 100), session(2, 'pull', 'finished', 50)];
    expect(nextDayId(days, s)).toBe('pull'); // push ended last
  });

  it('skipping advances the cycle', () => {
    const s = [session(1, 'push', 'finished', 1), session(2, 'pull', 'skipped', 2)];
    expect(nextDayId(days, s)).toBe('legs');
  });

  it('"another day": the next one follows the day actually done', () => {
    const s = [session(1, 'push', 'finished', 1), session(2, 'upper', 'finished', 2)];
    expect(nextDayId(days, s)).toBe('lower');
  });

  it('an in-progress session does not advance the cycle', () => {
    const s = [session(1, 'push', 'finished', 1), session(2, 'pull', 'in_progress', 2)];
    expect(nextDayId(days, s)).toBe('pull');
  });
});

describe('5.2 variant A/B', () => {
  const withSets = (id: number, dayId: string, t: number) => ({
    s: session(id, dayId, 'finished', t),
    l: log(id, `${dayId}-x1`, 'x', 0, 50, 8),
  });

  it('parity: 0 → A, 1 → B, 2 → A', () => {
    expect(variantFor('pull', [], [])).toBe('A');
    const a = withSets(1, 'pull', 1);
    expect(variantFor('pull', [a.s], [a.l])).toBe('B');
    const b = withSets(2, 'pull', 2);
    expect(variantFor('pull', [a.s, b.s], [a.l, b.l])).toBe('A');
  });

  it('counts only sessions of that same day', () => {
    const a = withSets(1, 'push', 1);
    expect(variantFor('pull', [a.s], [a.l])).toBe('A');
  });

  it('skipped sessions do not count', () => {
    const sk = session(1, 'pull', 'skipped', 1);
    expect(variantFor('pull', [sk], [])).toBe('A');
  });

  it('finished sessions without completed work sets do not count', () => {
    const s = session(1, 'pull', 'finished', 1);
    const incomplete = log(1, 'pull-x1', 'x', 0, 50, 8, { completed: false });
    const warm = log(1, 'pull-w1', 'x', 0, null, null, { kind: 'warmup' });
    expect(variantFor('pull', [s], [incomplete, warm])).toBe('A');
  });

  it('deleting a session recalculates parity', () => {
    const a = withSets(1, 'pull', 1);
    const b = withSets(2, 'pull', 2);
    expect(variantFor('pull', [a.s, b.s], [a.l, b.l])).toBe('A');
    expect(variantFor('pull', [b.s], [b.l])).toBe('B'); // session 1 deleted
  });

  it('the in-progress session can be excluded from its own count', () => {
    const a = withSets(1, 'pull', 1);
    expect(variantFor('pull', [a.s], [a.l], 1)).toBe('A');
  });

  it('Lower B has no exercises yet → falls back to A', () => {
    const lower = seedSlots().filter((s) => s.dayId === 'lower');
    expect(effectiveVariant(lower, 'B')).toEqual({ variant: 'A', fellBack: true });
    expect(effectiveVariant(lower, 'A')).toEqual({ variant: 'A', fellBack: false });
  });

  it('a day with only "both" slots keeps the requested variant', () => {
    const push = seedSlots().filter((s) => s.dayId === 'push');
    expect(effectiveVariant(push, 'B')).toEqual({ variant: 'B', fellBack: false });
  });

  it('slotsForVariant shows "both" plus the variant, warm-ups first', () => {
    const pull = seedSlots().filter((s) => s.dayId === 'pull');
    const b = slotsForVariant(pull, 'B');
    expect(b.map((s) => s.exerciseId)).toContain('wide-grip-lat-pulldown');
    expect(b.map((s) => s.exerciseId)).not.toContain('close-grip-lat-pulldown');
    expect(b.map((s) => s.exerciseId)).toContain('t-bar-row');
    expect(b[0].block).toBe('warmup');
  });
});
