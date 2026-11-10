import { describe, expect, it } from 'vitest';
import { SEED_DAYS, seedExercises, seedSlots } from '../data/seed';
import { generateDemo } from './demo';
import { bestMark, exerciseSets, prList, rangeStart, sessionPoints } from './progress';
import { log, session } from './testkit';
import { variantFor } from './variant';

describe('progress', () => {
  const sessions = [
    session(1, 'push', 'finished', 1000),
    session(2, 'upper', 'finished', 2000),
    session(3, 'push', 'finished', 3000),
    session(4, 'push', 'in_progress', 4000),
  ];
  const logs = [
    log(1, 'push-x1', 'bench-press', 0, 60, 8),
    log(1, 'push-x1', 'bench-press', 1, 60, 7),
    log(2, 'upper-x6', 'bench-press', 0, 40, 18),
    log(3, 'push-x1', 'bench-press', 0, 62.5, 8),
    log(3, 'push-x1', 'bench-press', 1, 60, 10),
    log(3, 'push-x1', 'bench-press', 2, 70, 3, { completed: false }),
    log(4, 'push-x1', 'bench-press', 0, 100, 8),
  ];

  it('only completed sets of finished sessions, optional day filter', () => {
    expect(exerciseSets(logs, sessions, 'bench-press')).toHaveLength(5);
    expect(exerciseSets(logs, sessions, 'bench-press', 'upper')).toHaveLength(1);
  });

  it('one point per session with its best set and best e1RM', () => {
    const pts = sessionPoints(exerciseSets(logs, sessions, 'bench-press'), sessions, 'weight_reps');
    expect(pts.map((p) => p.sessionId)).toEqual([1, 2, 3]);
    expect(pts[2].best.kg).toBe(62.5);
    expect(pts[2].e1rm).toBeCloseTo(80, 5); // 60 × (1 + 10/30)
    expect(pts[1].e1rm).toBeNull(); // 18 reps: no 1RM
  });

  it('best mark prefers the highest e1RM', () => {
    const b = bestMark(exerciseSets(logs, sessions, 'bench-press'), 'weight_reps');
    expect(b?.set.kg).toBe(60);
    expect(b?.set.reps).toBe(10);
  });

  it('PR list over full history, newest first', () => {
    const prs = prList(exerciseSets(logs, sessions, 'bench-press'), sessions, 'weight_reps');
    expect(prs.length).toBeGreaterThan(0);
    expect(prs[0].t).toBeGreaterThanOrEqual(prs[prs.length - 1].t);
  });

  it('range starts', () => {
    expect(rangeStart('all', 0)).toBe(-Infinity);
    expect(rangeStart('4w', 28 * 86_400_000)).toBe(0);
  });
});

describe('demo data', () => {
  const now = new Date(2026, 10, 10, 12).getTime();
  const exercises = new Map(seedExercises().map((e) => [e.id, e]));
  const demo = generateDemo({ days: SEED_DAYS, slots: seedSlots(), exercises, now });

  it('covers about 12 weeks of finished sessions', () => {
    expect(demo.sessions.length).toBeGreaterThan(40);
    const span = now - demo.sessions[0].startedAt;
    expect(span).toBeGreaterThan(11 * 7 * 86_400_000);
    expect(demo.sessions.every((s) => s.status === 'finished' && s.startedAt < now)).toBe(true);
  });

  it('follows the cycle and A/B parity', () => {
    expect(demo.sessions.slice(0, 5).map((s) => s.dayId)).toEqual(['push', 'pull', 'legs', 'upper', 'lower']);
    for (const s of demo.sessions) {
      const earlier = demo.sessions.filter((x) => x.startedAt < s.startedAt);
      expect(s.variant).toBe(variantFor(s.dayId, earlier, demo.logs));
    }
  });

  it('weights go up over time and logs are valid', () => {
    const bench = demo.logs.filter((l) => l.slotId === 'push-x1');
    expect(bench[bench.length - 1].kg!).toBeGreaterThan(bench[0].kg!);
    expect(demo.logs.every((l) => l.completed && l.kind === 'work')).toBe(true);
    expect(new Set(demo.logs.map((l) => l.id)).size).toBe(demo.logs.length);
  });

  it('is deterministic', () => {
    const again = generateDemo({ days: SEED_DAYS, slots: seedSlots(), exercises, now });
    expect(again.logs.length).toBe(demo.logs.length);
  });
});
