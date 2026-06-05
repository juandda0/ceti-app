# Producto — Ceti

> Descripción de capas y features según las **decisiones cerradas** Fase 1.
> Alimenta los requerimientos técnicos (Fase 2). Si algo aquí contradice el repo,
> ver `conflictos.md`.

## Plataforma

- **Un solo codebase** React Native + react-native-web (web responsive y, a
  futuro, móvil). Dashboards incluidos en el mismo codebase.
- **Backend:** Firebase (Auth, Firestore, Functions).
- **Aplicación COMPLETA** (no MVP recortado), construida sobre invariantes.

## Roles y acceso

- **5 roles:** admin Ceti, rector, coordinador, profesor, estudiante.
- **Auth:** OAuth 2.0; cualquier cuenta puede registrarse (login con email).
- **Provisión de roles:** **admin Ceti asigna el rol de todos los adultos**
  (rector/coordinador/profesor); ellos solo inician sesión con OAuth, nadie
  auto-asigna su rol. El **estudiante se une a un curso con código**.
- **Gate de acceso:** primer login **sin curso** → única pantalla disponible es
  "unirse a curso con código". **Sin curso asignado NO hay acceso al juego.**

## (a) Capa estudiante

- **5 mundos secuenciales** con narrativa espacial, desbloqueo progresivo. Mapa
  propuesto (Mundo 1 = más fácil, dificultad 1<2<3<4<5):
  1. **Planeta Origen** — ingreso / fundamentos del dinero
  2. **Luna del Presupuesto** — presupuesto y gasto
  3. **Estrella del Ahorro** — ahorro
  4. **Nebulosa del Crédito** — crédito
  5. **Agujero Negro de las Deudas** — deuda / riesgo
     Cada mundo mapea 1:1 a una competencia CONPES 4005 / MEN / PISA (visible al
     profesor).
- **Micro-teoría ligera por mundo:** cards/ejemplos cotidianos, **lenguaje
  neutro**. PROHIBIDO texto académico denso. Da herramientas para el quiz.
- **Quizzes de 10 preguntas**, auto-calificados. **3 tipos:**
  1. Selección múltiple
  2. Verdadero / Falso
  3. Tercer tipo dinámico (arrastrar/ordenar/emparejar) — **por definir en fase
     posterior**.
- **Evento aleatorio "Elige tu camino":** situación 100% temática del mundo, **2
  opciones sin correcta/incorrecta**, cada una con su consecuencia narrada.
  **PROHIBIDO construir un perfil individual persistente del menor** a partir de
  sus decisiones (riesgo legal de perfilamiento). El **output analítico es
  AGREGADO por curso**, para el profesor. Banco **separado** del de quizzes.
- **Gamificación:** XP, niveles y **badges atados a mastery real** (no a tiempo
  gastado). Progreso personal visible. **Sin leaderboard público individual.**
- **Feedback de alto refuerzo:** animaciones y sonidos **siempre**; **vibración
  háptica solo en móvil**. Acierto → refuerzo positivo (confetti/streak); fallo →
  feedback negativo claro que invite a reintentar.
- **Simulador de proyecto de vida** con **dinero virtual** (estilo Banzai:
  renta, gastos, imprevistos). Lenguaje "proyecto de vida" (MEN/Proyecta-T).
  **Sin dinero real, sin cuentas bancarias.**
- **Modo colaborativo de aula** activable/desactivable por el profesor (equipos),
  con leaderboard **de aula opcional** — **nunca** ranking global público.

## (b) Capa profesor

- Dashboard con **roster** del curso y **progreso por estudiante**.
- **Asignación de mundos con deadline** ("completa el Mundo X antes de Y").
- **Diagnóstico del curso por reglas** (no ML): "dónde está flojo el curso" por
  competencia. Output del "Elige tu camino" agregado por curso.
- **Calificación automática** de quizzes.
- **Exportación CSV / PDF** de progreso y reportes.

## (c) Capa institucional (rector / coordinador)

- **Reportes agregados** por grado / curso (distintos del reporte operativo del
  profesor) — son el argumento de renovación del contrato.
- **Mapping curricular CONPES 4005 / MEN / PISA descargable** (documento de
  evidencia de cumplimiento; lo más barato de producir y de mayor valor de venta).

## (d) Capa admin Ceti

- **Dashboard propio** donde el admin **registra y administra todo**: colegios,
  rectores, coordinadores, profesores y códigos. **No anula** las capacidades
  propias de los demás roles (el profesor sigue gestionando su curso, etc.).

## (e) Pre-test y post-test de impacto

- **Pre-test** (entrada) y **post-test** (salida) para medir impacto del programa
  (modelo Banzai pre→contenido→post). Insumo de evidencia para el colegio.

## Contenido (bancos)

- **Bancos por grado (9°, 10°, 11°) × mundo × tipo** + banco separado "Elige tu
  camino". Dificultad progresiva por mundo (1<…<5) y por grado (9<10<11).
- **El grado del estudiante se deriva del curso** al que se une (NO se pide en el
  onboarding). El grado del curso lo fija el profesor/admin al crearlo.
- **Generados por IA en authoring-time** (offline), **lenguaje neutro**, nunca
  teoría densa. Todo nace con flag **`pendiente_validacion_docente`** hasta
  validación docente (proceso posterior, **no bloqueante**).
- **En runtime el contenido se sirve ESTÁTICO** — no hay IA ni adaptación ML en
  vivo (compatible con el invariante "No generative AI in runtime").

## Excluido explícitamente

- ❌ Certificados / diplomas PDF.
- ❌ Reportes / app para padres.
- ❌ Facturación dentro del sistema (se gestiona por fuera).
- ❌ Sedes (jerarquía efectiva `colegio→curso→estudiante`; código de sede queda
  **dormante**, ver `conflictos.md`).
- ❌ IA generativa/adaptativa en runtime, dinero real, gift cards, leaderboard
  público individual, perfil individual del menor.
