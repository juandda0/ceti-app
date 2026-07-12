# Plan de implementación — "Mi dinero" (RQ-ES11) + Retos con cumplido (RQ-PR14)

> Estado: **BORRADOR DE PLAN**, redactado 2026-07-11. Producto de un workflow
> multi-agente (5 lectores del repo + panel de 3 diseños con juez + redacción de
> spec + 4 verificaciones adversariales: invariantes R1–R15, Ley 1581, costos
> Firebase/reglas, completitud). Veredicto de las tres verificaciones:
> **aprobado con ajustes** — ninguna rechazó el diseño; los ajustes bloqueantes
> están incorporados en este plan.
>
> Autoridad: este plan **no** es fuente de verdad. La fuente de verdad son los
> borradores del §10 una vez pegados en `docs/empresa/decisiones.md`,
> `docs/requerimientos.md` y las rules, y **aprobados por el dueño** (D0/R15).

---

## 0. Qué se construye

Dos entregas, una sola decisión coordinada (D-RETOS):

1. **"Mi dinero" (RQ-ES11)** — el diario de bolsillo (RQ-ES10) crece a herramienta
   completa **100% solo-vista-propia** bajo `users/{uid}/*`: presupuestos (topes)
   por categoría, reportes por periodo (semana/quincena/mes, calendario Bogotá),
   insights por reglas deterministas **sin ML**, racha y ritmo de meta derivados
   en cliente, y registro por voz **multi-movimiento** (una frase → hasta 5) +
   **fechas relativas** ("ayer gasté…"). Nada nuevo visible para staff.

2. **"Retos + cumplido" (RQ-PR14)** — el profesor asigna retos financieros a su
   curso y ve por estudiante **solo** `sin_empezar | en_progreso | cumplido`. La
   completitud se evalúa en el cliente del estudiante contra su diario local; a
   Firestore solo cruza una señal `{estado, timestamp}`. El profesor **jamás** ve
   montos, categorías, descripciones ni contenido del diario.

El diseño ganador del panel es el **candidato A** (reutilizar la infraestructura
de asignaciones existente, con la señal como espejo estructural de `progress/`),
con las mejoras del juez incorporadas (anclaje anti-backdating, catálogo de
tipos, forward-compat, supresión, copy de confianza).

---

## 1. La reformulación de compliance (bloqueante #1 — corregido)

La verificación de invariantes **y** la de Ley 1581 coincidieron en un punto
crítico: la redacción original de la señal era **jurídicamente falsa**. Decía que
la señal "no permite derivar conteos ni es un rasgo derivado del comportamiento".
No es cierto:

- `registrar_movimientos` en `cumplido` revela que el menor registró **≥N
  movimientos** en la ventana (una cota inferior de un conteo real de su diario).
- `en_progreso` revela que hubo **≥1 registro** en la ventana (la fuga de 1 bit).

Es, legalmente, **un dato derivado del comportamiento financiero del menor,
persistido y legible por un tercero (el profesor)**. Fundar la privacidad en
negarlo no sobrevive a una auditoría de la SIC ni al agente CP.

**La base legal correcta** (y la que va en la spec y los invariantes):

> La señal es un dato **derivado del comportamiento**, **minimizado** a un
> tri-estado, con **autorización informada actualizada**. Lo que permanece
> inaccesible al staff es el **contenido** del diario: montos, categorías,
> descripciones y el conteo exacto. La legalidad descansa en **minimización +
> autorización**, no en negar que sea dato conductual.

**Consecuencia de diseño (bloqueante #3 de invariantes):** cada tipo de reto v1
pasa el filtro S7 "¿qué se infiere del booleano?". Recomendación incorporada:

| Tipo v1                 | Qué infiere el profesor de `cumplido`        | Veredicto v1   |
| ----------------------- | -------------------------------------------- | -------------- |
| `registrar_movimientos` | Registró ≥N movimientos (hábito de registro) | ✅ incluir     |
| `crear_meta`            | Creó ≥1 meta de ahorro                       | ✅ incluir     |
| `racha_dias`            | Registró en ≥N días calendario distintos     | ⚠️ diferir     |
| `registrar_ahorros`     | **Ahorró** ≥N veces (no gastó)               | ⚠️ diferir     |
| `abonar_meta`           | Abonó ≥N veces a una meta                    | ⚠️ diferir     |
| `cumplir_tope`          | (requiere UI de topes)                       | ⛔ fuera de v1 |

**Decisión recomendada:** v1 arranca con `registrar_movimientos` + `crear_meta`
(los menos reveladores del comportamiento financiero, solo hábito de uso). Los
tres `⚠️` se difieren hasta que S7/CP los aprueben con su fuga documentada. Es
una decisión del dueño (ver §9).

---

## 2. Gate 0 — prerrequisitos de gobernanza y legal (antes de una línea de código)

Estos **cuatro** puntos son bloqueantes duros; sin ellos no debe salir código:

- **G0.1 — El dueño aprueba D-RETOS explícitamente.** Hoy el borrador está
  marcado "PENDIENTE DE APROBACIÓN HUMANA". R15/D0 prohíben enmendar R5/R10 o
  commitear código citando una decisión no aprobada. Al aprobar, se retira el
  marcador y queda el blockquote estándar "Decisión del dueño, autorizada
  explícitamente". _(bloqueante invariantes #2)_
- **G0.2 — Autorización informada (Ley 1581).** La señal es una **nueva
  finalidad + nuevo destinatario** (por primera vez el profesor ve un dato
  derivado del diario real). La atestación en archivo se recolectó bajo una
  política que promete "el diario es solo-vista-propia". Hay que: (a) actualizar
  la política pública (`EXPO_PUBLIC_PRIVACY_POLICY_URL`) para describir la señal
  de retos y su visibilidad al profesor; (b) **bumpear `politicaVersion`**
  (campo que ya existe en `atestar`, `functions/src/index.ts:508`); (c) decidir
  **con abogado** si los rosters ya activos requieren re-atestación o si la
  política nueva rige solo hacia adelante. _(bloqueante Ley 1581 #1)_
- **G0.3 — Coherencia de las fuentes tier-2.** El cambio coordinado debe incluir
  `docs/empresa/compliance.md` (autoridad sobre `requerimientos.md`): reformular
  la salvaguarda RQ-ES10 y la sección "No perfilamiento" para registrar la
  excepción estrecha, minimizada y autorizada. Y enmendar **RQ-ES10-CA6** (no
  solo CA5), porque "sin perfilamiento derivado" queda contradiciendo el código.
  _(bloqueante Ley 1581 #2)_
- **G0.4 — Veto D4 (AR + CP).** Un cambio que enmienda R5/R10 y toca PII de
  menores **exige** veto explícito del arquitecto (AR) y de compliance (CP), más
  una pasada real de la skill `compliance-ley1581` (S7) sobre el catálogo de
  tipos. Se agenda **antes del merge** y su veredicto se registra en
  `docs/estado.md`. _(faltantes de completitud)_

---

## 3. Secuenciación dura de aterrizaje (R13/R15)

El orden es un **gate**, no una sugerencia (si se invierte, E8/rq-citation y E4
coherencia-arnes bloquean, o se mergea spec-después-de-código violando R13):

```
Gate 0  →  Fase D (docs)  →  Fase I (invariantes)  →  Fase código  →  Veto D4  →  merge
```

- **Fase D — commit `docs:`** (exento de E8): `decisiones.md` (D-RETOS aprobada)
  - `requerimientos.md` (RQ-ES11, RQ-PR14, enmienda CA5 **y CA6**, filas §1.3) +
    `compliance.md`. Un solo commit de documentos.
- **Fase I — mismo PR:** `CLAUDE.md` (R5/R10) **y**
  `.cursor/rules/ceti-invariants.mdc` (R5/R10) en el **mismo commit** (E4
  `coherencia-arnes` bloquea si se toca una sin la otra).
- **Fase código:** los tres workstreams (§4), citando `RQ-ES11`/`RQ-PR14`/
  `RQ-ES10`. Aquí sí hay paralelismo (§8).
- **Cierre:** entrada en `docs/estado.md` al final tras `---`, con línea "Vetos"
  (AR/CP pass + commit) y línea "Gates" con conteos reales.

---

## 4. Los tres workstreams

### WS-A — Voz multi-movimiento + fechas relativas (RQ-ES10 v2, alimenta RQ-ES11 CA5–7)

Evolución de la **única** excepción runtime de R7 (`procesarRegistroVoz`); **no**
se agrega IA nueva.

- **Contrato nuevo (compat bidireccional):** la callable devuelve
  `movimientos: [1..5]` y mantiene a nivel raíz la proyección del primer ítem
  (cliente viejo ↔ función nueva). Cap de 5 ítems server-side. Una llamada
  consume **1 unidad** del cap diario de 30 sin importar cuántos ítems devuelva.
- **Prompt segmentador:** reescribir `SYSTEM_PROMPT` a shape array + jerga
  colombiana ampliada (`lucas`, `barras`, `billete`, `media`, `quincena`) +
  fechas relativas → `offsetDias` (entero −30..0) y opcional `diaSemana`. **La
  Function jamás conoce la fecha/zona del dispositivo**: el cliente resuelve el
  offset a fecha local al confirmar (ancla a mediodía local; nunca futuro).
- **Campo `fecha` aditivo** en `Movimiento` (epoch ms, opcional): rules numérico
  `> 0` y `≤ now + 1 día`; docs viejos no se migran (toda lectura usa
  `fecha ?? createdAt`); `offsetDias`/`diaSemana` son **transporte** y quedan
  fuera del `hasOnly` (nunca se persisten).
- **UI:** con >1 ítem, `ConfirmMovimientosListSheet` (lista editable por chip:
  tipo/monto/categoría/fecha, quitar ítems) antes de "Confirmar todo". Con 1
  ítem, el flujo actual no cambia.

**Ajustes de verificación incorporados:**

- 🔴 **Groq (costos, mayor):** subir `maxTokens` de 300 → **600** en
  `procesarRegistroVoz` (sin esto las frases de 4–5 ítems truncan). Y **cobrar
  la cuota cuando el proveedor fue realmente invocado**: distinguir fallo
  pre-invocación (red/DNS/HTTP → no cobra) de "el proveedor respondió pero la
  salida no parsea" (truncado/JSON malo → **sí** cobra). Cierra el hueco por el
  que un claim válido podría hacer llamadas Groq ilimitadas con entradas que no
  parsean. Test que fija `maxTokens ≥ 600`.
- **Golden eval del clasificador (faltante):** ~15–20 frases → clasificación
  esperada, con `ModelCaller` mockeado, como entregable versionado
  (`vozClasificacion.test.ts`). El prompt es la única defensa de la segmentación.

**Archivos:** `functions/src/vozClasificacion.ts` (+ `.test.ts`),
`functions/src/index.ts`, `src/features/savings/data/vozService.ts`,
`data/fechaRelativa.ts` (nuevo, + `.test.ts`), `data/movimientosStats.ts`,
`store/useMovimientosStore.ts`, `screens/MovimientosScreen.tsx`,
`components/ConfirmMovimientosListSheet.tsx` (nuevo),
`firestore.rules` + `scripts/testFirestoreRules.mjs`, `es.json`.

### WS-B — Herramienta "Mi dinero" (RQ-ES11), 100% self-view, cero ML

- **Presupuestos:** un **único** doc `users/{uid}/config/presupuestos` con shape
  `{topes, updatedAt}`; `hasOnly` sobre las 8 categorías; solo `isSelf`. Store
  Zustand+MMKV. Barra en tiempo real al confirmar un gasto con tope.
- **Reportes por periodo:** `periodos.ts` puro — semana (lunes–domingo),
  quincena (1–15 / 16–fin), mes, sobre `America/Bogota`, con comparación neutra
  vs periodo anterior. Todo en cliente sobre `fecha ?? createdAt`.
- **Insights por reglas:** `insights.ts` — catálogo fijo de 6–10 reglas
  deterministas (tope cerca/excedido, gasto que sube, racha, ritmo de meta,
  balance, mayor categoría), máx 2 visibles, **recomputadas en cada render,
  jamás persistidas** (ni MMKV, ni Firestore, ni analytics con su contenido).
- **Racha y ritmo:** funciones puras derivadas; la racha cuenta días con ≥1
  registro (sin contador persistido); el ritmo promedia depósitos de 90 días y
  reutiliza `monthsToReach`/`suggestMonthly` de `lifeProjects.ts`.
- **Navegación unificada:** un tab **"Mi dinero"** (`/dinero`) con secciones
  Registrar/Resumen/Metas; `/savings` y `/movimientos` → `Redirect` (href:null)
  conservando deep links y el flujo "Ahorrar" con `goalId`.

**Ajustes de verificación incorporados:**

- **Contradicción `merge:true` (faltante):** `presupuestosRepository` escribe el
  **doc completo sin merge** (o `deleteField`), no `{merge:true}` — porque el
  merge profundo haría reaparecer un tope "quitado". Diverge del patrón canónico
  a propósito; test que confirma que quitar un tope lo elimina de verdad.
- **No-persistencia forzada por test (Ley 1581, menor):** tests que asserten que
  la salida de `computeInsights`/`computeRacha` **nunca** fluye a `logEvent` ni a
  ningún `*Repository`; comentario `must-not-persist (R5)` en esos módulos.
- **Nombres (E4/R6):** prohibido `autorizacion*`/`Autorizacion` en identificadores,
  strings y comentarios (dispara el grupo E4 `acudiente`, baseline 0). Usar
  `topes`/`presupuestos`/`computeInsights`. El umbral `$5.000` del insight
  `gasto_subio` va como constante nombrada con comentario que cite por qué R14
  no aplica hoy (constante de producto, no SMMLV/UVT).
- **A11y (faltante):** BudgetBar/insights nunca por color solo — icono + etiqueta
  textual del estado (ok/cerca/excedido) además del color, contraste AA.

**Archivos (nuevos salvo indicado):** `data/{periodos,presupuestos,racha,insights,ritmoMeta}.ts`
(+ `.test.ts` c/u), `data/presupuestosRepository.ts`, `store/usePresupuestosStore.ts`,
`components/{BudgetBar,PresupuestosSheet,InsightCards,RachaChip}.tsx`,
`screens/MiDineroScreen.tsx`, `app/(app)/dinero.tsx`; y editados:
`app/(app)/_layout.tsx`, `app/(app)/{savings,movimientos}.tsx` (→ Redirect),
`screens/{MovimientosScreen,GoalsScreen}.tsx`, `components/MovimientosCharts.tsx`,
`paths.ts`, `firestore.rules` + `testFirestoreRules.mjs`, `es.json`.

### WS-C — Retos + cumplido (RQ-PR14) — candidato A + mejoras del juez

- **Consigna = asignación existente** con `kind:'reto'` y payload
  `{tipo, cantidad}` (sin texto libre; el título se deriva por i18n del tipo).
  `kind` ausente = `'mundo'` legacy (sin migración). Se **añade** validación de
  shape a `asignaciones` (hoy no tiene).
- **Señal = subcolección nueva** `.../estudiantes/{uid}/retos/{aid}` (espejo de
  `progress/`), **doc id = id de la asignación**. La escribe **solo el
  estudiante**; la leen el profesor del curso + self. `sin_empezar` = **ausencia
  del doc** (cero escrituras masivas al crear el reto).
- **Evaluación 100% client-side** (`retoEvaluator.ts` puro) sobre los stores
  locales del estudiante, ventana `[fechaInicio, deadline]` sobre `fecha ??
createdAt`. Ninguna Function ni regla lee `movimientos|goals|deposits`.
- **Copy de confianza (mejora del juez):** vista del profesor con etiqueta
  permanente "progreso autodeclarado por el estudiante"; vista del estudiante
  "tu profesor solo ve si lo cumpliste, nunca tus movimientos".
- **Forward-compat:** tipo de reto desconocido → el estudiante lo ignora y no
  publica señal (el catálogo crece sin romper clientes viejos).

**Ajustes de verificación incorporados:**

- **Supresión (bloqueante Ley 1581 #3):** `functions/src/index.ts` **entra** a la
  lista. `suppressStudentData` gana `recursiveDelete(estRef.collection('retos'))`
  - borrado de `users/{uid}/config/presupuestos`. **Y cerrar la brecha
    preexistente:** borra también `users/{uid}/goals` y `users/{uid}/deposits`
    (hoy quedan tras una supresión). Test de alcance de supresión (emulador) que
    asserte que las 4 colecciones ya no existen.
- **Anti-backdating (costos, menor):** la rule ancla `updatedAt == request.time`
  (ventana de skew pequeña) y `cumplidoAt` anclado cuando `estado=='cumplido'`.
  Test allow (anclado) + deny (fabricado lejos de `request.time`).
- **`target` con `hasOnly` (costos, menor):** `asignacionShapeValida` valida
  `target.keys().hasOnly(['tipo','cursoId','uid'])` + discriminador — cierra el
  vector de texto libre colegio-legible.
- **`cumplir_tope` fuera del enum de rules en v1 (faltante):** ampliarlo después
  es aditivo barato; incluirlo ahora crea retos incumplibles.
- **Fan-out gateado (costos, menor):** el `getDocs` de `retos/` por estudiante
  en `loadCourseReport` solo se dispara si existe ≥1 asignación `kind:'reto'`
  (dato que el cliente ya tiene). Sin retos, cero reads extra.
- **§1.3 (invariantes, menor):** añadir explícitamente la fila de **escritura**
  de la señal por el estudiante (✅S), no solo la de lectura.

**Archivos:** `src/shared/types/tenancy.ts`, `paths.ts`, `firestore.rules` +
`testFirestoreRules.mjs`, `data/retoEvaluator.ts` (+ `.test.ts`),
`data/retoEstadoRepository.ts`, `hooks/useRetoCompletionSync.ts` (+ `.test.ts`),
`data/loadCourseReport.ts`, `components/{AssignmentsManager,StudentAssignmentsBanner}.tsx`,
`screens/CourseDashboardScreen.tsx`, `functions/src/index.ts`, `es.json`.

---

## 5. Modelo de datos y reglas (núcleo de seguridad)

### Tipos (`src/shared/types/tenancy.ts`)

```ts
export type RetoFinancieroTipo =
  | 'registrar_movimientos'
  | 'crear_meta' // v1
  | 'racha_dias'
  | 'registrar_ahorros'
  | 'abonar_meta' // diferidos (S7/CP)
  | 'cumplir_tope'; // tras UI de topes

export type Asignacion = AsignacionMundo | AsignacionReto; // unión discriminada por `kind`

export type RetoEstadoDoc = {
  colegioId: string;
  cursoId: string;
  uid: string;
  retoId: string; // == path (anti-spoof)
  estado: 'en_progreso' | 'cumplido'; // 'sin_empezar' = ausencia del doc
  updatedAt: number;
  cumplidoAt?: number;
};
```

### Reglas (`firestore.rules`) — dos cambios

1. **Endurecer `asignaciones/{aid}`** (hoy sin validación): `asignacionShapeValida`
   con `hasOnly`, `deadline > fechaInicio`, `createdByUid == request.auth.uid`,
   rama mundo (legacy) vs rama reto (`reto.tipo in [enum v1]`, `cantidad` int
   1..100, `target` con `hasOnly`). La consigna es legible por `sameColegio`
   pero **incapaz de cargar texto libre**.
2. **Bloque nuevo `retos/{retoId}`** anidado en `estudiantes/{uid}` (junto a
   `progress/`): `read` = profesor del curso o self; `create/update` = **solo
   self activo** + `hasOnly` del shape + `estado in [en_progreso,cumplido]` +
   `updatedAt == request.time` + monotonicidad (nunca `cumplido → en_progreso`)
   - `get()` que exige que la asignación exista, sea `kind:'reto'` y apunte a
     ese curso; `delete: if false`. Costo: 2 `get()` por escritura (dedupe), bajo
     el límite de 10.

Lo que **no** cambia y los tests re-pinnean: `users/{uid}/movimientos|goals|deposits`
siguen self-only; el profesor sigue con **deny total** ahí (re-pin de CA5).

---

## 6. Matriz de tests y gates

| Capa           | Qué se prueba                                                                                                                                                                                                                                                                                                                                       | Dónde                                 |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| Unit puro      | `parseClasificaciones` (array, cap 5, jerga, offsets, malformados); `fechaRelativa`; `periodos` (semana/quincena/mes Bogotá, `dayKey` cruce UTC); `presupuestos` (`estadoTope` bordes 0.8/1.0); `racha`; `insights` (8 reglas, prioridad, máx 2); `ritmoMeta`; `retoEvaluator` (3 estados × tipo, ventana, límites)                                 | `*.test.ts` junto a cada módulo       |
| Store          | `usePresupuestosStore` (doc completo sin merge; quitar tope; analytics keys exactas); `useMovimientosStore` (`fecha` persiste; `movimiento_registrado` = `['origen','tipo']`; `movimientos_multi_confirmado` = `['cantidad']`); `useRetoCompletionSync` (solo transición hacia adelante; payload keys exactas **sin** monto/categoria)              | `*.test.ts`                           |
| Reglas (E7)    | ≥1 allow + ≥1 deny por celda. Críticos: **deny campo extra `monto` en la señal**, deny profesor escribe la señal, deny degradación, deny `retoId` inexistente/otro-curso, deny `pendiente_atestacion`, deny `updatedAt` fabricado, deny `fecha` futura, allow update de asignación **legacy** sin `kind`, **re-pin: profesor no lee `movimientos`** | `scripts/testFirestoreRules.mjs`      |
| Supresión      | tras `suppressStudentData`: `retos/`, `config/presupuestos`, `goals`, `deposits` no existen                                                                                                                                                                                                                                                         | test emulador                         |
| Golden voz     | ~15–20 frases → clasificación esperada (mock caller)                                                                                                                                                                                                                                                                                                | `vozClasificacion.test.ts`            |
| E2E (faltante) | Playwright-web (producto web-first): voz multi + "Confirmar todo"; definir tope y ver barra; profesor-crea-reto → estudiante-cumple → profesor-ve-estado                                                                                                                                                                                            | `e2e/` (hoy solo hay un stub Maestro) |

**Gate final antes del PR:** `npm run gates` **y** `npm test` (no es superset) +
`typecheck` + `lint` + `test:rules`. Verificar **"N passed, 0 failed" en stdout**
(exit-0 engañoso conocido en Windows; liberar puerto 8099 antes de `test:rules`).

---

## 7. Objeciones de la verificación → dónde se resuelven

| #   | Sev | Lente  | Objeción                                                                                                 | Resuelto en                                          |
| --- | --- | ------ | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| 1   | 🔴  | inv    | Afirmación de privacidad falsa ("no conteos / no rasgo")                                                 | §1 (reformulación honesta) + §10 (CA5/R5 reescritos) |
| 2   | 🔴  | inv    | Enmendar R5/R10 citando decisión no aprobada                                                             | §2 G0.1 (gate)                                       |
| 3   | 🔴  | ley    | Autorización no cubre nueva finalidad; falta `politicaVersion`                                           | §2 G0.2                                              |
| 4   | 🔴  | ley    | Omite `compliance.md` + RQ-ES10-CA6                                                                      | §2 G0.3, §3 Fase D                                   |
| 5   | 🔴  | ley    | Supresión no implementada para colecciones nuevas                                                        | §4 WS-C, §6 (test supresión)                         |
| 6   | 🟠  | inv    | Fuga por tipo sub-especificada                                                                           | §1 (tabla, v1 reducido)                              |
| 7   | 🟠  | inv    | Falta enmendar RQ-ES10-CA2 (contrato de la callable)                                                     | §10 (añadir a Fase D)                                |
| 8   | 🟠  | ley    | Brecha preexistente: goals/deposits no se borran                                                         | §4 WS-C (cerrada)                                    |
| 9   | 🟠  | ley    | Proporcionalidad de la lista nominal sin documentar                                                      | §9 (decisión) + D-RETOS                              |
| 10  | 🟠  | costos | Cuota Groq solo acota la ruta de éxito                                                                   | §4 WS-A                                              |
| 11  | 🟡  | varios | maxTokens, `updatedAt` anchor, `target` hasOnly, `cumplir_tope`, fan-out, nombres, a11y, no-persistencia | §4 (cada WS)                                         |

Faltantes de completitud (25) resueltos transversalmente en: §3 (secuenciación),
§8 (paralelización/hot-files), §6 (E2E, golden eval, estado.md), §2 G0.4 (veto D4/S7),
§9 (decisiones del dueño).

---

## 8. Paralelización y hot-files

**Corre en paralelo sin conflicto** (módulos puros independientes + sus tests):
`fechaRelativa.ts`, `periodos.ts`, `insights.ts`, `racha.ts`, `ritmoMeta.ts`,
`presupuestos.ts`, `retoEvaluator.ts`. Un agente por módulo, cero solapamiento.

**Debe serializarse** (hot-files que los tres workstreams tocan — propietario
único u orden estricto para evitar conflictos y orden frágil de escenarios E7):

| Hot-file                              | Lo tocan                                                               | Estrategia                                                     |
| ------------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------- |
| `firestore.rules`                     | A (fecha), B (presupuestos), C (retos+asignaciones)                    | un solo PR de reglas, orden C→B→A, escenarios al final         |
| `scripts/testFirestoreRules.mjs`      | A, B, C                                                                | mismo dueño que `firestore.rules`; seed propio por bloque      |
| `src/shared/i18n/locales/es.json`     | A, B, C (namespaces `movimientos.*`, `dinero.*`, `assignments.reto_*`) | inventario consolidado de claves antes del merge; `i18n:check` |
| `MovimientosScreen.tsx`               | A (onTranscript), B (parte en Registrar/Resumen)                       | B refactoriza primero, A rebasa encima                         |
| `functions/src/index.ts`              | A (Groq/cuota), C (supresión)                                          | secciones disjuntas; merge trivial                             |
| `docs/requerimientos.md`, `estado.md` | los tres                                                               | Fase D los serializa (un commit `docs:`)                       |

**Dependencia cruzada del campo `fecha`:** RQ-ES11-CA2 (reportes) y RQ-PR14-CA5
(ventana del evaluador) leen `fecha ?? createdAt`, pero `fecha` lo introduce
**solo WS-A**. Por eso **WS-A aterriza `fecha` (rules + tipo) antes o junto a
WS-B/WS-C**. Si el dueño prefiere no acoplarlos, v1 se congela a `createdAt` y
`fecha` se enmienda después (decisión §9).

---

## 9. Decisiones que necesito de ti (dueño)

1. **Tipos de reto v1.** Recomiendo arrancar con `registrar_movimientos` +
   `crear_meta` (menos reveladores) y diferir `racha_dias`/`registrar_ahorros`/
   `abonar_meta` hasta que S7/CP los aprueben. ¿De acuerdo, o quieres el catálogo
   completo desde v1 asumiendo la fuga documentada?
2. **Nominal vs agregado.** Elegiste lista nominal `nombre → estado`. Ley 1581
   pide justificar la **necesidad** del detalle nominal frente a la alternativa
   menos invasiva ("X de N cumplieron", sin nombres). ¿Registramos la
   justificación pedagógica (seguimiento a estudiantes concretos) en D-RETOS, o
   te sirve el agregado por curso y bajamos la intrusión?
3. **Re-atestación (legal).** ¿Los rosters ya activos re-atestan bajo la nueva
   política, o la política nueva rige solo hacia adelante? Requiere visto de
   abogado — lo dejamos por escrito en `compliance.md`.
4. **Alcance de la voz.** "Que la voz registre todo": ¿incluye **definir topes
   por voz** (hoy topes es un formulario), o el alcance de voz sigue en
   movimientos/abonos/meta como está diseñado?
5. **`fecha` acoplada.** ¿WS-A aterriza `fecha` primero (recomendado, habilita
   reportes/ventana por fecha declarada) o v1 se congela a `createdAt`?
6. **Una entrada de decisión o dos.** ¿Una sola D-RETOS con entregas A/B (patrón
   D-ORQ), o dos entradas `D-MIDINERO` + `D-RETOS`?

Defaults si no dices nada: 1→reducido, 2→documentar nominal, 4→fuera de alcance,
5→`fecha` primero, 6→una sola D-RETOS. El **3 requiere tu abogado** sí o sí.

---

## 10. Apéndice — borradores de spec (listos para Fase D)

> Pegar tal cual en las anclas indicadas. Verificado hoy: no hay conflicto de
> numeración (`RQ-ES11`/`RQ-PR14` no existen en el repo). Falta **añadir** la
> enmienda de RQ-ES10-CA2 y CA6 (objeciones #7 y #4), no solo CA5.

Los textos completos de **RQ-ES11**, **RQ-PR14**, la **enmienda de RQ-ES10-CA5**,
la entrada **D-RETOS** y los **diffs de R5/R10** (CLAUDE.md + rule) están
generados y guardados; se pegan en Fase D con las correcciones del §1 y §7
aplicadas (redacción honesta de la señal, CA2/CA6 añadidos, `compliance.md`
incluido, catálogo v1 reducido).

**Anclas de inserción** (usar el ancla textual, no offsets):

- RQ-ES11 → `requerimientos.md` §2, tras la última CA de RQ-ES10, antes de
  "### Conflictos resueltos en esta sección".
- RQ-PR14 → `requerimientos.md` §3, tras la última CA de RQ-PR13, antes del `---`.
- Enmienda CA5/CA6/CA2 → reemplazan las líneas correspondientes de RQ-ES10.
- D-RETOS → `docs/empresa/decisiones.md`, al final (entradas cronológicas).
- R5/R10 → `CLAUDE.md` **y** `.cursor/rules/ceti-invariants.mdc`, mismo commit.
- Filas §1.3 → tabla de la matriz: "Crear/editar retos" (profesor ✅U),
  "Ver estado de retos" (profesor ✅U + estudiante ✅S) **y "Escribir señal de
  reto"** (estudiante ✅S), cada celda con allow + deny en E7.
