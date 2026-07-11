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

- **3 roles (D-PIVOT):** `admin` (Ceti, claim **solo de backend**, sin UI),
  `profesor`, `estudiante`. En la app solo existen `profesor` y `estudiante`;
  `rector` y `coordinador` quedan eliminados.
- **Auth:** OAuth 2.0; cualquier cuenta puede registrarse (login con email).
- **Provisión de roles:** **admin Ceti (backend) asigna el rol de profesor**; el
  profesor solo inicia sesión con OAuth, nadie auto-asigna su rol. El **estudiante
  se une a un curso con código**.
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
- **~~Gamificación:~~ Dominio por mastery:** ~~XP, niveles y **badges atados a
  mastery real**~~ estado de **dominio por mundo** atado a `mastery` real (no a
  tiempo gastado), umbral 0.8, etiqueta "Dominado". Progreso personal visible.
  **Sin leaderboard público individual.** **[ENMENDADO por D-CUT: fuera
  XP/niveles/badges de colección; se conserva el dominio por mastery.]**
- **Feedback de alto refuerzo:** animaciones y sonidos **siempre**; **vibración
  háptica solo en móvil**. Acierto → refuerzo positivo (confetti/streak); fallo →
  feedback negativo claro que invite a reintentar.
- **Simulador de proyecto de vida** con **dinero virtual** (estilo Banzai:
  renta, gastos, imprevistos). Lenguaje "proyecto de vida" (MEN/Proyecta-T).
  **Sin dinero real, sin cuentas bancarias.**
- **Diario de bolsillo por voz (RQ-ES10):** el estudiante dicta sus movimientos
  reales de bolsillo ("gasté cinco mil en un helado"); una IA server-side los
  clasifica, el estudiante confirma, y los explora en su propio dashboard.
  **Solo registro autodeclarado, solo-vista-propia** — nunca cuentas, pagos ni
  transacciones (D-ES10-02).
- ~~**Modo colaborativo de aula** activable/desactivable por el profesor (equipos),
  con leaderboard **de aula opcional** — **nunca** ranking global público.~~
  **[ENMENDADO por D-CUT: modo colaborativo y leaderboard de aula retirados del producto.]**

## (b) Capa profesor

- Dashboard con **roster** del curso y **progreso por estudiante**.
- **Asignación de mundos con deadline** ("completa el Mundo X antes de Y").
- **Diagnóstico del curso por reglas** (no ML): "dónde está flojo el curso" por
  competencia. Output del "Elige tu camino" agregado por curso.
- **Calificación automática** de quizzes.
- **Exportación CSV / PDF** de progreso y reportes.
- **Reportería agregada de cumplimiento** por grado / curso y **mapping curricular
  CONPES 4005 / MEN / PISA descargable** — reasignados al profesor por D-PIVOT (antes
  de la capa institucional); son el argumento de renovación del contrato (que
  gestiona admin Ceti backend con el colegio).

## (c) Capa institucional — **RETIRADA (D-PIVOT)**

- Los roles `rector` y `coordinador` se eliminan; no hay usuario-directivo en el
  producto. La **reportería agregada** y el **mapping curricular** que vivían aquí se
  **absorben en la capa profesor (b)**, ahora consumidos por el profesor sobre sus
  cursos.

## (d) Capa admin Ceti (backend, sin UI)

- **Aprovisionamiento por backend** (Admin SDK / scripts): el admin **registra y
  administra** colegios, cursos, profesores y códigos, y asigna el rol de profesor.
  **No tiene interfaz, ruta ni dashboard en la app** (D-PIVOT) y **no anula** la
  operación del profesor sobre su curso.

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
- ❌ IA generativa/adaptativa en runtime (única excepción estrecha: clasificación
  server-side del registro por voz, RQ-ES10 / D-ES10-01), dinero real
  **transaccional** (cuentas, pagos, gift cards; el diario autodeclarado RQ-ES10
  es la única excepción, D-ES10-02), leaderboard público individual, perfil
  individual del menor.
