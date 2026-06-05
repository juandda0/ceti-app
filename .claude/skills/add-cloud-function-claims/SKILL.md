---
name: add-cloud-function-claims
description: Use when writing the Cloud Function that sets role/colegio custom claims — applyClaims, joinByCode, or membership mirror. Defines the v2 claim shape ({role, colegioId?, cursoId?}, no studentId/sedeId), the assignment rules (admin assigns adults, estudiante via joinByCode, nobody self-assigns), validation, and the token-refresh note. Used by the backend-firebase agent. Triggers: "set custom claims", "applyClaims function", "join by code", "role claims function".
---

# Add a Cloud Function that sets claims

Patrón de la Function que fija claims de rol/colegio. Lo usa **BE**
(`backend-firebase`). La _norma_ vive en R2/R3; aquí está el _patrón_. La Function
es el **único** escritor de claims y de `membership/{uid}` (R2).

## `applyClaims` v2

- Claims **solo** `{ role, colegioId?, cursoId? }` — **sin** `studentId/sedeId` (R1/R2).
- `admin` lleva claim **global** (sin `colegioId`).
- Espejo en `membership/{uid}` (doc no-autoritativo, solo para listar/auditar).

```ts
export const applyClaims = onCall(async (req) => {
  requireAuth(req);
  const { targetUid, role, colegioId, cursoId } = req.data;
  if (!isRole(role)) throw new HttpsError('invalid-argument', 'rol inválido');
  assertAssigner(req.auth, role, colegioId); // reglas de asignación (abajo)
  const claims =
    role === 'admin' ? { role: 'admin' } : stripUndefined({ role, colegioId, cursoId });
  await getAuth().setCustomUserClaims(targetUid, claims);
  await db
    .doc(`membership/${targetUid}`)
    .set({ ...claims, claimsUpdatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return { ok: true };
});
```

## Reglas de asignación (D7 / R3)

- `admin` asigna cualquier rol de **adulto** de forma global.
- `coordinador` limitado: **no** asigna `rector` ni `coordinador`.
- `estudiante` se asigna **solo** vía `joinByCode` → `{ role:'estudiante',
colegioId, cursoId }` (deriva el tenant del código de curso).
- **Ningún adulto se auto-asigna** su rol.

## Validación

- `requireString` para cada campo; `isRole` valida contra el enum de **5** roles.
- **Idempotencia**: re-aplicar los mismos claims no rompe estado.
- Sin allowlist `superadmin` / `CETI_SUPERADMIN_EMAILS` (retirada — R3).

## Refresh de token

Tras cambiar claims, el cliente debe refrescar: `getIdToken(true)`. Marca
`claimsUpdatedAt` para que el cliente sepa cuándo re-leer el token.

## Checklist

- [ ] La Function es el único escritor de claims/`membership`.
- [ ] Claims solo `{role, colegioId?, cursoId?}`; sin `studentId`/`sedeId`.
- [ ] `admin` sin `colegioId` (global).
- [ ] Nadie se auto-asigna; `coordinador` no crea rector/coordinador.
- [ ] Sin allowlist `superadmin`.
