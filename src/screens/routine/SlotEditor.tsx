import { useState } from 'react';
import { deleteSlot, saveSlot } from '../../data/actions';
import type { Exercise, Slot, SlotWeek } from '../../data/types';
import { normalizeRange } from '../../logic/routine';
import { ChipGroup, Field, Stepper } from '../../ui/controls';
import { IconClose } from '../../ui/icons';
import { ConfirmInline, Sheet } from '../../ui/Sheet';
import { ExerciseEditor } from './ExerciseEditor';
import { ExercisePicker } from './ExercisePicker';

type Goal = 'reps' | 'time' | 'none';

function goalOf(slot: Slot): Goal {
  if (slot.seconds) return 'time';
  if (slot.repMin !== null) return 'reps';
  return 'none';
}

/** Edit one exercise inside a day: sets, range, week, section, alternatives, note. */
export function SlotEditor({
  initial,
  isNew,
  exercises,
  sections,
  onClose,
}: {
  initial: Slot;
  isNew: boolean;
  exercises: Map<string, Exercise>;
  sections: string[];
  onClose: () => void;
}) {
  const [slot, setSlot] = useState(initial);
  const [sub, setSub] = useState<'exercise' | 'alt' | 'edit-ex' | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const ex = exercises.get(slot.exerciseId);
  const warm = slot.block === 'warmup';
  const timed = ex?.metric === 'time_weight';
  const [goal, setGoal] = useState<Goal>(timed ? 'time' : goalOf(initial));
  const set = <K extends keyof Slot>(k: K, v: Slot[K]) => setSlot((s) => ({ ...s, [k]: v }));

  if (sub === 'exercise' || sub === 'alt') {
    return (
      <ExercisePicker
        title={sub === 'exercise' ? 'Elegir ejercicio' : 'Agregar alternativa'}
        warmup={warm}
        exercises={exercises}
        exclude={[slot.exerciseId, ...slot.alternatives]}
        onClose={() => setSub(null)}
        onPick={(id) => {
          if (sub === 'exercise') {
            const picked = exercises.get(id);
            setSlot((s) => ({ ...s, exerciseId: id, alternatives: s.alternatives.filter((a) => a !== id) }));
            if (picked?.metric === 'time_weight') setGoal('time');
          } else set('alternatives', [...slot.alternatives, id]);
          setSub(null);
        }}
      />
    );
  }
  if (sub === 'edit-ex' && ex) return <ExerciseEditor initial={ex} onClose={() => setSub(null)} />;

  const save = async () => {
    const [repMin, repMax] = goal === 'reps' ? normalizeRange(slot.repMin ?? 8, slot.repMax ?? slot.repMin ?? 8) : [null, null];
    await saveSlot({
      ...slot,
      section: slot.section.trim().toUpperCase() || (warm ? 'CALENTAMIENTO' : 'EJERCICIOS'),
      repMin,
      repMax,
      seconds: goal === 'time' ? (slot.seconds ?? 30) : null,
      sets: Math.max(1, slot.sets),
    });
    onClose();
  };

  return (
    <Sheet title={isNew ? 'Agregar al día' : 'Editar en este día'} onClose={onClose}>
      <Field label="Ejercicio">
        <div className="picked">
          <strong>{ex?.name ?? slot.exerciseId}</strong>
          <div className="picked-actions">
            <button className="btn secondary small" onClick={() => setSub('exercise')}>
              Cambiar
            </button>
            {ex && (
              <button className="btn secondary small" onClick={() => setSub('edit-ex')}>
                Editar ficha
              </button>
            )}
          </div>
        </div>
      </Field>

      {!warm && (
        <Field label="Semana">
          <ChipGroup<SlotWeek>
            label="Semana"
            value={slot.week}
            onChange={(v) => set('week', v)}
            options={[
              { value: 'both', label: 'Ambas' },
              { value: 'A', label: 'Solo A' },
              { value: 'B', label: 'Solo B' },
            ]}
          />
        </Field>
      )}

      {!warm && (
        <Field label="Sección">
          <input className="text-input" value={slot.section} onChange={(e) => set('section', e.target.value)} placeholder="Ej. PECHO" />
          {sections.length > 0 && (
            <div className="chip-group compact">
              {sections.map((s) => (
                <button key={s} className={slot.section === s ? 'on' : ''} onClick={() => set('section', s)}>
                  {s}
                </button>
              ))}
            </div>
          )}
        </Field>
      )}

      <Field label="Series">
        <Stepper label="series" value={slot.sets} onChange={(v) => set('sets', v ?? 1)} min={1} />
      </Field>

      {!timed && (
        <Field label="Meta">
          <ChipGroup<Goal>
            label="Meta"
            value={goal}
            onChange={setGoal}
            options={[
              { value: 'reps', label: 'Repeticiones' },
              { value: 'time', label: 'Tiempo' },
              ...(warm ? [{ value: 'none' as Goal, label: 'Sin meta' }] : []),
            ]}
          />
        </Field>
      )}

      {goal === 'reps' && (
        <div className="two-col">
          <Field label="Reps mín.">
            <Stepper label="reps mínimas" value={slot.repMin ?? 8} onChange={(v) => set('repMin', v)} min={1} />
          </Field>
          <Field label="Reps máx.">
            <Stepper label="reps máximas" value={slot.repMax ?? slot.repMin ?? 8} onChange={(v) => set('repMax', v)} min={1} />
          </Field>
        </div>
      )}
      {goal === 'reps' && <small className="muted rangenote">Para un rango fijo (3 × 10) pon el mismo número en ambos.</small>}

      {goal === 'time' && (
        <Field label="Segundos por serie">
          <Stepper label="segundos" value={slot.seconds ?? 30} onChange={(v) => set('seconds', v)} step={5} min={5} />
        </Field>
      )}

      {!warm && (
        <Field label="Alternativas" hint="Aparecen primero al cambiar el ejercicio en Hoy.">
          <div className="alt-list">
            {slot.alternatives.map((id) => (
              <span key={id} className="alt-chip">
                {exercises.get(id)?.name ?? id}
                <button
                  className="icon-btn tiny"
                  aria-label={`Quitar ${exercises.get(id)?.name ?? id}`}
                  onClick={() => set('alternatives', slot.alternatives.filter((a) => a !== id))}
                >
                  <IconClose size={14} />
                </button>
              </span>
            ))}
            <button className="btn secondary small" onClick={() => setSub('alt')}>
              + Alternativa
            </button>
          </div>
        </Field>
      )}

      <Field label="Nota corta" hint='Ej. "heavy". Se ve junto a la meta.'>
        <input className="text-input" value={slot.note} onChange={(e) => set('note', e.target.value)} />
      </Field>

      <button className="btn primary next-cta" onClick={save}>
        {isNew ? 'Agregar' : 'Guardar'}
      </button>

      {!isNew &&
        (confirmDelete ? (
          <ConfirmInline
            message="¿Quitar este ejercicio del día? Tu historial con él se conserva."
            confirmLabel="Quitar"
            onConfirm={async () => {
              await deleteSlot(slot.id);
              onClose();
            }}
            onCancel={() => setConfirmDelete(false)}
          />
        ) : (
          <button className="btn secondary" onClick={() => setConfirmDelete(true)}>
            Quitar del día
          </button>
        ))}
    </Sheet>
  );
}
