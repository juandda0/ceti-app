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

## D-ADMIN — Admin Ceti in-app, autorización de profesores y gate de acceso (2026-07-11)

> Decisión del dueño, autorizada explícitamente (sesión 2026-07-11, con las 4
> respuestas de checkpoint registradas). **Revierte parcialmente D-PIVOT**
> ("admin sin UI") y enmienda D8; cambio coordinado R15 sobre R3, R11 y R12.

- **Reversión consciente de D-PIVOT:** el rol `admin` **recupera interfaz en la
  app**. Sigue siendo un rol de aprovisionamiento (no juega, no es alumno), pero
  ahora tiene un **panel** para operar el onboarding de colegios y profesores sin
  depender de scripts. Rector/coordinador siguen eliminados (D-PIVOT en pie).
- **Admin raíz por allowlist:** un conjunto de correos Ceti (en configuración del
  backend, incluye `juandiegodiazave@gmail.com`) obtiene el claim `role:'admin'`
  al iniciar sesión. Nadie se auto-nombra fuera del allowlist. No es allowlist de
  profesores — es solo para el staff Ceti.
- **Autorización de profesores (pre-autorización por correo):** el admin, desde
  el panel, **autoriza un correo de profesor y lo asigna a un colegio**
  (`profesoresAutorizados/{emailKey}` = `{email, colegioId, autorizadoPor,
autorizadoAt}`). Cuando ese correo inicia sesión, se le fija
  `role:'profesor' + colegioId` (sin `cursoId`). Un correo **no autorizado** no
  es profesor: es un **estudiante** que debe unirse por código.
- **El colegio lo asigna el admin:** al autorizar, el admin elige/crea el colegio
  (escuela) del profesor. Varios profesores pueden compartir colegio; la
  reportería institucional agregada es a nivel colegio (se conserva el modelo
  B2B2C: el colegio es el cliente).
- **El profesor crea sus propias clases:** ya autorizado, el profesor crea y
  nombra sus cursos **eligiendo el grado**, dentro de su colegio, vía Cloud
  Function (`crearMiCurso`): crea el `curso`, acuña un **código único** (2
  profesores nunca comparten código) y se añade a `profesorUids`. Luego opera la
  clase con D-ORQ (config, contenido, mundos) e invita estudiantes.
- **Gate del estudiante:** tras el onboarding de identidad (nombre + avatar), un
  estudiante **sin curso NO tiene acceso al juego**; ve una **pantalla dedicada
  de "unirse a clase"** (código o link). Solo al unirse (rol `estudiante` +
  colegio + curso) accede a los mundos. Reemplaza el banner suelto por un gate.
- **Dos vías de invitación:** (1) el **código único** de la clase (el estudiante
  lo escribe) — ya existía y ya es único; (2) un **link de invitación**
  `/join/{codigo}` que, tras iniciar sesión, une automáticamente al estudiante a
  esa clase (web y, a futuro, móvil). Regenerar el código invalida el anterior;
  los ya unidos no se ven afectados.
- **Enmiendas de invariantes (R15, mismo diff):**
  - **R3** — `admin` deja de ser "claim solo de backend sin UI": tiene panel de
    aprovisionamiento in-app (crear colegios, autorizar profesores, revocar). Su
    alcance sigue siendo global de aprovisionamiento; **no juega ni ve PII de
    menor** más allá de lo necesario para operar (no lee progreso nominal).
  - **R11** — se retira "sin UI de admin" de la lista de exclusiones; el resto de
    R11 se conserva.
  - **R12** — la matriz §1.3 gana: el `admin` (con claim, ya no solo backend)
    autoriza profesores y crea colegios desde el cliente vía Cloud Functions; el
    **profesor** gana la capacidad de **crear sus propios cursos** en su colegio
    (antes solo Admin SDK). La creación sigue pasando por Cloud Function (para
    acuñar código único atómicamente); las reglas de escritura directa de
    `cursos`/`colegios` siguen `if false`.
  - **D8** — se precisa: primer login sin claims → el backend resuelve el acceso
    (allowlist admin / correo autorizado profesor / estudiante). Estudiante sin
    curso: única pantalla = unirse a clase.
- **RQs nuevos:** RQ-AD07 (allowlist admin + panel), RQ-AD08 (autorización de
  profesores), RQ-PR13 (el profesor crea sus cursos), RQ-FN13 (gate de acceso por
  rol/curso + link de invitación).

## D-NODEMO — Se elimina el Modo Demo / Simulación (datos mock) (2026-07-11)

> Decisión del dueño, autorizada explícitamente ("elimina todos los datos mock,
> todos"). Retira RQ-DM01..RQ-DM07 (SECCIÓN 10) y todo el andamiaje de simulación.

- **Se elimina por completo el Modo Demo / Simulación:**
  - UI: la sección "Simulación Ceti" (botones Profesor/Estudiante) del login.
  - Backend: la Cloud Function `demoLogin`, `DEMO_USERS`, `DEMO_COLEGIO` y la
    "jaula demo" (`callerIsDemo`/`assertDemoScope`/`assertNotDemo` y el claim
    `demo:true`) en functions; la exclusión de `demo-colegio` en el trigger de
    agregados.
  - Datos sembrados: `colegio-demo` con estudiantes sintéticos + agregados; se
    borran los scripts `seedDemo.ts`, `seedDemoColegio.ts`,
    `backfillDemoAgregados.ts` y el escenario `seedScenario.ts` (siembra de
    cuentas). **Se conserva `seedBancos.ts`** (siembra el **contenido real**,
    no es mock).
- **Motivo:** con D-ADMIN el onboarding real es completo (admin autoriza
  profesores; el profesor crea sus clases; el estudiante entra por código/link),
  así que la simulación con datos falsos sobra y solo confunde.
- **Limpieza de producción:** la data ya sembrada en Firestore (`colegios/demo-colegio`,
  sus `classCodes`, membership/users demo) se borra con un script Admin SDK que
  ejecuta el dueño (`scripts/purgeDemo.ts`).
- **Se conserva** el **modo offline** (`isFirebaseConfigured()===false` →
  "Continuar sin cuenta"): no es mock, es uso sin backend; el `seedKey='demo'`
  de fallback offline es solo una etiqueta, no datos.
- **Impacto en RQ:** **RQ-DM01..RQ-DM07 → RETIRADOS.** El invariante RQ-DM05
  (jaula demo) desaparece con su feature: sin tokens `demo:true` no hay superficie
  que enjaular.
- **Autoridad:** coordinada con `requerimientos.md` (SECCIÓN 10 retirada),
  `estado.md` y el código (R13/R15 no aplican a invariantes duros aquí; es
  retiro de feature).
