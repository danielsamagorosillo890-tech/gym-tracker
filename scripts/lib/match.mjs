// Matching between our catalog and free-exercise-db. Pure functions (tested).

const STOP = new Set(['the', 'a', 'with', 'on', 'to', 'of', 'and', 'machine', 'attachment', '-']);

export function normalize(name) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['’]s\b/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter((t) => t && !STOP.has(t))
    .map((t) => (t.length > 3 && t.endsWith('s') && !t.endsWith('ss') ? t.slice(0, -1) : t))
    .join(' ');
}

export function similarity(a, b) {
  const A = new Set(normalize(a).split(' ').filter(Boolean));
  const B = new Set(normalize(b).split(' ').filter(Boolean));
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / (A.size + B.size - inter);
}

/**
 * Classifies each catalog exercise into high / doubtful / none.
 * - Curated map wins (doubtful entries are promoted only if listed in `approved`).
 * - Otherwise: same normalized name = high; best similarity ≥ 0.5 = doubtful; else none.
 */
export function matchCatalog(catalog, db, curated) {
  const byName = new Map(db.map((e) => [e.name, e]));
  const byNorm = new Map(db.map((e) => [normalize(e.name), e]));
  const approved = new Set(curated.approved ?? []);
  const out = { high: [], doubtful: [], none: [], errors: [] };

  for (const ex of catalog) {
    const c = curated.map?.[ex.id];
    if (c) {
      if (c.confidence === 'none' || !c.name) {
        out.none.push({ ex });
        continue;
      }
      const src = byName.get(c.name);
      if (!src) {
        out.errors.push(`"${ex.id}": no existe "${c.name}" en la base`);
        out.none.push({ ex });
        continue;
      }
      if (c.confidence === 'high') out.high.push({ ex, src, reason: 'mapa' });
      else if (approved.has(ex.id)) out.high.push({ ex, src, reason: 'aprobado' });
      else out.doubtful.push({ ex, src, why: c.why ?? '' });
      continue;
    }
    const exact = byNorm.get(normalize(ex.name));
    if (exact) {
      out.high.push({ ex, src: exact, reason: 'mismo nombre' });
      continue;
    }
    let best = null;
    let score = 0;
    for (const e of db) {
      const s = similarity(ex.name, e.name);
      if (s > score) {
        score = s;
        best = e;
      }
    }
    if (best && score >= 0.5) {
      if (approved.has(ex.id)) out.high.push({ ex, src: best, reason: 'aprobado' });
      else out.doubtful.push({ ex, src: best, why: `Parecido por nombre (${Math.round(score * 100)}%).` });
    } else out.none.push({ ex });
  }
  return out;
}
