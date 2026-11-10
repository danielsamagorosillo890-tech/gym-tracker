import cuesJson from './cues.es-MX.json';
import manifest from './media-manifest.json';
import type { Exercise, TechniqueText } from './types';

interface CueDraft {
  cues: string[];
  musculo: string;
  error: string;
  revisado: boolean;
}

const drafts = cuesJson as Record<string, CueDraft>;
const media = manifest.items as Record<string, { frames: string[]; sourceName: string; sourceId: string }>;

/** Technique text: the user's edited version if any, else the bundled draft. */
export function techniqueFor(ex: Exercise): TechniqueText | null {
  if (ex.technique) return ex.technique;
  const d = drafts[ex.id];
  if (!d) return null;
  return { cues: d.cues, muscle: d.musculo, mistake: d.error, reviewed: d.revisado };
}

/** Start/end photos bundled for this exercise (free-exercise-db), or null. */
export function framesFor(exerciseId: string): { frames: string[]; sourceName: string } | null {
  const m = media[exerciseId];
  return m && m.frames.length ? { frames: m.frames, sourceName: m.sourceName } : null;
}

export function youtubeUrl(name: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(`${name} técnica`)}`;
}

export const MAX_UPLOAD_BYTES = 60 * 1024 * 1024;
