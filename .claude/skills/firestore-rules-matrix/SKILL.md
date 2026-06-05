---
name: firestore-rules-matrix
description: Use when writing or auditing `firestore.rules`, adding a tenant-scoped path, or designing role-based access. Translates the rol×acción matrix (§1.3 of docs/requerimientos.md) into least-privilege rules with canonical claim helpers and one emulator scenario per critical cell. Shared knowledge for the backend-firebase and auditor-firestore-rules agents. Triggers: "add a rule for X", "audit firestore.rules", "least-privilege rule", "tenant access".
---

# Firestore rules from the §1.3 matrix

Conocimiento compartido por **BE** (`backend-firebase`) y **AR**
(`auditor-firestore-rules`): traducir la matriz rol×acción (§1.3 de
`docs/requerimientos.md`) a reglas least-privilege (R12), con helpers de claim y un
escenario de emulador por celda crítica (alimenta E7). La identidad del estudiante
es su **`uid`** (R1); la autorización es **solo por claim** (R2).

## Helpers canónicos (firmas exactas)

```
function signedIn()        { return request.auth != null; }
function role()            { return request.auth.token.role; }
function isRole(r)         { return signedIn() && role() == r; }
function isAdmin()         { return isRole('admin'); }            // global, SIN colegioId
function sameColegio(cid)  { return signedIn() && request.auth.token.colegioId == cid; }
function isStaff()         { return isRole('rector') || isRole('coordinador') || isRole('profesor'); }
function isEstudianteSelf(sid) { return isRole('estudiante') && request.auth.uid == sid; }   // por uid — R1
function isProfesorDe(cid, cursoId) {
  return isRole('profesor') && sameColegio(cid) &&
    request.auth.uid in get(/databases/$(database)/documents/colegios/$(cid)/cursos/$(cursoId)).data.profesorUids;
}
function canManageCurso(cid, cursoId) { return isAdmin() || (isRole('coordinador') && sameColegio(cid)); }
function estudianteActivo(cid, cursoId, uid) {
  return get(/databases/$(database)/documents/colegios/$(cid)/cursos/$(cursoId)/estudiantes/$(uid)).data.estado == 'activo';  // R6
}
```

> `isEstudianteSelf` reemplaza el viejo `request.auth.token.studentId` (R1). No
> existe claim `sedeId` ni `studentId` (R2).

## Tabla matriz → predicado

Por cada fila de §1.3, el predicado de claim que la autoriza:

| Rol                      | Predicado base                                                 |
| ------------------------ | -------------------------------------------------------------- |
| `admin`                  | `isAdmin()` (global, sin anular a los demás)                   |
| `rector` / `coordinador` | `isStaff() && sameColegio(cid)`                                |
| `profesor`               | `isProfesorDe(cid, cursoId)`                                   |
| `estudiante`             | `isEstudianteSelf(uid) && estudianteActivo(cid, cursoId, uid)` |

Invariantes codificados (R12):

- **Rector no lee progreso nominal** del menor — solo agregados (`agregados/*`).
- **Profesor no suprime** (la supresión es de rector/coordinador/admin).
- **Crear estructura** (colegios/cursos/vínculos) = `isAdmin()`; **operar** =
  coordinador/profesor.
- `admin` opera global pero **no anula** las capacidades de los demás roles.

## Collection-group

`progress` denormaliza `{colegioId, cursoId, uid}`. La lectura por grupo se gatea:

```
match /{path=**}/progress/{worldId} {
  // rector/coordinador: todo su colegio (solo si la vista es agregada aguas arriba)
  allow read: if (isRole('rector') || isRole('coordinador')) && resource.data.colegioId == request.auth.token.colegioId;
  // profesor: solo su curso
  allow read: if isProfesorDe(resource.data.colegioId, resource.data.cursoId);
  // estudiante: lo suyo
  allow read: if isEstudianteSelf(resource.data.uid);
}
```

## Default deny

```
match /{document=**} { allow read, write: if false; }
```

## Ejemplos válido / inválido

- ✅ `allow read: if isProfesorDe(cid, cursoId) || isEstudianteSelf(sid);`
- ✅ `allow write: if isAdmin();` para crear `colegios/{cid}`.
- ❌ `allow read: if signedIn();` — demasiado amplio (fuga cross-colegio).
- ❌ `allow read, write: if true;` — prohibido.
- ❌ Autorizar leyendo `resource.data.role` — el rol viene del **claim**, no del doc (R2).
- ❌ `bancos/**` con `allow write` para cualquier cliente — son read-only (R8).

## Plantilla de escenario de emulador (alimenta E7)

Por cada celda crítica, una fila `(rol, acción, recurso, esperado)`:

```
{ rol: 'estudiante', uid: 'u1', accion: 'get', recurso: 'estudiantes/u2', esperado: 'deny' }
{ rol: 'profesor',   curso: 'cA', accion: 'list', recurso: 'cursos/cB/.../progress', esperado: 'deny' }
{ rol: 'rector',     accion: 'get', recurso: 'estudiantes/u1' (nominal), esperado: 'deny' }
{ rol: 'rector',     accion: 'get', recurso: 'cursos/cA/agregados/x', esperado: 'allow' }
{ rol: 'coordinador',accion: 'create', recurso: 'cursos/cA', esperado: 'allow' }
{ rol: 'admin',      accion: 'create', recurso: 'colegios/cX', esperado: 'allow' }
{ rol: 'estudiante', accion: 'write', recurso: 'bancos/9_world_1_multiple_choice', esperado: 'deny' }
{ rol: 'cualquiera', accion: 'get', recurso: '/cualquier/otro/path', esperado: 'deny' }
```

Cada celda crítica de §1.3 debe tener al menos un escenario allow y uno deny.
