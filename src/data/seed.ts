import type { Day, Exercise, ExerciseType, MuscleGroup, Slot, SlotWeek, WeightBasis } from './types';

// Initial routine (spec section 8). Group / type / basis are proposals for the user to review.

type ExDef = [
  id: string,
  name: string,
  group: MuscleGroup | null,
  type: ExerciseType,
  basis: WeightBasis,
  opts?: { perSide?: boolean; time?: boolean; check?: boolean; notes?: string },
];

const EXERCISES: ExDef[] = [
  // Warm-ups and mobility (checklist only)
  ['circles', 'Circles', null, 'isolation', 'total', { check: true }],
  ['arm-swings', 'Arm swings', null, 'isolation', 'total', { check: true }],
  ['chest-flys', 'Chest flys', null, 'isolation', 'total', { check: true }],
  ['band-rotation', 'Band rotation', null, 'isolation', 'total', { check: true }],
  ['assisted-push-ups', 'Assisted push-ups', null, 'isolation', 'total', { check: true }],
  ['rotator-cuff-warm-up', 'Rotator cuff warm-up', null, 'isolation', 'total', { check: true }],
  ['banded-shoulder-dislocates', 'Banded shoulder dislocates', null, 'isolation', 'total', { check: true }],
  ['band-pull-aparts', 'Band pull-aparts', null, 'isolation', 'total', { check: true }],
  ['arm-circles', 'Arm circles', null, 'isolation', 'total', { check: true }],
  ['assisted-pull-ups', 'Assisted pull-ups', null, 'isolation', 'total', { check: true }],
  ['hip-openers', 'Hip openers', null, 'isolation', 'total', { check: true, perSide: true }],
  ['lunges', 'Lunges', null, 'isolation', 'total', { check: true, perSide: true }],
  ['90-90s', '90/90s', null, 'isolation', 'total', { check: true, perSide: true }],
  ['cossack-squat', 'Cossack squat', null, 'isolation', 'total', { check: true, perSide: true }],
  ['partial-dragon-squat', 'Partial dragon squat', null, 'isolation', 'total', { check: true, perSide: true }],

  // Push
  ['bench-press', 'Bench press', 'Pecho', 'compound', 'total'],
  ['incline-dumbbell-press', 'Incline dumbbell press', 'Pecho', 'compound', 'dumbbell'],
  ['seated-cable-fly', 'Seated cable fly', 'Pecho', 'isolation', 'stack'],
  ['smith-machine-military-press', 'Smith machine military press', 'Hombro', 'compound', 'total'],
  ['dumbbell-shoulder-press', 'Dumbbell shoulder press', 'Hombro', 'compound', 'dumbbell'],
  ['front-y-raise', 'Front Y raise', 'Hombro', 'isolation', 'dumbbell', { notes: 'De pie.' }],
  ['one-arm-reverse-fly', 'One-arm reverse fly', 'Hombro', 'isolation', 'stack', { perSide: true }],
  ['single-arm-tricep-pushdown', 'Single-arm tricep pushdown', 'Tríceps', 'isolation', 'stack', { perSide: true }],
  ['reverse-tricep-pushdown', 'Reverse tricep pushdown', 'Tríceps', 'isolation', 'stack'],
  ['rope-pushdown', 'Rope pushdown', 'Tríceps', 'isolation', 'stack'],
  ['one-arm-overhead-tricep-extension', 'One-arm overhead tricep extension', 'Tríceps', 'isolation', 'stack', { perSide: true }],

  // Pull
  ['close-grip-lat-pulldown', 'Close-grip lat pulldown', 'Espalda', 'compound', 'stack'],
  ['wide-grip-lat-pulldown', 'Wide-grip lat pulldown', 'Espalda', 'compound', 'stack'],
  ['chest-supported-machine-row', 'Chest-supported machine row', 'Espalda', 'compound', 'stack'],
  ['seated-row', 'Seated row', 'Espalda', 'compound', 'stack', { notes: 'Enfocado en upper back.' }],
  ['close-grip-cable-row', 'Close-grip cable row', 'Espalda', 'compound', 'stack'],
  ['wide-grip-cable-row', 'Wide-grip cable row', 'Espalda', 'compound', 'stack'],
  ['t-bar-row', 'T-bar row', 'Espalda', 'compound', 'total'],
  ['cable-ez-bar-curl', 'Cable EZ-bar curl', 'Bíceps', 'isolation', 'stack'],
  ['seated-cable-preacher-curl', 'Seated cable preacher curl', 'Bíceps', 'isolation', 'stack'],
  ['bayesian-cable-curl', 'Bayesian cable curl', 'Bíceps', 'isolation', 'stack'],
  ['farmers-carry', "Farmer's carry", 'Antebrazo', 'compound', 'dumbbell', { time: true }],
  ['dumbbell-wrist-curl', 'Dumbbell wrist curl', 'Antebrazo', 'isolation', 'dumbbell'],
  ['reverse-ez-bar-curl', 'Reverse EZ-bar curl', 'Antebrazo', 'isolation', 'total'],

  // Legs
  ['horizontal-leg-press', 'Horizontal leg press machine', 'Cuádriceps', 'compound', 'stack'],
  ['barbell-squat', 'Barbell squat', 'Cuádriceps', 'compound', 'total'],
  ['leg-extension', 'Leg extension', 'Cuádriceps', 'isolation', 'stack'],
  ['calf-raise', 'Calf raise', 'Pantorrilla', 'isolation', 'stack'],
  ['hip-abduction', 'Hip abduction', 'Isquios y glúteo', 'isolation', 'stack'],
  ['bulgarian-split-squat', 'Bulgarian split squat', 'Cuádriceps', 'compound', 'dumbbell', { perSide: true }],
  ['seated-leg-curl', 'Seated leg curl', 'Isquios y glúteo', 'isolation', 'stack'],
  ['rdl', 'RDL', 'Isquios y glúteo', 'compound', 'total'],
  ['hack-squat', 'Hack squat', 'Cuádriceps', 'compound', 'total'],

  // Upper
  ['dumbbell-row', 'Dumbbell row', 'Espalda', 'compound', 'dumbbell'],
  ['ez-bar-curl', 'EZ-bar curl', 'Bíceps', 'isolation', 'total'],
  ['machine-supported-hammer-curl', 'Machine-supported hammer curl', 'Bíceps', 'isolation', 'stack'],
  ['single-arm-cuffed-lateral-raise', 'Single-arm cuffed lateral raise', 'Hombro', 'isolation', 'stack', { perSide: true }],
  ['y-raise', 'Y raise', 'Hombro', 'isolation', 'dumbbell', { notes: 'Acostado. Distinto de Front Y raise.' }],
  ['cable-tricep-pushdown', 'Cable tricep pushdown', 'Tríceps', 'isolation', 'stack'],
  ['katana-extension', 'Katana extension', 'Tríceps', 'isolation', 'stack'],

  // Lower
  ['weighted-lunges-in-place', 'Weighted lunges in place', 'Cuádriceps', 'compound', 'dumbbell'],
  ['sissy-squat', 'Sissy squat', 'Cuádriceps', 'isolation', 'total'],
  ['box-squat', 'Box squat', 'Cuádriceps', 'compound', 'total'],
  ['seated-calf-raise', 'Seated calf raise', 'Pantorrilla', 'isolation', 'total'],
];

export const SEED_DAYS: Day[] = [
  { id: 'push', name: 'Push', order: 0 },
  { id: 'pull', name: 'Pull', order: 1 },
  { id: 'legs', name: 'Legs', order: 2 },
  { id: 'upper', name: 'Upper', order: 3 },
  { id: 'lower', name: 'Lower', order: 4 },
];

export function seedExercises(): Exercise[] {
  return EXERCISES.map(([id, name, group, type, basis, o = {}]) => ({
    id,
    name,
    group,
    type,
    metric: o.check ? 'check' : o.time ? 'time_weight' : 'weight_reps',
    perSide: !!o.perSide,
    weightBasis: basis,
    inputUnit: 'kg',
    step: 2.5,
    restSec: null,
    notes: o.notes ?? '',
    machineSettings: '',
  }));
}

// Warm-up: [exerciseId, sets, repMin, repMax, seconds]
type WarmDef = [string, number, number | null, number | null, number | null];
// Work: [section, exerciseId, sets, repMin, repMax, opts]
type WorkDef = [
  string,
  string,
  number,
  number | null,
  number | null,
  { week?: SlotWeek; seconds?: number; alts?: string[]; note?: string; pairWithPrev?: boolean }?,
];

const WARMUPS: Record<string, WarmDef[]> = {
  push: [
    ['circles', 1, null, null, 20],
    ['arm-swings', 1, null, null, 20],
    ['chest-flys', 1, 12, 12, null],
    ['band-rotation', 1, null, null, null],
    ['assisted-push-ups', 1, null, null, null],
    ['rotator-cuff-warm-up', 1, null, null, null],
  ],
  pull: [
    ['banded-shoulder-dislocates', 1, 12, 12, null],
    ['band-pull-aparts', 1, 12, 12, null],
    ['arm-circles', 1, null, null, 20],
    ['assisted-pull-ups', 1, 12, 12, null],
  ],
  legs: [
    ['hip-openers', 2, 10, 12, null],
    ['lunges', 2, 10, 10, null],
    ['90-90s', 2, 10, 12, null],
    ['cossack-squat', 2, 5, 10, null],
  ],
  upper: [
    ['banded-shoulder-dislocates', 1, 12, 12, null],
    ['band-pull-aparts', 1, 12, 12, null],
    ['assisted-pull-ups', 1, 12, 12, null],
    ['chest-flys', 1, 12, 12, null],
  ],
  lower: [
    ['lunges', 2, 10, 10, null],
    ['90-90s', 2, 10, 12, null],
    ['cossack-squat', 2, 5, 10, null],
    ['partial-dragon-squat', 2, 8, 8, null],
  ],
};

const A = { week: 'A' as const };
const B = { week: 'B' as const, pairWithPrev: true };

const WORK: Record<string, WorkDef[]> = {
  push: [
    ['PECHO', 'bench-press', 3, 8, 10],
    ['PECHO', 'incline-dumbbell-press', 3, 8, 10],
    ['PECHO', 'seated-cable-fly', 3, 8, 10],
    ['HOMBRO', 'smith-machine-military-press', 3, 8, 10],
    ['HOMBRO', 'dumbbell-shoulder-press', 3, 8, 10],
    ['HOMBRO', 'front-y-raise', 3, 8, 10],
    ['HOMBRO', 'one-arm-reverse-fly', 3, 8, 10],
    ['TRÍCEPS', 'single-arm-tricep-pushdown', 3, 8, 12],
    ['TRÍCEPS', 'reverse-tricep-pushdown', 3, 8, 12, { alts: ['cable-tricep-pushdown'] }],
    ['TRÍCEPS', 'rope-pushdown', 3, 8, 12],
    ['TRÍCEPS', 'one-arm-overhead-tricep-extension', 3, 10, 12],
  ],
  pull: [
    ['ESPALDA', 'close-grip-lat-pulldown', 3, 10, 15, A],
    ['ESPALDA', 'wide-grip-lat-pulldown', 3, 10, 15, B],
    ['ESPALDA', 'chest-supported-machine-row', 3, 8, 12, A],
    ['ESPALDA', 'seated-row', 3, 8, 12, B],
    ['ESPALDA', 'close-grip-cable-row', 2, 15, 20, A],
    ['ESPALDA', 'wide-grip-cable-row', 2, 15, 20, B],
    ['ESPALDA', 't-bar-row', 3, 8, 12],
    ['BÍCEPS', 'cable-ez-bar-curl', 3, 8, 12],
    ['BÍCEPS', 'seated-cable-preacher-curl', 3, 8, 12],
    ['BÍCEPS', 'bayesian-cable-curl', 3, 8, 12],
    ['ANTEBRAZO', 'farmers-carry', 1, null, null, { seconds: 120 }],
    ['ANTEBRAZO', 'dumbbell-wrist-curl', 3, 10, 15],
    ['ANTEBRAZO', 'reverse-ez-bar-curl', 3, 10, 15],
  ],
  legs: [
    ['LEGS', 'horizontal-leg-press', 3, 8, 12, A],
    ['LEGS', 'barbell-squat', 3, 8, 10, A],
    ['LEGS', 'leg-extension', 3, 8, 10, A],
    ['LEGS', 'calf-raise', 3, 8, 10, { week: 'A', note: 'heavy' }],
    ['LEGS', 'hip-abduction', 4, 10, 12, { week: 'B' }],
    ['LEGS', 'bulgarian-split-squat', 2, 10, 12, { week: 'B' }],
    ['LEGS', 'seated-leg-curl', 3, 8, 10, { week: 'B' }],
    ['LEGS', 'rdl', 2, 8, 10, { week: 'B' }],
    ['LEGS', 'calf-raise', 3, 8, 10, { week: 'B' }],
    ['LEGS', 'hack-squat', 2, 6, 8, { week: 'B' }],
  ],
  upper: [
    ['ESPALDA', 't-bar-row', 3, 8, 12],
    ['ESPALDA', 'dumbbell-row', 3, 10, 12],
    ['BÍCEPS', 'ez-bar-curl', 3, 8, 12],
    ['BÍCEPS', 'machine-supported-hammer-curl', 3, 10, 10],
    ['PECHO', 'incline-dumbbell-press', 3, 8, 10],
    ['PECHO', 'bench-press', 2, 15, 20],
    ['HOMBRO', 'single-arm-cuffed-lateral-raise', 3, 8, 10],
    ['HOMBRO', 'y-raise', 2, 10, 15],
    ['TRÍCEPS', 'cable-tricep-pushdown', 3, 8, 12],
    ['TRÍCEPS', 'katana-extension', 3, 10, 15],
  ],
  lower: [
    ['LOWER', 'weighted-lunges-in-place', 3, 10, 10, A],
    ['LOWER', 'sissy-squat', 3, 10, 10, A],
    ['LOWER', 'box-squat', 4, 6, 6, A],
    ['LOWER', 'rdl', 2, 10, 10, A],
    ['LOWER', 'seated-calf-raise', 3, 10, 10, A],
    ['LOWER', 'calf-raise', 3, 8, 10, A],
  ],
};

export function seedSlots(): Slot[] {
  const slots: Slot[] = [];
  for (const day of SEED_DAYS) {
    WARMUPS[day.id].forEach(([exerciseId, sets, repMin, repMax, seconds], i) => {
      slots.push({
        id: `${day.id}-w${i + 1}`,
        dayId: day.id,
        block: 'warmup',
        section: 'CALENTAMIENTO',
        order: i,
        exerciseId,
        sets,
        repMin,
        repMax,
        seconds,
        week: 'both',
        alternatives: [],
        note: '',
      });
    });
    // Separate counters per variant so A and B lists each run 0..n.
    const counters: Record<SlotWeek, number> = { both: 0, A: 0, B: 0 };
    let order = 0;
    WORK[day.id].forEach(([section, exerciseId, sets, repMin, repMax, o = {}], i) => {
      const week = o.week ?? 'both';
      if (!o.pairWithPrev && i > 0) order++;
      counters[week]++;
      slots.push({
        id: `${day.id}-${week === 'both' ? 'x' : week.toLowerCase()}${counters[week]}`,
        dayId: day.id,
        block: 'work',
        section,
        order,
        exerciseId,
        sets,
        repMin,
        repMax,
        seconds: o.seconds ?? null,
        week,
        alternatives: o.alts ?? [],
        note: o.note ?? '',
      });
    });
  }
  return slots;
}
