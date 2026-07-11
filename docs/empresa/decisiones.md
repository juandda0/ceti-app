# Decisiones cerradas — Ceti (bitácora de máxima autoridad)

> Registro literal de las decisiones cerradas (Fase 1) + aclaraciones de esta
> sesión. **Autoridad máxima:** ante cualquier conflicto con estudios, repo,
> CLAUDE.md o reglas, **manda este documento**. Fecha base: 2026-06-04.

## D0 — Jerarquía de fuentes

1. Decisiones cerradas (este archivo). 2. Documentos de estudio adjuntos.
2. Contexto del repo (código, CLAUDE.md, docs previos) — el más débil.

## D1 — Empresa / producto

- **Ceti** (una sola T). B2B2C: educación financiera gamificada para **colegios
  privados de Colombia** (cumplimiento CONPES 4005, evidencia medible, mínima
  carga docente). Comprador = colegio; usuarios = estudiantes, profesores~~,
  directivos~~; operador = admin Ceti. **[ENMENDADO por D-PIVOT: sin
  usuario-directivo; solo profesor + estudiante en la app.]**

## D2 — Alcance: aplicación COMPLETA (no MVP recortado)

- **(a) Capa estudiante:** 5 mundos secuenciales (narrativa espacial),
  micro-teoría ligera por mundo, quizzes de 10 preguntas, ~~XP/niveles/badges por
  mastery~~, evento aleatorio "Elige tu camino", feedback de alto refuerzo
  (animaciones y sonidos **siempre**; **háptica solo en móvil**), simulador de
  proyecto de vida con dinero virtual, ~~modo colaborativo de aula activable por el
  profesor (sin leaderboards públicos individuales)~~. **[ENMENDADO por D-CUT:
  fuera XP/niveles/badges de colección, wallet de Cetis y modo colaborativo/
  leaderboard de aula. Se conserva el estado de dominio por mundo (`mastery`,
  etiqueta "Dominado") y el perfil de identidad.]**
- **(b) Capa profesor:** dashboard, roster, progreso, asignación de mundos con
  deadline, diagnóstico del curso por reglas, calificación automática,
  exportación CSV/PDF.
- **(c) Capa institucional:** ~~rector y coordinador~~, reportes agregados por
  grado/curso, mapping curricular CONPES 4005/MEN/PISA descargable.
  **[ENMENDADO por D-PIVOT]** La capa institucional desaparece; la reportería
  agregada y el mapping los consume el **profesor**.
- **(d) Capa admin Ceti:** aprovisiona todo (colegios, ~~rectores,
  coordinadores,~~ profesores, códigos) **[ENMENDADO por D-PIVOT: solo por
  backend/Admin SDK, sin UI]** — sin anular capacidades de los demás roles.
- **(e)** Pre-test y post-test de impacto.
- **EXCLUIDO:** certificados PDF, reportes a padres, facturación dentro del
  sistema (se maneja por fuera), **sedes** (no se manejan por ahora).

## D3 — Cuestionarios

- **3 tipos:** selección múltiple, verdadero/falso, y un **tercer tipo dinámico
  por definir** en fases posteriores. + banco **separado** de situaciones "Elige
  tu camino".

## D4 — "Elige tu camino"

- Mecánica decisión-consecuencia, situaciones **100% temáticas** del mundo en
  juego, **2 opciones sin correcta/incorrecta**, cada una con consecuencia.
- **PROHIBIDO** construir perfil individual persistente del menor a partir de sus
  decisiones (riesgo legal de perfilamiento). Output analítico **AGREGADO por
  curso**, para el profesor.

## D5 — Contenido

- Bancos por **grado (9°, 10°, 11°) × mundo × tipo**, dificultad progresiva por
  mundo (1<…<5) y por grado (9<10<11), **generados por IA**, todo con flag
  **`pendiente_validacion_docente`** hasta validación docente (posterior, no
  bloqueante).
- **ENMIENDA (sesión):** el lenguaje del contenido es **neutro** (no "juvenil
  colombiano", como decía el prompt original).
- **ACLARACIÓN (sesión):** la IA actúa **solo en authoring-time** (offline); en
  runtime el contenido se sirve **estático**, sin IA ni adaptación ML.

## D6 — Stack

- React Native + react-native-web, **un solo codebase** (incluidos dashboards).
- Firebase (Auth, Firestore, Functions).

## D7 — Roles

- admin Ceti, rector, coordinador, profesor, estudiante.
- **ACLARACIÓN (sesión):** **admin Ceti asigna el rol de todos los adultos**;
  ellos solo inician sesión con OAuth, nadie auto-asigna su rol.
- **[ENMENDADO por D-PIVOT, 2026-07-09]** → **tres roles** `{admin, profesor,
estudiante}`. Rector y coordinador quedan eliminados.

## D-PIVOT — Solo profesor + estudiante en la app (2026-07-09)

> Decisión del dueño, autorizada explícitamente. Enmienda D1, D2(c)(d) y D7.

- **En la app existen solo dos roles de usuario: `profesor` y `estudiante`.**
- **`admin` (Ceti)** se conserva **únicamente como claim de backend** para el
  aprovisionamiento (crear colegios/cursos, asignar profesores) vía Admin SDK /
  scripts. **No tiene ninguna interfaz, ruta ni dashboard en la app.**
- **`rector` y `coordinador` se eliminan por completo:** rol, claims, functions,
  reglas, UI, docs, tests y demo. Cualquier rastro se retira.
- **Tenencia `colegio → curso → estudiante` se conserva.** El admin (backend)
  crea la estructura; el profesor opera su curso.
- **Reasignaciones:**
  - **Reportería institucional** (antes del rector): se conserva y pasa al
    **profesor** (agregados por curso/colegio no-nominales, sin PII).
  - **Supresión Ley 1581** (antes rector/coordinador): la ejercen **el profesor
    (de su curso) y el admin** (backend). Sigue siendo acción con titular
    explícito (no queda sin responsable).
  - **Atestación** (activación Ley 1581): la ejerce el **profesor** (y admin).
- **Comprador/negocio:** el colegio sigue contratando; la relación comercial la
  gestiona **admin Ceti** (backend); el **profesor** es el usuario que consume la
  reportería de cumplimiento. Ya no hay usuario-directivo (rector/coordinador)
  dentro del producto.

## D8 — Auth

- OAuth 2.0; **cualquier cuenta puede registrarse**. Primer login **sin curso** →
  única pantalla disponible: **unirse a curso con código**. Sin curso asignado
  **NO hay acceso al juego**.

## D9 — Datos de menores (Ley 1581)

- Se almacena **ÚNICAMENTE email y nombre** del estudiante. Minimización de datos
  como principio permanente.
- **ACLARACIÓN (sesión):** el **grado NO se pide en el onboarding** — se deriva
  del curso al que el estudiante se une. (El prompt original listaba "grado" como
  dato almacenado; queda como atributo del curso, no del menor.)
- **ACLARACIÓN (sesión):** el **email es la identidad** del estudiante; se retira
  el seudónimo `studentId` como llave (modelo previo del repo).
- La autorización de acudientes la recolecta el colegio **por fuera del sistema**.
  **ACLARACIÓN (sesión):** dentro del sistema solo hay **atestación ligera**
  (checkbox "el colegio confirma tener la autorización") que habilita al
  estudiante; **no** se guardan datos del acudiente.

## D10 — Aclaraciones estructurales (sesión)

- **Sedes = dormante:** jerarquía efectiva `colegio→curso→estudiante`; el código
  de sede existente queda oculto/sin uso, no se elimina ahora.

## D11 — Esta fase

- **Solo documentación.** Prohibido tocar código. Entregable: `docs/empresa/`
  como fuente de verdad permanente.

## D-CUT — Recorte de alcance: fuera gamificación, wallet y leaderboard (2026-07-10)

- **Decisión (dueño):** se eliminan del producto tres superficies que no aportaban
  al valor vendido (cumplimiento CONPES + reportería + tiempo docente) y cuya
  cadena de enganche estaba muerta o marcada como legacy:
  1. **Gamificación de colección:** XP, niveles, racha y motor de insignias
     (`badges`). El enganche por puntos/racha no estaba cableado (setters solo en
     tests) y no alimentaba la reportería.
  2. **Wallet de Cetis** (moneda virtual `users/{uid}/wallet`). Sin RQ, inactivo,
     y marcado como legacy a retirar en `data-model.md`.
  3. **Modo colaborativo / leaderboard de aula** (`curso.colaboracionAula`,
     `.../leaderboard/{uid}`, componente de aula). Dependía del XP muerto.
- **Se CONSERVA:** el **estado de dominio por mundo** (`WorldProgress.mastery`,
  umbral 0.8, etiqueta "Dominado" — sigue siendo la verdad de la reportería), el
  **perfil de identidad** (nombre + avatar), mundos, quizzes, micro-teoría,
  Elige-camino, metas de ahorro y diario de bolsillo (RQ-ES10).
- **Impacto en RQ:** **RQ-ES09 (colaborativo/leaderboard) → RETIRADO.**
  **RQ-PR04 (toggle `colaboracionAula`) → RETIRADO.** **RQ-ES05 → ENMENDADO:** se
  reduce a "dominio por `mastery`" (estado `bloqueado/disponible/en_progreso/
dominado`); se retiran XP, niveles y badges de colección. Se retira `xp`/`nivel`
  de `WorldProgress` y del contrato de `firestore.rules`.
- **Nota de compliance:** al eliminar `users/{uid}/wallet`, la deuda D-ES10-05
  (la supresión Ley 1581 no borraba `wallet`) queda parcialmente resuelta para esa
  colección; `goals`/`deposits` siguen pendientes de esa unidad de compliance.
- **Autoridad:** enmienda a D2(a); coordinada con `requerimientos.md`,
  `data-model.md`, `producto.md`, `competencia.md` y el código (R15).

## D-ORQ — El profesor orquesta su clase (2026-07-10)

> Decisión del dueño, autorizada explícitamente (sesión 2026-07-10, con las 6
> respuestas del checkpoint registradas). Enmienda D3 y D5; amplía el alcance de
> los invariantes R7 y R8 (cambio coordinado R15).

- **Reposicionamiento:** Ceti deja de ser un currículo fijo y pasa a ser una
  **herramienta real de enseñanza**. En Colombia el MEN define lineamientos y
  referentes de calidad, no un temario idéntico por grado: cada institución
  tiene autonomía curricular. El contenido default de Ceti (mundos + teoría +
  bancos) es el **punto de partida**, no el límite.
- **El profesor tiene control total sobre SU clase (la clase = el curso):**
  1. **Setea la clase** antes de que sus estudiantes jueguen — con defaults
     inteligentes: sin tocar nada la clase queda funcional (5 mundos default,
     orden canónico, bancos default). Configurar es opcional, nunca obligatorio.
  2. **Elige qué mundos** ve su clase y **en qué orden**; el desbloqueo
     secuencial sigue el orden configurado.
  3. **Modo enfocado:** toggle persistente "la clase trabaja solo el Mundo X"
     hasta que lo apague. Sin noción de sesión con horario.
  4. **Edita en vivo:** todo parámetro es editable después del setup y se
     refleja en los estudiantes **en tiempo real**. Política de salida suave: el
     estudiante dentro de un mundo retirado/desenfocado termina la actividad en
     curso (nunca expulsión a mitad de pregunta), no puede re-entrar, y su
     progreso jamás se borra por cambios de configuración.
  5. **Edita el contenido** de su clase (preguntas, teoría, metadata del
     mundo). El default global **nunca se muta**: copy-on-write por curso
     (`cursos/{cursoId}/contenido/*`); "restaurar default" = borrar la copia.
  6. **Crea mundos propios** por curso (ids `cw_*`), con borrador
     (`activo:false`) → activación con gate de contenido mínimo (≥4 MC + ≥3 V/F
     - ≥3 ordenar + ≥1 card de teoría). Puede **duplicarlos a otro de sus
       cursos**. Biblioteca de colegio / marketplace: fuera de alcance.
  7. **IA de authoring para el profesor** (server-side): una Cloud Function
     genera **borradores** (nombres, títulos, teoría, preguntas, elige-camino)
     que el profesor revisa y guarda; la función nunca escribe contenido ni ve
     PII; cap diario por profesor (mismo patrón `procesarRegistroVoz`); mismo
     proveedor (Groq); el costo lo absorbe Ceti.
- **El formato del quiz se conserva (R9):** 10 = 4 MC + 3 V/F + 3 ordenar para
  TODO mundo, custom incluido; el banco puede tener más ítems y el quiz muestrea.
- **Reportería CONPES:** el profesor puede asignar una de las 5 competencias a
  su mundo custom (entonces cuenta en diagnóstico/cumplimiento); sin asignar, el
  mundo registra `competencia:'personalizada'` y se reporta solo como progreso,
  fuera del cumplimiento.
- **Para el estudiante todo esto es invisible:** cero pantallas ni decisiones
  nuevas; solo ve su clase, sus mundos, en su orden. Un curso sin configuración
  = comportamiento default exacto (retrocompatibilidad total, migración cero).
- **Enmiendas de invariantes (R15, cambio coordinado en el mismo diff):**
  - **R7 (IA):** sigue prohibida la IA en el runtime del estudiante y todo
    perfilamiento; se **amplía el authoring**: además del pipeline offline de
    Ceti, el profesor puede generar borradores vía Cloud Function server-side
    (RQ-CN06).
  - **R8 (bancos):** `bancos/**` global sigue read-only y sembrado por Admin
    SDK; nace el **contenido custom por curso** escribible únicamente por su
    profesor (`cursos/{cursoId}/contenido/*`).
  - **RQ-PR08-CA3** ("el profesor no edita el banco") queda enmendado: no edita
    el banco **default**; su copia por curso sí (RQ-PR11).
- **RQs nuevos:** RQ-PR10 (configuración de clase), RQ-PR11 (contenido custom
  por curso), RQ-PR12 (mundos propios), RQ-CN06 (IA de authoring docente).
- **Entregas:** A (config + orden + modo enfocado + tiempo real), B (contenido
  editable), C (mundos propios + IA). Cada entrega deja la app funcional.
