import { useState } from 'react';
import { MUSCLE_GROUPS, type Exercise } from '../../data/types';
import { Sheet } from '../../ui/Sheet';
import { blankExercise, ExerciseEditor } from './ExerciseEditor';

/** Search the catalog (warm-ups or work exercises) or create a new exercise. */
export function ExercisePicker({
  title,
  warmup,
  exercises,
  exclude = [],
  onPick,
  onClose,
}: {
  title: string;
  warmup: boolean;
  exercises: Map<string, Exercise>;
  exclude?: string[];
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const q = query.trim().toLowerCase();
  const list = [...exercises.values()]
    .filter((e) => (warmup ? e.group === null : e.group !== null))
    .filter((e) => !exclude.includes(e.id))
    .filter((e) => !q || e.name.toLowerCase().includes(q))
    .sort((a, b) => a.name.localeCompare(b.name));

  if (creating) {
    return (
      <ExerciseEditor
        initial={{ ...blankExercise(warmup), name: query.trim() }}
        onClose={() => setCreating(false)}
        onSaved={(id) => onPick(id)}
      />
    );
  }

  const groups = warmup
    ? [{ g: 'Calentamiento y movilidad', items: list }]
    : MUSCLE_GROUPS.map((g) => ({ g: g as string, items: list.filter((e) => e.group === g) }));

  return (
    <Sheet title={title} onClose={onClose}>
      <input className="search" placeholder="Buscar ejercicio" value={query} onChange={(e) => setQuery(e.target.value)} />
      <button className="btn secondary" onClick={() => setCreating(true)}>
        + Crear ejercicio nuevo{query.trim() ? `: "${query.trim()}"` : ''}
      </button>
      {groups
        .filter((x) => x.items.length)
        .map(({ g, items }) => (
          <div key={g}>
            <h4 className="list-title small">{g}</h4>
            {items.map((e) => (
              <button key={e.id} className="list-item" onClick={() => onPick(e.id)}>
                {e.name}
              </button>
            ))}
          </div>
        ))}
      {list.length === 0 && <p className="muted">Nada coincide. Créalo con el botón de arriba.</p>}
    </Sheet>
  );
}
