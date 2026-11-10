import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { addPastSet, saveBodyWeight } from './actions';
import { db, ensureSeeded } from './db';
import type { SetLog } from './types';

describe('history and body actions', () => {
  it('adds a forgotten set after the last one of that exercise', async () => {
    await ensureSeeded(db);
    const sessionId = (await db.sessions.add({
      dayId: 'push',
      variant: 'A',
      startedAt: 1,
      endedAt: 2,
      status: 'finished',
      note: '',
      overrides: {},
    } as never)) as number;
    const base = { sessionId, slotId: 'push-x1', exerciseId: 'bench-press', kind: 'work', kg: 60, reps: 8, seconds: null, completed: true } as const;
    await db.setLogs.bulkAdd([{ ...base, index: 0, at: 10 }, { ...base, index: 1, at: 20 }] as SetLog[]);
    const last = (await db.setLogs.where({ sessionId }).toArray()).find((l) => l.index === 1)!;
    await addPastSet(last);
    const all = (await db.setLogs.where({ sessionId }).toArray()).sort((a, b) => a.index - b.index);
    expect(all.map((l) => l.index)).toEqual([0, 1, 2]);
    expect(all[2]).toMatchObject({ kg: 60, reps: 8, completed: true });
    expect(all[2].at).toBeGreaterThan(20);
  });

  it('keeps one body weight per day', async () => {
    await saveBodyWeight('2026-11-10', 80);
    await saveBodyWeight('2026-11-10', 80.4);
    const rows = await db.bodyWeights.where({ date: '2026-11-10' }).toArray();
    expect(rows).toHaveLength(1);
    expect(rows[0].kg).toBe(80.4);
  });
});
