import { useEffect, useState } from 'react';
import { fmtClock, useRestTimer } from '../ui/RestTimer';

function Arrow({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={dir === 'left' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'} />
    </svg>
  );
}

/**
 * Bottom bar of the step flow: previous / next, and the rest timer in the middle
 * when it is running (one bar instead of two, to keep the screen roomy).
 */
export function StepBar({
  index,
  total,
  label,
  onPrev,
  onNext,
}: {
  index: number;
  total: number;
  label: string;
  onPrev: () => void;
  onNext: () => void;
}) {
  const { state, add, skip } = useRestTimer();
  const [, tick] = useState(0);
  useEffect(() => {
    if (!state) return;
    const id = window.setInterval(() => tick((n) => n + 1), 250);
    return () => window.clearInterval(id);
  }, [state]);

  const left = state ? (state.endsAt - Date.now()) / 1000 : 0;
  const pct = state ? Math.min(100, Math.max(0, (1 - left / state.total) * 100)) : (index / Math.max(1, total - 1)) * 100;

  return (
    <div className={`step-bar${state ? ' resting' : ''}`}>
      <div className="step-progress" style={{ width: `${pct}%` }} />
      <div className="step-bar-row">
        <button className="nav-arrow" onClick={onPrev} disabled={index === 0} aria-label="Paso anterior">
          <Arrow dir="left" />
        </button>
        {state ? (
          <div className="rest-inline" role="timer" aria-live="off">
            <div className="rest-inline-time">
              <span className="rest-time">{fmtClock(left)}</span>
              <span className="rest-label">descanso</span>
            </div>
            <button className="btn secondary small" onClick={() => add(15)}>
              +15 s
            </button>
            <button className="btn secondary small" onClick={skip}>
              Saltar
            </button>
          </div>
        ) : (
          <div className="step-count">
            <strong>
              {index + 1} / {total}
            </strong>
            <span>{label}</span>
          </div>
        )}
        <button className="nav-arrow" onClick={onNext} disabled={index === total - 1} aria-label="Paso siguiente">
          <Arrow dir="right" />
        </button>
      </div>
    </div>
  );
}
