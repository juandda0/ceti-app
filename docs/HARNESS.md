# HARNESS.md — Arnés multi-agente de Ceti

> **Qué es este documento.** El arnés operativo, reproducible, con el que Claude
> (orquestador raíz) construye Ceti con calidad de producción: qué subagentes
> existen, qué hace cada uno, **quién bloquea a quién antes de merge**, qué corre
> en **paralelo** y qué es **barrera**, y cómo se **descubren e instalan skills y
> rules** en cada fase.
>
> **Relación con los demás docs.** `CLAUDE.md` manda sobre todo (invariantes de
> producto). `AGENTS.md` define el _ecosistema conceptual_ de agentes (roles,
> gates, justificación por archivo). **`HARNESS.md` es la capa de ejecución**:
> cómo ese ecosistema se materializa con el tooling real (Agent subagents,
> Workflow, Skills, compuertas de verificación). Si `AGENTS.md` y `HARNESS.md`
> divergen en _qué agente existe_, manda `AGENTS.md`; en _cómo se ejecuta el
> flujo_, manda `HARNESS.md`.
>
> Versión 1 · 2026-06-03 · branch `master`

---

## 0. Estado real del repo (sobre el que se diseñó este arnés)

Ceti ya **no** es la app single-user que describe `AGENTS.md` §0. Está en la fase
B2B2C escolar (≈ Fase 12 del pivot). Verificado en el árbol al escribir esto:

- **Multi-tenant operativo.** `firestore.rules` implementa el árbol completo
  `colegios/{cid}/{sedes,cursos/{cursoId}/estudiantes/{sid}/progress},
asignaciones, autorizaciones}`, `membership/{uid}`, `classCodes/{code}`,
  más el área account-scoped `users/{uid}/{goals,deposits,lessonProgress,wallet,
aiProfile}` y `questionBank`. Autorización por **custom claims**
  (`role`, `colegioId`, `sedeId`, `studentId`, `cursoId`), nunca por campos
  escribibles desde cliente. Read collection-group de `progress` para reportes
  agregados (rector/coordinador).
- **Cloud Functions reales** (`functions/src/index.ts`, ya no `export {}`):
  `setMemberClaims`, `bootstrapColegio`, `registerColegio`, `listColegios`
  (super-admin), `setAuthorizationStatus` y `suppressStudentData` (Ley 1581),
  `generateClassCode` / `joinByCode` (auto-inscripción tipo Classroom).
- **Feature nuevo `src/features/dashboard`** — reportes por curso y por colegio
  (`courseReport`, `schoolReport`), roster, asignaciones, certificados, consola
  admin/superadmin. Ya tiene tests (`courseReport.test`, `schoolReport.test`,
  `assignmentStatus.test`, `certificate.test`, `mastery.test`, `worldProgress.test`).
- **Pantallas por rol** bajo `app/(staff)`: `index`, `colegio`, `superadmin`,
  `curso/[cursoId]`, `admin/index`, `admin/curso/[cursoId]`; estudiante en
  `app/(app)`; auth en `app/(auth)`.
- **Testing de reglas real**: `npm run test:rules` corre
  `scripts/testFirestoreRules.mjs` contra el emulador
  (`@firebase/rules-unit-testing`). Scripts de operación:
  `seedDemoColegio`, `seedScenario`, `setRole`, `setSuperadmin`, `seedQuestionBank`.

**Consecuencia para el arnés:** los riesgos del arnés ya no son "Functions vacío"
ni "aiProfile escribible"; son **aislamiento de tenant**, **fugas cross-colegio**
en queries collection-group, **PII de menor** en el flujo Ley 1581/consentimiento,
y **regresión de permisos por rol** en reglas/Functions. El roster de abajo está
calibrado a eso.

> **Acción documental pendiente (no bloquea este arnés):** actualizar `AGENTS.md`
> §0 al contexto B2B2C. Se propone como primer ítem una vez aprobado el arnés.

---

## 1. El orquestador raíz (Claude)

Yo soy el orquestador. No hay un subagente "orquestador": **es el hilo principal**.
Mis responsabilidades:

1. **Descomponer** la solicitud en unidades con dueño claro (un lente/dominio).
2. **Despachar** a especialistas — con `Agent` (una tarea aislada) o `Workflow`
   (fan-out determinista de muchos) — secuenciando por dependencias.
3. **Sincronizar e integrar** los diffs, resolviendo conflictos entre dominios.
4. **Correr el loop** plan → construir → revisar (adversarial) → corregir → merge
   hasta "verde", sin mergear nada que no haya pasado las compuertas.
5. **Mantener los invariantes** de `CLAUDE.md` por encima de cualquier subagente.

**Cómo materializo cada "agente" del brief con el tooling real:**

| Concepto del brief              | Materialización real en este repo                                                                                                                                                       |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Orquestador                     | El hilo principal de Claude Code (yo).                                                                                                                                                  |
| Especialistas (lentes)          | `Agent` con `subagent_type` (`general-purpose`, `Explore`, `Plan`) + un prompt de rol; o etapas de un `Workflow` con `label`/`phase`.                                                   |
| Validador / revisor adversarial | Skills `code-review`, `security-review`, `firebase-security-rules-auditor`, `verify` + las **compuertas de verificación** (§4).                                                         |
| Descubridor de skills & rules   | Paso de arranque de cada fase (§6): inventario de `.claude/skills/*`, `.cursor/rules/*`, skills del plugin Firebase, y búsqueda externa (findskill / WebSearch) cuando falte cobertura. |
| Fan-out paralelo / barrera      | `Workflow`: `pipeline()` por defecto, `parallel()` sólo cuando se necesitan todos los resultados a la vez (§5).                                                                         |

Para trabajo grande y multi-fase, **no** se lanza un solo Workflow gigante: se
encadenan Workflows de una fase cada uno (entender → diseñar → construir →
revisar), y yo leo el resultado de cada uno antes de decidir el siguiente.

---

## 2. Roster de subagentes (lentes especialistas)

Cada lente revisa **lo suyo** antes de integrar. Todos son de **sólo lectura +
propuesta de diff** salvo los marcados como autores. Ninguno puede violar los
invariantes de `CLAUDE.md`. La columna "Gate" indica si **bloquea merge**.

### 2.1 Constructores (autores de diff)

| Lente                            | Responsabilidad                                                                                                                                                                                      | Entrada → Salida                                       | `subagent_type` / skill                                                                                                                             | Gate                                                 |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------- | ----------------- |
| **Frontend RN/Expo (web-first)** | Pantallas y lógica de dominio bajo `app/(app                                                                                                                                                         | auth                                                   | staff)/_`y`src/features/{auth,learning,savings,dashboard}/_`. Zustand + expo-router + RNW. **No** toca `firestore.rules`, `functions/`, `eas.json`. | spec de feature + paths → diff TS/TSX, stores, repos | `general-purpose` + skills `add-screen`, `add-zustand-mmkv-store` | — (debe pasar §4) |
| **Firebase / Backend**           | `firestore.rules`, `firestore.indexes.json`, `functions/src/*`, claims, App Check, deploy a `ceti-d3769`. Repos cliente que crean paths nuevos.                                                      | issue backend → diff reglas/Functions + índices        | `general-purpose` + skill `firebase-firestore`, plugin `firebase:*`                                                                                 | — (debe pasar 2.2 y §4)                              |
| **Datos / Repositorios**         | Repos Firestore (`*Repository.ts`) bajo la tenencia de `docs/data-model.md`: `getFirebaseClients()` guard + `stripUndefinedValues` + `{ merge: true }` + retorno boolean; paths sólo vía `paths.ts`. | entidad → repo + helper de path                        | `general-purpose` + skill `add-firestore-repository`                                                                                                | —                                                    |
| **Testing / QA**                 | Tests Jest para repos/stores/utils sin cobertura; tests de reglas en `scripts/testFirestoreRules.mjs` (emulador); flujos E2E Maestro reales. **No** mocks triviales.                                 | módulo → `*.test.ts(x)` / caso de regla / YAML Maestro | `general-purpose` + skill `verify`                                                                                                                  | — (su salida pasa por 2.2 Test-Reviewer)             |
| **i18n**                         | Toda string visible vía `t('...')` en `src/shared/i18n/locales/es.json`; sin literales en JSX.                                                                                                       | diff de pantalla → patch `es.json` + reemplazos        | `general-purpose`                                                                                                                                   | recomendación                                        |
| **DevOps / Deploy**              | `eas.json`, `firebase.json`, `.github/workflows/*`, channels OTA, migraciones de datos, deploy.                                                                                                      | release/infra → comandos + changelog                   | `general-purpose`                                                                                                                                   | bloqueado por Testing/QA antes de build preview/prod |

### 2.2 Validadores (adversariales — bloquean merge)

| Lente                                                | Qué busca                                                                                                                                                                                         | Entrada → Salida                                                                                             | Skill / herramienta                                            | Gate                                                                                                       |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Revisor de código (adversarial)**                  | Bugs, regresiones, acoplamiento, duplicación, cabos sueltos en cada diff.                                                                                                                         | diff → hallazgos verificados                                                                                 | skill `code-review` (effort alto en cambios sensibles)         | **bloquea** merge ante bug confirmado                                                                      |
| **Auditor de reglas Firestore**                      | Menor privilegio, **aislamiento de tenant** (`sameColegio`), `isSelf`/`isStudentSelf`, validación de tipos/rangos en `progress`, fugas en collection-group, idempotencia, compatibilidad cliente. | diff de `firestore.rules` / `firestore.indexes.json` / paths nuevos                                          | skill `firebase-security-rules-auditor` + `npm run test:rules` | **bloquea** merge: `allow ... if true`, path sin gate de claims, campo PII sin validar, fuga cross-colegio |
| **Seguridad & Cumplimiento (Ley 1581/Decreto 1377)** | PII de menor fuera de lo que el flujo de autorización exige; `MIN_AGE=13`; analytics sin nombres/correos/edad; consentimiento del acudiente; supresión (derecho de borrado).                      | diff de `analytics/*`, `functions/*` (Ley 1581), `auth/screens/*`, `firestore.rules`, copy de consentimiento | skill `security-review` + `docs/COMPLIANCE.md`                 | **bloquea** merge ante PII de menor o baja de `MIN_AGE`                                                    |
| **Test-Reviewer**                                    | Tests que verifican implementación en vez de comportamiento; mocks que esconden errores (sobre Firestore); verde falso; happy-path sin error-path.                                                | diff de tests → `pass`/`needs-rework`                                                                        | `general-purpose` (lente)                                      | **bloquea** merge de tests con `expect(true).toBe(true)`, mocks sin assert, cobertura aparente             |
| **Compuertas de verificación**                       | Que tsc/lint/test/test:rules/build/export pasen.                                                                                                                                                  | working tree → reporte por step                                                                              | comandos §4                                                    | **bloquea** commit/merge si falla cualquiera                                                               |

### 2.3 Lentes de calidad (revisan, recomiendan; escalan a gate si tocan dominio sensible)

Arquitectura · Clean code · Escalabilidad (modelado Firestore, índices, costos,
queries collection-group, paginación) · UI/UX (jerarquía visual, flujos por rol,
estados vacío/carga/error, light/dark, responsive) · Accesibilidad (roles,
labels, contraste, teclado en web) · Performance (bundle web, lazy-load, caché) ·
Documentación (mantiene `CLAUDE.md`, `data-model.md`, `COMPLIANCE.md`,
`AGENTS.md`, este `HARNESS.md` en sync).

Se invocan como lentes adicionales en el fan-out de revisión cuando el cambio los
toca. Si un lente de calidad detecta algo que cruza a seguridad/cumplimiento o
rompe un invariante, **escala a gate** (deja de ser recomendación).

> **No hay tope de lentes.** Si una fase necesita uno nuevo (p. ej. _Analítica_,
> _Migraciones de datos_), se crea aquí y se documenta en el §11.

---

## 3. Quién bloquea a quién (gates de merge)

```
Frontend / Datos / Firebase / Testing  ── producen diff
        │
        ├── Compuertas de verificación (§4)            [BARRERA · bloquea commit]
        ├── Revisor de código adversarial               [bloquea ante bug]
        ├── Auditor de reglas Firestore   (si toca rules/paths/índices)  [bloquea]
        ├── Seguridad & Cumplimiento      (si toca PII/analytics/Ley 1581/age) [bloquea]
        └── Test-Reviewer                 (si hay tests nuevos)          [bloquea]
                                  │
                            (todo verde)
                                  ▼
                               MERGE

DevOps / Deploy  ──blocked by──►  Testing/QA  (smoke + flujo real verde antes de build preview/prod)
```

Regla dura: **ningún diff entra a `master` sin pasar las compuertas de
verificación + todo gate aplicable a los archivos que tocó.** Ante duda de un
validador, se asume **falla** y se corrige (§7).

---

## 4. Compuertas de verificación (comandos reales)

Replican exactamente lo que exige CI (`.github/workflows/ci.yml`) y añaden las
compuertas del backend. Las corro al cerrar toda tarea que tocó código.

| Compuerta             | Comando                                              | Cuándo                                  |
| --------------------- | ---------------------------------------------------- | --------------------------------------- |
| Typecheck             | `npm run typecheck`                                  | todo cambio TS/TSX                      |
| Lint                  | `npm run lint`                                       | todo cambio TS/TSX                      |
| Formato               | `npm run format:check`                               | todo cambio                             |
| Unit/RTL              | `npm test`                                           | todo cambio de lógica/UI                |
| **Reglas (emulador)** | `npm run test:rules`                                 | todo cambio de `firestore.rules`/paths  |
| **Build Functions**   | `cd functions && npm run build`                      | todo cambio en `functions/src/*`        |
| Export web            | `npx expo export -p web`                             | cambios que puedan romper el bundle web |
| Audit                 | `npm audit --audit-level=high` (raíz y `functions/`) | dependencias / pre-release              |

`master` sólo recibe merge con **todas** las aplicables en verde. En Windows uso
sintaxis PowerShell; `cd` en compuestos se evita (rutas absolutas o `working-directory`).

---

## 5. Flujo por fase: plan → fan-out → validación → fix → merge

Cada fase de trabajo sigue el mismo ciclo. El patrón por defecto en `Workflow` es
**`pipeline()`** (cada ítem fluye por todas las etapas sin barrera); **`parallel()`
sólo cuando de verdad necesito todos los resultados juntos** (dedupe de hallazgos,
early-exit si 0, síntesis final).

```
1. PLAN              (yo, o subagent_type: Plan)         — secuencial
   └─ descomponer, identificar archivos/dominios, invariantes en juego

2. DESCUBRIR SKILLS & RULES de la fase (§6)              — secuencial, barato
   └─ inventario .claude/skills, .cursor/rules, plugin firebase; instalar lo que falte

3. FAN-OUT DE ESPECIALISTAS (independientes)             — PARALELO
   └─ Frontend ∥ Datos ∥ Firebase ∥ Testing ∥ i18n  (cada uno su dominio)

4. VALIDACIÓN ADVERSARIAL                                — PIPELINE→BARRERA
   └─ por cada diff: code-review ∥ rules-auditor ∥ security ∥ test-reviewer
      → dedupe de hallazgos (BARRERA) → ¿real? verificación adversarial (§7)

5. FIX                                                   — dirigido
   └─ el constructor dueño corrige; re-corre sólo lo afectado

6. COMPUERTAS DE VERIFICACIÓN (§4)                       — BARRERA
   └─ tsc + lint + test + test:rules + build + export — todo verde

7. MERGE                                                 — secuencial
   └─ integro, actualizo docs si cambió convención (Update protocol de CLAUDE.md)
```

**Qué es paralelo (independiente):**

- Especialistas de dominios distintos en el paso 3 (Frontend, Datos, Firebase, i18n, Testing) — no comparten archivos.
- Los validadores del paso 4 ven el mismo diff desde ángulos distintos (code-review ∥ rules-auditor ∥ security ∥ test-reviewer).

**Qué es barrera (necesita todos):**

- Dedupe de hallazgos antes de verificar (no verifico dos veces el mismo bug).
- Las compuertas de verificación del paso 6 (no se mergea con una en rojo).
- Síntesis final / decisión de merge.

**Cuándo NO uso barrera:** si sólo necesito aplanar/mapear/filtrar resultados, lo
hago dentro de una etapa de `pipeline()`, no con `parallel()`.

### Patrón canónico de revisión (referencia para Workflow)

```
pipeline(
  DIMENSIONES,                                  // [code, rules, security, tests]
  d  => agent(prompt(d),  {phase:'Review',  schema: FINDINGS}),
  rv => parallel(rv.findings.map(f => () =>     // cada hallazgo se verifica al cerrar su dimensión
        agent(`Refuta adversarialmente: ${f}`, {phase:'Verify', schema: VERDICT})))
)
// confirmados = findings cuyo veredicto NO logró ser refutado por mayoría
```

Escala según el pedido: "encuentra bugs" → pocos finders, voto simple;
"audita a fondo" / "sé exhaustivo" → pool mayor, 3–5 votos adversariales,
etapa de síntesis y loop-until-dry.

---

## 6. Descubrimiento e instalación de skills & rules por fase

Antes del fan-out de cada fase (paso 2), levanto el inventario de la fase:

1. **Repo skills** — `.claude/skills/*` (hoy: `add-firestore-repository`,
   `add-zustand-mmkv-store`, `add-screen`). Si la fase repite un patrón nuevo y
   estable, propongo crear un skill con `skill-creator`.
2. **Repo rules** — `.cursor/rules/*` (hoy: `ceti-invariants`,
   `expo-rn-typescript`, `firebase-modular-client`, `zustand-stores`). Si falta
   una convención que la fase necesita, la **propongo y la creo en el mismo
   cambio** (y actualizo `CLAUDE.md` primero — _Update protocol_).
3. **Skills de plataforma** — plugin `firebase:*` (`firebase-firestore`,
   `firebase-security-rules-auditor`, `firebase-auth-basics`, etc.) y los de
   revisión (`code-review`, `security-review`, `verify`).
4. **Búsqueda externa** — cuando ningún skill local cubre el trabajo de la fase,
   busco e instalo skills relevantes (findskill / WebSearch) y dejo registro de
   qué se instaló y por qué.

Mapa rápido fase → skills/rules:

| Trabajo de la fase               | Skills / rules a cargar                                                                            |
| -------------------------------- | -------------------------------------------------------------------------------------------------- |
| Pantalla o flujo por rol         | `add-screen`, `expo-rn-typescript`, `zustand-stores`, `ceti-invariants`                            |
| Persistencia nueva               | `add-firestore-repository`, `firebase-modular-client`, `firebase-firestore`                        |
| Estado compartido                | `add-zustand-mmkv-store`, `zustand-stores`                                                         |
| Reglas / claims / Functions      | `firebase-security-rules-auditor`, `firebase-firestore`, `firebase-auth-basics`, `ceti-invariants` |
| PII / consentimiento / analytics | `security-review`, `ceti-invariants` + `docs/COMPLIANCE.md`                                        |
| Verificación de un cambio        | `verify`, `code-review`                                                                            |

---

## 7. Verificación adversarial (regla del arnés)

- Las afirmaciones de validadores y especialistas **se contrastan**, no se toman
  como verdad. Para hallazgos sensibles (seguridad, reglas, PII) lanzo verificadores
  independientes con instrucción de **refutar**; si la mayoría refuta, se descarta;
  si no logran refutar, se trata como real.
- **Ante duda, se asume "falla" y se corrige.** Un test verde con mock equivocado
  o una regla "probablemente segura" cuentan como rojo.
- Diversidad de lente cuando un hallazgo puede fallar de varias formas: distintos
  verificadores con foco distinto (correctitud, aislamiento de tenant, PII,
  reproducibilidad) en vez de N idénticos.
- **Sin caps silenciosos:** si una revisión limita cobertura (top-N, muestreo),
  lo declaro explícitamente; no presento parcial como total.

---

## 8. Invariantes primero (no negociable)

Ningún subagente puede violar los invariantes de `CLAUDE.md` /
`.cursor/rules/ceti-invariants.mdc`. En particular, en este repo:

- **Nada de `parent`/`child`/`family`** ni acudiente como usuario in-app con
  dashboard. La jerarquía es org-tenancy (staff ↔ estudiante), no tutela.
- **Sin dinero real**, sin leaderboards globales, **sin IA generativa en MVP**.
- **`MIN_AGE = 13`**; PII de menor minimizada (pseudónimo/`studentId`, no nombre/email).
- Autorización **siempre** por custom claims en `firestore.rules`; nunca por campos
  escribibles desde cliente. Aislamiento de tenant por `colegioId` en todo read
  cross-student.
- Paths sólo vía `paths.ts`; escrituras sólo vía `*Repository.ts` con el patrón guard.

Para **levantar** un invariante (p. ej. activar IA o nativo) se actualiza
`CLAUDE.md` **y** la regla correspondiente **en el mismo cambio**. Un subagente no
puede hacerlo unilateralmente.

---

## 9. Relación con AGENTS.md

`AGENTS.md` define el ecosistema conceptual (12 agentes nombrados, gates,
justificación por archivo). Su **§0 de contexto está obsoleto** (describe la app
single-user pre-pivot). Los agentes conceptuales siguen mapeando a los lentes de
§2 así:

| Agente en `AGENTS.md`                                | Lente/gate en `HARNESS.md`                |
| ---------------------------------------------------- | ----------------------------------------- |
| Orchestrator                                         | Orquestador raíz (§1)                     |
| Mobile-Feature-Builder                               | Frontend RN/Expo (§2.1)                   |
| Firestore-Rules-Auditor                              | Auditor de reglas Firestore (§2.2)        |
| COPPA-GDPRK-Guard                                    | Seguridad & Cumplimiento (§2.2)           |
| Test-Writer / Test-Reviewer                          | Testing/QA (§2.1) / Test-Reviewer (§2.2)  |
| TypeCheck-Lint-Gate                                  | Compuertas de verificación (§4)           |
| E2E-Maestro-Author                                   | Testing/QA — flujos Maestro (§2.1)        |
| EAS-Release-Manager                                  | DevOps/Deploy (§2.1)                      |
| AI-Service-Integrator / AIProfile-Functions-Migrator | Diferidos (sin IA en MVP — invariante §8) |
| Dependency-Auditor                                   | Compuerta `npm audit` (§4) + cron CI      |

**Pendiente propuesto:** refrescar `AGENTS.md` §0 al contexto B2B2C (multi-tenant,
Functions reales, feature `dashboard`, `test:rules`), añadir lentes de tenant
(Escalabilidad/aislamiento) y marcar los agentes de IA como diferidos por
invariante. Se hace tras aprobar este arnés.

---

## 10. Restricciones honradas

- El orquestador raíz es el único punto de entrada (no se auto-despachan subagentes
  entre sí; yo secuencio).
- Paralelo donde es independiente; barrera donde se necesitan todos los resultados.
- Plan → construir → revisar (adversarial) → corregir → merge en cada fase; nada
  se mergea sin validador + compuertas.
- Verificación adversarial con sesgo a "falla".
- Invariantes de `CLAUDE.md` por encima de cualquier subagente.
- Nombres de lente descriptivos, sin metáforas; cada gate cita un archivo/estado real.

---

## 11. Evolución del arnés

- **v1 — 2026-06-03** — Diseño inicial sobre el estado B2B2C real (≈ Fase 12):
  multi-tenant, Cloud Functions reales, feature `dashboard`, `test:rules`.
  Materializa el roster del brief con el tooling real (Agent/Workflow/Skills/gates).
  Señala el `AGENTS.md` §0 obsoleto como deuda documental.

> Cuando una fase necesite un lente nuevo, créalo en §2 y regístralo aquí. Si el
> arnés cambia una convención de proyecto, actualiza `CLAUDE.md` y la regla
> afectada en el mismo cambio (_Update protocol_).
