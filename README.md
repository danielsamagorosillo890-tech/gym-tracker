# Gym Tracker

App personal para registrar entrenamientos de gimnasio. PWA instalable en Android,
funciona sin conexión y guarda todo en el celular (IndexedDB). Sin cuentas ni servidor.

**App:** https://danielsamagorosillo890-tech.github.io/gym-tracker/

La especificación completa y las decisiones tomadas están en
[prompt-gym-tracker.md](prompt-gym-tracker.md) (sección 11 para lo decidido después de la Fase 0).

## Comandos

```bash
npm install          # una vez
npm run dev          # servidor de desarrollo
npm test             # pruebas (Vitest)
npm run build        # compila a dist/
npm run preview      # sirve dist/ en http://localhost:4173
npm run media        # regenera las fotos de técnica (ver abajo)
```

## Publicar

Cada push a `main` corre las pruebas, compila y publica en GitHub Pages
(`.github/workflows/deploy.yml`). Si una prueba falla, no se publica.

En el celular aparece "Hay una versión nueva · Actualizar". Nunca se actualiza sola a media sesión.

## Fotos de técnica

Vienen de [free-exercise-db](https://github.com/yuhonas/free-exercise-db) (dominio público). Ver [CREDITS.md](CREDITS.md).

- `npm run media` descarga la base (en `.media-cache/`, ignorada por git), empareja con el catálogo,
  genera WebP de 480 px en `public/media/` y escribe `src/data/media-manifest.json` y
  [media-coverage.md](media-coverage.md).
- **Aprobar un dudoso:** agrega su id a `"approved"` en `scripts/media-map.json` y corre `npm run media`.
- **Ejercicios nuevos** creados en la app: exporta un respaldo y corre
  `npm run media -- --catalog ruta/al/respaldo.json`.
- Las indicaciones en borrador están en `src/data/cues.es-MX.json`.

## Datos y respaldo

- Todo vive en IndexedDB del navegador (`gym-tracker`). El modo demo usa otra base (`gym-tracker-demo`).
- Ajustes → Respaldo descarga o comparte un JSON con `schemaVersion`. Antes de importar se guarda una
  copia automática de lo actual (las últimas 3).
- Las fotos y videos que subas desde el celular **no** van en el JSON.
- La app avisa si pasan más de 14 días sin respaldo.

## Estructura

```
src/
  data/      modelo (types), Dexie (db), siembra, respaldo, acciones, técnica
  logic/     reglas puras con pruebas: ciclo, variante A/B, pre-llenado,
             progresión, PRs, volumen, CSV, descarga, demo
  screens/   Hoy (por pasos), Rutina, Progreso, Historial, Cuerpo, Ajustes
  ui/        componentes compartidos (hoja, gráfica, temporizador, iconos)
scripts/     build-media.mjs y el emparejador (corren en la computadora)
public/      íconos y fotos WebP
```
