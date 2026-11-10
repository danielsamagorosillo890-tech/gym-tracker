import type { Day, Exercise, Session, SetLog, Slot, Variant } from '../data/types';
import { effectiveVariant, slotsForVariant } from './variant';

/** Small deterministic PRNG (mulberry32) so demo data is reproducible. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function startKg(ex: Exercise, repMin: number): number {
  const f = repMin >= 13 ? 0.7 : 1;
  return Math.round(baseKg(ex) * f);
}

function baseKg(ex: Exercise): number {
  const compound = ex.type === 'compound';
  if (ex.weightBasis === 'dumbbell') return compound ? 20 : 10;
  if (ex.weightBasis === 'stack') return compound ? 45 : 20;
  return compound ? 60 : 25;
}

/**
 * 12 weeks of synthetic history following the real cycle, A/B parity and double
 * progression, with occasional bad days. Session and log ids are assigned here.
 */
export function generateDemo(args: {
  days: Day[];
  slots: Slot[];
  exercises: Map<string, Exercise>;
  now: number;
  weeks?: number;
  seed?: number;
}): { sessions: Session[]; logs: SetLog[] } {
  const { days, slots, exercises, now, weeks = 12, seed = 7 } = args;
  const rand = rng(seed);
  const ordered = [...days].sort((a, b) => a.order - b.order);
  const sessions: Session[] = [];
  const logs: SetLog[] = [];
  const state = new Map<string, { kg: number; reps: number }>(); // per slot
  const doneByDay = new Map<string, number>();
  const start = now - weeks * 7 * 86_400_000;
  let t = start;
  let dayIdx = 0;
  let logId = 1;

  while (t < now - 86_400_000) {
    const day = ordered[dayIdx % ordered.length];
    dayIdx++;
    const date = new Date(t);
    date.setHours(18, Math.floor(rand() * 50), 0, 0);
    const startedAt = date.getTime();
    const n = doneByDay.get(day.id) ?? 0;
    const variant: Variant = n % 2 === 0 ? 'A' : 'B';
    const daySlots = slots.filter((s) => s.dayId === day.id);
    const eff = effectiveVariant(daySlots, variant).variant;
    const work = slotsForVariant(daySlots, eff).filter((s) => s.block === 'work');
    const id = sessions.length + 1;
    const badDay = rand() < 0.12;
    let minute = 8;

    for (const slot of work) {
      const ex = exercises.get(slot.exerciseId);
      if (!ex || ex.metric === 'check') continue;
      const st = state.get(slot.id) ?? { kg: startKg(ex, slot.repMin ?? 8), reps: slot.repMin ?? 8 };
      const repMin = slot.repMin ?? 8;
      const repMax = slot.repMax ?? repMin;
      const results: number[] = [];
      for (let i = 0; i < slot.sets; i++) {
        minute += 3;
        const fatigue = i > 0 && rand() < 0.35 ? 1 : 0;
        const reps = Math.max(1, st.reps - fatigue - (badDay ? 2 : 0));
        results.push(reps);
        logs.push({
          id: logId++,
          sessionId: id,
          slotId: slot.id,
          exerciseId: ex.id,
          index: i,
          kind: 'work',
          kg: st.kg,
          reps: ex.metric === 'time_weight' ? null : reps,
          seconds: ex.metric === 'time_weight' ? Math.min(slot.seconds ?? 60, (slot.seconds ?? 60) - (badDay ? 20 : 0)) : null,
          completed: true,
          at: startedAt + minute * 60_000,
        });
      }
      // Double progression for the next time.
      if (ex.metric === 'time_weight') {
        if (!badDay) st.kg += ex.step;
      } else if (results.every((r) => r >= repMax)) {
        st.kg = Math.round((st.kg + ex.step) * 100) / 100;
        st.reps = repMin;
      } else if (!badDay) {
        st.reps = Math.min(repMax, st.reps + 1);
      }
      state.set(slot.id, st);
    }

    sessions.push({
      id,
      dayId: day.id,
      variant,
      startedAt,
      endedAt: startedAt + (minute + 5) * 60_000,
      status: 'finished',
      note: badDay ? 'Día pesado, poca energía.' : '',
      overrides: {},
    });
    doneByDay.set(day.id, n + 1);
    // Next session in 1–3 days (mostly 1–2).
    t = startedAt + (rand() < 0.75 ? 1 : rand() < 0.7 ? 2 : 3) * 86_400_000;
  }
  return { sessions, logs };
}
