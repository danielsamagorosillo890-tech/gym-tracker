import { useState } from 'react';
import { fixSlotExercise, setOverride, updateExercise } from '../data/actions';
import { MUSCLE_GROUPS, type Exercise, type Session, type Slot } from '../data/types';
import { parseDecimal } from '../logic/number';
import { fmtNum } from '../logic/units';
import { Sheet } from '../ui/Sheet';

type View = 'menu' | 'swap' | 'notes' | 'settings';

export function ExerciseMenu({
  slot,
  exercise,
  exercises,
  session,
  ensureSession,
  onClose,
}: {
  slot: Slot;
  exercise: Exercise;
  exercises: Map<string, Exercise>;
  session: Session | null;
  ensureSession: () => Promise<number>;
  onClose: () => void;
}) {
  const [view, setView] = useState<View>('menu');

  if (view === 'swap')
    return <SwapSheet slot={slot} current={exercise} exercises={exercises} session={session} ensureSession={ensureSession} onClose={onClose} />;
  if (view === 'notes') return <NotesSheet exercise={exercise} onClose={onClose} />;
  if (view === 'settings') return <ExerciseSettingsSheet exercise={exercise} onClose={onClose} />;

  return (
    <Sheet title={exercise.name} onClose={onClose}>
      <div className="menu-list">
        <button className="btn secondary" onClick={() => setView('swap')}>
          Cambiar ejercicio
        </button>
        <button className="btn secondary" onClick={() => setView('notes')}>
          Notas y ajustes de máquina
        </button>
        <button className="btn secondary" onClick={() => setView('settings')}>
          Unidad, paso y descanso
        </button>
      </div>
    </Sheet>
  );
}

function SwapSheet({
  slot,
  current,
  exercises,
  session,
  ensureSession,
  onClose,
}: {
  slot: Slot;
  current: Exercise;
  exercises: Map<string, Exercise>;
  session: Session | null;
  ensureSession: () => Promise<number>;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<Exercise | null>(null);
  const isWarmup = slot.block === 'warmup';
  const all = [...exercises.values()].filter((e) => (isWarmup ? e.group === null : e.group !== null) && e.id !== current.id);
  const alternatives = slot.alternatives.map((id) => exercises.get(id)).filter((e): e is Exercise => !!e && e.id !== current.id);
  const q = query.trim().toLowerCase();
  const filtered = all.filter((e) => !q || e.name.toLowerCase().includes(q));
  const original = exercises.get(slot.exerciseId);

  if (picked) {
    return (
      <Sheet title={`Cambiar a ${picked.name}`} onClose={onClose}>
        <p className="muted">
          Las series que ya marcaste de {current.name} se quedan guardadas con ese ejercicio. Las no marcadas se
          descartan.
        </p>
        <div className="menu-list">
          <button
            className="btn primary"
            onClick={async () => {
              const sid = await ensureSession();
              await setOverride(sid, slot.id, picked.id === slot.exerciseId ? null : picked.id);
              onClose();
            }}
          >
            Solo hoy
          </button>
          <button
            className="btn secondary"
            onClick={async () => {
              await fixSlotExercise(slot.id, picked.id, session?.id);
              onClose();
            }}
          >
            Dejarlo fijo en la rutina
          </button>
          <button className="btn secondary" onClick={() => setPicked(null)}>
            Elegir otro
          </button>
        </div>
      </Sheet>
    );
  }

  const groups = MUSCLE_GROUPS.map((g) => ({ g, items: filtered.filter((e) => e.group === g) })).filter((x) => x.items.length);

  return (
    <Sheet title="Cambiar ejercicio" onClose={onClose}>
      {original && original.id !== current.id && (
        <>
          <h4 className="list-title">De la rutina</h4>
          <button className="list-item" onClick={() => setPicked(original)}>
            {original.name}
          </button>
        </>
      )}
      {alternatives.length > 0 && (
        <>
          <h4 className="list-title">Alternativas</h4>
          {alternatives.map((e) => (
            <button key={e.id} className="list-item" onClick={() => setPicked(e)}>
              {e.name}
            </button>
          ))}
        </>
      )}
      <h4 className="list-title">Catálogo</h4>
      <input className="search" placeholder="Buscar ejercicio" value={query} onChange={(e) => setQuery(e.target.value)} />
      {isWarmup
        ? filtered.map((e) => (
            <button key={e.id} className="list-item" onClick={() => setPicked(e)}>
              {e.name}
            </button>
          ))
        : groups.map(({ g, items }) => (
            <div key={g}>
              <h4 className="list-title small">{g}</h4>
              {items.map((e) => (
                <button key={e.id} className="list-item" onClick={() => setPicked(e)}>
                  {e.name}
                </button>
              ))}
            </div>
          ))}
      {filtered.length === 0 && <p className="muted">Nada coincide. Podrás crear ejercicios nuevos en la pestaña Rutina.</p>}
    </Sheet>
  );
}

function NotesSheet({ exercise, onClose }: { exercise: Exercise; onClose: () => void }) {
  return (
    <Sheet title={exercise.name} onClose={onClose}>
      <label className="field">
        <span>Ajustes de máquina</span>
        <textarea
          rows={2}
          defaultValue={exercise.machineSettings}
          placeholder="Ej. asiento 4, respaldo 2"
          onChange={(e) => updateExercise(exercise.id, { machineSettings: e.target.value })}
        />
      </label>
      <label className="field">
        <span>Notas</span>
        <textarea rows={4} defaultValue={exercise.notes} onChange={(e) => updateExercise(exercise.id, { notes: e.target.value })} />
      </label>
      <p className="muted">Se guarda mientras escribes.</p>
    </Sheet>
  );
}

function ExerciseSettingsSheet({ exercise, onClose }: { exercise: Exercise; onClose: () => void }) {
  return (
    <Sheet title={exercise.name} onClose={onClose}>
      <div className="field">
        <span>Unidad de captura</span>
        <div className="segmented">
          {(['kg', 'lb'] as const).map((u) => (
            <button
              key={u}
              className={exercise.inputUnit === u ? 'on' : ''}
              aria-pressed={exercise.inputUnit === u}
              onClick={() => updateExercise(exercise.id, { inputUnit: u, step: u === 'lb' ? 5 : 2.5 })}
            >
              {u}
            </button>
          ))}
        </div>
        <small className="muted">Siempre se guarda en kg. Al cambiar de unidad el paso se ajusta a 2.5 kg o 5 lb.</small>
      </div>
      <label className="field">
        <span>Paso para subir peso ({exercise.inputUnit})</span>
        <input
          className="num small"
          inputMode="decimal"
          defaultValue={fmtNum(exercise.step)}
          key={`step-${exercise.inputUnit}`}
          onChange={(e) => {
            const n = parseDecimal(e.target.value);
            if (n && n > 0) updateExercise(exercise.id, { step: n });
          }}
        />
      </label>
      <label className="field">
        <span>Descanso (segundos; vacío = el de Ajustes)</span>
        <input
          className="num small"
          inputMode="numeric"
          defaultValue={exercise.restSec ?? ''}
          onChange={(e) => {
            const v = e.target.value.trim();
            const n = parseDecimal(v);
            if (v === '') updateExercise(exercise.id, { restSec: null });
            else if (n !== null && Number.isInteger(n)) updateExercise(exercise.id, { restSec: n });
          }}
        />
      </label>
    </Sheet>
  );
}
