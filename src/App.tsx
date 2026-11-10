import { useLiveQuery } from 'dexie-react-hooks';
import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { db, isDemo } from './data/db';
import { exitDemo } from './data/demo';
import type { Variant } from './data/types';
import { Today } from './screens/Today';
import { ErrorBoundary } from './ui/ErrorBoundary';
import { IconBody, IconClose, IconHistory, IconProgress, IconRoutine, IconSettings, IconToday } from './ui/icons';
import { RestTimerBar, RestTimerProvider } from './ui/RestTimer';

// Hoy loads first; the other tabs are separate chunks (all precached, so offline still works).
const Routine = lazy(() => import('./screens/Routine').then((m) => ({ default: m.Routine })));
const Progress = lazy(() => import('./screens/Progress').then((m) => ({ default: m.Progress })));
const History = lazy(() => import('./screens/History').then((m) => ({ default: m.History })));
const Body = lazy(() => import('./screens/Body').then((m) => ({ default: m.Body })));
const SettingsScreen = lazy(() => import('./screens/SettingsScreen').then((m) => ({ default: m.SettingsScreen })));

type Tab = 'today' | 'routine' | 'progress' | 'history' | 'body';

const TABS: { id: Tab; label: string; icon: ReactNode }[] = [
  { id: 'today', label: 'Hoy', icon: <IconToday /> },
  { id: 'routine', label: 'Rutina', icon: <IconRoutine /> },
  { id: 'progress', label: 'Progreso', icon: <IconProgress /> },
  { id: 'history', label: 'Historial', icon: <IconHistory /> },
  { id: 'body', label: 'Cuerpo', icon: <IconBody /> },
];

/** Shows a banner when a database write fails (e.g. storage full) instead of failing silently. */
function useSaveErrors(): [string | null, () => void] {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    const onReject = (e: PromiseRejectionEvent) => {
      const err = e.reason as { name?: string; message?: string } | undefined;
      if (err?.name === 'AbortError') return;
      const quota = err?.name === 'QuotaExceededError' || /quota/i.test(err?.message ?? '');
      setMsg(quota ? 'No hay espacio para guardar. Libera espacio en el celular y descarga un respaldo.' : `No se pudo guardar: ${err?.message ?? 'error desconocido'}`);
    };
    window.addEventListener('unhandledrejection', onReject);
    return () => window.removeEventListener('unhandledrejection', onReject);
  }, []);
  return [msg, () => setMsg(null)];
}

export default function App() {
  const [tab, setTab] = useState<Tab>('today');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [routineTarget, setRoutineTarget] = useState<{ dayId: string; variant: Variant } | null>(null);
  const [saveError, clearSaveError] = useSaveErrors();
  const theme = useLiveQuery(() => db.settings.get('settings').then((s) => s?.theme ?? 'dark'));
  const inProgress = useLiveQuery(() => db.sessions.where('status').equals('in_progress').count());
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  useEffect(() => {
    const t = theme ?? 'dark';
    document.documentElement.dataset.theme = t;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'light' ? '#f5f6f8' : '#121417');
  }, [theme]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [tab, settingsOpen]);

  const go = (t: Tab) => {
    setSettingsOpen(false);
    setTab(t);
  };

  return (
    <RestTimerProvider>
      <div className="shell">
        <header className="topbar">
          <h1>{settingsOpen ? 'Gym Tracker' : TABS.find((t) => t.id === tab)!.label}</h1>
          <button
            className="icon-btn"
            onClick={() => setSettingsOpen(!settingsOpen)}
            aria-label={settingsOpen ? 'Cerrar ajustes' : 'Ajustes'}
          >
            {settingsOpen ? <IconClose /> : <IconSettings />}
          </button>
        </header>

        {isDemo() && (
          <div className="demo-banner" role="status">
            <span>Datos de demostración. Tus datos reales no se tocan.</span>
            <button className="btn small" onClick={() => exitDemo()}>
              Salir
            </button>
          </div>
        )}

        {saveError && (
          <div className="banner warn" role="alert">
            <span>{saveError}</span>
            <button className="btn secondary small" onClick={clearSaveError}>
              Cerrar
            </button>
          </div>
        )}

        {needRefresh && !inProgress && (
          <div className="banner">
            <span>Hay una versión nueva.</span>
            <button className="btn primary small" onClick={() => updateServiceWorker(true)}>
              Actualizar
            </button>
          </div>
        )}

        <main className="content">
          <ErrorBoundary key={settingsOpen ? 'settings' : tab}>
            <Suspense fallback={<p className="muted center">Cargando…</p>}>
              {settingsOpen ? (
                <SettingsScreen />
              ) : tab === 'today' ? (
                <Today
                  onDefineVariant={(dayId, variant) => {
                    setRoutineTarget({ dayId, variant });
                    go('routine');
                  }}
                />
              ) : tab === 'routine' ? (
                <Routine key={routineTarget ? `${routineTarget.dayId}-${routineTarget.variant}` : 'r'} initial={routineTarget} />
              ) : tab === 'progress' ? (
                <Progress />
              ) : tab === 'history' ? (
                <History />
              ) : (
                <Body />
              )}
            </Suspense>
          </ErrorBoundary>
        </main>

        {/* On Hoy the timer lives inside the step bar. */}
        {(settingsOpen || tab !== 'today') && <RestTimerBar />}
        <nav className="tabbar" aria-label="Secciones">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={!settingsOpen && tab === t.id ? 'on' : ''}
              aria-current={!settingsOpen && tab === t.id ? 'page' : undefined}
              onClick={() => {
                if (t.id === 'routine') setRoutineTarget(null);
                go(t.id);
              }}
            >
              {t.icon}
              <span>{t.label}</span>
            </button>
          ))}
        </nav>
      </div>
    </RestTimerProvider>
  );
}
