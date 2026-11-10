import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { getSettings, updateSettings } from '../data/actions';

interface TimerState {
  endsAt: number;
  total: number;
  label: string;
}

interface RestTimerApi {
  state: TimerState | null;
  start: (seconds: number, label: string) => void;
  add: (seconds: number) => void;
  skip: () => void;
}

const Ctx = createContext<RestTimerApi | null>(null);
const KEY = 'gym-rest-timer';

function load(): TimerState | null {
  try {
    const raw = localStorage.getItem(KEY);
    const s = raw ? (JSON.parse(raw) as TimerState) : null;
    return s && s.endsAt > Date.now() ? s : null;
  } catch {
    return null;
  }
}

function save(s: TimerState | null) {
  try {
    if (s) localStorage.setItem(KEY, JSON.stringify(s));
    else localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable: timer still works in memory */
  }
}

/** Asks for notification permission once, the first time a rest starts. */
async function maybeAskNotifications() {
  if (!('Notification' in window) || Notification.permission !== 'default') return;
  const s = await getSettings();
  if (s.notificationsAsked) return;
  await updateSettings({ notificationsAsked: true });
  try {
    await Notification.requestPermission();
  } catch {
    /* ignored */
  }
}

async function notifyDone(label: string) {
  try {
    navigator.vibrate?.([250, 120, 250]);
  } catch {
    /* ignored */
  }
  if (document.visibilityState === 'visible') return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    const opts = { body: label ? `Siguiente: ${label}` : 'A la siguiente serie', tag: 'rest', renotify: true };
    if (reg) await reg.showNotification('Descanso terminado', opts as NotificationOptions);
    else new Notification('Descanso terminado', opts as NotificationOptions);
  } catch {
    /* ignored */
  }
}

export function RestTimerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TimerState | null>(load);
  const timeout = useRef<number | undefined>(undefined);

  const set = useCallback((s: TimerState | null) => {
    save(s);
    setState(s);
  }, []);

  // Fire once at the end. Computed from timestamps, so throttled tabs catch up on return.
  useEffect(() => {
    window.clearTimeout(timeout.current);
    if (!state) return;
    const ms = state.endsAt - Date.now();
    timeout.current = window.setTimeout(() => {
      notifyDone(state.label);
      set(null);
    }, Math.max(0, ms));
    return () => window.clearTimeout(timeout.current);
  }, [state, set]);

  const api: RestTimerApi = {
    state,
    start: (seconds, label) => {
      set({ endsAt: Date.now() + seconds * 1000, total: seconds, label });
      maybeAskNotifications();
    },
    add: (seconds) => state && set({ ...state, endsAt: state.endsAt + seconds * 1000, total: state.total + seconds }),
    skip: () => set(null),
  };
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useRestTimer(): RestTimerApi {
  const c = useContext(Ctx);
  if (!c) throw new Error('RestTimerProvider missing');
  return c;
}

export function fmtClock(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Fixed bar above the bottom nav. */
export function RestTimerBar() {
  const { state, add, skip } = useRestTimer();
  const [, tick] = useState(0);
  useEffect(() => {
    if (!state) return;
    const id = window.setInterval(() => tick((n) => n + 1), 250);
    return () => window.clearInterval(id);
  }, [state]);
  if (!state) return null;
  const left = (state.endsAt - Date.now()) / 1000;
  const pct = Math.min(100, Math.max(0, (1 - left / state.total) * 100));
  return (
    <div className="rest-bar" role="timer" aria-live="off">
      <div className="rest-progress" style={{ width: `${pct}%` }} />
      <div className="rest-content">
        <div>
          <div className="rest-time">{fmtClock(left)}</div>
          <div className="rest-label">Descanso{state.label ? ` · sigue ${state.label}` : ''}</div>
        </div>
        <button className="btn secondary small" onClick={() => add(15)}>
          +15 s
        </button>
        <button className="btn secondary small" onClick={skip}>
          Saltar
        </button>
      </div>
    </div>
  );
}
