---
name: add-firestore-repository
description: Use when the user asks to create a new Firestore repository, persist a new domain entity to Firestore, or add CRUD operations under the tenancy tree (`colegios/{cid}/cursos/{cursoId}/...`) or account-scoped (`users/{uid}/...`). Generates a repository under `src/features/{domain}/data/`, ensures the path helper in `src/shared/lib/firebase/paths.ts`, and routes the rule through skill `firestore-rules-matrix`. Triggers: "add repository for X", "persist X to Firestore", "create CRUD for X".
---

# Add a Firestore repository (tenancy-aware)

Procedimiento del patrón repositorio de Ceti, ahora **multi-tenant y sin
`studentId`**. La clave del estudiante es su **`uid`** de Auth (R1). La _norma_
vive en `ceti-invariants.mdc` (CR1) y `firebase-modular-client.mdc` (CR3); esta
skill es el _cómo_.

## Cuándo invocar

- Una entidad nueva debe persistirse bajo el árbol tenant o bajo `users/{uid}/...`.
- Una entidad existente necesita CRUD contra Firestore que aún no existe.

## Paso 1 — Decidir la ubicación del path

Dos familias (ver CR3 / `docs/data-model.md`):

| Tipo de dato                                                  | Path                                                    | Autorización                                      |
| ------------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------- |
| Cuenta del propio usuario (savings, wallet, goals)            | `users/{uid}/<col>/{id}`                                | `isSelf(uid)`                                     |
| Dato del estudiante dentro del colegio (progreso, atestación) | `colegios/{cid}/cursos/{cursoId}/estudiantes/{uid}/...` | claim `{role,colegioId,cursoId}` (R2/R12)         |
| Agregado por curso (diagnóstico, Elige-camino)                | `cursos/{cursoId}/agregados/{id}`                       | staff por claim; **sin decisión individual** (R5) |

Reglas duras de ubicación:

- La llave del estudiante es **`uid`**, nunca `studentId` (R1).
- En el doc del estudiante solo `email`+`nombre` — nunca edad/grado/documento (R4).
- **Nunca** crees un repositorio de escritura para `bancos/**` ni
  `bancosEligeCamino/**`: el contenido es read-only y se siembra por Admin SDK (R8).

## Paso 2 — Añadir el helper de path

En `src/shared/lib/firebase/paths.ts`, registra la colección en
`FIRESTORE_COLLECTIONS` y exporta los helpers (colección + doc). Para escrituras
tenant que se leerán por **collection-group**, denormaliza `{colegioId, cursoId,
uid}` en el doc para que la regla de grupo pueda filtrar por `colegioId`.

```ts
export function cursoProgressDocRef(
  db: Firestore,
  cid: string,
  cursoId: string,
  uid: string,
  worldId: string
) {
  return doc(
    db,
    FIRESTORE_COLLECTIONS.colegios,
    cid,
    FIRESTORE_COLLECTIONS.cursos,
    cursoId,
    FIRESTORE_COLLECTIONS.estudiantes,
    uid,
    FIRESTORE_COLLECTIONS.progress,
    worldId
  );
}
```

## Paso 3 — Crear el repositorio

Patrón obligatorio: **guard `getFirebaseClients()` → `stripUndefinedValues` →
`{merge:true}` → retorno `boolean`**.

```ts
import { setDoc } from 'firebase/firestore';
import { getFirebaseClients } from '@shared/lib/firebase/app';
import { cursoProgressDocRef } from '@shared/lib/firebase/paths';
import { stripUndefinedValues } from '@shared/lib/firebase/sanitizeForFirestore';

export const progressRepository = {
  async upsert(cid: string, cursoId: string, uid: string, p: WorldProgress): Promise<boolean> {
    const clients = getFirebaseClients();
    if (!clients?.firestore) return false;
    const ref = cursoProgressDocRef(clients.firestore, cid, cursoId, uid, p.worldId);
    // denormaliza el tenant para collection-group + filtro por colegioId
    await setDoc(
      ref,
      stripUndefinedValues({ ...p, colegioId: cid, cursoId, uid } as Record<string, unknown>),
      { merge: true }
    );
    return true;
  },
};
```

## Paso 4 — Registrar la regla (vía S4)

Toda ruta nueva exige una regla least-privilege en `firestore.rules`. **No la
escribas a mano**: derívala de la matriz §1.3 con la skill **`firestore-rules-matrix`
(S4)** (helpers `isRole`/`sameColegio`/`isProfesorDe`/`isEstudianteSelf`/
`estudianteActivo`, default deny). Añade un escenario de emulador por celda crítica
(alimenta E7).

## Paso 5 — Tests

`<entity>Repository.test.ts` junto al archivo. Verifica:

- **Null guard**: `getFirebaseClients()===null` → retorna `false`, no llama `setDoc`.
- **Happy path**: `setDoc` con el ref esperado y payload sin `undefined`.
- **Merge**: la llamada incluye `{ merge: true }`.
- (Tenant) el payload denormaliza `{colegioId,cursoId,uid}`.

## Checklist verificable

- [ ] Usa null-guard `getFirebaseClients()`.
- [ ] Usa helper de path (cero `doc(...)` inline).
- [ ] `stripUndefinedValues` en el payload.
- [ ] `{ merge: true }` salvo overwrite intencional.
- [ ] Retorna `boolean`.
- [ ] En escrituras tenant, denormaliza `{colegioId, cursoId, uid}`.
- [ ] **Nunca** escribe `studentId` (R1) ni PII de menor fuera de `email`+`nombre` (R4).
- [ ] **Nunca** crea repo de escritura para `bancos/**` (R8).
- [ ] Regla registrada vía S4 + escenario de emulador (E7).

## Ejemplos válido / inválido

- ✅ `progress/{worldId}` keyed by `uid` con `{colegioId,cursoId,uid}` denormalizado.
- ✅ `agregados/{id}` = contador por curso, sin decisión individual (R5).
- ❌ Repo que escribe `estudiantes/{uid}.grado` → viola R4 (el grado vive en `curso.grado`).
- ❌ Repo cuyo path o campo usa `studentId` → viola R1.
- ❌ Repo de escritura a `bancos/...` desde el cliente → viola R8.

## No-objetivos

- No crea el store → `add-zustand-mmkv-store` (S2).
- No crea la pantalla → `add-screen` (S3).
- No crea la Cloud Function de claims → `add-cloud-function-claims` (S9).
