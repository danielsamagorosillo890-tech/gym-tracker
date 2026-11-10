import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import cues from './cues.es-MX.json';
import manifest from './media-manifest.json';
import { seedExercises } from './seed';
import { framesFor, techniqueFor } from './technique';

const all = seedExercises();

describe('technique drafts', () => {
  it('every seeded exercise has 3–4 cues, a muscle and a common mistake, as a draft', () => {
    for (const ex of all) {
      const t = techniqueFor(ex);
      expect(t, ex.id).not.toBeNull();
      expect(t!.cues.length, ex.id).toBeGreaterThanOrEqual(3);
      expect(t!.cues.length, ex.id).toBeLessThanOrEqual(4);
      expect(t!.muscle.length, ex.id).toBeGreaterThan(0);
      expect(t!.mistake.length, ex.id).toBeGreaterThan(0);
      expect(t!.reviewed, ex.id).toBe(false);
    }
  });

  it('has no drafts for unknown ids', () => {
    const ids = new Set(all.map((e) => e.id));
    expect(Object.keys(cues).filter((k) => !ids.has(k))).toEqual([]);
  });

  it('a user-edited version wins over the draft', () => {
    const ex = { ...all.find((e) => e.id === 'bench-press')!, technique: { cues: ['a', 'b', 'c'], muscle: 'm', mistake: 'x', reviewed: true } };
    expect(techniqueFor(ex)?.reviewed).toBe(true);
  });
});

describe('media manifest', () => {
  it('every listed frame exists in public/', () => {
    for (const [id, item] of Object.entries(manifest.items)) {
      expect(item.frames.length, id).toBe(2);
      for (const f of item.frames) expect(existsSync(join(process.cwd(), 'public', f)), f).toBe(true);
    }
  });

  it('only references catalog exercises', () => {
    const ids = new Set(all.map((e) => e.id));
    expect(Object.keys(manifest.items).filter((k) => !ids.has(k))).toEqual([]);
    expect(framesFor('bench-press')?.frames).toHaveLength(2);
    expect(framesFor('katana-extension')).toBeNull();
  });
});
