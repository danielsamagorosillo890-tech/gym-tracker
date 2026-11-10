import Dexie, { type EntityTable } from 'dexie';

// Phase 0 only: a throwaway table to prove IndexedDB survives app kills,
// reboots and airplane mode. Replaced by the full model in Phase 1.
export interface TestSet {
  id: number;
  kg: number;
  reps: number;
  at: number; // epoch ms
}

export const db = new Dexie('gym-tracker') as Dexie & {
  testSets: EntityTable<TestSet, 'id'>;
};

db.version(1).stores({
  testSets: '++id, at',
});
