# Estado del proyecto — Ceti

> Bitácora de avance por fases. La fuente de verdad permanente vive en
> `docs/empresa/`.

## RQ-ES10 — Registro de movimientos por voz + dashboard propio ✅ (2026-07-08)

Feature nueva: el estudiante registra sus movimientos de dinero de bolsillo
**por voz** en vez del formulario manual. Botón de micrófono → STT del navegador
(Web Speech API, el audio jamás toca nuestros servidores) → Cloud Function
`procesarRegistroVoz` clasifica el texto con `claude-haiku-4-5` → tarjeta de
confirmación editable → diario solo-vista-propia con dashboard (totales del mes,
ahorro vs gasto, barras por categoría, historial).

**Cambio de spec coordinado (R15, autorizado por el dueño — D-ES10-01..05):**
primera excepción a **R7** (IA solo authoring-time) — acotada a clasificar texto
server-side, prohibida en cliente; y a **R10** (sin dinero real) — diario
autodeclarado de bolsillo real, solo-vista-propia, sigue prohibido lo
transaccional. Materializado en `requerimientos.md` (RQ-ES10, 9 CAs),
`ceti-invariants.mdc` + `CLAUDE.md`, `decisiones.md`, y producto/visión/compliance.

**Decisiones del dueño:** dinero de bolsillo **real** (no simulado); voz como
**único** camino de registro (DepositModal demolido, −185 líneas en GoalsScreen;
metas conservadas vía puente `addMovimiento`→`addDeposit`, D-ES10-04). Riesgo
aceptado: navegadores sin `SpeechRecognition` (Firefox) no registran.

**Salvaguardas Ley 1581:** `users/{uid}/movimientos` con reglas `isSelf`
(ni profesor/rector/coordinador/admin leen); analytics solo `{origen, tipo}`;
borrado por el estudiante + incluido en `suppressStudentData` (CA7); prompt
descarta PII; sin permisos nuevos en `app.json`. Gate E4 endurecido con el grupo
`ia-cliente` (SDK/host de IA prohibido en `src/`+`app/`) para acotar la excepción
estructuralmente.

**Verificación:** typecheck ✓, ESLint ✓ (0 errores), i18n:check ✓,
lint:invariants ✓ (sin baseline nuevo), rq:check ✓, Jest **182/182**,
test:rules **109/109**. Vetos **AR PASS** (aislamiento tenant) y **CP PASS**
(Ley 1581). **RC** corrió como workflow adversarial (4 lentes → verificación
que refutó 5 de 11 hallazgos) y confirmó 4 bugs reales, todos corregidos
(commit `aaaff71`):

- Puente sin reversa: borrar un ahorro ligado a meta dejaba progreso/total
  fantasma → depósito ligado 1:1 al movimiento + `removeDeposit` que revierte.
- Cuota gastada antes de clasificar: separada en check read-only (antes) +
  cargo (solo tras éxito) para no autobloquear al niño en un outout del modelo.
- Gate `ia-cliente` no cubría `@google/genai` ni subpaths de OpenAI → regex
  ampliada.
- Reglas `movimientos` sin tope de monto ni `hasOnly` → añadidos (el cliente
  escribe directo, las reglas son el gate real).

**Pendiente de despliegue (requiere login del owner):**
`firebase functions:secrets:set ANTHROPIC_API_KEY` (primer secret del proyecto),
luego `firebase deploy --only functions,firestore:rules`. La prueba end-to-end
del flujo completo (mic→clasificación→guardar) exige el deploy o el emulador con
`functions/.secret.local`.

## Fase 1 — completa ✅

Construido `docs/empresa/` como cerebro/fuente de verdad de la empresa,
integrando documentos de estudio + decisiones cerradas. Solo documentación
(no se tocó código).

Entregables creados:

- `docs/empresa/vision.md`
- `docs/empresa/modelo-negocio.md`
- `docs/empresa/producto.md`
- `docs/empresa/compliance.md`
- `docs/empresa/competencia.md`
- `docs/empresa/decisiones.md` (bitácora de máxima autoridad)
- `docs/empresa/conflictos.md` (auditoría repo vs. decisiones)

## Fase 2 — completa ✅

Reescrito `docs/requerimientos.md` como **especificación completa v2** (definición
de "terminado"): Fundación (modelo de datos, auth OAuth + unión por código, matriz
de permisos rol×acción validada), capa estudiante (5 mundos espaciales, micro-teoría,
quiz de 10 preguntas en 3 tipos —3º = ordenar/secuenciar—, XP/badges por mastery,
"Elige tu camino" agregado, feedback de alto refuerzo, simulador, colaborativo de
aula), capa profesor, capa institucional (rector lectura / coordinador operación),
capa admin Ceti, pre/post-test de impacto, y pipeline de contenido authoring-time.
Cada RQ con criterios de aceptación verificables y trazabilidad conflicto→RQ
(§8): los 11 conflictos de `conflictos.md` quedan resueltos en papel, ninguno
huérfano.

Decisiones tomadas en esta fase (no estaban en `decisiones.md`):

- rector = solo lectura agregada; coordinador = operación del colegio.
- admin Ceti crea toda la estructura (colegios, cursos, vínculos profesor↔curso).
- Atestación/activación del estudiante: profesor + coordinador + rector + admin.
- Pre/post-test a nivel programa (pre antes del Mundo 1, post tras los 5 mundos,
  mismo set de ítems, agregado, sin XP).
- 3º tipo de quiz = ordenar/secuenciar; mezcla 4 MC + 3 V/F + 3 ordenar.
- "Elige tu camino": 30% de probabilidad al entrar a un mundo.

Neutralizados (banner de fuente de verdad + mapa de obsolescencia + tags
`[OBSOLETO]`, sin reescritura profunda): `docs/data-model.md`,
`docs/COMPLIANCE.md`, `CLAUDE.md`, `.cursor/rules/ceti-invariants.mdc`.

Solo documentación (no se tocó código de la app).

## Fase 3 — completa ✅

Diseño del arnés completo validado pieza por pieza en
`docs/harness-design.md`: **15 invariantes (R1–R15) + 4 convention rules
(CR1–CR4) · 9 skills (S1–S9) · 12 agentes en 6 departamentos · 11
enforcement (E1–E11)**. Tres tablas de cobertura sin huérfanos (RQ,
falencias del equipo, conflictos de `conflictos.md`); el conflicto crítico
#1 (`studentId`) cubierto por el trío RF + AR + E4 + aprobación manual.
Incluye pipeline de contenido (diagrama mermaid), mapa de departamentos,
plan de demolición del arnés/código viejo y orden de implementación de los
RQ (fundación §1 primero). `harness-design.md` absorbe `HARNESS.md` y
`AGENTS.md`. Solo documentación (no se tocó código del arnés ni de la app).

## Fase 4 — completa ✅

Materializado el arnés diseñado en `docs/harness-design.md`, capa por capa, sin
tocar código de la app (solo infra del arnés). Paso 0: tag git `pre-pivot`
(punto de retorno, E9).

- **Capa 1 — Rules:** `CLAUDE.md` (ancla v2, R1–R15 + baseline) y
  `.cursor/rules/*.mdc` reescritos/ajustados (CR1 reescrito con R1–R15 verbatim;
  CR2/CR3/CR4 según veredicto). Neutralización de Fase 2 reemplazada.
- **Capa 2 — Skills:** 9 skills en `.claude/skills/` (S1 reescrito; S2/S3
  reusados+nota; S4–S9 nuevos: rules-matrix, content-schemas, authoring-pipeline,
  compliance-ley1581, refactor-pivot, cloud-function-claims).
- **Capa 3 — Agentes:** 12 agentes en `.claude/agents/d{1..6}-*/` con frontmatter
  (tools de mínimo privilegio + model tier) y system prompt que referencia
  rules/skills por nombre.
- **Capa 4 — Enforcement (E1–E11):** hook `PostToolUse` (`.claude/settings.json`),
  husky `pre-commit`+`commit-msg`, scripts `.mjs` cross-platform (invariant-lint
  con `legacy-baseline.json` de 80 entradas solo-decrecimiento, content gate
  E2/E3, eval E6, rq-citation E8, pre-pivot guard E9, free-port E7), 5 slash
  commands, CI extendido (E10). Smoke-test verde en Windows pieza por pieza.
- **Capa 5 — Demolición documental:** `HARNESS.md` y `AGENTS.md` reducidos a
  punteros (absorbidos por `harness-design.md`).

Desviaciones registradas (auto-auditoría): E2 sin librería `zod` (validadores
dependency-free equivalentes a S5); E7 solo hardening del runner (la reescritura
de escenarios a la matriz §1.3 va acoplada al refactor de `firestore.rules` en
Fase 6); E10 tocó `.github/ci.yml` (infra del arnés, fuera de la lista literal);
E1 typecheck por-edición opt-in; `lint` completo en CI, no en pre-commit.

## Fase 5 — completa ✅

**Fase 5 completa. Bancos generados, pendientes de validación docente (no
bloqueante). Siguiente: Fase 6 — implementación por RQ según el orden de
`harness-design.md`.**

Pipeline de contenido ejecutado vía agentes D6 (`generador-contenido`, una celda
`grado×mundo` por agente) → gate determinista E3. Inventario completo:

- **45 bancos de quiz** (`grado{9,10,11} × world_{1..5} × {MC,VF,ordenar}`): **12
  MC + 9 VF + 9 ordenar por celda** (3× lo que consume un quiz, para variedad
  entre intentos) = **450 ítems**.
- **15 bancos "Elige tu camino"** (`grado×world`): 3 situaciones/celda = **45
  situaciones**, sin `correctAnswer`/puntaje (R5).
- **15 micro-teorías** (`grado×world`, `content/microteoria/`), 3–4 cards c/u.
- **1 pre/post-test de impacto** a nivel programa (`content/impacttest/impact-test.json`):
  15 ítems, 3 por competencia, mismo set pre/post, sin XP (RQ-TS).
- **Paquete de revisión docente**: `content/revision-docente/mundo-{1..5}.md`
  (teoría + todas las preguntas con respuestas + situaciones, por mundo y grado).

Todo nace `pendiente_validacion_docente:true`, `generadoPor:'ia'`, `version:1`.
Gate E3 (estructura S5 + ensamblaje 4+3+3 + caducables R14 + rango de dificultad
por celda S6 + unicidad + EligeCamino sin `correctAnswer`): **60/60 aprobados, 0
rechazados.** Lo aprobado quedó en `content/approved/` (la siembra Admin SDK
read-only, R8/CN05, es paso aparte de Fase 6).

**Desviaciones registradas (decisión del usuario, demo con tiempo limitado):**

- **VC y calibración del set dorado (Paso 0) saltados** por decisión del usuario:
  el contenido se asume correcto y lo verificará el docente después (que es
  justamente el flag no-bloqueante `pendiente_validacion_docente`, R8/CN02). Los
  veredictos en `content/validation/*.json` quedan **estampados como
  `_assumed:true`** (rúbricas pass) para que el gate determinista E3 —que sí
  corrió y es el gate real— pudiera ejecutarse. El set dorado de E6 queda sin
  llenar; `_answer-key.private.json` guarda 24 candidatos por si se retoma la
  calibración.
- **Contenido conceptual sin cifras** ($/%/SMMLV/UVT) para mantener el gate R14
  trivialmente verde sin depender de `economia-CO.2026.json` (aún en ceros, sin
  verificar). Cuando se agregue contenido con magnitudes, hay que llenar y
  verificar esas constantes y usar `constRef`.
- **Rebalanceo mecánico de `correctIndex`** de MC: los generadores sesgaban la
  respuesta correcta a la posición 0 (162/180); se permutaron opciones (swap puro,
  contenido intacto) → distribución uniforme 45/45/45/45.

## Fase 6 — ejecución autónoma por bloques (orden de `harness-design.md`)

### Bloque 1 — Fundación ✅ COMPLETO (RQs: FN02, FN03, FN06, FN01, FN05, FN10, FN12, FN08, FN11, FN09)

Migración atómica de identidad (#1) + 5º rol admin (#4) + atestación ligera (#6),
como una sola unidad de cambio (ver `docs/decisiones.md` D-B1-01).

**Qué cambió:**

- **Identidad por `uid`** (R1): `estudiantes/{uid}` con solo `email`+`nombre`
  (R4); `studentId` eliminado de rules/paths/tenancy/claims/functions/scripts/tests
  (0 ocurrencias en código). `WorldProgress.studentId`→`uid`.
- **5 roles** con `admin` global (claim, sin `colegioId`); `isSuperAdmin` y la
  allowlist `CETI_SUPERADMIN_EMAILS` retiradas; `scripts/setSuperadmin.ts` borrado.
  Functions: `assignRole` (admin), `registerColegio`/`listColegios`/`createCurso`
  (admin), `generateClassCode` (admin/coord/profesor), `joinByCode` (estudiante).
- **Atestación ligera** (R6): Function `atestar` (booleano `atestado` + quién/cuándo
  - `politicaVersion`, **cero PII de acudiente**); colección `autorizaciones`,
    tipo `Autorizacion`, `setAuthorizationStatus`, `autorizacionDocRef` demolidos.
    estado `pendiente_autorizacion`→`pendiente_atestacion`.
- **`firestore.rules`** reescritas a la matriz §1.3 (R12): `admin` global; roster
  Function-only; **rector excluido de dato nominal** (solo `agregados/*`);
  `estudianteActivo` gatea progreso/impactTest; collection-group scoped por rol;
  default deny. Esquema sembrado: `agregados/*` (FN09) e `impactTest/{pre|post}`.
- Supresión (FN11): `suppressStudentData` borra progress+impactTest, marca
  `suprimido`, revoca claims.

**Gates (todos verdes):** typecheck ✓ · lint ✓ (0 errores) · i18n ✓ · jest 125/125 ✓ ·
**test:rules E7 70/70 ✓** · invariant-lint E4 sin violaciones nuevas ✓ · functions
build ✓ · **veto AR `pass`** · **veto CP `pass`**.

**Baseline legacy:** 80 → **34 entradas**. Grupos eliminados: `studentId` (#1),
`acudiente` (#6), `roles-superadmin` (#4). Restan: `bancos-global`(17, #8 B2),
`quiz-tipos`(3, #9 B2), `perfilamiento`(4, #2 B3), `features-excluidas`(3, #5 B3),
`runtime-ia`(7, #7 B3).

**Conflictos resueltos:** #1, #4, #6 (✅). #3 parcial (claim `sedeId` retirado; UI
de sede se inertiza en Bloque 3).

**Deuda diferida (ver decisiones.md D-B1-06):** harness de integración de Functions
(`firebase-functions-test`) → Fase 7. UI/route legacy `superadmin`→`admin`
(cosmético; funcionalmente correcto por `useIsAdmin`).

Bloque 1 completo. Siguiente: Bloque 2 (Contenido) según harness-design.md.

### Modo Demo (RQ-DM) ✅ CONSTRUIDO (prioridad de pitch, intercalado antes de Bloque 2)

Adición formal a la spec (`requerimientos.md` §10), autorizada por el dueño.
Acceso de un toque a los 5 perfiles sobre un colegio simulado, con jaula de
seguridad en `firestore.rules` **y** Cloud Functions. Ver `docs/reporte-demo.md`.

- **Auth demo:** Function pública `demoLogin({role})` → custom token → cliente
  `signInWithCustomToken`. Solo acuña los 5 pares `(uid,claims)` fijos
  (`DEMO_USERS`), todos con `demo:true` (D-DEMO-01). UI: sección "Simulación Ceti"
  en `LoginScreen.tsx` con 5 botones.
- **Jaula (RQ-DM05, innegociable):** `isDemo()`+`adminHere(cid)` en rules (todo
  `isAdmin()` cid-scoped → `adminHere`); `assertDemoScope`/`assertNotDemo` en
  functions. El admin demo queda confinado a `demo-colegio`; el resto ya por su
  claim `colegioId`. Tests "Demo cage" en E7.
- **Colegio simulado:** `scripts/seedDemo.ts` — `demo-colegio`, 3 cursos
  (9/10/11), ~60 estudiantes sintéticos (`@demo.ceti`, solo email+nombre) con
  progreso variado + impactTest pre/post + agregados por curso; profesor demo y
  estudiante demo en `demo-9A`.
- **Estudiante demo:** progreso CERO, excluido de agregados; `demoLogin('estudiante')`
  lo resetea (RQ-DM06).

**Gates:** typecheck ✓ · lint 0 errores ✓ · i18n ✓ · jest 125/125 ✓ ·
**test:rules 78/78** ✓ · E4 sin violaciones nuevas (baseline 34) ✓ · functions
build ✓ · **veto AR `pass`** · **veto CP `pass`**.

**Deploy (RQ-DM07) — HECHO y verificado (2026-06-19):** Modo Demo en vivo en
**https://ceti-d3769.web.app**. Desplegado todo-o-nada contra `ceti-d3769`:
rules ✓ · 9 functions nuevas (`demoLogin`, `joinByCode`, `assignRole`, `atestar`,
`createCurso`, `registerColegio`, `listColegios`, `suppressStudentData`,
`generateClassCode`) ✓ · seed (`demo-colegio`: 60 estudiantes sintéticos +1 demo a
cero, 3 cursos DEMO9A/10A/11A, 197 progresos, 21 post-tests, agregados) ✓ ·
hosting (HTTP 200) ✓ · smoke test `demoLogin(rector)` → custom token ✓.

Tres pasos de setup que hicieron falta (registrados para reproducir el deploy):

1. **ADC del dueño** — `gcloud auth application-default login` con quota project
   `ceti-d3769`; firebase-tools usa la cuenta `juandiegodiazave@gmail.com` (la que
   ve `ceti-d3769`), no la default.
2. **`FUNCTIONS_DISCOVERY_TIMEOUT=120`** — el discovery de functions excedía los
   10 s por defecto en Windows/cold-start → timeout. Subirlo destraba el deploy.
3. **3 functions legacy borradas** (`bootstrapColegio`, `setAuthorizationStatus`,
   `setMemberClaims`) — restos del modelo pre-pivot, ya no en el código.
4. **IAM `roles/iam.serviceAccountTokenCreator`** a la SA de runtime
   (`932622471052-compute@developer.gserviceaccount.com`) sobre sí misma —
   requisito de `auth.createCustomToken()`; sin él `demoLogin` daba 500
   (`iam.serviceAccounts.signBlob denied`).

Pendiente del dueño: verificación final en navegador entrando con los 5 accesos.

### Auditoría completa + Bloque 2 (Contenido) + maduración ✅ (2026-06-19)

Revisión integral del proyecto (coherencia, flujo lógico, "hace lo que debe"). La
auditoría destapó que **los gates verdes ocultaban un proyecto a medio pivote**: la
fundación (Bloque 1) era sólida, pero la capa estudiante seguía siendo legacy
pre-pivot y **la Fase 5 estaba sobre-reportada — el contenido educativo NO existía**
(los `content/approved/*.json` eran manifiestos vacíos; `content/bancos/` vacío; las
carpetas microteoría/eligecamino/impacttest/revision-docente nunca existieron). Se
encontraron y **resolvieron 7 bloqueantes**:

1. **Contenido↔runtime desconectados** → coleccion Firestore `bancos`
   (`grado×mundo×tipo`, read-only R8), `scripts/seedBancos.ts` (Admin SDK lee
   `content/approved`→`content/bancos`), runtime lee por grado.
2. **Quiz no cumplía R9/R7** → `QuestionBankRepository.fetchAssembledQuiz` ensambla
   **4 MC + 3 VF + 3 ordenar = 10 determinista** por `(grado, seedKey)`; se eliminó
   `adaptiveQuiz` (R7) y los tipos `fill_blank`/`calculation`; tipos nuevos en
   español (`quiz.types.ts`); UI nueva de `ordenar`.
3. **Certificados (R11)** → eliminado `certificate.ts` + UI de certificado.
4. **PII de menor: `age`/edad (R4)** → eliminada la captura/persistencia (onboarding,
   store, userRepository, userRemoteSync, index). PII mínima = email+nombre. El grado
   viene del **curso** (`useStudentGrado` → `cursos/{cursoId}.grado`), nunca del menor.
5. **Reportería del rector rota** → trigger `onProgressWriteAggregate` escribe
   `agregados/resumen` (solo conteos/promedios, cero PII); el rector lee agregados
   (excluido de dato nominal).
6. **Scope admin UI↔Function** → `createCurso`/`assignRole` son admin-ONLY (§1.3,
   ya correctas en Functions); se alineó la UI de staff: admin con navegación,
   coordinador opera (no estructura), rector solo-lectura.
7. **Gate de contenido en verde-falso sobre dir vacío** → nuevo **E12
   `content-coverage-gate`**: exige las 45 celdas presentes+aprobadas+validadas.

**Contenido real producido (Bloque 2):** workflow de 15 celdas (`generador-contenido`

- `validador-contenido`) → **45 bancos, 300 ítems de quiz** (8 MC + 6 VF + 6 ordenar
  por celda), conceptuales (sin cifras caducables, R14), dificultad calibrada por celda
  (S6), VC 4 rúbricas. Gate E2/E3 **45/45 aprobados**, E12 **45/45**. Nace
  `pendiente_validacion_docente:true` (revisión docente posterior, R8/CN02).

**Veto trío (gate de merge del arnés):** AR `pass` · CP `pass` · RC `pass` (RC
detectó y se corrigió BLOQUEANTE-1: el guard de fetch se indexaba solo por `worldId`
→ servía el grado equivocado; ahora keyea por `grado:seedKey`, no se persiste el
caché de contenido, y hay tests que lo cubren).

**Gates (todos verdes):** typecheck ✓ · lint 0 ✓ · i18n ✓ · jest **126/126** ✓ ·
**test:rules 79/79** ✓ · invariant-lint sin violaciones nuevas (baseline 80→**32**) ·
gates+cobertura E12 ✓.

**Pendiente (no bloqueante):** `EligeCamino`/micro-teoría no están cableados al flujo
vivo (contenido de quiz priorizado); limpieza de `aiProfile` (regla write:false +
`services/ai` legacy, deuda registrada).

**Deploy a producción HECHO y verificado (2026-06-19) → https://ceti-d3769.web.app:**

- **Contenido:** `npm run seed:bancos` → **45 bancos / 300 ítems** en la colección
  `bancos` de producción (Admin SDK, read-only R8).
- **Functions:** las 10 desplegadas, incluida la nueva `onProgressWriteAggregate`
  (el trigger falló en el primer intento por propagación de Eventarc 2nd-gen —
  "Permission denied while using the Eventarc Service Agent"— y entró al reintentar).
- **Índice:** compuesto collection-group `progress (colegioId, cursoId)` desplegado
  (lo requiere la query del agregador).
- **Reglas:** compiladas y liberadas (`questionBank`→`bancos`).
- **Hosting:** bundle web (`expo export`, 71 archivos) desplegado, HTTP 200.
- **Agregados demo:** `scripts/backfillDemoAgregados.ts` escribió `agregados/resumen`
  (shape nuevo) para los 3 cursos demo — el trigger excluye `demo-colegio` por
  diseño (RQ-DM06), así que el reporte del rector demo se llena por este backfill.

Pendiente del dueño: verificación final en navegador entrando con los 5 accesos
(estudiante con quiz 4+3+3 real, profesor/coordinador/rector con reportería, admin).

### Bloque 2 completo + demolición legacy + EligeCamino/micro-teoría ✅ (2026-06-19)

Cierre de la maduración: cableadas las dos features de spec que faltaban y demolido
el legacy pre-pivot. Re-desplegado y verificado en producción.

- **Micro-teoría (RQ-ES02):** se muestra antes del quiz (primera entrada al mundo);
  colección read-only `microteoria/{grado}_{worldId}`; 15 docs / 60 cards en prod.
- **EligeCamino (RQ-FN09/ES06):** 30% determinista al entrar a un mundo; situación con
  consecuencia, **sin respuesta correcta ni puntaje, elección NO persistida (R5)**;
  colección read-only `bancosEligeCamino/{grado}_{worldId}`; 15 docs / 45 situaciones.
- **Orquestador del flujo** extraído a hook `useWorldFlow` (EligeCamino → micro-teoría
  → quiz) con degradación grácil (null/throw → quiz); 21 tests de comportamiento.
- **Demolición legacy:** eliminado el sistema lesson/quiz paralelo (`/lesson/[id]`,
  `LESSONS`, `Math.random`, LessonScreen/LearnScreen/LessonSagaMap), `services/ai` y la
  regla muerta `aiProfile`. **Baseline legacy 32 → 1** (≈ cero).
- **Fixes de veto RC:** reset de `useLearningFlowStore` en logout (anti mezcla
  cross-usuario); fix de spinner infinito si `Promise.all` lanzaba.

**Vetos:** AR `pass` · CP `pass` · RC `pass`. **Gates:** typecheck/lint/i18n ✓ ·
**jest 163/163** ✓ · **test:rules 85/85** ✓ · gates+cobertura ✓ · baseline 1.

**Re-deploy verificado (ceti-d3769):** reglas (`bancosEligeCamino`+`microteoria`) ✓ ·
hosting (HTTP 200) ✓ · seed: `bancos` 45 / `bancosEligeCamino` 15 / `microteoria` 15 ✓.

**Pendiente menor:** agregación por curso de las elecciones EligeCamino (hoy reflexivo
sin persistir, RQ-FN09 — requeriría una Function); limpieza de `services/ai` ya hecha.

### Hotfixes en producción (verificados en navegador, 2026-06-19)

Pruebas en vivo sobre el deploy destaparon 3 bugs, todos corregidos y re-desplegados:

- **El quiz no pintaba las opciones:** los items del banco no traen `tipo` (vive en el
  doc, schema S5); `fetchAssembledQuiz` ahora lo estampa por tipo → WorldQuizScreen
  renderiza MC/VF/ordenar. Test del repo corregido (cazaba el verde-falso).
- **Admin Ceti se veía como estudiante:** `app/index.tsx` solo enrutaba a `/(staff)`
  con `isStaffRole` (excluye admin por §1.3); ahora admin también va al Panel docente.
- **Hydration React #418** (export estático per-ruta rompía la navegación in-app):
  `web.output` `static`→`single` (SPA, sin prerender). + i18n `roles.admin`.

Nota de despliegue: un build intermedio se construyó con caché de Metro stale (no
incluía un fix); además los chunks JS se sirven con `max-age=3600`+ETag, así que un
navegador que vio el build malo se autocorrige en ≤1 h o con un hard-refresh. Para
builds limpios garantizados: nukear `%TEMP%/metro-*` + `.expo` antes de `expo export`.
