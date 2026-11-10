import { describe, expect, it } from 'vitest';
import { matchCatalog, normalize, similarity } from './match.mjs';

const db = [
  { name: 'Barbell Squat', id: 'Barbell_Squat' },
  { name: 'Leg Extensions', id: 'Leg_Extensions' },
  { name: 'Triceps Pushdown', id: 'Triceps_Pushdown' },
  { name: 'Hammer Curls', id: 'Hammer_Curls' },
];

describe('media matching', () => {
  it('normalizes plurals, punctuation and stop words', () => {
    expect(normalize('Leg Extensions')).toBe(normalize('leg extension'));
    expect(normalize("Farmer's Walk")).toBe('farmer walk');
  });

  it('similarity is 1 for equivalent names and low for unrelated', () => {
    expect(similarity('Leg Extension', 'Leg Extensions')).toBe(1);
    expect(similarity('Katana extension', 'Barbell Squat')).toBe(0);
  });

  it('exact name match is high confidence', () => {
    const r = matchCatalog([{ id: 'leg-extension', name: 'Leg extension' }], db, { map: {} });
    expect(r.high.map((x) => x.src.id)).toEqual(['Leg_Extensions']);
  });

  it('curated doubtful is not used until approved', () => {
    const cur = { map: { 'hc': { name: 'Hammer Curls', confidence: 'doubtful' } }, approved: [] };
    const cat = [{ id: 'hc', name: 'Machine hammer curl' }];
    expect(matchCatalog(cat, db, cur).doubtful).toHaveLength(1);
    expect(matchCatalog(cat, db, { ...cur, approved: ['hc'] }).high).toHaveLength(1);
  });

  it('curated none and unknown names go to none; bad map names are reported', () => {
    const cur = { map: { k: { confidence: 'none' }, bad: { name: 'Nope', confidence: 'high' } } };
    const r = matchCatalog(
      [
        { id: 'k', name: 'Katana extension' },
        { id: 'bad', name: 'X' },
        { id: 'z', name: 'Partial dragon squat' },
      ],
      db,
      cur,
    );
    expect(r.none.map((x) => x.ex.id)).toEqual(['k', 'bad', 'z']);
    expect(r.errors).toHaveLength(1);
  });

  it('similar names become doubtful candidates', () => {
    const r = matchCatalog([{ id: 'p', name: 'Single-arm triceps pushdown' }], db, { map: {} });
    expect(r.doubtful.map((x) => x.src.id)).toEqual(['Triceps_Pushdown']);
  });
});
