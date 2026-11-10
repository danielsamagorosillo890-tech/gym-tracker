export type PersistState = 'granted' | 'not-granted' | 'unsupported';

export async function getPersistState(): Promise<PersistState> {
  if (!navigator.storage?.persisted) return 'unsupported';
  return (await navigator.storage.persisted()) ? 'granted' : 'not-granted';
}

/** Asks the browser to protect our data from eviction. Safe to call repeatedly. */
export async function requestPersist(): Promise<PersistState> {
  if (!navigator.storage?.persist) return 'unsupported';
  return (await navigator.storage.persist()) ? 'granted' : 'not-granted';
}

export async function getUsage(): Promise<{ usage: number; quota: number } | null> {
  if (!navigator.storage?.estimate) return null;
  const { usage = 0, quota = 0 } = await navigator.storage.estimate();
  return { usage, quota };
}
