# Ceti — Data model (multi-tenant B2B2C)

> **Fuente de verdad: `docs/empresa/`. En conflicto, manda
> `docs/empresa/decisiones.md`.** Este doc es PREVIO al modelo nuevo (Fase 2) y
> conserva partes OBSOLETAS marcadas abajo; la especificación viva es
> `docs/requerimientos.md` (v2). Reescritura profunda = Fase 3-4.

> ### ⚠️ OBSOLETO tras Fase 2 (no heredar estos invariantes)
>
> | Esto (abajo en este doc)                                                    | Reemplazo vigente                                                                           |
> | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
> | `studentId` seudónimo como llave del estudiante (Principio 3, §3, §4)       | **email = identidad; clave = `uid`** (RQ-FN02)                                              |
> | 4 roles (§2)                                                                | **3 roles** `{admin, profesor, estudiante}`; `admin` claim backend-only (D-PIVOT / RQ-FN06) |
> | `sedeId` en claims / sede activa (§3, §4)                                   | **sedes dormantes** `colegio→curso→estudiante` (RQ-FN01)                                    |
> | `autorizaciones` con `canalEvidencia`/`acudienteRef` (§4, §6)               | **atestación ligera** booleana, sin PII de acudiente (RQ-FN10)                              |
> | `questionBank` global sin grado (§4)                                        | **bancos `grado×mundo×tipo`** + flag `pendiente_validacion_docente` (RQ-FN07)               |
> | `aiProfile` por usuario (§4)                                                | **prohibido**; agregado por curso (RQ-FN09)                                                 |
> | Roadmap MVP: certificado PDF; V2: reporte a padres / dashboard de sede (§8) | **excluidos** (certificados, padres, sede) — ver §9 de requerimientos.md                    |

> Source of truth for the Firestore schema after the B2B2C pivot. Any change to
> `firestore.rules` or `src/shared/lib/firebase/paths.ts` must match this file,
> and this file must be updated **first** (see `CLAUDE.md` update protocol).
>
> Status: **implemented (MVP).** The tenancy tree, custom-claims provisioning,
> Ley 1581 authorization/suppression, learning + per-world progress, teacher
> dashboards and class self-join are built, and the rules are covered by
> `npm run test:rules` (emulator). Collection identifiers are Spanish to match
> the product domain (`colegio`, `curso`, `estudiante`).

## 1. Principles

1. **Tenancy by hierarchy**: `colegio → (sede, optional) → curso → estudiante`.
2. **Authorization by custom claims**, not by client-writable fields. Rules read
   `request.auth.token.{role, colegioId, sedeId}`.
3. **PII minimization (Ley 1581 / Banzai model)**: a student is keyed by a
   **school-provided pseudonym** (`studentId`), not by personal name/email/age.
   `[OBSOLETO — ver docs/empresa/ y RQ-FN02: email = identidad, clave = uid; se retira el seudónimo studentId]`
   The auth account (`users/{uid}`) is linked to the pseudonym via a membership
   record; identifying data, if ever stored, is isolated and access-restricted.
4. **Teacher-readable progress**: student progress lives under the tenant tree so
   role-based rules can grant a teacher read access to their course — never
   buried under a private `users/{uid}` subtree.
5. **No real money**: wallet/goals are simulated (virtual currency).

## 2. Roles

`[OBSOLETO — ver docs/empresa/ y RQ-FN06 / D-PIVOT: son 3 roles {admin, profesor, estudiante}; rector y coordinador eliminados; admin es claim de backend (Admin SDK, sin UI), no allowlist de email]`

| Role         | Scope                                     | Sees                                                              |
| ------------ | ----------------------------------------- | ----------------------------------------------------------------- |
| `admin`      | global (backend only, no UI)              | provisioning; global backstop, does not override profesor         |
| `profesor`   | their `cursos` (listed in `profesorUids`) | roster + per-student progress + aggregate reports of their cursos |
| `estudiante` | self                                      | only their own experience                                         |

> The **acudiente** (legal guardian) is **not a role**. They only sign the Ley
> 1581 authorization (§6). No guardian dashboard, no access to student data.

## 3. Custom claims (Auth token)

Set by a Cloud Function (`functions/`) on provisioning / role assignment:

`[OBSOLETO — ver docs/empresa/ y RQ-FN01/FN02: el claim vigente es {role, colegioId?, cursoId?}; sin studentId, sin sedeId]`

```jsonc
{
  "role": "profesor", // profesor | estudiante (admin = claim backend, sin colegioId)
  "colegioId": "col_abc",
  "sedeId": "sede_1", // optional in MVP
  "studentId": "stu_2025_0481", // only for estudiante; the school pseudonym
  "cursoId": "c1", // only for estudiante; locates their progress path
}
```

Claims are the single trust source for rules. Client-side `role` in
`useAuthStore` is a UI convenience mirrored from the token, never authoritative.

## 4. Collections

```
colegios/{colegioId}
  ├─ (doc) { nombre, logoUrl, plan, planMaxEstudiantes, sedesEnabled: bool, createdAt }
  ├─ sedes/{sedeId}                 # OPTIONAL in MVP (sedesEnabled=false → single implicit sede)
  │    └─ (doc) { nombre }
  ├─ cursos/{cursoId}
  │    └─ (doc) { nombre, grado, sedeId?, profesorUids: string[], colaboracionAula: bool,
  │               codigo?: string }            # class self-join code (generateClassCode Fn)
  │    └─ estudiantes/{studentId}                 # studentId = school pseudonym
  │         ├─ (doc) { displayLabel, estado: 'pendiente_autorizacion'|'activo'|'suprimido',
  │         │          uidVinculado?: string, createdAt }
  │         └─ progress/{worldId}
  │              └─ (doc) { colegioId, cursoId, studentId,   # denormalized for collection-group reports
  │                         competencia, xp, nivel, mastery: 0..1,
  │                         quizScores: {...}, badges: string[],
  │                         completed: bool, completedAt?, updatedAt }
  ├─ asignaciones/{asignacionId}
  │    └─ (doc) { worldId, target: {tipo:'curso'|'estudiante', cursoId, studentId?},
  │               fechaInicio, deadline, createdByUid, createdAt }
  └─ autorizaciones/{studentId}                   # Ley 1581 consent register
       └─ (doc) { estado:'pendiente'|'otorgada'|'revocada', politicaVersion,
                  otorgadaAt?, canalEvidencia, acudienteRef? }

users/{uid}                          # auth-account scope ONLY (mirrors claims)
  └─ (doc) { role, colegioId, sedeId?, cursoIds?: string[], studentId?, displayName, provider }

membership/{uid}                     # uid → tenant mapping, used by rules/bootstrap
  └─ (doc) { colegioId, sedeId?, role, cursoIds?: string[], studentId? }

questionBank/{questionId}            # GLOBAL, human-curated, read-only to clients
  └─ (doc) { worldId, competencia, ...question }
# [OBSOLETO — ver docs/empresa/ y RQ-FN07: bancos por grado×mundo×tipo
#  (bancos/{grado}_{worldId}_{tipo}) + bancosEligeCamino separado + flag
#  pendiente_validacion_docente; el banco global sin grado queda reemplazado]
```

### Notes

- **`studentId` (pseudonym) is the primary student key**, decoupled from
  `uid`. `estudiantes/{studentId}.uidVinculado` links the auth account once the
  student logs in. This is the PII-minimization seam.
- **Progress under the tenant tree** (`.../cursos/{cursoId}/estudiantes/{studentId}/progress/{worldId}`)
  is what lets a teacher read it via a role rule.
- **`competencia`** on each progress/world doc is the CONPES 4005 mapping that
  powers "world = competency" in the dashboard (F5).
- The legacy single-user paths (`users/{uid}/goals|deposits|lessonProgress|
wallet|aiProfile`) are **simulated/account-scoped** and are migrated/retired in
  F2/F5 (see §7). `aiProfile` is deferred (no client writes) per the no-AI-in-MVP
  invariant.

## 5. Security rules strategy (F2)

- Helpers from claims: `isRole(r)`, `sameColegio(cid)`, `isProfesorDe(cursoId)`
  (uid ∈ course `profesorUids`), `isStudentSelf(sid)`.
- `colegios/{colegioId}/**`: read if `sameColegio(colegioId)` **and** role allows
  the scope; writes to roster/asignaciones restricted to `profesor` (own course);
  `admin` provisions from backend.
- `.../estudiantes/{sid}/progress/**`: student writes own (`isStudentSelf(sid)`);
  the `profesor` of the tenant (own course) reads.
- `autorizaciones/**`: written by staff/Function; gates student activation.
- Everything else denied (`/{document=**}`). Audit with the rules auditor +
  emulator role scenarios before merge.

## 6. Compliance hook (Ley 1581)

Student activation is blocked until `autorizaciones/{studentId}.estado ===
'otorgada'`. Full flow, registry, suppression, and policy linkage are specified
in `docs/COMPLIANCE.md` and built in F4. Until then, **do not load real minors'
data**.

## 7. Migration from single-user

If real users exist under `users/{uid}/...`, F2 includes a one-shot script that:

1. Creates a `colegio`/`curso` (pilot tenant).
2. Allocates a pseudonymous `studentId` per user, links `uidVinculado`.
3. Copies `lessonProgress` → `.../estudiantes/{studentId}/progress/{worldId}`.
4. Marks legacy paths read-only. No real-money data exists to migrate.

## 8. Roadmap (do not build ahead)

- **MVP**: tenancy `colegio→curso→estudiante` (sede deferred), Google web SSO,
  Ley 1581 authorization + PII minimization, content + auto-graded quiz,
  world↔competencia, XP/levels/mastery badges, teacher dashboard + CSV/PDF
  export, simple assignment, certificate PDF, basic aggregate report (teacher-consumed).
- **V2**: ✅ rule-based weakness detection reports, ✅ simulated life-project
  goals, ✅ class collaboration + optional class leaderboard (teacher toggle,
  class-scoped — never global), ✅ sede dashboard (per-sede roll-up — now
  excluded/dormant; D-PIVOT drops the coordinador scoping). Still pending: Google
  Classroom roster sync; **basic parents report**
  (must be a generated read-only report shared out-of-band — NOT an acudiente
  login/dashboard, which stays forbidden).
- **V3+**: generative/adaptive AI question bank, native iOS/Android app, LTI/
  OneRoster grade passback, predictive analytics, bank-sponsorship channel.
