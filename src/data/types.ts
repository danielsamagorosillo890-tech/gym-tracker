export const MUSCLE_GROUPS = [
  'Pecho',
  'Hombro',
  'Tríceps',
  'Espalda',
  'Bíceps',
  'Antebrazo',
  'Cuádriceps',
  'Isquios y glúteo',
  'Pantorrilla',
] as const;
export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

export type ExerciseType = 'compound' | 'isolation';
/** weight_reps = kg × reps; time_weight = kg × seconds; check = done / not done (warm-ups). */
export type Metric = 'weight_reps' | 'time_weight' | 'check';
/** How the logged weight is read: total incl. bar, per dumbbell, or machine stack. */
export type WeightBasis = 'total' | 'dumbbell' | 'stack';
export type Unit = 'kg' | 'lb';
export type Variant = 'A' | 'B';
export type SlotWeek = Variant | 'both';

export interface Exercise {
  id: string;
  name: string;
  /** null for warm-up / mobility drills that do not count toward volume. */
  group: MuscleGroup | null;
  type: ExerciseType;
  metric: Metric;
  perSide: boolean;
  weightBasis: WeightBasis;
  /** Unit used in the UI. Storage is always kg. */
  inputUnit: Unit;
  /** Progression step expressed in inputUnit (e.g. 2.5 kg or 5 lb). */
  step: number;
  /** null → use the default rest for its type from Settings. */
  restSec: number | null;
  notes: string;
  machineSettings: string;
  /** Present once the user edits or reviews the technique text. */
  technique?: TechniqueText;
}

export interface Day {
  id: string;
  name: string;
  order: number;
}

export interface Slot {
  id: string;
  dayId: string;
  block: 'warmup' | 'work';
  /** Visible section header, e.g. "PECHO". */
  section: string;
  /** Position inside the day; A/B pairs share the same order. */
  order: number;
  exerciseId: string;
  sets: number;
  repMin: number | null;
  repMax: number | null;
  /** Target seconds for timed slots. */
  seconds: number | null;
  week: SlotWeek;
  alternatives: string[];
  note: string;
}

export type SessionStatus = 'in_progress' | 'finished' | 'skipped';

export interface Session {
  id: number;
  dayId: string;
  /** Variant chosen for the session (parity or manual). Display may fall back to A. */
  variant: Variant;
  startedAt: number;
  endedAt: number | null;
  status: SessionStatus;
  note: string;
  /** "Solo hoy" swaps: slotId → exerciseId. */
  overrides: Record<string, string>;
}

export interface SetLog {
  id: number;
  sessionId: number;
  slotId: string;
  /** Exercise actually performed (may differ from the slot's default). */
  exerciseId: string;
  index: number;
  kind: 'work' | 'warmup';
  kg: number | null;
  reps: number | null;
  seconds: number | null;
  completed: boolean;
  /** Last time the row changed; for completed sets, the completion time. */
  at: number;
}

export interface WarmupCheck {
  /** `${sessionId}:${slotId}` */
  id: string;
  sessionId: number;
  slotId: string;
  done: boolean;
}

export interface Settings {
  id: 'settings';
  theme: 'dark' | 'light';
  restCompoundSec: number;
  restIsolationSec: number;
  lastExportAt: number | null;
  notificationsAsked: boolean;
  /** First time the app stored real data; anchors the backup reminder. */
  firstDataAt: number | null;
}

export interface Backup {
  id: number;
  createdAt: number;
  reason: 'before_import';
  json: string;
}

export const DEFAULT_SETTINGS: Settings = {
  id: 'settings',
  theme: 'dark',
  restCompoundSec: 150,
  restIsolationSec: 90,
  lastExportAt: null,
  notificationsAsked: false,
  firstDataAt: null,
};

/** User-edited technique text; overrides the bundled draft in cues.es-MX.json. */
export interface TechniqueText {
  cues: string[];
  muscle: string;
  mistake: string;
  reviewed: boolean;
}

/** Photo, GIF or video the user uploads for an exercise (kept only on this device). */
export interface UserMedia {
  id: number;
  exerciseId: string;
  kind: 'image' | 'video';
  mime: string;
  blob: Blob;
  createdAt: number;
}
