import { DATA_TABLES, LATER_TABLES, type DataTable, type GymDB } from './db';
import { DEFAULT_SETTINGS } from './types';

// v2 added bodyWeights and measurements; v1 files import with those empty.
export const SCHEMA_VERSION = 2;
const MAX_AUTO_BACKUPS = 3;

export interface ExportFile {
  app: 'gym-tracker';
  schemaVersion: number;
  exportedAt: number;
  data: Record<DataTable, unknown[]>;
}

export async function exportData(db: GymDB, now = Date.now()): Promise<ExportFile> {
  const data = {} as Record<DataTable, unknown[]>;
  await db.transaction('r', DATA_TABLES.map((t) => db.table(t)), async () => {
    for (const t of DATA_TABLES) data[t] = await db.table(t).toArray();
  });
  return { app: 'gym-tracker', schemaVersion: SCHEMA_VERSION, exportedAt: now, data };
}

export class BackupError extends Error {}

/** Parses and validates a backup file. Throws BackupError with a user-facing message. */
export function parseBackup(json: string): ExportFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new BackupError('El archivo no es un JSON válido.');
  }
  const f = parsed as Partial<ExportFile>;
  if (!f || f.app !== 'gym-tracker' || typeof f.data !== 'object' || f.data === null) {
    throw new BackupError('Este archivo no es un respaldo de Gym Tracker.');
  }
  if (typeof f.schemaVersion !== 'number' || f.schemaVersion > SCHEMA_VERSION) {
    throw new BackupError('El respaldo es de una versión más nueva de la app. Actualiza la app primero.');
  }
  const data = f.data as Record<string, unknown>;
  for (const t of DATA_TABLES) {
    if (data[t] === undefined && LATER_TABLES.includes(t)) data[t] = [];
    if (!Array.isArray(data[t])) {
      throw new BackupError(`Al respaldo le falta la tabla "${t}".`);
    }
  }
  return f as ExportFile;
}

/** Replaces all data with the backup, saving an automatic copy of the current data first. */
export async function importData(db: GymDB, file: ExportFile, now = Date.now()): Promise<void> {
  const current = await exportData(db, now);
  await db.transaction('rw', [...DATA_TABLES.map((t) => db.table(t)), db.backups], async () => {
    await db.backups.add({ createdAt: now, reason: 'before_import', json: JSON.stringify(current) } as never);
    const old = await db.backups.orderBy('createdAt').reverse().offset(MAX_AUTO_BACKUPS).primaryKeys();
    await db.backups.bulkDelete(old);
    for (const t of DATA_TABLES) {
      await db.table(t).clear();
      await db.table(t).bulkAdd(file.data[t]);
    }
    if ((await db.settings.count()) === 0) await db.settings.add(DEFAULT_SETTINGS);
  });
}

export function backupFileName(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `gym-tracker-respaldo-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}.json`;
}

/** 14-day backup reminder: due when there is data and no export (or the last one) for 14+ days. */
export function backupReminderDue(
  settings: { lastExportAt: number | null; firstDataAt: number | null },
  now: number,
  days = 14,
): boolean {
  const anchor = settings.lastExportAt ?? settings.firstDataAt;
  if (anchor === null) return false;
  return now - anchor >= days * 24 * 60 * 60 * 1000;
}
