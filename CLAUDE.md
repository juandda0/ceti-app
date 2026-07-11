# CLAUDE.md

> **Fuente de verdad: `docs/empresa/`. En conflicto, manda
> `docs/empresa/decisiones.md`**, luego el resto de `docs/empresa/`, luego
> `docs/requerimientos.md` (v2). Este archivo es el ancla del arnés: gana frente
> a reglas, skills y memoria, pero **no** frente a `docs/empresa/`.
>
> Orden de autoridad (D0): `docs/empresa/decisiones.md` > resto de
> `docs/empresa/` > `docs/requerimientos.md` (v2) > `conflictos.md`/`estado.md` >
> este archivo / `.cursor/rules/*` > repo/código.

Este archivo ancla toda la guía para Claude (y cualquier asistente) en este
repositorio. El diseño completo del arnés (departamentos, agentes, rules, skills,
enforcement) vive en **[`docs/harness-design.md`](docs/harness-design.md)**, que
**absorbe y reemplaza** a los antiguos `docs/HARNESS.md` y `AGENTS.md`.

## Qué es Ceti

Ceti es un **SaaS educativo B2B2C** vendido a **colegios privados de Colombia**.
El cliente que paga es el colegio; la relación comercial la gestiona **admin Ceti**
(backend). Lo que compra es **cumplimiento curricular (CONPES 4005) + reportería
docente + tiempo docente ahorrado**, entregado mediante una experiencia gamificada
de educación financiera para estudiantes (13+). **No** es "una app divertida":
cada feature debe servir a ese objetivo de cumplimiento/reportería.

- **Multi-tenant con jerarquía de roles**: `colegio → curso → estudiante` (sede
  **dormante**, RQ-FN01). **Tres roles** (D-PIVOT): `profesor` y `estudiante`
  operan la experiencia; `admin` (Ceti, global) tiene un **panel de
  aprovisionamiento in-app** (D-ADMIN: crea colegios, autoriza correos de
  profesor asignándolos a un colegio, revoca) y se otorga por **allowlist de
  correos Ceti**. El **profesor** se habilita por **pre-autorización de su
  correo** por un admin; **crea sus propios cursos** (nombre + grado) en su
  colegio. El **estudiante** (correo no autorizado) entra por **código/​link de
  clase**; sin curso no hay juego. Rector y coordinador **eliminados**. La
  autorización se aplica en `firestore.rules` desde custom claims (`role`,
  `colegioId`, `cursoId`) — por diseño desde el inicio, nunca como parche
  posterior.
- **NO es el modelo familiar.** El viejo modelo de tutela padre/hijo fue removido
  y sigue prohibido: sin entidades/rutas/stores `parent`/`child`/`family`, sin
  acudiente como usuario in-app con dashboard. El acudiente aparece **solo** en la
  atestación ligera Ley 1581 (R6). La jerarquía institucional es org-tenancy, no
  tutela.
- **App completa, web-first** (Expo Web / RN-Web sobre este mismo codebase).
  Nativo iOS/Android fuera de alcance.
- **Sin dinero real, jamás.** Simulador con moneda virtual. Sin gift cards, sin
  vínculo a cuentas bancarias. Sin leaderboards públicos individuales (solo
  colaboración de aula que el profesor activa).
- **IA solo en authoring-time.** El runtime del estudiante se sirve 100%
  estático (sin generación/adaptación ML en vivo). El authoring tiene dos vías
  (D-ORQ): el pipeline offline de Ceti y la **IA de authoring docente**
  (Cloud Function server-side que genera borradores que el profesor revisa y
  guarda; nunca escribe contenido). El diagnóstico del curso es por reglas, no ML.
- **El profesor orquesta su clase** (D-ORQ): configura mundos activos y orden de
  su curso (doc `cursos/{cursoId}/config/mundos`, en tiempo real, con salida
  suave; modo enfocado eliminado 2026-07-11), edita contenido vía **copy-on-write por curso**
  (`cursos/{cursoId}/contenido/*` — el default global nunca se muta) y crea
  mundos propios (`cw_*`) con gate de activación. Defaults inteligentes: un
  curso sin configuración se comporta exactamente como el default. _(RQ-PR10/
  PR11/PR12, RQ-CN06)_
- **PII de menores minimizada** (Ley 1581): solo `email` + `nombre`; identidad por
  `uid` de Auth (sin seudónimo `studentId`).
- Stack: Expo 54, React Native 0.81, TypeScript strict, Firebase 12 modular,
  Zustand 5, MMKV, Maestro E2E, Jest + RTL.
- Arquitectura: feature-first (`src/features/{auth,learning,savings,...}`) con
  infraestructura compartida bajo `src/shared/*`.

## Invariantes duros (R1–R15) — anclas

La norma completa vive en
[`.cursor/rules/ceti-invariants.mdc`](.cursor/rules/ceti-invariants.mdc) (CR1).
Aquí una línea por invariante; **levantarlos exige cambio coordinado** (R15: este
archivo **y** la rule en el mismo cambio).

- **R1** — Identidad por email; clave `estudiantes/{uid}` con solo `email`+`nombre`. Prohibido `studentId`. _(RQ-FN02)_
- **R2** — Autorización solo por custom claims `{role, colegioId, cursoId}`; ningún campo cliente es autoritativo; sin `sedeId`/`studentId`. _(RQ-FN03/FN01)_
- **R3** — Tres roles `{admin, profesor, estudiante}` (D-PIVOT: rector/coordinador eliminados). `admin` (allowlist de correos Ceti) tiene **panel de aprovisionamiento in-app** (D-ADMIN: crea colegios, autoriza correos de profesor, revoca; no juega ni lee progreso nominal). `profesor` se otorga por **pre-autorización de correo** por un admin. _(RQ-FN06, RQ-AD07/AD08, D-ADMIN)_
- **R4** — PII mínima del menor: solo `email`+`nombre`; prohibido edad/fecha/documento/teléfono/dirección/grado; analytics sin PII. _(RQ-FN02)_
- **R5** — Sin perfil individual del menor; sin `aiProfile`; Elige-camino/diagnóstico solo agregados por curso. _(RQ-FN09)_
- **R6** — Atestación ligera; cero PII de acudiente; booleano `atestado` activa al estudiante; acudiente sin cuenta/pantalla. _(RQ-FN10)_
- **R7** — Runtime del estudiante estático; IA solo authoring-time; prohibida adaptación/selección por modelo en vivo. Dos excepciones server-side estrechas: RQ-ES10 `procesarRegistroVoz` (clasifica texto del registro de bolsillo) y D-ORQ RQ-CN06 (IA de authoring docente: genera **borradores** que el profesor guarda a mano, nunca escribe contenido ni ve PII). IA prohibida en cliente y para adaptar/servir contenido o perfilar. _(RQ-CN03, RQ-ES10, RQ-CN06)_
- **R8** — Bancos default `grado×mundo×tipo`, read-only, sembrados vía Admin SDK; flag `pendiente_validacion_docente`. D-ORQ: el contenido **custom por curso** (`cursos/{cursoId}/contenido/*`) es escribible solo por el profesor del curso (copy-on-write; el default nunca se muta). _(RQ-FN07, RQ-PR11/PR12)_
- **R9** — Quiz de exactamente 10 ítems = 4 MC + 3 V/F + 3 ordenar. _(RQ-ES03/ES04)_
- **R10** — Sin dinero real; sin ranking público; solo leaderboard de aula. Excepción RQ-ES10: diario autodeclarado de bolsillo real (`users/{uid}/movimientos`), solo-vista-propia; lo transaccional sigue prohibido. _(RQ-ES05/ES08/ES09/ES10)_
- **R11** — Features excluidas (certificados PDF, app/reporte de padres, facturación, sedes activas, IA runtime, `parent/child/family`). _(D2/§9)_
- **R12** — Reglas least-privilege según matriz §1.3; default deny `/{document=**}`. D-PIVOT/D-ADMIN: en cliente autoriza admin (aprovisiona vía Functions), profesor (su curso, y crea sus cursos) + estudiante (self); escritura directa de `colegios`/`cursos` sigue `if false` (se crea vía Cloud Function que acuña código único); profesor lee agregados, atesta y suprime. _(RQ-FN12, RQ-PR13)_
- **R13** — Todo trabajo mapea a un `RQ-id` de `requerimientos.md`. _(§9)_
- **R14** — Cifras caducables nunca quemadas; vía `content/constants/economia-CO.<año>.json`. _(RQ-CN04)_
- **R15** — Levantar/cambiar un invariante exige cambio coordinado (`CLAUDE.md` + rule). _(D11)_

**Baseline de deuda legacy:** el código aún sin refactorizar viola algunos
invariantes; sus violaciones conocidas están en `scripts/legacy-baseline.json`
(solo-decrecimiento, prohibido agregar entradas, debe llegar a cero). Los gates
fallan solo ante violaciones **nuevas**. Ver CR1.

## Documentos fuente de verdad

Léelos antes de cualquier cambio no trivial.

- **[docs/empresa/](docs/empresa/)** — cerebro de la empresa. `decisiones.md`
  (máxima autoridad), `conflictos.md`, `vision.md`, `modelo-negocio.md`,
  `producto.md`, `compliance.md`, `competencia.md`.
- **[docs/requerimientos.md](docs/requerimientos.md)** — especificación v2
  (definición de "terminado"); universo de RQ (R13).
- **[docs/harness-design.md](docs/harness-design.md)** — diseño del arnés:
  agentes, departamentos, gates, pipeline de contenido. Absorbe HARNESS/AGENTS.
- **[docs/data-model.md](docs/data-model.md)** / **[docs/COMPLIANCE.md](docs/COMPLIANCE.md)**
  — schema de tenancy y Ley 1581 (targets de refactor del pivot).
- **[docs/estado.md](docs/estado.md)** — bitácora de avance por fases.

## Active rules

Las rules viven en [`.cursor/rules/`](.cursor/rules/) (lo que el motor carga).

| Rule                                                                             | Scope                                                         |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| [`ceti-invariants.mdc`](.cursor/rules/ceti-invariants.mdc) (CR1)                 | Invariantes R1–R15 + baseline legacy. Prioridad máxima.       |
| [`expo-rn-typescript.mdc`](.cursor/rules/expo-rn-typescript.mdc) (CR2)           | Expo 54 + RN 0.81 + TS strict, ESLint/Prettier, EAS, i18n.    |
| [`firebase-modular-client.mdc`](.cursor/rules/firebase-modular-client.mdc) (CR3) | Firebase modular SDK, dual-SDK, paths v2, patrón repositorio. |
| [`zustand-stores.mdc`](.cursor/rules/zustand-stores.mdc) (CR4)                   | Diseño de stores, selectores, persistencia MMKV, testing.     |

## Active skills

Las skills viven en [`.claude/skills/`](.claude/skills/) y formalizan
procedimientos/conocimiento reutilizable (no repiten la _norma_ de las rules ni
el _check_ del enforcement).

| Skill                             | Úsala cuando                                                          |
| --------------------------------- | --------------------------------------------------------------------- |
| `add-firestore-repository` (S1)   | Persistir una entidad nueva bajo el árbol tenant o `users/{uid}/...`. |
| `add-zustand-mmkv-store` (S2)     | Nuevo estado cliente compartido con persistencia MMKV.                |
| `add-screen` (S3)                 | Nueva pantalla/tab/ruta (con role-gating).                            |
| `firestore-rules-matrix` (S4)     | Traducir la matriz §1.3 a reglas least-privilege + escenarios.        |
| `content-schemas` (S5)            | Schemas Zod por tipo de ítem/banco.                                   |
| `content-authoring-pipeline` (S6) | Generar contenido (banco) authoring-time → validar → sembrar.         |
| `compliance-ley1581` (S7)         | Revisar PII/perfilamiento de un feature (Ley 1581).                   |
| `refactor-pivot` (S8)             | Demoler código viejo del pivot según `conflictos.md`.                 |
| `add-cloud-function-claims` (S9)  | Cloud Function que fija claims de rol/colegio.                        |

## Agentes y enforcement

- **Agentes** (12 en 6 departamentos D1–D6): `.claude/agents/d{N}-{depto}/*.md`.
  Constructores (FE/BE/RF/TQ/GC/DR) producen diff; revisores (RC) y veto
  (AR/CP de D4) bloquean merge. Mapa completo en `docs/harness-design.md`.
- **Enforcement** (E1–E12): hook `PostToolUse` (E1), gates de contenido (E2/E3),
  `invariant-lint` (E4), slash commands (E5), eval del validador (E6),
  rules-matrix-tests (E7), rq-citation (E8), pre-pivot-tag-guard (E9), CI (E10),
  pre-commit husky (E11), content-coverage-gate (E12, exige 45 celdas
  `grado×mundo×tipo` presentes+aprobadas+validadas — cierra el verde-falso de
  contenido ausente). Detalle en `docs/harness-design.md` → Capa 4.

## Quick conventions reference

- Path aliases: `@/*` (root), `@features/*` (`src/features/*`), `@shared/*` (`src/shared/*`). Nunca imports relativos cross-feature.
- Firestore paths: siempre vía `src/shared/lib/firebase/paths.ts`, según `docs/data-model.md`. Nunca literales inline.
- Firestore writes: siempre vía `*Repository.ts` con guard `getFirebaseClients()` + `stripUndefinedValues` + `{ merge: true }` + retorno boolean.
- Tenancy & roles: todo read cross-estudiante (staff) se gatea por `role`/`colegioId`/`cursoId` en `firestore.rules`. Nunca leer datos de otro estudiante sin regla que lo autorice por rol (R12).
- PII del menor: solo `email`+`nombre`; nunca edad/grado/documento (R4). `bancos/**` read-only (R8).
- Persistencia de stores: siempre `createJSONStorage(() => createZustandMmkvStorage())` — nunca PII/tokens a MMKV (R4).
- Strings visibles: siempre `t('...')` con claves en `src/shared/i18n/locales/es.json`.
- **Nunca mostrar "IA" en copy visible al usuario.** La generación de contenido se presenta como "Generar preguntas" (el modelo es detalle de implementación). Aplica a botones, avisos, subtítulos y mensajes de error.
- Analytics: vía `src/shared/lib/analytics/logEvent.ts`. **Nunca** nombres, emails, edades ni PII de menor en params.

## Tooling commands

| Command                        | Purpose                                                             |
| ------------------------------ | ------------------------------------------------------------------- |
| `npm start`                    | Metro + Expo dev server                                             |
| `npm run typecheck`            | `tsc --noEmit` — must pass                                          |
| `npm run lint`                 | ESLint flat config — must pass                                      |
| `npm test`                     | Jest — must pass                                                    |
| `npm run test:rules`           | Firestore rules vs. emulador                                        |
| `npm run i18n:check`           | Toda clave `t()` existe en es.json                                  |
| `npm run lint:invariants`      | E4 invariant-lint (R1–R14)                                          |
| `npm run validar-bancos`       | E2/E3 gate de contenido                                             |
| `npm run content:coverage`     | E12 cobertura: 45 celdas grado×mundo×tipo listas                    |
| `npm run gates`                | Gates rápidos: invariant-lint + i18n + contenido + cobertura + eval |
| `npm run format`               | Prettier write                                                      |
| `npm audit --audit-level=high` | Bloqueante en CI                                                    |

## Update protocol

Cuando cambies convenciones del proyecto, actualiza este archivo y la rule
afectada en el mismo cambio. Las rules y skills nunca contradicen `CLAUDE.md` en
silencio — actualiza `CLAUDE.md` primero. Para invariantes (R1–R15) aplica R15
(cambio coordinado citado contra `docs/empresa/decisiones.md`).
