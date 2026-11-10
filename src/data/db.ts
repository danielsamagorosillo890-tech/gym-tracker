import Dexie, { type EntityTable } from 'dexie';
import { SEED_DAYS, seedExercises, seedSlots } from './seed';
import {
  DEFAULT_SETTINGS,
  type Backup,
  type Day,
  type Exercise,
  type Session,
  type SetLog,
  type Settings,
  type Slot,
  type WarmupCheck,
  type UserMedia,
} from './types';

export type GymDB = Dexie & {
  exercises: EntityTable<Exercise, 'id'>;
  days: EntityTable<Day, 'id'>;
  slots: EntityTable<Slot, 'id'>;
  sessions: EntityTable<Session, 'id'>;
  setLogs: EntityTable<SetLog, 'id'>;
  warmupChecks: EntityTable<WarmupCheck, 'id'>;
  settings: EntityTable<Settings, 'id'>;
  backups: EntityTable<Backup, 'id'>;
  userMedia: EntityTable<UserMedia, 'id'>;
};

/** Tables included in export/import, in restore order. */
export const DATA_TABLES = [
  'exercises',
  'days',
  'slots',
  'sessions',
  'setLogs',
  'warmupChecks',
  'settings',
] as const;
export type DataTable = (typeof DATA_TABLES)[number];

export function createDB(name = 'gym-tracker'): GymDB {
  const db = new Dexie(name) as GymDB;
  // v1 was the Phase 0 test table.
  db.version(1).stores({ testSets: '++id, at' });
  db.version(2).stores({
    testSets: null,
    exercises: 'id, group',
    days: 'id, order',
    slots: 'id, dayId, exerciseId',
    sessions: '++id, dayId, status, startedAt',
    setLogs: '++id, sessionId, exerciseId, slotId',
    warmupChecks: 'id, sessionId',
    settings: 'id',
    backups: '++id, createdAt',
  });
  // v3: photos/videos the user uploads (not part of the JSON backup).
  db.version(3).stores({ userMedia: '++id, exerciseId' });
  db.on('populate', (tx) => {
    tx.table('exercises').bulkAdd(seedExercises());
    tx.table('days').bulkAdd(SEED_DAYS);
    tx.table('slots').bulkAdd(seedSlots());
    tx.table('settings').add(DEFAULT_SETTINGS);
  });
  return db;
}

/** Seeds an existing (e.g. upgraded from v1 or wiped) database if it has no routine. */
export async function ensureSeeded(db: GymDB): Promise<void> {
  await db.transaction('rw', [db.exercises, db.days, db.slots, db.settings], async () => {
    if ((await db.days.count()) === 0) {
      await db.exercises.bulkPut(seedExercises());
      await db.days.bulkPut(SEED_DAYS);
      await db.slots.bulkPut(seedSlots());
    }
    if (!(await db.settings.get('settings'))) await db.settings.put(DEFAULT_SETTINGS);
  });
}

export const REAL_DB = 'gym-tracker';
export const DEMO_DB = 'gym-tracker-demo';
const DEMO_FLAG = 'gym-demo';

/** Demo mode swaps the whole app onto a separate database; real data is never touched. */
export function isDemo(): boolean {
  try {
    return localStorage.getItem(DEMO_FLAG) === '1';
  } catch {
    return false;
  }
}

export function setDemoFlag(on: boolean): void {
  try {
    if (on) localStorage.setItem(DEMO_FLAG, '1');
    else localStorage.removeItem(DEMO_FLAG);
  } catch {
    /* ignored */
  }
}

export const db = createDB(isDemo() ? DEMO_DB : REAL_DB);
