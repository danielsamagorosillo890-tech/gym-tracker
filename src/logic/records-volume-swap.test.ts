import { describe, expect, it } from 'vitest';
import { epley1RM, findPRs } from './records';
import { fixSwap, resolveExerciseId } from './swap';
import { exercise, log, slot } from './testkit';
import { tonnage, weekStart, weeklySetsByGroup } from './volume';

describe('5.5 1RM and PRs', () => {
  it('Epley only up to 12 reps', () => {
    expect(epley1RM(100, 10)).toBeCloseTo(133.333, 3);
    expect(epley1RM(100, 12)).toBeCloseTo(140, 5);
    expect(epley1RM(100, 13)).toBeNull();
    expect(epley1RM(100, 0)).toBeNull();
    expect(epley1RM(null, 8)).toBeNull();
  });

  const ids = (m: Map<number, unknown>) => [...m.keys()];

  it('the first record is never a PR', () => {
    const a = log(1, 's', 'e', 0, 60, 8);
    expect(findPRs([a], 'weight_reps').size).toBe(0);
  });

  it('(a) higher estimated 1RM is a PR; ties are not', () => {
    const a = log(1, 's', 'e', 0, 60, 8);
    const tie = log(2, 's', 'e', 0, 60, 8);
    const better = log(3, 's', 'e', 0, 62.5, 8);
    const prs = findPRs([a, tie, better], 'weight_reps');
    expect(ids(prs)).toEqual([better.id]);
    expect(prs.get(better.id)).toContain('e1rm');
  });

  it('(b) more reps with the same kg or more', () => {
    const a = log(1, 's', 'e', 0, 60, 8);
    const b = log(2, 's', 'e', 0, 60, 9);
    expect(findPRs([a, b], 'weight_reps').get(b.id)).toContain('reps');
  });

  it('(b) lighter kg: PR only if it beats the reps of every set at that kg or heavier', () => {
    const a = log(1, 's', 'e', 0, 60, 8);
    const more = log(2, 's', 'e', 0, 50, 10); // never did 10 reps with ≥50 kg
    const fewer = log(3, 's', 'e', 0, 50, 7);
    const prs = findPRs([a, more, fewer], 'weight_reps');
    expect(prs.get(more.id)).toEqual(['reps']);
    expect(prs.has(fewer.id)).toBe(false);
  });

  it('over 12 reps: no 1RM, but rep PR still applies', () => {
    const a = log(1, 's', 'e', 0, 40, 15);
    const b = log(2, 's', 'e', 0, 40, 18);
    expect(findPRs([a, b], 'weight_reps').get(b.id)).toEqual(['reps']);
  });

  it('warm-ups and incomplete sets never count nor serve as base', () => {
    const w = log(1, 's', 'e', 0, 100, 10, { kind: 'warmup' });
    const inc = log(1, 's', 'e', 1, 100, 10, { completed: false });
    const a = log(2, 's', 'e', 0, 60, 8);
    expect(findPRs([w, inc, a], 'weight_reps').size).toBe(0);
  });

  it('(c) time_weight: longer with the same kg or more', () => {
    const a = log(1, 's', 'e', 0, 24, null, { seconds: 100 });
    const b = log(2, 's', 'e', 0, 24, null, { seconds: 120 });
    const tie = log(3, 's', 'e', 0, 24, null, { seconds: 120 });
    const lighterShorter = log(4, 's', 'e', 0, 20, null, { seconds: 110 });
    const heavierFirst = log(5, 's', 'e', 0, 30, null, { seconds: 60 });
    const prs = findPRs([a, b, tie, lighterShorter, heavierFirst], 'time_weight');
    expect(ids(prs)).toEqual([b.id]);
  });

  it('within the same session later sets compare against earlier ones', () => {
    const a = log(5, 's', 'e', 0, 60, 8);
    const b = log(5, 's', 'e', 1, 60, 10);
    expect(findPRs([b, a], 'weight_reps').has(b.id)).toBe(true);
  });
});

describe('5.6 volume', () => {
  const exMap = new Map([
    ['bench-press', exercise()],
    ['one-arm-reverse-fly', exercise({ id: 'one-arm-reverse-fly', group: 'Hombro', perSide: true })],
    ['circles', exercise({ id: 'circles', group: null, metric: 'check' })],
  ]);
  const monday = new Date(2026, 10, 9, 10).getTime(); // Mon 9 Nov 2026
  const sunday = new Date(2026, 10, 15, 22).getTime();
  const nextMonday = new Date(2026, 10, 16, 8).getTime();

  it('weeks start on Monday', () => {
    expect(weekStart(sunday)).toBe(weekStart(monday));
    expect(weekStart(nextMonday)).not.toBe(weekStart(monday));
  });

  it('counts work sets per group; per-side counts once; warm-ups excluded', () => {
    const logs = [
      log(1, 's', 'bench-press', 0, 60, 8, { at: monday }),
      log(1, 's', 'bench-press', 1, 60, 8, { at: sunday }),
      log(1, 's', 'one-arm-reverse-fly', 0, 10, 10, { at: monday }),
      log(1, 's', 'bench-press', 2, 40, 10, { at: monday, kind: 'warmup' }),
      log(1, 's', 'bench-press', 3, 60, 8, { at: monday, completed: false }),
      log(1, 's', 'circles', 0, null, null, { at: monday }),
    ];
    const weeks = weeklySetsByGroup(logs, exMap, sunday, 8);
    expect(weeks).toHaveLength(8);
    expect(weeks[7].counts).toEqual({ Pecho: 2, Hombro: 1 });
    expect(weeks[6].counts).toEqual({});
  });

  it('tonnage is kg × reps as logged', () => {
    const logs = [
      log(1, 's', 'bench-press', 0, 60, 8),
      log(1, 's', 'one-arm-reverse-fly', 0, 10, 10), // per side: not doubled
      log(1, 's', 'bench-press', 1, 60, 8, { completed: false }),
    ];
    expect(tonnage(logs)).toBe(580);
  });
});

describe('5.7 swap', () => {
  const s = slot({ exerciseId: 'reverse-tricep-pushdown', alternatives: ['cable-tricep-pushdown'] });

  it('"solo hoy" override wins for this session only', () => {
    expect(resolveExerciseId(s, { overrides: { [s.id]: 'cable-tricep-pushdown' } })).toBe('cable-tricep-pushdown');
    expect(resolveExerciseId(s, { overrides: {} })).toBe('reverse-tricep-pushdown');
    expect(resolveExerciseId(s, null)).toBe('reverse-tricep-pushdown');
  });

  it('"dejarlo fijo" changes the default and keeps the old one as alternative', () => {
    const fixed = fixSwap(s, 'cable-tricep-pushdown');
    expect(fixed.exerciseId).toBe('cable-tricep-pushdown');
    expect(fixed.alternatives).toEqual(['reverse-tricep-pushdown']);
  });

  it('sets are logged with the exercise actually done', () => {
    // The log carries exerciseId, so history follows the real exercise.
    const l = log(1, s.id, resolveExerciseId(s, { overrides: { [s.id]: 'rope-pushdown' } }), 0, 20, 10);
    expect(l.exerciseId).toBe('rope-pushdown');
  });
});
