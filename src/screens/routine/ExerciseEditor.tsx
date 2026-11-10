import { useState } from 'react';
import { saveExercise } from '../../data/actions';
import { MUSCLE_GROUPS, type Exercise, type MuscleGroup } from '../../data/types';
import { ChipGroup, Field, Stepper } from '../../ui/controls';
import { Sheet } from '../../ui/Sheet';

export function blankExercise(warmup: boolean): Omit<Exercise, 'id'> {
  return {
    name: '',
    group: warmup ? null : 'Pecho',
    type: warmup ? 'isolation' : 'compound',
    metric: warmup ? 'check' : 'weight_reps',
    perSide: false,
    weightBasis: 'total',
    inputUnit: 'kg',
    step: 2.5,
    restSec: null,
    notes: '',
    machineSettings: '',
  };
}

/** Create or edit a catalog exercise. Changes apply to every day that uses it. */
export function ExerciseEditor({
  initial,
  onClose,
  onSaved,
}: {
  initial: Exercise | Omit<Exercise, 'id'>;
  onClose: () => void;
  onSaved?: (id: string) => void;
}) {
  const [ex, setEx] = useState(initial);
  const isNew = !('id' in initial);
  const set = <K extends keyof Exercise>(k: K, v: Exercise[K]) => setEx((e) => ({ ...e, [k]: v }));
  const valid = ex.name.trim().length > 0;

  return (
    <Sheet title={isNew ? 'Nuevo ejercicio' : 'Editar ejercicio'} onClose={onClose}>
      <Field label="Nombre">
        <input className="text-input" value={ex.name} onChange={(e) => set('name', e.target.value)} placeholder="Ej. Pec deck" />
      </Field>

      <Field label="Grupo muscular">
        <ChipGroup<MuscleGroup | null>
          label="Grupo muscular"
          value={ex.group}
          onChange={(g) => {
            set('group', g);
            if (g === null) set('metric', 'check');
            else if (ex.metric === 'check') set('metric', 'weight_reps');
          }}
          options={[...MUSCLE_GROUPS.map((g) => ({ value: g as MuscleGroup | null, label: g })), { value: null, label: 'Calentamiento' }]}
        />
      </Field>

      {ex.group !== null && (
        <>
          <Field label="Tipo" hint="Define el descanso por defecto (compuesto 150 s, aislamiento 90 s).">
            <ChipGroup
              label="Tipo"
              value={ex.type}
              onChange={(v) => set('type', v)}
              options={[
                { value: 'compound', label: 'Compuesto' },
                { value: 'isolation', label: 'Aislamiento' },
              ]}
            />
          </Field>

          <Field label="Se mide en">
            <ChipGroup
              label="Métrica"
              value={ex.metric}
              onChange={(v) => set('metric', v)}
              options={[
                { value: 'weight_reps', label: 'Peso × reps' },
                { value: 'time_weight', label: 'Peso × tiempo' },
              ]}
            />
          </Field>

          <Field label="El peso que anotas es">
            <ChipGroup
              label="Peso"
              value={ex.weightBasis}
              onChange={(v) => set('weightBasis', v)}
              options={[
                { value: 'total', label: 'Total (con barra)' },
                { value: 'dumbbell', label: 'Por mancuerna' },
                { value: 'stack', label: 'Pila / máquina' },
              ]}
            />
          </Field>

          <Field label="Unidad">
            <ChipGroup
              label="Unidad"
              value={ex.inputUnit}
              onChange={(u) => setEx((e) => ({ ...e, inputUnit: u, step: u === 'lb' ? 5 : 2.5 }))}
              options={[
                { value: 'kg', label: 'kg' },
                { value: 'lb', label: 'lb' },
              ]}
            />
          </Field>

          <Field label={`Paso para subir (${ex.inputUnit})`}>
            <Stepper label="paso" value={ex.step} onChange={(v) => v && set('step', v)} step={ex.inputUnit === 'lb' ? 2.5 : 0.5} min={0.5} decimal />
          </Field>

          <Field label="Descanso propio (s)" hint="Vacío = el de Ajustes según el tipo.">
            <Stepper label="descanso" value={ex.restSec} onChange={(v) => set('restSec', v)} step={15} min={0} allowEmpty />
          </Field>
        </>
      )}

      <label className="toggle-row">
        <span>
          <strong>Por lado</strong>
          <small className="muted">Se anota una vez y cuenta como 1 serie.</small>
        </span>
        <input type="checkbox" checked={ex.perSide} onChange={(e) => set('perSide', e.target.checked)} />
      </label>

      <Field label="Notas">
        <textarea rows={2} value={ex.notes} onChange={(e) => set('notes', e.target.value)} />
      </Field>

      <button
        className="btn primary next-cta"
        disabled={!valid}
        onClick={async () => {
          const id = await saveExercise({ ...ex, name: ex.name.trim() });
          onSaved?.(id);
          onClose();
        }}
      >
        {isNew ? 'Crear ejercicio' : 'Guardar'}
      </button>
      {!isNew && <p className="muted">Los cambios aplican en todos los días que usan este ejercicio. El historial no se modifica.</p>}
    </Sheet>
  );
}
