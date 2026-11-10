import { describe, expect, it } from 'vitest';
import { prefillForSlot } from './prefill';
import { suggestProgression } from './progression';
import { exercise, log, session, slot } from './testkit';
import { LB_TO_KG } from './units';

describe('5.3 prefill', () => {
  const push = slot({ id: 'push-x1', dayId: 'push', repMin: 8, repMax: 10 });
  const upper = slot({ id: 'upper-x6', dayId: 'upper', repMin: 15, repMax: 20, sets: 2 });

  it('no history: kg empty, reps at repMin', () => {
    const r = prefillForSlot({ slot: push, exerciseId: 'bench-press', sessions: [], logs: [] });
    expect(r.source).toBe('none');
    expect(r.rows).toEqual([
      { kg: null, reps: 8, seconds: null },
      { kg: null, reps: 8, seconds: null },
      { kg: null, reps: 8, seconds: null },
    ]);
  });

  it('uses the same set of the last finished session of the same slot', () => {
    const sessions = [session(1, 'push', 'finished', 1), session(2, 'push', 'finished', 2)];
    const logs = [
      log(1, 'push-x1', 'bench-press', 0, 55, 10),
      log(2, 'push-x1', 'bench-press', 0, 60, 8),
      log(2, 'push-x1', 'bench-press', 1, 60, 8),
      log(2, 'push-x1', 'bench-press', 2, 60, 7),
    ];
    const r = prefillForSlot({ slot: push, exerciseId: 'bench-press', sessions, logs });
    expect(r.source).toBe('slot');
    expect(r.rows.map((x) => [x.kg, x.reps])).toEqual([
      [60, 8],
      [60, 8],
      [60, 7],
    ]);
  });

  it('does not prefill from the same exercise in another day; shows it as reference', () => {
    const sessions = [session(1, 'upper', 'finished', 1)];
    const logs = [log(1, 'upper-x6', 'bench-press', 0, 40, 18)];
    const r = prefillForSlot({ slot: push, exerciseId: 'bench-press', sessions, logs });
    expect(r.source).toBe('exercise');
    expect(r.rows[0]).toEqual({ kg: null, reps: 8, seconds: null });
    expect(r.reference?.slotId).toBe('upper-x6');
    expect(r.reference?.sets[0].kg).toBe(40);
  });

  it('keeps Push and Upper bench histories separate', () => {
    const sessions = [session(1, 'push', 'finished', 1), session(2, 'upper', 'finished', 2)];
    const logs = [log(1, 'push-x1', 'bench-press', 0, 60, 8), log(2, 'upper-x6', 'bench-press', 0, 40, 18)];
    expect(prefillForSlot({ slot: push, exerciseId: 'bench-press', sessions, logs }).rows[0].kg).toBe(60);
    expect(prefillForSlot({ slot: upper, exerciseId: 'bench-press', sessions, logs }).rows[0].kg).toBe(40);
  });

  it('ignores the current, skipped or in-progress sessions and incomplete sets', () => {
    const sessions = [session(1, 'push', 'finished', 1), session(2, 'push', 'in_progress', 2)];
    const logs = [
      log(1, 'push-x1', 'bench-press', 0, 60, 8),
      log(1, 'push-x1', 'bench-press', 1, 99, 8, { completed: false }),
      log(2, 'push-x1', 'bench-press', 0, 70, 8),
    ];
    const r = prefillForSlot({ slot: push, exerciseId: 'bench-press', sessions, logs, currentSessionId: 2 });
    expect(r.lastSets.map((s) => s.kg)).toEqual([60]);
    expect(r.rows.map((x) => x.kg)).toEqual([60, 60, 60]); // missing sets copy the last one
  });

  it('a swapped exercise has its own history in the slot', () => {
    const sessions = [session(1, 'push', 'finished', 1)];
    const logs = [log(1, 'push-x1', 'dumbbell-press', 0, 30, 10)];
    const r = prefillForSlot({ slot: push, exerciseId: 'bench-press', sessions, logs });
    expect(r.source).toBe('none');
  });

  it('timed slots prefill seconds', () => {
    const carry = slot({ id: 'pull-x11', sets: 1, repMin: null, repMax: null, seconds: 120 });
    const r = prefillForSlot({ slot: carry, exerciseId: 'farmers-carry', sessions: [], logs: [] });
    expect(r.rows[0]).toEqual({ kg: null, reps: null, seconds: 120 });
  });
});

describe('5.4 double progression', () => {
  const s = slot({ repMin: 8, repMax: 10, sets: 3 });
  const ex = exercise();
  const sets = (pairs: [number, number][]) => pairs.map(([kg, reps], i) => log(1, s.id, ex.id, i, kg, reps));

  it('all sets at repMax with the same kg → increase by step, reps to repMin', () => {
    expect(suggestProgression(s, ex, sets([[60, 10], [60, 10], [60, 10]]))).toEqual({
      kind: 'increase',
      kg: 62.5,
      reps: 8,
    });
  });

  it('heavier later sets still count as "same kg or more"', () => {
    expect(suggestProgression(s, ex, sets([[60, 10], [60, 11], [62.5, 10]]))?.kind).toBe('increase');
  });

  it('a lighter later set blocks the increase', () => {
    expect(suggestProgression(s, ex, sets([[60, 10], [57.5, 10], [60, 10]]))?.kind).toBe('more_reps');
  });

  it('within range → keep kg, more reps', () => {
    expect(suggestProgression(s, ex, sets([[60, 10], [60, 9], [60, 8]]))).toEqual({ kind: 'more_reps', kg: 60 });
  });

  it('below repMin → hold kg', () => {
    expect(suggestProgression(s, ex, sets([[60, 9], [60, 8], [60, 7]]))).toEqual({ kind: 'hold', kg: 60 });
  });

  it('fewer sets than planned → no suggestion', () => {
    expect(suggestProgression(s, ex, sets([[60, 10], [60, 10]]))).toBeNull();
  });

  it('no history → no suggestion', () => {
    expect(suggestProgression(s, ex, [])).toBeNull();
  });

  it('fixed range (3 × 10): repMin = repMax', () => {
    const fixed = slot({ repMin: 10, repMax: 10 });
    expect(suggestProgression(fixed, ex, sets([[20, 10], [20, 10], [20, 10]]))?.kind).toBe('increase');
    expect(suggestProgression(fixed, ex, sets([[20, 10], [20, 10], [20, 9]]))?.kind).toBe('hold');
  });

  it('uses the per-exercise step in its input unit (lb)', () => {
    const lb = exercise({ inputUnit: 'lb', step: 5 });
    const kg50lb = 50 * LB_TO_KG;
    const r = suggestProgression(s, lb, sets([[kg50lb, 10], [kg50lb, 10], [kg50lb, 10]]));
    expect(r?.kind).toBe('increase');
    expect(r && 'kg' in r ? r.kg / LB_TO_KG : 0).toBeCloseTo(55, 5);
  });

  it('time_weight: target time reached → increase', () => {
    const carry = slot({ sets: 1, repMin: null, repMax: null, seconds: 120 });
    const fc = exercise({ id: 'farmers-carry', metric: 'time_weight' });
    const done = [log(1, carry.id, fc.id, 0, 24, null, { seconds: 120 })];
    const short = [log(1, carry.id, fc.id, 0, 24, null, { seconds: 100 })];
    expect(suggestProgression(carry, fc, done)).toEqual({ kind: 'increase', kg: 26.5, reps: null });
    expect(suggestProgression(carry, fc, short)?.kind).toBe('hold');
  });
});
