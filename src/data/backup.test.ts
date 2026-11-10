import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { backupReminderDue, exportData, importData, parseBackup, BackupError } from './backup';
import { createDB, ensureSeeded, type GymDB } from './db';
import { seedSlots } from './seed';

let n = 0;
const dbs: GymDB[] = [];
async function freshDB() {
  const db = createDB(`test-${n++}`);
  dbs.push(db);
  await db.open();
  await ensureSeeded(db);
  return db;
}
afterEach(async () => {
  for (const d of dbs.splice(0)) await d.delete();
});

describe('seed', () => {
  it('seeds the full routine on first open', async () => {
    const db = await freshDB();
    expect(await db.days.count()).toBe(5);
    expect(await db.slots.count()).toBe(seedSlots().length);
    expect(await db.exercises.get('bench-press')).toMatchObject({ group: 'Pecho', step: 2.5 });
  });

  it('slot ids are unique', () => {
    const ids = seedSlots().map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('export / import', () => {
  it('round-trips without loss', async () => {
    const a = await freshDB();
    const sid = await a.sessions.add({
      dayId: 'push',
      variant: 'A',
      startedAt: 1,
      endedAt: 2,
      status: 'finished',
      note: 'buen día',
      overrides: { 'push-x9': 'cable-tricep-pushdown' },
    } as never);
    await a.setLogs.add({
      sessionId: sid,
      slotId: 'push-x1',
      exerciseId: 'bench-press',
      index: 0,
      kind: 'work',
      kg: 62.5,
      reps: 8,
      seconds: null,
      completed: true,
      at: 3,
    } as never);
    await a.exercises.update('bench-press', { machineSettings: 'Banco 3' });
    const file = await exportData(a, 10);
    const json = JSON.stringify(file);

    const b = await freshDB();
    await importData(b, parseBackup(json), 20);
    const again = await exportData(b, 10);
    expect(again).toEqual(file);
  });

  it('saves an automatic copy before importing, keeping the last 3', async () => {
    const db = await freshDB();
    const file = await exportData(db);
    for (let i = 0; i < 5; i++) await importData(db, file, 100 + i);
    const backups = await db.backups.orderBy('createdAt').toArray();
    expect(backups.map((b) => b.createdAt)).toEqual([102, 103, 104]);
    expect(parseBackup(backups[0].json).app).toBe('gym-tracker');
  });

  it('rejects invalid files with a readable message', () => {
    expect(() => parseBackup('nope')).toThrow(BackupError);
    expect(() => parseBackup('{"app":"otra"}')).toThrow(/no es un respaldo/);
    expect(() => parseBackup(JSON.stringify({ app: 'gym-tracker', schemaVersion: 99, data: {} }))).toThrow(
      /más nueva/,
    );
    expect(() => parseBackup(JSON.stringify({ app: 'gym-tracker', schemaVersion: 1, data: {} }))).toThrow(/falta/);
  });
});

describe('backup reminder', () => {
  const day = 86_400_000;
  it('not due without data', () => {
    expect(backupReminderDue({ lastExportAt: null, firstDataAt: null }, 100 * day)).toBe(false);
  });
  it('due 14 days after first data with no export', () => {
    expect(backupReminderDue({ lastExportAt: null, firstDataAt: 0 }, 13 * day)).toBe(false);
    expect(backupReminderDue({ lastExportAt: null, firstDataAt: 0 }, 14 * day)).toBe(true);
  });
  it('resets with each export', () => {
    expect(backupReminderDue({ lastExportAt: 10 * day, firstDataAt: 0 }, 20 * day)).toBe(false);
  });
});
