import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { exportData, importData, parseBackup } from '../data/backup';
import { createDB, ensureSeeded } from '../data/db';
import { SEED_DAYS } from '../data/seed';
import { weightTrend } from './body';
import { bodyCsv, localDate, setsCsv, toCsv } from './csv';
import { deloadActive, deloadRows, deloadSets } from './deload';
import { prefillForSlot } from './prefill';
import { exerciseSets } from './progress';
import { findPRs, withoutDeload } from './records';
import { exercise, log, session, slot } from './testkit';

describe('CSV', () => {
  it('escapes commas, quotes and new lines', () => {
    expect(toCsv([['a,b', 'di "hola"', 'x\ny', 1.234, null]])).toBe('"a,b","di ""hola""","x\ny",1.23,\r\n');
  });

  it('sets CSV has one row per completed work set of finished sessions', () => {
    const sessions = [session(1, 'push', 'finished', new Date(2026, 10, 9, 18).getTime()), session(2, 'push', 'in_progress', 9e12)];
    const logs = [
      log(1, 'push-x1', 'bench-press', 0, 60, 8),
      log(1, 'push-x1', 'bench-press', 1, 60, 7, { completed: false }),
      log(2, 'push-x1', 'bench-press', 0, 70, 8),
    ];
    const csv = setsCsv(sessions, logs, new Map([['bench-press', exercise()]]), SEED_DAYS).trim().split('\r\n');
    expect(csv).toHaveLength(2);
    expect(csv[1]).toBe('2026-11-09,Push,A,no,Bench press,Pecho,1,60,8,,no,76');
  });

  it('body CSV merges weight and measurements by date', () => {
    const csv = bodyCsv(
      [{ id: 1, date: '2026-11-01', kg: 80.5 }],
      [{ id: 1, date: '2026-11-02', waist: 84, chest: null, arm: 36, thigh: null }],
    );
    expect(csv.trim().split('\r\n')).toEqual([
      'fecha,peso_kg,cintura_cm,pecho_cm,brazo_cm,muslo_cm',
      '2026-11-01,80.5,,,,',
      '2026-11-02,,84,,36,',
    ]);
  });

  it('localDate uses local calendar day', () => {
    expect(localDate(new Date(2026, 0, 5, 23, 59).getTime())).toBe('2026-01-05');
  });
});

describe('body weight trend', () => {
  it('latest value and change vs ~4 weeks before', () => {
    const t = weightTrend([
      { id: 1, date: '2026-10-01', kg: 82 },
      { id: 2, date: '2026-10-13', kg: 81 },
      { id: 3, date: '2026-11-10', kg: 80.2 },
    ]);
    expect(t?.latest.kg).toBe(80.2);
    expect(t?.change4w).toBe(-0.8);
  });

  it('no change when there is no entry that old', () => {
    expect(weightTrend([{ id: 1, date: '2026-11-01', kg: 80 }])?.change4w).toBeNull();
    expect(weightTrend([])).toBeNull();
  });
});

describe('deload', () => {
  it('is active only until its end date', () => {
    expect(deloadActive({ deloadUntil: 100 }, 50)).toBe(true);
    expect(deloadActive({ deloadUntil: 100 }, 150)).toBe(false);
    expect(deloadActive({ deloadUntil: null }, 0)).toBe(false);
  });

  it('halves sets (rounded up) and uses ~60% weight snapped to the step', () => {
    expect(deloadSets(3)).toBe(2);
    expect(deloadSets(1)).toBe(1);
    const rows = [1, 2, 3].map(() => ({ kg: 100, reps: 8, seconds: null }));
    const light = deloadRows(rows, { inputUnit: 'kg', step: 2.5 }, 3);
    expect(light).toHaveLength(2);
    expect(light[0]).toEqual({ kg: 60, reps: 8, seconds: null });
    expect(deloadRows([{ kg: 62.5, reps: 8, seconds: null }], { inputUnit: 'kg', step: 2.5 }, 1)[0].kg).toBe(37.5);
  });

  it('deload sessions are ignored for prefill, charts and PRs', () => {
    const normal = session(1, 'push', 'finished', 1000);
    const light = { ...session(2, 'push', 'finished', 2000), deload: true };
    const logs = [log(1, 'push-x1', 'bench-press', 0, 100, 8), log(2, 'push-x1', 'bench-press', 0, 60, 12)];
    const r = prefillForSlot({ slot: slot(), exerciseId: 'bench-press', sessions: [normal, light], logs });
    expect(r.rows[0].kg).toBe(100);
    expect(exerciseSets(logs, [normal, light], 'bench-press')).toHaveLength(1);
    expect(findPRs(withoutDeload(logs, [normal, light]), 'weight_reps').size).toBe(0);
    // Unfiltered, the light 60 × 12 set would count as a false rep PR.
    expect(findPRs(logs, 'weight_reps').size).toBe(1);
  });
});

describe('backup v2', () => {
  it('imports a v1 backup without body tables', async () => {
    const db = createDB('phase4-v1');
    await db.open();
    await ensureSeeded(db);
    const file = await exportData(db);
    const v1 = JSON.parse(JSON.stringify(file));
    v1.schemaVersion = 1;
    delete v1.data.bodyWeights;
    delete v1.data.measurements;
    const parsed = parseBackup(JSON.stringify(v1));
    expect(parsed.data.bodyWeights).toEqual([]);
    await importData(db, parsed);
    expect(await db.bodyWeights.count()).toBe(0);
    await db.delete();
  });

  it('round-trips body data', async () => {
    const a = createDB('phase4-a');
    await a.open();
    await ensureSeeded(a);
    await a.bodyWeights.add({ date: '2026-11-10', kg: 80.4 } as never);
    await a.measurements.add({ date: '2026-11-10', waist: 84, chest: 100, arm: 37, thigh: 58 } as never);
    const file = await exportData(a, 1);
    const b = createDB('phase4-b');
    await b.open();
    await importData(b, parseBackup(JSON.stringify(file)));
    expect(await exportData(b, 1)).toEqual(file);
    await a.delete();
    await b.delete();
  });
});
