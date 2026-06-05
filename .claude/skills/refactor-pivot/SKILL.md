---
name: refactor-pivot
description: Use when demolishing legacy pre-pivot code per docs/empresa/conflictos.md — migrating studentId→uid, removing aiProfile/certificates/services-ai, replacing autorizaciones-PII with attestation, inerting sedes. Defines the return point (pre-pivot tag), the conflict→unit map, the atomic studentId migration (manual diff approval), demolition order, and what to delete vs. inert vs. keep. Used by the refactor-migracion agent. Triggers: "refactor the pivot", "remove studentId", "demolish legacy", "migrate to uid".
---

# Refactor del pivot (playbook de demolición)

Playbook que usa **RF** (`refactor-migracion`) para demoler lo viejo según
`docs/empresa/conflictos.md` **sin romper lo conservado**. La _norma_ vive en
R1/R3/R5/R6/R7/R11/R15; aquí está el _orden y los límites_.

## Punto de retorno (obligatorio)

Antes de **cualquier** demolición, exige el tag git **`pre-pivot`** (E9). El
historial es la cuarentena (D3-matiz). Sin tag → no se demuele.

## Migración atómica `studentId` (#1 — la delicada)

Conjunto coordinado **en un solo cambio** (no parcial):

- `firestore.rules`: `isStudentSelf` → `isEstudianteSelf` por `uid`;
  `progress.studentId` → `uid`.
- `paths.ts`: `estudianteDocRef/...(studentId)` → `(uid)`; retiro de
  `autorizacionDocRef`.
- `tenancy.ts`: `CetiClaims` sin `studentId/sedeId`; `Estudiante` con
  `{email, nombre, estado, atestado, ...}`.
- `functions/`: `applyClaims/joinByCode/setMemberClaims` sin `studentId`.
- Scripts de seed actualizados.

> **Requiere aprobación manual del plan de diff antes de ejecutar** (D1/D2-matiz).
> RF presenta el diff completo; no se ejecuta sin "ok" humano.

## Orden (sigue `conflictos.md`)

```
tag pre-pivot
 → (a) identidad + roles      #1, #4   [atómico, aprobación manual] — gate: RF + AR + CP + E4 + E7
 → (b) atestación             #6                                     — gate: RF + CP + E4 + E7
 → (c) bancos + tipos         #8, #9                                 — gate: BE/GC + E2/E3 + E4
 → (d) retiro IA/perfil/cert/sede  #2, #5, #7, #3                    — gate: RF + E4
 → (e) pre/post + narrativa   #10, #11                               — gate: FE/BE + E7
```

## Borrar vs. inertizar vs. conservar

- **Borrar (delete real):** `certificate.ts`, `services/ai/*`, `adaptiveQuiz.ts`,
  path/regla `aiProfile`, colección `autorizaciones` + tipo `Autorizacion` con PII.
- **Inertizar:** `sede*` (`sedesEnabled:false`, sin docs en `sedes/`, oculto; no se
  borra — D10/R11).
- **Conservar (NO tocar):** `earlyWarning.ts`, `weaknessReport.ts`,
  `lifeProjects.ts`, `leaderboard*` (alineados con los invariantes).

## Gate por unidad

- **Toda unidad:** E4 (invariant-lint) + E7 (rules-matrix) verdes antes de merge.
- **#1 / #4 / #6** (identidad/roles/atestación): además **AR + CP** verdes.
- **Rollback:** `git reset` al tag `pre-pivot`.

## Baseline de deuda legacy

Cada unidad de demolición **elimina** entradas de `scripts/legacy-baseline.json`
(citan su conflicto). El baseline es solo-decrecimiento (prohibido agregar) y debe
llegar a **cero** al cerrar el refactor (ver CR1).

## Reglas duras (rechaza si)

- Unidad sin tag `pre-pivot`.
- Unidad `studentId`/claims/PII sin aprobación manual del plan de diff.
- Borra código conservado (`earlyWarning`/`weaknessReport`/`lifeProjects`/`leaderboard`).
- Deja el baseline con entradas nuevas o sin decrecer.
