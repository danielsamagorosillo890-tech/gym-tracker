import { db } from './db';
import { fixSwap } from '../logic/swap';
import { copyVariant, moveSlot, newSlotId, slugify } from '../logic/routine';
import { DEFAULT_SETTINGS, type Exercise, type SetLog, type Settings, type Slot, type Variant } from './types';
import { requestPersist } from '../storage';

export async function getSettings(): Promise<Settings> {
  return (await db.settings.get('settings')) ?? DEFAULT_SETTINGS;
}

export async function updateSettings(patch: Partial<Settings>): Promise<void> {
  const current = await getSettings();
  await db.settings.put({ ...current, ...patch, id: 'settings' });
}

export async function startSession(dayId: string, variant: Variant): Promise<number> {
  return db.transaction('rw', db.sessions, async () => {
    const open = await db.sessions.where('status').equals('in_progress').first();
    if (open) return open.id;
    return db.sessions.add({
      dayId,
      variant,
      startedAt: Date.now(),
      endedAt: null,
      status: 'in_progress',
      note: '',
      overrides: {},
    } as never) as Promise<number>;
  });
}

/** Called after the first real write: ask the browser for persistent storage. */
async function onDataWritten(): Promise<void> {
  const s = await getSettings();
  if (s.firstDataAt === null) {
    await updateSettings({ firstDataAt: Date.now() });
    requestPersist().catch(() => {});
  }
}

export interface SetValues {
  kg: number | null;
  reps: number | null;
  seconds: number | null;
}

/** Creates or updates one set row. Every edit is saved immediately. */
export async function upsertSet(
  sessionId: number,
  slotId: string,
  exerciseId: string,
  index: number,
  values: Partial<SetValues> & { completed?: boolean },
): Promise<void> {
  await db.transaction('rw', db.setLogs, async () => {
    const existing = await db.setLogs
      .where({ sessionId })
      .filter((l) => l.slotId === slotId && l.exerciseId === exerciseId && l.index === index)
      .first();
    const now = Date.now();
    if (existing) {
      await db.setLogs.update(existing.id, { ...values, at: now });
    } else {
      await db.setLogs.add({
        sessionId,
        slotId,
        exerciseId,
        index,
        kind: 'work',
        kg: null,
        reps: null,
        seconds: null,
        completed: false,
        ...values,
        at: now,
      } as SetLog);
    }
  });
  if (values.completed) await onDataWritten();
}

/** Writes several rows at once (prefill buttons). Leaves completed rows untouched. */
export async function fillSets(
  sessionId: number,
  slotId: string,
  exerciseId: string,
  rows: SetValues[],
): Promise<void> {
  await db.transaction('rw', db.setLogs, async () => {
    const existing = await db.setLogs
      .where({ sessionId })
      .filter((l) => l.slotId === slotId && l.exerciseId === exerciseId)
      .toArray();
    const now = Date.now();
    for (let i = 0; i < rows.length; i++) {
      const e = existing.find((l) => l.index === i);
      if (e?.completed) continue;
      if (e) await db.setLogs.update(e.id, { ...rows[i], at: now });
      else
        await db.setLogs.add({
          sessionId,
          slotId,
          exerciseId,
          index: i,
          kind: 'work',
          ...rows[i],
          completed: false,
          at: now,
        } as SetLog);
    }
  });
}

export async function deleteSetRow(sessionId: number, slotId: string, exerciseId: string, index: number) {
  await db.transaction('rw', db.setLogs, async () => {
    const rows = await db.setLogs
      .where({ sessionId })
      .filter((l) => l.slotId === slotId && l.exerciseId === exerciseId)
      .toArray();
    const target = rows.find((r) => r.index === index);
    if (target) await db.setLogs.delete(target.id);
    // Keep indexes contiguous.
    for (const r of rows.filter((r) => r.index > index)) await db.setLogs.update(r.id, { index: r.index - 1 });
  });
}

export async function toggleWarmup(sessionId: number, slotId: string, done: boolean): Promise<void> {
  await db.warmupChecks.put({ id: `${sessionId}:${slotId}`, sessionId, slotId, done });
}

/** Finishes the session; incomplete rows are dropped so history only has real sets. */
export async function finishSession(sessionId: number, note: string): Promise<void> {
  await db.transaction('rw', db.sessions, db.setLogs, async () => {
    await db.setLogs.where({ sessionId }).filter((l) => !l.completed).delete();
    await db.sessions.update(sessionId, { status: 'finished', endedAt: Date.now(), note });
  });
}

export async function skipDay(dayId: string, variant: Variant): Promise<number> {
  const now = Date.now();
  return db.sessions.add({
    dayId,
    variant,
    startedAt: now,
    endedAt: now,
    status: 'skipped',
    note: '',
    overrides: {},
  } as never) as Promise<number>;
}

/** Deletes a session and everything logged in it. */
export async function deleteSession(sessionId: number): Promise<void> {
  await db.transaction('rw', db.sessions, db.setLogs, db.warmupChecks, async () => {
    await db.setLogs.where({ sessionId }).delete();
    await db.warmupChecks.where({ sessionId }).delete();
    await db.sessions.delete(sessionId);
  });
}

export async function updateSession(
  sessionId: number,
  patch: Partial<{ dayId: string; variant: Variant; note: string }>,
): Promise<void> {
  await db.sessions.update(sessionId, patch);
}

/** "Solo hoy": swap for this session. Incomplete rows of the old exercise are dropped. */
export async function setOverride(sessionId: number, slotId: string, exerciseId: string | null): Promise<void> {
  await db.transaction('rw', db.sessions, db.setLogs, async () => {
    const s = await db.sessions.get(sessionId);
    if (!s) return;
    const overrides = { ...s.overrides };
    if (exerciseId === null) delete overrides[slotId];
    else overrides[slotId] = exerciseId;
    await db.sessions.update(sessionId, { overrides });
    await db.setLogs
      .where({ sessionId })
      .filter((l) => l.slotId === slotId && !l.completed)
      .delete();
  });
}

/** "Dejarlo fijo": change the slot default in the routine. */
export async function fixSlotExercise(slotId: string, exerciseId: string, sessionId?: number): Promise<void> {
  await db.transaction('rw', db.slots, db.sessions, db.setLogs, async () => {
    const slot = await db.slots.get(slotId);
    if (!slot) return;
    await db.slots.put(fixSwap(slot, exerciseId));
    if (sessionId !== undefined) {
      const s = await db.sessions.get(sessionId);
      if (s && s.overrides[slotId]) {
        const overrides = { ...s.overrides };
        delete overrides[slotId];
        await db.sessions.update(sessionId, { overrides });
      }
      await db.setLogs
        .where({ sessionId })
        .filter((l) => l.slotId === slotId && !l.completed)
        .delete();
    }
  });
}

export async function updateExercise(id: string, patch: Partial<Exercise>): Promise<void> {
  await db.exercises.update(id, patch);
}

export async function wipeAll(): Promise<void> {
  await db.delete();
  await db.open();
}

// ---- Routine editing (Phase 1b) ----

export async function saveSlot(slot: Slot): Promise<void> {
  await db.slots.put(slot);
}

export async function deleteSlot(slotId: string): Promise<void> {
  // History keeps its slotId and exerciseId, so past sets stay in Progreso.
  await db.slots.delete(slotId);
}

export async function moveSlotInVariant(dayId: string, slotId: string, dir: -1 | 1, variant: Variant): Promise<void> {
  await db.transaction('rw', db.slots, async () => {
    const daySlots = await db.slots.where({ dayId }).toArray();
    const changed = moveSlot(daySlots, slotId, dir, variant);
    if (changed.length) await db.slots.bulkPut(changed);
  });
}

export async function copyVariantSlots(dayId: string, from: Variant, to: Variant): Promise<void> {
  await db.transaction('rw', db.slots, async () => {
    const all = await db.slots.toArray();
    const daySlots = all.filter((s) => s.dayId === dayId);
    const taken = [...all];
    const copies = copyVariant(daySlots, from, to, () => {
      const id = newSlotId(dayId, taken);
      taken.push({ ...daySlots[0], id });
      return id;
    });
    await db.slots.bulkAdd(copies);
  });
}

/** Creates a new catalog exercise (id from its name) or updates an existing one. */
export async function saveExercise(ex: Omit<Exercise, 'id'> & { id?: string }): Promise<string> {
  if (ex.id) {
    await db.exercises.put(ex as Exercise);
    return ex.id;
  }
  const ids = new Set((await db.exercises.toCollection().primaryKeys()) as string[]);
  const id = slugify(ex.name, ids);
  await db.exercises.add({ ...ex, id } as Exercise);
  return id;
}

export async function renameDay(dayId: string, name: string): Promise<void> {
  await db.days.update(dayId, { name });
}

/** Moves a day earlier/later in the cycle. */
export async function moveDay(dayId: string, dir: -1 | 1): Promise<void> {
  await db.transaction('rw', db.days, async () => {
    const days = await db.days.orderBy('order').toArray();
    const i = days.findIndex((d) => d.id === dayId);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= days.length) return;
    [days[i], days[j]] = [days[j], days[i]];
    await db.days.bulkPut(days.map((d, k) => ({ ...d, order: k })));
  });
}

// ---- History editing (Phase 2) ----

export async function updateSetLog(id: number, patch: Partial<Pick<SetLog, 'kg' | 'reps' | 'seconds'>>): Promise<void> {
  await db.setLogs.update(id, patch);
}

export async function deleteSetLog(id: number): Promise<void> {
  await db.setLogs.delete(id);
}
