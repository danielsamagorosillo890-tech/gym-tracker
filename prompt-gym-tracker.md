# Gym Tracker: especificación para Claude Code

## 0. Cómo quiero que trabajes

- Háblame y escribe toda la interfaz en español de México. Identificadores y comentarios de código en inglés.
- Trabaja por fases (sección 9). Al terminar cada una dime qué quedó, cómo probarlo en mi Android paso a paso y qué pudo fallar. Luego espera mi "sigue".
- Empieza con un plan corto (máximo 15 líneas: stack, carpetas, cómo vas a probar el guardado) y sigue directo con la Fase 0 sin esperar aprobación, salvo que algo te bloquee.
- No crees cuentas ni me pidas contraseñas o tokens: los inicios de sesión los hago yo. No publiques ni hagas push a ningún lado sin preguntarme.
- Haz `git init` y un commit al cerrar cada fase.
- Quiero crítica directa: si algo de esta especificación es mala idea o está incompleto, dímelo antes de implementarlo.

## 1. Qué es

App personal para registrar entrenamientos de gimnasio, de un solo usuario. Vive en un Android (Chrome) como PWA instalada. Se usa de pie, entre series, con una mano: registrar una serie debe tomar menos de 5 segundos. Funciona sin señal. Sin cuentas ni backend por ahora: los datos viven en el dispositivo y el respaldo es exportar/importar. Unidad: kg.

Principio rector: si registrar es lento, la app se abandona. Todo lo demás es secundario a la velocidad de la pantalla "Hoy".

## 2. Reglas de diseño

- Mobile-first (360 a 412 px de ancho), objetivos táctiles de al menos 48 px, números grandes, `inputmode="decimal"`; aceptar punto y coma como decimal.
- Tema oscuro por defecto, con tema claro opcional. Legible con poca luz y con sol.
- Sin diálogos nativos (`alert`, `confirm`): las confirmaciones destructivas van dentro de la interfaz.
- Todo empaquetado, sin CDNs ni servicios externos en tiempo de ejecución. Debe funcionar en modo avión. Único enlace externo: "Ver técnica en YouTube".
- Sin analítica ni rastreo.
- Navegación inferior con 5 pestañas: Hoy, Rutina, Progreso, Historial, Cuerpo. Ajustes con un ícono en el encabezado.
- Sin emojis como decoración. Un solo color de acento, y colores semánticos aparte (PR, avisos).

## 3. Stack sugerido

Vite + TypeScript + React (o Preact), IndexedDB con Dexie, vite-plugin-pwa, gráficas ligeras (uPlot o SVG propio) y Vitest para la lógica. Si propones otro stack, justifícalo en dos líneas. Presupuesto: app más assets, menos de 15 MB en caché.

## 4. Modelo de datos

Afínalo si hace falta, pero conserva estos conceptos.

- **Exercise** (catálogo; un ejercicio existe una sola vez aunque aparezca en varios días): nombre, grupo (Pecho, Hombro, Tríceps, Espalda, Bíceps, Antebrazo, Cuádriceps, Isquios y glúteo, Pantorrilla), tipo (compuesto o aislamiento), métrica (`peso_reps`, `tiempo_peso` o `check`), porLado, pesoPor (total, mancuerna o pila), unidadCaptura (kg o lb; siempre se guarda en kg), pasoKg (2.5 por defecto, editable por ejercicio), descansoSeg, notas, ajustesMaquina (texto libre), media, cues.
- **Day**: Push, Pull, Legs, Upper, Lower, con su orden en el ciclo.
- **Slot** (un ejercicio dentro de un día): día, bloque (calentamiento o trabajo), sección visible ("PECHO", "HOMBRO"...), orden, ejercicio, series, repMin, repMax (o segundos), semana (A, B o ambas), alternativas (otros ejercicios que lo pueden sustituir), nota ("heavy").
- **Session**: día, variante (A o B), inicio, fin, estado (en_curso, terminada, saltada), nota.
- **SetLog**: sesión, ejercicio realmente hecho, slot, índice, tipo (trabajo o calentamiento), kg, reps, segundos, completada, hora.
- **WarmupCheck**: sesión, slot, hecho.
- **BodyWeight**: fecha, kg.
- **CycleState**: índice del siguiente día.
- **Settings** y **MediaBlob** (visuales que yo suba).

Una serie "por lado" se registra una sola vez (mismos kg y reps en ambos lados) y cuenta como 1 serie. Peso en barra: total, incluida la barra. Mancuernas: kg por mancuerna.

## 5. Reglas de lógica (cada una con pruebas unitarias)

**5.1 Ciclo rotativo.** El orden es Push, Pull, Legs, Upper, Lower y vuelve a Push. "Hoy" muestra el siguiente día del ciclo: el que sigue al último día que terminé, sin importar el día de la semana. Debo poder elegir otro día ("Hacer otro día"; al terminarlo, el siguiente es el que sigue a ese) o saltar el día sugerido sin registrar nada. Una sesión saltada no cuenta para la variante A/B.

**5.2 Variante A/B.** "Semana A/B" NO es la semana de calendario. La variante de un día se decide por cuántas sesiones terminadas de ESE día llevo: 0, 2, 4... es A; 1, 3, 5... es B. Una sesión terminada es la que tiene al menos una serie de trabajo completada. Cada slot con semana A o B solo aparece en su variante; los de "ambas" siempre. Si una variante no tiene ejercicios (Lower B por ahora), usa la A y muéstrame una nota en pantalla. Puedo cambiar a mano la variante de la sesión de hoy. Al borrar una sesión, la paridad se recalcula.

**5.3 Pre-llenado.** Cada serie nace con los kg y reps de la misma serie en la última sesión terminada del mismo slot (mismo día y mismo ejercicio), y muestra "la vez pasada: 60 x 8, 8, 7". Esto importa porque un mismo ejercicio puede tener rangos distintos según el día (Bench press es 8-10 en Push y 15-20 en Upper). Si el slot nunca se ha hecho pero el ejercicio sí en otro día, muestra esa marca solo como referencia, sin pre-llenar kg. "Igual que la vez pasada" llena todo el ejercicio. Sin historial: kg vacío y reps en repMin.

**5.4 Doble progresión (solo sugerencia, nunca automática).** Se evalúa por slot. Si en la última sesión del slot todas las series de trabajo llegaron a repMax con el mismo kg (o más), muestra una ficha "Sube a X kg" (X = kg + pasoKg) que, al tocarla, pre-llena todas las series con X kg y repMin. Si todas las series están entre repMin y repMax, mantén el kg y la meta es más reps. Si alguna quedó debajo de repMin, mantén el kg. Para `tiempo_peso`, si completé el tiempo objetivo, sugiere subir kg. Un rango fijo (3 x 10) tiene repMin igual a repMax.

**5.5 1RM estimado y PRs.** 1RM estimado = kg * (1 + reps / 30) (Epley), solo para series de trabajo con 12 reps o menos; con más reps no se calcula. Una serie de trabajo es PR cuando (a) supera el mejor 1RM estimado previo del ejercicio, o (b) tiene más reps que cualquier serie previa con el mismo kg o más, o (c) en `tiempo_peso`, dura más con el mismo kg o más. El primer registro de un ejercicio no es PR (no hay base). Los empates no cuentan. Los calentamientos nunca cuentan.

**5.6 Volumen.** Métrica principal: series de trabajo por grupo muscular por semana de calendario (lunes a domingo), últimas 8 semanas. Las series por lado cuentan 1; los calentamientos no cuentan. Métrica secundaria: tonelaje por sesión = suma de kg * reps tal como se registró, sin multiplicar por mancuernas ni por lado.

**5.7 Cambiar ejercicio.** En "Hoy", cada ejercicio se puede cambiar por una alternativa del slot o por cualquiera del catálogo, "solo hoy" o "dejarlo fijo en la rutina". Las series se guardan con el ejercicio que realmente hice, para que el progreso quede correcto.

**5.8 Sesión en curso.** Todo se guarda al instante. Si cierro la app a media sesión, al abrirla recupera la sesión en curso. Mientras hay sesión en curso la pantalla no se apaga (Wake Lock; tolera que no esté soportado).

## 6. Pantallas

**Hoy.** Encabezado con el día y la variante (por ejemplo "Pull · Semana B") y accesos a "Hacer otro día" y "Saltar". Calentamiento como lista con check (los de tiempo tienen cuenta regresiva al tocarlos), plegable. Luego los ejercicios agrupados por sección como los escribí. Cada ejercicio muestra: nombre, meta ("3 x 8-10"), la vez pasada, la ficha de progresión si aplica, filas de series (kg, reps, check), "+ serie", "Igual que la vez pasada", botón de técnica y menú (cambiar, notas, ajustes de máquina). Al marcar una serie arranca el temporizador de descanso (150 s compuestos, 90 s aislamiento, editable) en una barra fija abajo con +15 s y saltar; vibra al terminar si el navegador lo permite. Metas de velocidad: una serie igual que la vez pasada es 1 toque; con cambio de peso, 3 toques o menos. "Terminar sesión" muestra resumen: duración, series, tonelaje y PRs.

**Rutina.** Editar días, slots, series, rangos, variante A/B/ambas, alternativas y orden (botones subir/bajar o arrastrar), y agregar ejercicios nuevos al catálogo. Una variante vacía se muestra como "Por definir" con las acciones "Copiar de la otra" y "Crear".

**Progreso.** Buscador de ejercicio agrupado por grupo muscular. Por ejercicio: gráfica de la mejor serie de cada sesión (kg) y 1RM estimado cuando aplique; rangos de 4 semanas, 12 semanas y todo; tarjetas "Mejor marca" y "Último"; lista de PRs. Si el ejercicio está en más de un día con rangos distintos, ofrece filtro por día (Todos, Push, Upper...). Aparte, panel de volumen semanal por grupo muscular. Gráficas legibles en tema claro y oscuro, con unidades en los ejes y tooltip al tocar un punto. Con poca historia, un estado vacío que explique qué aparecerá y cuándo.

**Historial.** Lista por fecha (día, variante, duración, tonelaje). Al tocar, detalle editable: corregir series, notas, borrar sesión con confirmación.

**Cuerpo.** Registrar peso corporal (kg, fecha) y su gráfica. Medidas (cintura, pecho, brazo, muslo) en la Fase 4.

**Ajustes.** Tema, descansos por tipo, exportar/importar JSON con `schemaVersion` (antes de importar, guardar copia automática de lo actual), exportar CSV (descarga de archivo y Web Share si existe), recordatorio de respaldo (aviso si pasan más de 14 días), indicador de si el navegador concedió almacenamiento persistente, borrar todo (doble confirmación) y modo demo.

**Modo demo.** Genera 12 semanas de historial sintético en una base de datos SEPARADA, con un banner permanente "Datos de demostración" y botón para salir. Sirve para probar gráficas sin tocar mis datos reales.

## 7. Referencias visuales y técnica

Cada ejercicio (calentamientos incluidos) tiene una ficha de técnica:

1. **Animación:** dos fotos (inicio y final del movimiento) alternadas con fundido suave, cuando existan.
2. **Texto:** 3 a 4 indicaciones de ejecución, músculo principal y error común. Redáctalos como borrador en español de México (`cues.es-MX.json`) con `revisado: false`; la app muestra una etiqueta "Borrador" hasta que yo marque el ejercicio como revisado.
3. **Botón "Ver técnica en YouTube"** (búsqueda con el nombre del ejercicio).
4. **Subir mi propio video, foto o GIF** desde el celular (se guarda en el dispositivo).

Fuente de las fotos: la base abierta free-exercise-db (github.com/yuhonas/free-exercise-db), reportada como dominio público (Unlicense), con fotos fijas y sin GIFs. Confirma el archivo LICENSE del repo antes de usar nada y guarda un `CREDITS.md`. Haz un script de construcción (que corre en mi computadora, no en el celular) que descargue el JSON, empareje por nombre con mi catálogo, optimice las imágenes a WebP chicas y genere `media-coverage.md` con tres listas: emparejados con confianza alta, dudosos (no los uses hasta que yo apruebe) y sin visual. Muchos ejercicios míos son poco comunes (Bayesian cable curl, katana extension, cuffed lateral raise, partial dragon squat, sissy squat), así que es esperable que varios queden sin visual; la app debe marcarlos para que yo los vaya llenando.

No uses GIFs de ExerciseDB ni de ninguna fuente de licencia dudosa, y no hagas scraping de sitios.

## 8. Rutina inicial (siémbrala tal cual)

Los nombres ya están normalizados. Leyenda: [A] y [B] son las variantes; sin etiqueta, el ejercicio va en ambas. Las parejas [A]/[B] seguidas ocupan la misma posición en el orden. [por lado] significa que se cuenta por lado. [tiempo] significa que se mide en tiempo con peso. Entre paréntesis, mis notas originales.

### PUSH

Calentamiento (checklist):
- Circles — 20 s
- Arm swings — 20 s
- Chest flys — 12 reps (ligero)
- Band rotation
- Assisted push-ups
- Rotator cuff warm-up

PECHO
- Bench press — 3 × 8-10
- Incline dumbbell press — 3 × 8-10
- Seated cable fly — 3 × 8-10

HOMBRO
- Smith machine military press — 3 × 8-10
- Dumbbell shoulder press — 3 × 8-10
- Front Y raise (de pie) — 3 × 8-10
- One-arm reverse fly — 3 × 8-10 [por lado]

TRÍCEPS
- Single-arm tricep pushdown — 3 × 8-12 [por lado]
- Reverse tricep pushdown — 3 × 8-12 (alternativa: Cable tricep pushdown)
- Rope pushdown — 3 × 8-12
- One-arm overhead tricep extension — 3 × 10-12 [por lado]

### PULL

Calentamiento (checklist):
- Banded shoulder dislocates — 12 reps
- Band pull-aparts — 12 reps
- Arm circles — 20 s
- Assisted pull-ups — 12 reps

ESPALDA
- Close-grip lat pulldown — 3 × 10-15 [A]
- Wide-grip lat pulldown — 3 × 10-15 [B]
- Chest-supported machine row — 3 × 8-12 [A]
- Seated row (enfocado en upper back) — 3 × 8-12 [B]
- Close-grip cable row — 2 × 15-20 [A]
- Wide-grip cable row — 2 × 15-20 [B]
- T-bar row — 3 × 8-12

BÍCEPS
- Cable EZ-bar curl — 3 × 8-12
- Seated cable preacher curl — 3 × 8-12
- Bayesian cable curl — 3 × 8-12

ANTEBRAZO
- Farmer's carry — 1 × 2 min [tiempo]
- Dumbbell wrist curl — 3 × 10-15
- Reverse EZ-bar curl — 3 × 10-15

### LEGS

Calentamiento (checklist):
- Hip openers — 2 × 10-12 [por lado]
- Lunges — 2 × 10 [por lado]
- 90/90s — 2 × 10-12 [por lado]
- Cossack squat — 2 × 5-10 [por lado]

LEGS [A] (Legs 1)
- Horizontal leg press machine — 3 × 8-12
- Barbell squat — 3 × 8-10
- Leg extension — 3 × 8-10
- Calf raise — 3 × 8-10 (heavy)

LEGS [B] (Legs 2)
- Hip abduction — 4 × 10-12
- Bulgarian split squat — 2 × 10-12 [por lado]
- Seated leg curl — 3 × 8-10
- RDL — 2 × 8-10
- Calf raise — 3 × 8-10
- Hack squat — 2 × 6-8

### UPPER

Calentamiento (checklist):
- Banded shoulder dislocates — 12 reps
- Band pull-aparts — 12 reps
- Assisted pull-ups — 12 reps
- Chest flys — 12 reps

ESPALDA
- T-bar row — 3 × 8-12
- Dumbbell row — 3 × 10-12

BÍCEPS
- EZ-bar curl — 3 × 8-12
- Machine-supported hammer curl — 3 × 10 (rango fijo: repMin = repMax = 10)

PECHO
- Incline dumbbell press — 3 × 8-10
- Bench press — 2 × 15-20

HOMBRO
- Single-arm cuffed lateral raise — 3 × 8-10 [por lado]
- Y raise (acostado; es un ejercicio distinto de Front Y raise) — 2 × 10-15

TRÍCEPS
- Cable tricep pushdown — 3 × 8-12
- Katana extension — 3 × 10-15

### LOWER

Calentamiento (checklist):
- Lunges — 2 × 10 [por lado]
- 90/90s — 2 × 10-12 [por lado]
- Cossack squat — 2 × 5-10 [por lado]
- Partial dragon squat — 2 × 8 [por lado]

LOWER [A] (semana 1)
- Weighted lunges in place — 3 × 10
- Sissy squat — 3 × 10
- Box squat — 4 × 6
- RDL — 2 × 10
- Seated calf raise — 3 × 10
- Calf raise — 3 × 8-10

LOWER [B] (semana 2): por definir. Mientras tanto, usar la A.

### Supuestos que revisaré yo

- Solo marqué [por lado] lo que anoté como one arm, single arm o each side/leg. Dumbbell row, Bayesian cable curl y Weighted lunges in place se registran como series normales hasta que yo los cambie.
- El grupo muscular, el tipo (compuesto o aislamiento) y la unidad de cada ejercicio son propuesta tuya. Asígnalos en la siembra y muéstramelos al terminar la Fase 1 para corregirlos (por ejemplo hip abduction a Isquios y glúteo, reverse EZ-bar curl a Antebrazo, one-arm reverse fly a Hombro).
- Farmer's carry es una sola serie de 2 minutos, con kg y tiempo.

## 9. Fases

**Fase 0: prueba crítica (antes de cualquier diseño).** App mínima: una pantalla con un botón "+ serie de prueba" que guarde kg, reps y hora en IndexedDB y las liste, más manifest, service worker y un indicador de si el almacenamiento persistente fue concedido (`navigator.storage.persist()`). Instálala en mi Android. Para que se pueda instalar necesita HTTPS: propón las opciones de alojamiento gratis más simples (por ejemplo GitHub Pages, Netlify Drop o Cloudflare Pages) con pros y contras en 3 líneas cada una y pregúntame cuál prefiero antes de configurar nada. Dame un checklist de prueba: instalar desde Chrome, guardar 3 series, cerrar la app, matarla desde recientes, reiniciar el celular, abrirla en modo avión y confirmar que todo sigue ahí. No pases a la Fase 1 hasta que yo confirme que pasó.

**Fase 1: núcleo.** Modelo completo, siembra de la rutina (sección 8), ciclo y variantes (5.1 y 5.2), pantalla Hoy completa (pre-llenado, doble progresión, temporizador, cambiar ejercicio, notas y ajustes de máquina, terminar sesión), pantalla Rutina con edición, exportar/importar JSON y `navigator.storage.persist()` al guardar la primera serie. Pruebas unitarias de 5.1 a 5.7. Con esto ya debo poder usarla en el gym.

**Fase 2: progreso e historial.** Pestañas Progreso e Historial, 1RM, PRs, volumen semanal y modo demo para probar las gráficas.

**Fase 3: referencias visuales y técnica.** Sección 7.

**Fase 4: cuerpo y extras.** Peso corporal y medidas, exportar CSV, recordatorio de respaldo y semanas de descarga (deload) opcionales.

## 10. Calidad y pruebas

- Pruebas unitarias (Vitest) de: ciclo (avanzar, saltar, otro día), variante A/B (paridad, respaldo de Lower B, sesión saltada, borrado), pre-llenado por slot, doble progresión, 1RM y PRs (incluyendo más de 12 reps y primer registro), volumen (por lado y calentamientos) y exportar/importar ida y vuelta sin pérdida.
- Verifica en una ventana de 390 px de ancho que no haya scroll horizontal y que todo sea alcanzable con una mano.
- Rendimiento: abrir en menos de 2 segundos en un Android de gama media, incluso sin señal.
- Accesibilidad básica: contraste suficiente en ambos temas y foco visible.

## 11. Decisiones tomadas (10 nov 2026, tras la Fase 0)

Estas decisiones mandan sobre lo escrito arriba si hay conflicto.

- **Fase 0 aprobada** en Android: los datos sobreviven a cerrar la app, matarla desde recientes, reiniciar y modo avión. `persist()` aún sale "No concedido" (Chrome lo decide por uso); el respaldo es la protección real.
- **Recordatorio de respaldo en la Fase 1** (no en la 4): aviso si pasan más de 14 días sin exportar.
- **Notificaciones para el descanso:** pedir permiso la primera vez que arranque un temporizador, una sola vez; si el permiso se niega, la app sigue funcionando igual. Avisar al terminar el descanso aunque la app esté en segundo plano. El temporizador se calcula con marcas de tiempo, no con conteo de ticks.
- **Sesión terminada sin series de trabajo:** avanza el ciclo, pero no cuenta para la paridad A/B (igual que una saltada).
- **Paso de peso:** se guarda en la unidad de captura del ejercicio (`paso` en kg o lb, por ejemplo 5 lb), para que la sugerencia caiga en un disco real. El peso se sigue guardando en kg.
- **La Fase 1 se parte en dos:**
  - **1a:** modelo completo, siembra, ciclo y variantes, pantalla Hoy completa, exportar/importar JSON, `persist()` al guardar la primera serie, recordatorio de respaldo y pruebas de 5.1 a 5.7.
  - **1b:** pantalla Rutina con edición.
- **Actualizaciones de la app:** nunca recargar sola a media sesión; mostrar un aviso "Nueva versión" y aplicarla cuando no haya sesión en curso.
