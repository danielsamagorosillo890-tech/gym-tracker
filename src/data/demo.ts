import { generateDemo } from '../logic/demo';
import { createDB, db, DEMO_DB, isDemo, setDemoFlag } from './db';
import { DEFAULT_SETTINGS } from './types';

/** Builds 12 weeks of synthetic history in the demo database using your current routine, then reloads. */
export async function enterDemo(): Promise<void> {
  const [days, slots, exercises, real] = await Promise.all([
    db.days.toArray(),
    db.slots.toArray(),
    db.exercises.toArray(),
    db.settings.get('settings'),
  ]);
  const demo = createDB(DEMO_DB);
  await demo.delete();
  await demo.open();
  const now = Date.now();
  const { sessions, logs } = generateDemo({ days, slots, exercises: new Map(exercises.map((e) => [e.id, e])), now });
  await demo.transaction('rw', [demo.days, demo.slots, demo.exercises, demo.sessions, demo.setLogs, demo.settings], async () => {
    for (const t of [demo.days, demo.slots, demo.exercises, demo.settings]) await t.clear();
    await demo.days.bulkAdd(days);
    await demo.slots.bulkAdd(slots);
    await demo.exercises.bulkAdd(exercises);
    await demo.sessions.bulkAdd(sessions);
    await demo.setLogs.bulkAdd(logs);
    await demo.settings.add({ ...DEFAULT_SETTINGS, theme: real?.theme ?? 'dark', lastExportAt: now, firstDataAt: now, notificationsAsked: true });
  });
  demo.close();
  setDemoFlag(true);
  location.reload();
}

/** Leaves demo mode and deletes the demo database. */
export async function exitDemo(): Promise<void> {
  setDemoFlag(false);
  if (isDemo() === false) {
    db.close();
    await createDB(DEMO_DB).delete();
  }
  location.reload();
}
