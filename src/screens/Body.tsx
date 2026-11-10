import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { deleteBodyWeight, deleteMeasurement, saveBodyWeight, saveMeasurement } from '../data/actions';
import { db } from '../data/db';
import type { Measurement } from '../data/types';
import { dateToTime, weightTrend } from '../logic/body';
import { localDate } from '../logic/csv';
import { rangeStart, type Range } from '../logic/progress';
import { fmtNum } from '../logic/units';
import { ChipGroup, Field, Stepper } from '../ui/controls';
import { IconClose } from '../ui/icons';
import { LineChart } from '../ui/LineChart';
import { NumInput } from './SetRow';

const dayFmt = new Intl.DateTimeFormat('es-MX', { weekday: 'short', day: 'numeric', month: 'short' });
const MEASURES = [
  { key: 'waist', label: 'Cintura' },
  { key: 'chest', label: 'Pecho' },
  { key: 'arm', label: 'Brazo' },
  { key: 'thigh', label: 'Muslo' },
] as const;
type MeasureKey = (typeof MEASURES)[number]['key'];

function fmtDate(date: string) {
  return dayFmt.format(dateToTime(date));
}

export function Body() {
  const weights = useLiveQuery(() => db.bodyWeights.orderBy('date').toArray());
  const measurements = useLiveQuery(() => db.measurements.orderBy('date').toArray());
  const [mode, setMode] = useState<'weight' | 'measures'>('weight');
  if (!weights || !measurements) return null;

  return (
    <div className="screen roomy">
      <div className="segmented full" role="group" aria-label="Vista">
        <button className={mode === 'weight' ? 'on' : ''} aria-pressed={mode === 'weight'} onClick={() => setMode('weight')}>
          Peso
        </button>
        <button className={mode === 'measures' ? 'on' : ''} aria-pressed={mode === 'measures'} onClick={() => setMode('measures')}>
          Medidas
        </button>
      </div>
      {mode === 'weight' ? <WeightView weights={weights} /> : <MeasuresView measurements={measurements} />}
    </div>
  );
}

function RangeChips({ value, onChange }: { value: Range; onChange: (r: Range) => void }) {
  return (
    <ChipGroup<Range>
      label="Rango"
      value={value}
      onChange={onChange}
      options={[
        { value: '4w', label: '4 semanas' },
        { value: '12w', label: '12 semanas' },
        { value: 'all', label: 'Todo' },
      ]}
    />
  );
}

function WeightView({ weights }: { weights: { id: number; date: string; kg: number }[] }) {
  const last = weights[weights.length - 1];
  const [date, setDate] = useState(localDate(Date.now()));
  const [kg, setKg] = useState<number | null>(last?.kg ?? null);
  const [range, setRange] = useState<Range>('12w');
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);
  const trend = weightTrend(weights);
  const from = rangeStart(range, Date.now());
  const points = weights.filter((w) => dateToTime(w.date) >= from).map((w) => ({ x: dateToTime(w.date), y: w.kg }));
  const existing = weights.find((w) => w.date === date);

  return (
    <>
      <section className="card">
        <h3>Registrar peso</h3>
          <Field label="Fecha">
            <input className="text-input" type="date" value={date} max={localDate(Date.now())} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="kg">
            <Stepper label="peso corporal" value={kg} onChange={(v) => setKg(v)} step={0.1} decimal allowEmpty />
          </Field>
        <button
          className="btn primary"
          disabled={kg === null || kg <= 0 || !date}
          onClick={async () => {
            await saveBodyWeight(date, kg!);
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
          }}
        >
          {existing ? 'Actualizar peso de ese día' : 'Guardar peso'}
        </button>
        {saved && <p className="ok-text">Guardado.</p>}
      </section>

      {trend && (
        <div className="stat-cards">
          <div className="stat-card">
            <span>Último</span>
            <strong>{fmtNum(trend.latest.kg)} kg</strong>
            <small>{fmtDate(trend.latest.date)}</small>
          </div>
          <div className="stat-card">
            <span>En 4 semanas</span>
            <strong>{trend.change4w === null ? '—' : `${trend.change4w > 0 ? '+' : ''}${fmtNum(trend.change4w)} kg`}</strong>
            <small>{trend.change4w === null ? 'Aún sin dato de hace 4 semanas' : 'vs. hace ~4 semanas'}</small>
          </div>
        </div>
      )}

      {weights.length > 0 && <RangeChips value={range} onChange={setRange} />}
      {points.length >= 2 ? (
        <section className="card chart-card">
          <h3>Peso corporal</h3>
          <LineChart unit="kg" series={[{ id: 'w', label: 'Peso', colorVar: '--series-1', points }]} />
        </section>
      ) : (
        <section className="card empty">
          <p>{weights.length === 0 ? 'Registra tu peso para empezar.' : 'Con dos registros en este rango verás la gráfica.'}</p>
          <p className="muted">Tip: pésate a la misma hora, por ejemplo en la mañana antes de desayunar.</p>
        </section>
      )}

      {weights.length > 0 && (
        <section className="r-block">
          <h3 className="section-title">Registros</h3>
          <ul className="r-list">
            {[...weights].reverse().slice(0, 30).map((w) => (
              <li key={w.id} className="r-row">
                <button
                  className="r-main"
                  onClick={() => {
                    setDate(w.date);
                    setKg(w.kg);
                    window.scrollTo(0, 0);
                  }}
                >
                  <strong>{fmtNum(w.kg)} kg</strong>
                  <span className="muted">{fmtDate(w.date)}</span>
                </button>
                {confirmId === w.id ? (
                  <button className="btn danger small row-action" onClick={() => deleteBodyWeight(w.id).then(() => setConfirmId(null))}>
                    Borrar
                  </button>
                ) : (
                  <button className="icon-btn" aria-label={`Borrar peso del ${fmtDate(w.date)}`} onClick={() => setConfirmId(w.id)}>
                    <IconClose size={18} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function MeasuresView({ measurements }: { measurements: Measurement[] }) {
  const last = measurements[measurements.length - 1];
  const [date, setDate] = useState(localDate(Date.now()));
  const [values, setValues] = useState<Record<MeasureKey, number | null>>({
    waist: last?.waist ?? null,
    chest: last?.chest ?? null,
    arm: last?.arm ?? null,
    thigh: last?.thigh ?? null,
  });
  const [which, setWhich] = useState<MeasureKey>('waist');
  const [range, setRange] = useState<Range>('all');
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);
  const from = rangeStart(range, Date.now());
  const points = measurements
    .filter((m) => m[which] !== null && dateToTime(m.date) >= from)
    .map((m) => ({ x: dateToTime(m.date), y: m[which] }));
  const label = MEASURES.find((m) => m.key === which)!.label;
  const anyValue = Object.values(values).some((v) => v !== null && v > 0);

  return (
    <>
      <section className="card">
        <h3>Registrar medidas (cm)</h3>
        <Field label="Fecha">
          <input className="text-input" type="date" value={date} max={localDate(Date.now())} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <div className="two-col">
          {MEASURES.map((m) => (
            <Field key={m.key} label={m.label}>
              <NumInput label={`${m.label} en cm`} value={values[m.key]} onCommit={(v) => setValues((s) => ({ ...s, [m.key]: v }))} decimal />
            </Field>
          ))}
        </div>
        <small className="muted">Deja vacío lo que no midas hoy.</small>
        <button
          className="btn primary"
          disabled={!anyValue || !date}
          onClick={async () => {
            await saveMeasurement(date, values);
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
          }}
        >
          Guardar medidas
        </button>
        {saved && <p className="ok-text">Guardado.</p>}
      </section>

      {measurements.length > 0 && (
        <>
          <ChipGroup<MeasureKey> label="Medida" value={which} onChange={setWhich} options={MEASURES.map((m) => ({ value: m.key, label: m.label }))} />
          <RangeChips value={range} onChange={setRange} />
        </>
      )}
      {points.length >= 2 ? (
        <section className="card chart-card">
          <h3>{label}</h3>
          <LineChart unit="cm" series={[{ id: which, label, colorVar: '--series-1', points }]} />
        </section>
      ) : (
        <section className="card empty">
          <p>{measurements.length === 0 ? 'Registra tus medidas para empezar.' : `Con dos registros de ${label.toLowerCase()} verás la gráfica.`}</p>
          <p className="muted">Mide siempre en el mismo punto y con la cinta sin apretar.</p>
        </section>
      )}

      {measurements.length > 0 && (
        <section className="r-block">
          <h3 className="section-title">Registros</h3>
          <ul className="r-list">
            {[...measurements].reverse().slice(0, 30).map((m) => (
              <li key={m.id} className="r-row">
                <button
                  className="r-main"
                  onClick={() => {
                    setDate(m.date);
                    setValues({ waist: m.waist, chest: m.chest, arm: m.arm, thigh: m.thigh });
                    window.scrollTo(0, 0);
                  }}
                >
                  <strong>{fmtDate(m.date)}</strong>
                  <span className="muted">
                    {MEASURES.filter((x) => m[x.key] !== null)
                      .map((x) => `${x.label} ${fmtNum(m[x.key]!)}`)
                      .join(' · ')}
                  </span>
                </button>
                {confirmId === m.id ? (
                  <button className="btn danger small row-action" onClick={() => deleteMeasurement(m.id).then(() => setConfirmId(null))}>
                    Borrar
                  </button>
                ) : (
                  <button className="icon-btn" aria-label={`Borrar medidas del ${fmtDate(m.date)}`} onClick={() => setConfirmId(m.id)}>
                    <IconClose size={18} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
