import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { copyVariantSlots, moveDay, moveSlotInVariant, renameDay } from '../data/actions';
import { db } from '../data/db';
import { MUSCLE_GROUPS, type Day, type Exercise, type Slot, type Variant } from '../data/types';
import { appendOrder, newSlotId, variantDefined } from '../logic/routine';
import { slotsForVariant } from '../logic/variant';
import { IconChevron, IconMore } from '../ui/icons';
import { Sheet } from '../ui/Sheet';
import { goalText } from './ExerciseCard';
import { blankExercise, ExerciseEditor } from './routine/ExerciseEditor';
import { ExercisePicker } from './routine/ExercisePicker';
import { SlotEditor } from './routine/SlotEditor';

const TYPE = { compound: 'Compuesto', isolation: 'Aislamiento' };
const BASIS = { total: 'peso total', dumbbell: 'por mancuerna', stack: 'pila' };

type Editing = { slot: Slot; isNew: boolean } | null;

export function Routine() {
  const days = useLiveQuery(() => db.days.orderBy('order').toArray());
  const slots = useLiveQuery(() => db.slots.toArray());
  const exList = useLiveQuery(() => db.exercises.toArray());
  const [mode, setMode] = useState<'days' | 'catalog'>('days');
  const exercises = useMemo(() => new Map((exList ?? []).map((e) => [e.id, e])), [exList]);
  if (!days || !slots || !exList) return null;

  return (
    <div className="screen roomy">
      <div className="segmented full" role="group" aria-label="Vista">
        <button className={mode === 'days' ? 'on' : ''} aria-pressed={mode === 'days'} onClick={() => setMode('days')}>
          Días
        </button>
        <button className={mode === 'catalog' ? 'on' : ''} aria-pressed={mode === 'catalog'} onClick={() => setMode('catalog')}>
          Catálogo
        </button>
      </div>
      {mode === 'days' ? <DaysView days={days} slots={slots} exercises={exercises} /> : <CatalogView exercises={exercises} slots={slots} days={days} />}
    </div>
  );
}

function DaysView({ days, slots, exercises }: { days: Day[]; slots: Slot[]; exercises: Map<string, Exercise> }) {
  const [dayId, setDayId] = useState(days[0]?.id ?? 'push');
  const [variant, setVariant] = useState<Variant>('A');
  const [sorting, setSorting] = useState(false);
  const [editing, setEditing] = useState<Editing>(null);
  const [adding, setAdding] = useState<{ block: Slot['block']; week: Slot['week'] } | null>(null);
  const [dayMenu, setDayMenu] = useState(false);

  const day = days.find((d) => d.id === dayId) ?? days[0];
  const daySlots = slots.filter((s) => s.dayId === day.id);
  const visible = slotsForVariant(daySlots, variant);
  const warm = visible.filter((s) => s.block === 'warmup');
  const work = visible.filter((s) => s.block === 'work');
  const other: Variant = variant === 'A' ? 'B' : 'A';
  const usesAB = daySlots.some((s) => s.block === 'work' && s.week !== 'both');
  const undefinedHere = usesAB && !variantDefined(daySlots, variant) && variantDefined(daySlots, other);
  const sections = [...new Set(daySlots.filter((s) => s.block === 'work').map((s) => s.section))];

  const groups: { name: string; slots: Slot[] }[] = [];
  for (const s of work) {
    const last = groups[groups.length - 1];
    if (last && last.name === s.section) last.slots.push(s);
    else groups.push({ name: s.section, slots: [s] });
  }

  const startAdd = (block: Slot['block'], week: Slot['week']) => setAdding({ block, week });

  const row = (s: Slot, i: number, list: Slot[]) => {
    const ex = exercises.get(s.exerciseId);
    return (
      <li key={s.id} className="r-row">
        <button className="r-main" onClick={() => setEditing({ slot: s, isNew: false })}>
          <strong>{ex?.name ?? s.exerciseId}</strong>
          <span className="muted">
            {ex ? goalText(s, ex) : ''}
            {s.note ? ` · ${s.note}` : ''}
          </span>
          {(s.week !== 'both' || s.alternatives.length > 0) && (
            <span className="r-badges">
              {s.week !== 'both' && <span className="tag">Solo {s.week}</span>}
              {s.alternatives.length > 0 && (
                <span className="tag">
                  {s.alternatives.length} {s.alternatives.length === 1 ? 'alternativa' : 'alternativas'}
                </span>
              )}
            </span>
          )}
        </button>
        {sorting && (
          <span className="r-sort">
            <button
              className="icon-btn"
              disabled={i === 0}
              aria-label={`Subir ${ex?.name}`}
              onClick={() => moveSlotInVariant(day.id, s.id, -1, variant)}
            >
              <IconChevron open />
            </button>
            <button
              className="icon-btn"
              disabled={i === list.length - 1}
              aria-label={`Bajar ${ex?.name}`}
              onClick={() => moveSlotInVariant(day.id, s.id, 1, variant)}
            >
              <IconChevron />
            </button>
          </span>
        )}
      </li>
    );
  };

  return (
    <>
      <div className="tabs-row" role="tablist" aria-label="Días">
        {days.map((d) => (
          <button key={d.id} role="tab" aria-selected={d.id === day.id} className={d.id === day.id ? 'on' : ''} onClick={() => setDayId(d.id)}>
            {d.name}
          </button>
        ))}
      </div>

      <section className="r-day-head">
        <div>
          <h2 className="day-title">{day.name}</h2>
          <p className="muted">Ciclo: {days.map((d) => d.name).join(' → ')}</p>
        </div>
        <button className="icon-btn" aria-label={`Opciones de ${day.name}`} onClick={() => setDayMenu(true)}>
          <IconMore />
        </button>
      </section>

      <div className="r-toolbar">
        <div className="segmented" role="group" aria-label="Semana">
          {(['A', 'B'] as const).map((v) => (
            <button key={v} className={variant === v ? 'on' : ''} aria-pressed={variant === v} onClick={() => setVariant(v)}>
              Semana {v}
            </button>
          ))}
        </div>
        <button className={`btn small ${sorting ? 'primary' : 'secondary'}`} onClick={() => setSorting(!sorting)}>
          {sorting ? 'Listo' : 'Ordenar'}
        </button>
      </div>

      <section className="r-block">
        <h3 className="section-title">Calentamiento</h3>
        <ul className="r-list">{warm.map((s, i) => row(s, i, warm))}</ul>
        <button className="btn secondary small add-btn" onClick={() => startAdd('warmup', 'both')}>
          + Agregar calentamiento
        </button>
      </section>

      {undefinedHere && (
        <section className="card tbd">
          <h3>
            Semana {variant}: por definir
          </h3>
          <p className="muted">Mientras tanto, en Hoy se usa la Semana {other}.</p>
          <div className="row">
            <button className="btn primary" onClick={() => copyVariantSlots(day.id, other, variant)}>
              Copiar de la {other}
            </button>
            <button className="btn secondary" onClick={() => startAdd('work', variant)}>
              Crear
            </button>
          </div>
        </section>
      )}

      {groups.map((g) => (
        <section key={g.name} className="r-block">
          <h3 className="section-title">{g.name}</h3>
          <ul className="r-list">{g.slots.map((s) => row(s, work.indexOf(s), work))}</ul>
        </section>
      ))}

      {!undefinedHere && (
        <button className="btn secondary add-btn" onClick={() => startAdd('work', usesAB ? variant : 'both')}>
          + Agregar ejercicio
        </button>
      )}

      {adding && (
        <ExercisePicker
          title={adding.block === 'warmup' ? 'Agregar calentamiento' : `Agregar a ${day.name}`}
          warmup={adding.block === 'warmup'}
          exercises={exercises}
          onClose={() => setAdding(null)}
          onPick={(exerciseId) => {
            const ex = exercises.get(exerciseId);
            const lastSection = groups[groups.length - 1]?.name ?? 'EJERCICIOS';
            const timed = ex?.metric === 'time_weight';
            const slot: Slot = {
              id: newSlotId(day.id, slots),
              dayId: day.id,
              block: adding.block,
              section: adding.block === 'warmup' ? 'CALENTAMIENTO' : (ex?.group?.toUpperCase() ?? lastSection),
              order: appendOrder(daySlots, adding.block),
              exerciseId,
              sets: adding.block === 'warmup' ? 1 : 3,
              repMin: timed ? null : adding.block === 'warmup' ? null : 8,
              repMax: timed ? null : adding.block === 'warmup' ? null : 12,
              seconds: timed ? 60 : null,
              week: adding.week,
              alternatives: [],
              note: '',
            };
            setAdding(null);
            setEditing({ slot, isNew: true });
          }}
        />
      )}

      {editing && (
        <SlotEditor
          key={editing.slot.id}
          initial={editing.slot}
          isNew={editing.isNew}
          exercises={exercises}
          sections={sections}
          onClose={() => setEditing(null)}
        />
      )}

      {dayMenu && <DayMenu day={day} days={days} onClose={() => setDayMenu(false)} />}
    </>
  );
}

function DayMenu({ day, days, onClose }: { day: Day; days: Day[]; onClose: () => void }) {
  const [name, setName] = useState(day.name);
  const i = days.findIndex((d) => d.id === day.id);
  return (
    <Sheet title={`Día ${day.name}`} onClose={onClose}>
      <div className="field">
        <span>Nombre</span>
        <input className="text-input" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <button
        className="btn primary"
        disabled={!name.trim() || name.trim() === day.name}
        onClick={async () => {
          await renameDay(day.id, name.trim());
          onClose();
        }}
      >
        Guardar nombre
      </button>
      <h4 className="list-title">Posición en el ciclo</h4>
      <p className="muted">{days.map((d) => (d.id === day.id ? `[${d.name}]` : d.name)).join(' → ')}</p>
      <div className="row">
        <button className="btn secondary" disabled={i === 0} onClick={() => moveDay(day.id, -1)}>
          Antes
        </button>
        <button className="btn secondary" disabled={i === days.length - 1} onClick={() => moveDay(day.id, 1)}>
          Después
        </button>
      </div>
      <p className="muted">"Hoy" siempre sugiere el día que sigue al último que terminaste.</p>
    </Sheet>
  );
}

function CatalogView({ exercises, slots, days }: { exercises: Map<string, Exercise>; slots: Slot[]; days: Day[] }) {
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Exercise | 'new' | null>(null);
  const q = query.trim().toLowerCase();
  const list = [...exercises.values()].filter((e) => !q || e.name.toLowerCase().includes(q)).sort((a, b) => a.name.localeCompare(b.name));
  const usedIn = (id: string) =>
    [...new Set(slots.filter((s) => s.exerciseId === id).map((s) => days.find((d) => d.id === s.dayId)?.name ?? s.dayId))].join(', ');
  const groups = [
    ...MUSCLE_GROUPS.map((g) => ({ g: g as string, items: list.filter((e) => e.group === g) })),
    { g: 'Calentamiento y movilidad', items: list.filter((e) => e.group === null) },
  ].filter((x) => x.items.length);

  return (
    <>
      <p className="muted">Un ejercicio existe una sola vez aunque esté en varios días. Aquí corriges su grupo, tipo y forma de pesar.</p>
      <input className="search" placeholder="Buscar ejercicio" value={query} onChange={(e) => setQuery(e.target.value)} />
      <button className="btn secondary" onClick={() => setEditing('new')}>
        + Nuevo ejercicio
      </button>
      {groups.map(({ g, items }) => (
        <section key={g} className="r-block">
          <h3 className="section-title">{g}</h3>
          <ul className="r-list">
            {items.map((e) => (
              <li key={e.id} className="r-row">
                <button className="r-main" onClick={() => setEditing(e)}>
                  <strong>{e.name}</strong>
                  <span className="muted">
                    {e.group
                      ? `${TYPE[e.type]} · ${BASIS[e.weightBasis]} · ${e.inputUnit}${e.perSide ? ' · por lado' : ''}${e.metric === 'time_weight' ? ' · tiempo' : ''}`
                      : e.perSide
                        ? 'por lado'
                        : 'checklist'}
                  </span>
                  <span className="muted small">{usedIn(e.id) ? `En: ${usedIn(e.id)}` : 'Sin usar en la rutina'}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {editing && (
        <ExerciseEditor initial={editing === 'new' ? { ...blankExercise(false), name: query.trim() } : editing} onClose={() => setEditing(null)} />
      )}
    </>
  );
}
