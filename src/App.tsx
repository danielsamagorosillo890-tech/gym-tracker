import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState, type ReactNode } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { db } from './data/db';
import { Routine } from './screens/Routine';
import { SettingsScreen } from './screens/SettingsScreen';
import { Today } from './screens/Today';
import { IconBody, IconClose, IconHistory, IconProgress, IconRoutine, IconSettings, IconToday } from './ui/icons';
import { RestTimerBar, RestTimerProvider } from './ui/RestTimer';

type Tab = 'today' | 'routine' | 'progress' | 'history' | 'body';

const TABS: { id: Tab; label: string; icon: ReactNode }[] = [
  { id: 'today', label: 'Hoy', icon: <IconToday /> },
  { id: 'routine', label: 'Rutina', icon: <IconRoutine /> },
  { id: 'progress', label: 'Progreso', icon: <IconProgress /> },
  { id: 'history', label: 'Historial', icon: <IconHistory /> },
  { id: 'body', label: 'Cuerpo', icon: <IconBody /> },
];

function Placeholder({ title, phase, text }: { title: string; phase: string; text: string }) {
  return (
    <div className="screen">
      <h2 className="screen-title">{title}</h2>
      <section className="card empty">
        <p>{text}</p>
        <p className="muted">Llega en la {phase}.</p>
      </section>
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState<Tab>('today');
  const [settingsOpen, setSettingsOpen] = useState(false);
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

        {needRefresh && !inProgress && (
          <div className="banner">
            <span>Hay una versión nueva.</span>
            <button className="btn primary small" onClick={() => updateServiceWorker(true)}>
              Actualizar
            </button>
          </div>
        )}

        <main className="content">
          {settingsOpen ? (
            <SettingsScreen />
          ) : tab === 'today' ? (
            <Today />
          ) : tab === 'routine' ? (
            <Routine />
          ) : tab === 'progress' ? (
            <Placeholder
              title="Progreso"
              phase="Fase 2"
              text="Gráficas por ejercicio (mejor serie y 1RM estimado), récords y volumen semanal por grupo muscular."
            />
          ) : tab === 'history' ? (
            <Placeholder title="Historial" phase="Fase 2" text="Lista de sesiones por fecha, con detalle editable." />
          ) : (
            <Placeholder title="Cuerpo" phase="Fase 4" text="Peso corporal y medidas con su gráfica." />
          )}
        </main>

        <RestTimerBar />
        <nav className="tabbar" aria-label="Secciones">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={!settingsOpen && tab === t.id ? 'on' : ''}
              aria-current={!settingsOpen && tab === t.id ? 'page' : undefined}
              onClick={() => {
                setSettingsOpen(false);
                setTab(t.id);
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
