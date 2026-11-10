import { useCallback, useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { db, type TestSet } from './db';
import { parseDecimal } from './number';
import { getPersistState, getUsage, requestPersist, type PersistState } from './storage';

const PERSIST_LABEL: Record<PersistState, string> = {
  granted: 'Concedido',
  'not-granted': 'No concedido',
  unsupported: 'No soportado',
};

const dateFmt = new Intl.DateTimeFormat('es-MX', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches;
}

export default function App() {
  const [sets, setSets] = useState<TestSet[]>([]);
  const [kg, setKg] = useState('60');
  const [reps, setReps] = useState('8');
  const [persist, setPersist] = useState<PersistState | null>(null);
  const [usage, setUsage] = useState<{ usage: number; quota: number } | null>(null);
  const [online, setOnline] = useState(navigator.onLine);
  const [confirmClear, setConfirmClear] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    offlineReady: [offlineReady],
  } = useRegisterSW();
  // offlineReady only fires on first install; afterwards an active controller means cached.
  const swActive = !!navigator.serviceWorker?.controller;

  const refresh = useCallback(async () => {
    setSets(await db.testSets.orderBy('at').reverse().toArray());
    setPersist(await getPersistState());
    setUsage(await getUsage());
  }, []);

  useEffect(() => {
    refresh().catch((e) => setError(String(e)));
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, [refresh]);

  const kgNum = parseDecimal(kg);
  const repsNum = parseDecimal(reps);
  const valid = kgNum !== null && repsNum !== null && Number.isInteger(repsNum) && repsNum > 0;

  async function addSet() {
    if (!valid) return;
    try {
      const isFirst = (await db.testSets.count()) === 0;
      await db.testSets.add({ kg: kgNum!, reps: repsNum!, at: Date.now() } as TestSet);
      if (isFirst || persist !== 'granted') await requestPersist();
      await refresh();
      setError(null);
    } catch (e) {
      setError(`No se pudo guardar: ${String(e)}`);
    }
  }

  async function clearAll() {
    await db.testSets.clear();
    setConfirmClear(false);
    await refresh();
  }

  return (
    <div className="app">
      <header className="header">
        <h1>Gym Tracker</h1>
        <span className="badge">Fase 0 · prueba de guardado</span>
      </header>

      <section className="card status" aria-label="Estado">
        <StatusRow
          label="Almacenamiento persistente"
          value={persist ? PERSIST_LABEL[persist] : '...'}
          tone={persist === 'granted' ? 'ok' : persist === 'not-granted' ? 'warn' : 'muted'}
        />
        <StatusRow
          label="Listo sin conexión"
          value={offlineReady || swActive ? 'Sí' : 'Aún no'}
          tone={offlineReady || swActive ? 'ok' : 'muted'}
        />
        <StatusRow label="Abierta como" value={isStandalone() ? 'App instalada' : 'Pestaña de Chrome'} tone="muted" />
        <StatusRow label="Red" value={online ? 'Con conexión' : 'Sin conexión'} tone="muted" />
        {usage && (
          <StatusRow
            label="Espacio usado"
            value={`${(usage.usage / 1024).toFixed(0)} KB de ${(usage.quota / 1024 / 1024 / 1024).toFixed(1)} GB`}
            tone="muted"
          />
        )}
        {persist === 'not-granted' && (
          <button className="btn secondary" onClick={() => requestPersist().then(refresh)}>
            Pedir almacenamiento persistente
          </button>
        )}
      </section>

      <section className="card" aria-label="Nueva serie">
        <div className="inputs">
          <label>
            <span>kg</span>
            <input
              inputMode="decimal"
              value={kg}
              onChange={(e) => setKg(e.target.value)}
              onFocus={(e) => e.target.select()}
              aria-invalid={kgNum === null}
            />
          </label>
          <label>
            <span>reps</span>
            <input
              inputMode="numeric"
              value={reps}
              onChange={(e) => setReps(e.target.value)}
              onFocus={(e) => e.target.select()}
              aria-invalid={!valid && repsNum !== null}
            />
          </label>
        </div>
        <button className="btn primary" onClick={addSet} disabled={!valid}>
          + serie de prueba
        </button>
        {error && <p className="error">{error}</p>}
      </section>

      <section className="card" aria-label="Series guardadas">
        <h2>Series guardadas ({sets.length})</h2>
        {sets.length === 0 ? (
          <p className="muted">Todavía no hay series. Guarda 3 para hacer la prueba.</p>
        ) : (
          <ol className="list">
            {sets.map((s) => (
              <li key={s.id}>
                <span className="set">
                  {s.kg} kg × {s.reps}
                </span>
                <span className="muted">{dateFmt.format(s.at)}</span>
              </li>
            ))}
          </ol>
        )}
        {sets.length > 0 &&
          (confirmClear ? (
            <div className="confirm">
              <p>¿Borrar las {sets.length} series de prueba? No se puede deshacer.</p>
              <div className="row">
                <button className="btn danger" onClick={clearAll}>
                  Sí, borrar
                </button>
                <button className="btn secondary" onClick={() => setConfirmClear(false)}>
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button className="btn secondary" onClick={() => setConfirmClear(true)}>
              Borrar series de prueba
            </button>
          ))}
      </section>

      <footer className="muted footer">Versión {__BUILD_TIME__.slice(0, 16).replace('T', ' ')} UTC</footer>
    </div>
  );
}

function StatusRow({ label, value, tone }: { label: string; value: string; tone: 'ok' | 'warn' | 'muted' }) {
  return (
    <div className="status-row">
      <span>{label}</span>
      <span className={`pill ${tone}`}>{value}</span>
    </div>
  );
}
