# Ceti — Data model (multi-tenant B2B2C)

> Source of truth for the Firestore schema after the B2B2C pivot. Any change to
> `firestore.rules` or `src/shared/lib/firebase/paths.ts` must match this file,
> and this file must be updated **first** (see `CLAUDE.md` update protocol).
>
> Status: **design / not yet implemented.** Implemented incrementally in the
> pivot phases (F2 = schema + paths + rules). Collection identifiers are Spanish
> to match the product domain (`colegio`, `curso`, `estudiante`).

## 1. Principles

1. **Tenancy by hierarchy**: `colegio → (sede, optional) → curso → estudiante`.
2. **Authorization by custom claims**, not by client-writable fields. Rules read
   `request.auth.token.{role, colegioId, sedeId}`.
3. **PII minimization (Ley 1581 / Banzai model)**: a student is keyed by a
   **school-provided pseudonym** (`studentId`), not by personal name/email/age.
   The auth account (`users/{uid}`) is linked to the pseudonym via a membership
   record; identifying data, if ever stored, is isolated and access-restricted.
4. **Teacher-readable progress**: student progress lives under the tenant tree so
   role-based rules can grant a teacher read access to their course — never
   buried under a private `users/{uid}` subtree.
5. **No real money**: wallet/goals are simulated (virtual currency).

## 2. Roles

| Role          | Scope                                     | Sees                                          |
| ------------- | ----------------------------------------- | --------------------------------------------- |
| `rector`      | whole `colegio`                           | aggregate compliance across all cursos/sedes  |
| `coordinador` | `colegio` (or a `sede` when present)      | aggregate for their scope                     |
| `profesor`    | their `cursos` (listed in `profesorUids`) | roster + per-student progress of their cursos |
| `estudiante`  | self                                      | only their own experience                     |

> The **acudiente** (legal guardian) is **not a role**. They only sign the Ley
> 1581 authorization (§6). No guardian dashboard, no access to student data.

## 3. Custom claims (Auth token)

Set by a Cloud Function (`functions/`) on provisioning / role assignment:

```jsonc
{
  "role": "profesor", // rector | coordinador | profesor | estudiante
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
  │    └─ (doc) { nombre, grado, sedeId?, profesorUids: string[], colaboracionAula: bool }
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
  the scope; writes to roster/asignaciones restricted to `profesor` (own course)
  / `rector` / `coordinador`.
- `.../estudiantes/{sid}/progress/**`: student writes own (`isStudentSelf(sid)`);
  teacher/rector/coordinador of the tenant read.
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
  export, simple assignment, certificate PDF, basic rector aggregate report.
- **V2**: rule-based weakness detection reports, simulated life-project goals,
  class collaboration + optional class leaderboard, Google Classroom roster sync,
  full sede dashboard, basic parents report.
- **V3+**: generative/adaptive AI question bank, native iOS/Android app, LTI/
  OneRoster grade passback, predictive analytics, bank-sponsorship channel.
