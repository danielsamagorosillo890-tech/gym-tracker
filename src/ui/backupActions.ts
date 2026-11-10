import { updateSettings } from '../data/actions';
import { backupFileName, exportData } from '../data/backup';
import { db } from '../data/db';

async function backupBlob(): Promise<{ blob: Blob; name: string }> {
  const file = await exportData(db);
  return { blob: new Blob([JSON.stringify(file)], { type: 'application/json' }), name: backupFileName() };
}

/** Downloads the JSON backup and records the export time. */
export async function downloadBackup(): Promise<void> {
  const { blob, name } = await backupBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  await updateSettings({ lastExportAt: Date.now() });
}

export function canShareFiles(): boolean {
  try {
    const f = new File(['{}'], 'x.json', { type: 'application/json' });
    return !!navigator.canShare?.({ files: [f] });
  } catch {
    return false;
  }
}

/** Opens the Android share sheet (Drive, WhatsApp, correo…). Returns false if cancelled. */
export async function shareBackup(): Promise<boolean> {
  const { blob, name } = await backupBlob();
  const file = new File([blob], name, { type: 'application/json' });
  try {
    await navigator.share({ files: [file], title: 'Respaldo Gym Tracker' });
    await updateSettings({ lastExportAt: Date.now() });
    return true;
  } catch {
    return false;
  }
}
