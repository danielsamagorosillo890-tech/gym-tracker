import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState } from 'react';
import { endDeload, startDeload, updateSettings, wipeAll } from '../data/actions';
import { BackupError, importData, parseBackup } from '../data/backup';
import { db, isDemo } from '../data/db';
import { enterDemo, exitDemo } from '../data/demo';
import { parseDecimal } from '../logic/number';
import { getPersistState, requestPersist, type PersistState } from '../storage';
import { canShareFiles, downloadBackup, exportCsv, shareBackup } from '../ui/backupActions';
import { bodyCsv, localDate, setsCsv } from '../logic/csv';
import { ConfirmInline } from '../ui/Sheet';

const deloadFmt = new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
const dateFmt = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const PERSIST: Record<PersistState, string> = {
  granted: 'Concedido',
  'not-granted': 'No concedido',
  unsupported: 'No soportado',
};

export function SettingsScreen() {
  const settings = useLiveQuery(() => db.settings.get('settings'));
  const backups = useLiveQuery(() => db.backups.orderBy('createdAt').reverse().toArray());
  const [persist, setPersist] = useState<PersistState | null>(null);
  const [pendingImport, setPendingImport] = useState<{ name: string; json: string } | null>(null);
  const [restoreId, setRestoreId] = useState<number | null>(null);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [wipeStep, setWipeStep] = useState(0);
  const [demoStep, setDemoStep] = useState(false);
  const deloadOn = !!settings?.deloadUntil && settings.deloadUntil > Date.now();

  const csv = async (kind: 'series' | 'cuerpo', share: boolean) => {
    const stamp = localDate(Date.now());
    const text =
      kind === 'series'
        ? setsCsv(
            await db.sessions.toArray(),
            await db.setLogs.toArray(),
            new Map((await db.exercises.toArray()).map((e) => [e.id, e])),
            await db.days.toArray(),
          )
        : bodyCsv(await db.bodyWeights.toArray(), await db.measurements.toArray());
    await exportCsv(`gym-tracker-${kind}-${stamp}.csv`, text, share);
  };
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getPersistState().then(setPersist);
  }, []);

  if (!settings) return null;

  const restInput = (key: 'restCompoundSec' | 'restIsolationSec', label: string) => (
    <label className="field inline">
      <span>{label}</span>
      <input
        className="num small"
        inputMode="numeric"
        defaultValue={settings[key]}
        onChange={(e) => {
          const n = parseDecimal(e.target.value);
          if (n !== null && Number.isInteger(n) && n > 0) updateSettings({ [key]: n });
        }}
      />
    </label>
  );

  const doImport = async (json: string) => {
    try {
      await importData(db, parseBackup(json));
      setMessage({ text: 'Datos importados. Se guardó una copia automática de lo anterior.' });
    } catch (e) {
      setMessage({ text: e instanceof BackupError ? e.message : `No se pudo importar: ${String(e)}`, error: true });
    }
    setPendingImport(null);
    setRestoreId(null);
  };

  return (
    <div className="screen">
      <h2 className="screen-title">Ajustes</h2>

      <section className="card">
        <h3>Tema</h3>
        <div className="segmented">
          {(['dark', 'light'] as const).map((t) => (
            <button key={t} className={settings.theme === t ? 'on' : ''} aria-pressed={settings.theme === t} onClick={() => updateSettings({ theme: t })}>
              {t === 'dark' ? 'Oscuro' : 'Claro'}
            </button>
          ))}
        </div>
      </section>

      <section className="card">
        <h3>Descanso por defecto (segundos)</h3>
        {restInput('restCompoundSec', 'Compuestos')}
        {restInput('restIsolationSec', 'Aislamiento')}
        <small className="muted">Cada ejercicio puede tener el suyo desde su menú.</small>
      </section>

      <section className="card">
        <h3>Respaldo</h3>
        <p className="muted">
          Tus datos viven solo en este celular. Último respaldo:{' '}
          {settings.lastExportAt ? dateFmt.format(settings.lastExportAt) : 'nunca'}.
        </p>
        <button className="btn primary" onClick={() => downloadBackup().then(() => setMessage({ text: 'Respaldo descargado.' }))}>
          Descargar respaldo (JSON)
        </button>
        {canShareFiles() && (
          <button className="btn secondary" onClick={() => shareBackup().then((ok) => ok && setMessage({ text: 'Respaldo compartido.' }))}>
            Compartir respaldo (Drive, correo…)
          </button>
        )}
        <button className="btn secondary" onClick={() => fileRef.current?.click()}>
          Importar respaldo
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) setPendingImport({ name: f.name, json: await f.text() });
          }}
        />
        {pendingImport && (
          <ConfirmInline
            message={`¿Reemplazar todos tus datos con "${pendingImport.name}"? Antes se guarda una copia automática de lo actual.`}
            confirmLabel="Importar"
            onConfirm={() => doImport(pendingImport.json)}
            onCancel={() => setPendingImport(null)}
          />
        )}
        {backups && backups.length > 0 && (
          <>
            <h4 className="list-title">Copias automáticas (antes de importar)</h4>
            {backups.map((b) => (
              <div key={b.id}>
                <button className="list-item" onClick={() => setRestoreId(b.id)}>
                  Restaurar copia del {dateFmt.format(b.createdAt)}
                </button>
                {restoreId === b.id && (
                  <ConfirmInline
                    message="¿Volver a los datos de esa copia? Lo actual también se guarda como copia."
                    confirmLabel="Restaurar"
                    onConfirm={() => doImport(b.json)}
                    onCancel={() => setRestoreId(null)}
                  />
                )}
              </div>
            ))}
          </>
        )}
        {message && <p className={message.error ? 'error' : 'ok-text'}>{message.text}</p>}
      </section>

      <section className="card">
        <h3>Almacenamiento</h3>
        <div className="status-row">
          <span>Almacenamiento persistente</span>
          <span className={`pill ${persist === 'granted' ? 'ok' : persist === 'not-granted' ? 'warn' : ''}`}>
            {persist ? PERSIST[persist] : '…'}
          </span>
        </div>
        {persist === 'not-granted' && (
          <>
            <small className="muted">Chrome lo concede según el uso. El respaldo es tu protección real.</small>
            <button className="btn secondary" onClick={() => requestPersist().then(setPersist)}>
              Pedirlo otra vez
            </button>
          </>
        )}
      </section>

      <section className="card">
        <h3>Semana de descarga</h3>
        {deloadOn ? (
          <>
            <p className="muted">
              Activa hasta el {deloadFmt.format(settings.deloadUntil!)}. En Hoy verás la mitad de series y alrededor de 60% del peso. Estas
              sesiones no cuentan para el pre-llenado, las gráficas ni los PRs.
            </p>
            <button className="btn secondary" onClick={() => endDeload()}>
              Terminar descarga
            </button>
          </>
        ) : (
          <>
            <p className="muted">
              Una semana más ligera para recuperarte. Al terminarla, la app vuelve a tus pesos de antes.
            </p>
            <button className="btn secondary" onClick={() => startDeload()}>
              Empezar semana de descarga
            </button>
          </>
        )}
      </section>

      <section className="card">
        <h3>Exportar CSV</h3>
        <p className="muted">Para abrir en Excel o Google Sheets. Peso siempre en kg.</p>
        <div className="row">
          <button className="btn secondary" onClick={() => csv('series', false)}>
            Series
          </button>
          <button className="btn secondary" onClick={() => csv('cuerpo', false)}>
            Cuerpo
          </button>
        </div>
        {canShareFiles() && (
          <div className="row">
            <button className="btn secondary small" onClick={() => csv('series', true)}>
              Compartir series
            </button>
            <button className="btn secondary small" onClick={() => csv('cuerpo', true)}>
              Compartir cuerpo
            </button>
          </div>
        )}
      </section>

      <section className="card">
        <h3>Modo demo</h3>
        {isDemo() ? (
          <>
            <p className="muted">Estás viendo datos de demostración. Al salir se borran y vuelves a tus datos reales.</p>
            <button className="btn primary" onClick={() => exitDemo()}>
              Salir del modo demo
            </button>
          </>
        ) : (
          <>
            <p className="muted">
              Genera 12 semanas de entrenamientos ficticios con tu rutina actual, en una base de datos aparte, para ver cómo
              se ven las gráficas. Tus datos reales no se tocan.
            </p>
            {demoStep ? (
              <ConfirmInline
                message="¿Entrar al modo demo? La app se recarga con datos ficticios y un aviso arriba para salir."
                confirmLabel="Entrar"
                onConfirm={() => {
                  setDemoStep(false);
                  enterDemo();
                }}
                onCancel={() => setDemoStep(false)}
              />
            ) : (
              <button className="btn secondary" onClick={() => setDemoStep(true)}>
                Probar con datos de demostración
              </button>
            )}
          </>
        )}
      </section>

      <section className="card">
        <h3>Borrar todo</h3>
        {wipeStep === 0 && (
          <button className="btn secondary" onClick={() => setWipeStep(1)}>
            Borrar todos mis datos
          </button>
        )}
        {wipeStep === 1 && (
          <ConfirmInline
            message="Se borran sesiones, series, cambios a la rutina y ajustes. ¿Seguro?"
            confirmLabel="Sí, continuar"
            onConfirm={() => setWipeStep(2)}
            onCancel={() => setWipeStep(0)}
          />
        )}
        {wipeStep === 2 && (
          <ConfirmInline
            message="Última confirmación: esto no se puede deshacer. Descarga un respaldo antes si lo necesitas."
            confirmLabel="Borrar todo"
            onConfirm={async () => {
              await wipeAll();
              location.reload();
            }}
            onCancel={() => setWipeStep(0)}
          />
        )}
      </section>

      <p className="muted center">Versión {__BUILD_TIME__.slice(0, 16).replace('T', ' ')} UTC</p>
    </div>
  );
}
