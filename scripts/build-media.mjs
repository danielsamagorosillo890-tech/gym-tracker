#!/usr/bin/env node
// Builds technique photos from free-exercise-db (public domain, The Unlicense).
// Runs on your computer, never on the phone:
//
//   npm run media                     # uses the seed catalog
//   npm run media -- --catalog respaldo.json   # uses the exercises of an exported backup
//   npm run media -- --offline        # reuse cached downloads only
//
// Output: public/media/*.webp, src/data/media-manifest.json, media-coverage.md.
// Doubtful matches are listed but NOT used until you add their id to "approved"
// in scripts/media-map.json and run it again.

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { matchCatalog } from './lib/match.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const RAW = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main';
const CACHE = join(root, '.media-cache'); // downloaded, untrusted data lives only here
const OUT = join(root, 'public', 'media');
const MANIFEST = join(root, 'src', 'data', 'media-manifest.json');
const REPORT = join(root, 'media-coverage.md');
const WIDTH = 480;
const QUALITY = 68;
const MAX_BYTES = 3_000_000;

const args = process.argv.slice(2);
const offline = args.includes('--offline');
const catIdx = args.indexOf('--catalog');
const catalogPath = catIdx >= 0 ? args[catIdx + 1] : null;

async function download(url, dest) {
  if (existsSync(dest)) return;
  if (offline) throw new Error(`Falta en caché (modo --offline): ${dest}`);
  const res = await fetch(url, { headers: { 'User-Agent': 'gym-tracker-media-build' } });
  if (!res.ok) throw new Error(`${res.status} al descargar ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_BYTES) throw new Error(`Archivo demasiado grande: ${url}`);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, buf);
}

async function loadCatalog() {
  if (catalogPath) {
    const file = JSON.parse(readFileSync(resolve(catalogPath), 'utf8'));
    if (file.app !== 'gym-tracker') throw new Error('Ese archivo no es un respaldo de Gym Tracker.');
    return file.data.exercises;
  }
  // Node strips the TypeScript types of seed.ts (it only has type imports).
  const seed = await import(pathToFileURL(join(root, 'src', 'data', 'seed.ts')).href);
  return seed.seedExercises();
}

async function main() {
  mkdirSync(CACHE, { recursive: true });
  const dbFile = join(CACHE, 'exercises.json');
  await download(`${RAW}/dist/exercises.json`, dbFile);
  const db = JSON.parse(readFileSync(dbFile, 'utf8'));
  if (!Array.isArray(db) || !db.every((e) => typeof e.name === 'string' && Array.isArray(e.images))) {
    throw new Error('exercises.json no tiene el formato esperado.');
  }
  const curated = JSON.parse(readFileSync(join(root, 'scripts', 'media-map.json'), 'utf8'));
  const catalog = await loadCatalog();
  const result = matchCatalog(catalog, db, curated);

  mkdirSync(OUT, { recursive: true });
  const items = {};
  const keep = new Set();
  for (const { ex, src } of result.high) {
    const frames = [];
    for (const [i, img] of src.images.slice(0, 2).entries()) {
      if (!/^[\w\-./]+\.(jpe?g|png)$/i.test(img) || img.includes('..')) throw new Error(`Ruta de imagen inválida: ${img}`);
      const cached = join(CACHE, 'images', img);
      await download(`${RAW}/exercises/${img}`, cached);
      const name = `${ex.id}-${i}.webp`;
      await sharp(cached).resize({ width: WIDTH, withoutEnlargement: true }).webp({ quality: QUALITY }).toFile(join(OUT, name));
      frames.push(`media/${name}`);
      keep.add(name);
    }
    items[ex.id] = { frames, sourceName: src.name, sourceId: src.id };
    process.stdout.write('.');
  }
  for (const f of readdirSync(OUT)) if (f.endsWith('.webp') && !keep.has(f)) rmSync(join(OUT, f));

  writeFileSync(
    MANIFEST,
    JSON.stringify({ source: 'free-exercise-db (The Unlicense)', generatedAt: new Date().toISOString().slice(0, 10), items }, null, 2) + '\n',
  );

  const sizeKb = Math.round(readdirSync(OUT).reduce((s, f) => s + readFileSync(join(OUT, f)).length, 0) / 1024);
  const line = (x) => `- **${x.ex.name}** (\`${x.ex.id}\`)${x.src ? ` → ${x.src.name}` : ''}${x.why ? ` — ${x.why}` : ''}${x.reason ? ` _(${x.reason})_` : ''}`;
  const md = [
    '# Cobertura de visuales',
    '',
    `Fuente: [free-exercise-db](https://github.com/yuhonas/free-exercise-db) (dominio público, The Unlicense). Generado ${new Date().toISOString().slice(0, 10)}.`,
    `Fotos: ${Object.keys(items).length} ejercicios, ${keep.size} imágenes WebP de ${WIDTH} px, ${sizeKb} KB en total.`,
    '',
    `## Emparejados con confianza alta (${result.high.length}) — se usan`,
    '',
    ...result.high.map(line),
    '',
    `## Dudosos (${result.doubtful.length}) — NO se usan hasta que los apruebes`,
    '',
    'Para aprobar uno, agrega su id a `"approved"` en `scripts/media-map.json` y corre `npm run media`.',
    '',
    ...result.doubtful.map(line),
    '',
    `## Sin visual (${result.none.length}) — la app los marca para que subas el tuyo`,
    '',
    ...result.none.map(line),
    '',
    ...(result.errors.length ? ['## Errores del mapa', '', ...result.errors.map((e) => `- ${e}`), ''] : []),
  ].join('\n');
  writeFileSync(REPORT, md);

  console.log(`\nListo: ${result.high.length} con foto, ${result.doubtful.length} dudosos, ${result.none.length} sin visual, ${sizeKb} KB.`);
  if (result.errors.length) console.log('Errores:', result.errors);
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
