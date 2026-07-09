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
  micro-teoría ligera por mundo, quizzes de 10 preguntas, XP/niveles/badges por
  mastery, evento aleatorio "Elige tu camino", feedback de alto refuerzo
  (animaciones y sonidos **siempre**; **háptica solo en móvil**), simulador de
  proyecto de vida con dinero virtual, modo colaborativo de aula activable por el
  profesor (sin leaderboards públicos individuales).
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
