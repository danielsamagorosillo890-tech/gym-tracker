import { useRef, useState } from 'react';
import { removeUserMedia, saveTechnique, setUserMedia } from '../../data/actions';
import { framesFor, MAX_UPLOAD_BYTES, techniqueFor, youtubeUrl } from '../../data/technique';
import type { Exercise, TechniqueText } from '../../data/types';
import { IconPlay } from '../../ui/icons';
import { ConfirmInline, Sheet } from '../../ui/Sheet';
import { TechniqueMedia, useUserMedia } from './TechniqueMedia';

/** Full technique card: visual, cues, main muscle, common mistake, YouTube and own upload. */
export function TechniqueSheet({ exercise, onClose }: { exercise: Exercise; onClose: () => void }) {
  const t = techniqueFor(exercise);
  const own = useUserMedia(exercise.id);
  const frames = framesFor(exercise.id);
  const [editing, setEditing] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  if (editing) return <TechniqueEditor exercise={exercise} initial={t} onDone={() => setEditing(false)} onClose={onClose} />;

  return (
    <Sheet title={exercise.name} onClose={onClose}>
      <TechniqueMedia exerciseId={exercise.id} name={exercise.name} size="large" />
      {!own && frames && <small className="muted credit">Fotos: free-exercise-db (dominio público)</small>}
      {!own && !frames && <p className="note">Este ejercicio no tiene visual. Sube una foto, GIF o video tuyo.</p>}

      {t ? (
        <>
          <div className="tech-status">
            {t.reviewed ? <span className="tag ok-tag">Revisado</span> : <span className="tag draft-tag">Borrador</span>}
            <span className="muted">{t.muscle}</span>
          </div>
          <ol className="cue-list">
            {t.cues.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ol>
          <div className="info-block mistake">
            <b>Error común</b>
            <span>{t.mistake}</span>
          </div>
          <div className="row">
            <button className="btn secondary" onClick={() => setEditing(true)}>
              Editar texto
            </button>
            <button className="btn secondary" onClick={() => saveTechnique(exercise.id, { ...t, reviewed: !t.reviewed })}>
              {t.reviewed ? 'Volver a borrador' : 'Marcar revisado'}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="muted">Todavía no hay indicaciones para este ejercicio.</p>
          <button className="btn secondary" onClick={() => setEditing(true)}>
            Escribir indicaciones
          </button>
        </>
      )}

      <a className="technique" href={youtubeUrl(exercise.name)} target="_blank" rel="noopener noreferrer">
        <span className="technique-icon">
          <IconPlay size={26} />
        </span>
        <strong>Ver técnica en YouTube</strong>
      </a>

      <button className="btn secondary" onClick={() => fileRef.current?.click()}>
        {own ? 'Cambiar mi foto o video' : 'Subir mi foto, GIF o video'}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*,video/*"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          if (!f.type.startsWith('image/') && !f.type.startsWith('video/')) return setError('Solo fotos, GIFs o videos.');
          if (f.size > MAX_UPLOAD_BYTES) return setError('El archivo pesa más de 60 MB. Usa un clip más corto.');
          setError(null);
          await setUserMedia(exercise.id, f);
        }}
      />
      {error && <p className="error">{error}</p>}
      {own &&
        (confirmRemove ? (
          <ConfirmInline
            message="¿Quitar tu foto o video de este ejercicio?"
            confirmLabel="Quitar"
            onConfirm={async () => {
              await removeUserMedia(exercise.id);
              setConfirmRemove(false);
            }}
            onCancel={() => setConfirmRemove(false)}
          />
        ) : (
          <button className="btn secondary" onClick={() => setConfirmRemove(true)}>
            Quitar mi visual
          </button>
        ))}
      <small className="muted">Tus fotos y videos se guardan solo en este celular y no van en el respaldo JSON.</small>
    </Sheet>
  );
}

function TechniqueEditor({
  exercise,
  initial,
  onDone,
  onClose,
}: {
  exercise: Exercise;
  initial: TechniqueText | null;
  onDone: () => void;
  onClose: () => void;
}) {
  const [cues, setCues] = useState((initial?.cues ?? ['', '', '']).join('\n'));
  const [muscle, setMuscle] = useState(initial?.muscle ?? '');
  const [mistake, setMistake] = useState(initial?.mistake ?? '');
  const list = cues
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
  return (
    <Sheet title={`Técnica: ${exercise.name}`} onClose={onClose}>
      <label className="field">
        <span>Indicaciones (una por línea, 3 o 4)</span>
        <textarea rows={5} value={cues} onChange={(e) => setCues(e.target.value)} />
      </label>
      <label className="field">
        <span>Músculo principal</span>
        <input className="text-input" value={muscle} onChange={(e) => setMuscle(e.target.value)} />
      </label>
      <label className="field">
        <span>Error común</span>
        <input className="text-input" value={mistake} onChange={(e) => setMistake(e.target.value)} />
      </label>
      <button
        className="btn primary next-cta"
        disabled={list.length === 0}
        onClick={async () => {
          await saveTechnique(exercise.id, { cues: list, muscle: muscle.trim(), mistake: mistake.trim(), reviewed: true });
          onDone();
        }}
      >
        Guardar y marcar revisado
      </button>
      <button className="btn secondary" onClick={onDone}>
        Cancelar
      </button>
    </Sheet>
  );
}
