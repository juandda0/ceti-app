# Aislamiento Firestore Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cerrar lecturas y actualizaciones cross-course en cursos y asignaciones.

**Architecture:** Autorizar exclusivamente con claims y `isProfesorDe`. El profesor conserva la consulta por curso; el estudiante combina una consulta para asignaciones del curso y otra para las dirigidas a su `uid`, porque Firestore Rules no filtra resultados. Las reglas se cambian solo después de agregar escenarios RED al emulador.

**Tech Stack:** Firestore Security Rules, Firebase Emulator, Node.js, JDK 21.

## Global Constraints

- Default deny permanece intacto.
- `classCodes/*` sigue inaccesible para clientes.
- Identidad del estudiante por `uid`, nunca `studentId`.
- `target` y `createdByUid` son inmutables en updates.
- Ejecutar E7 con JDK 21 solo en el proceso.

---

### Task 1: Restringir lectura de cursos

**Files:**

- Modify: `scripts/testFirestoreRules.mjs`
- Modify: `firestore.rules:100-106`

**Interfaces:**

- Consumes: claims `{role, colegioId, cursoId}` y `isProfesorDe(cid, cursoId)`.
- Produces: lectura del curso solo para su profesor o estudiante matriculado.

- [ ] **Step 1: Sembrar segundo curso y escribir tests RED**

En el seed deshabilitado, agregar:

```js
await setDoc(doc(db, 'colegios/A/cursos/c2'), {
  nombre: '9B',
  grado: '9',
  profesorUids: ['uProfA2'],
  codigo: 'SECRE2',
});
```

Agregar:

```js
console.log('Course document isolation:');
await check(
  'student reads own course doc',
  assertSucceeds(getDoc(doc(stuA1, 'colegios/A/cursos/c1')))
);
await check(
  'student cannot read another course doc or its code',
  assertFails(getDoc(doc(stuA1, 'colegios/A/cursos/c2')))
);
await check(
  'course teacher reads own course doc',
  assertSucceeds(getDoc(doc(profA1, 'colegios/A/cursos/c1')))
);
await check(
  'teacher cannot read a course they do not teach',
  assertFails(getDoc(doc(profA1, 'colegios/A/cursos/c2')))
);
```

- [ ] **Step 2: Verificar RED con JDK 21**

PowerShell:

```powershell
$env:JAVA_HOME='C:\Program Files\Java\jdk-21'
$env:Path=(Join-Path $env:JAVA_HOME 'bin') + ';' + $env:Path
npm run test:rules
```

Expected: falla al menos `student cannot read another course doc` y `teacher cannot read a course they do not teach`.

- [ ] **Step 3: Implementar regla mínima**

Reemplazar el `allow read` de `/cursos/{cursoId}` por:

```rules
allow read: if isProfesorDe(cid, cursoId)
  || (isRole('estudiante')
    && sameColegio(cid)
    && request.auth.token.cursoId == cursoId);
```

Mantener `allow create, update, delete: if false;`.

- [ ] **Step 4: Verificar GREEN**

Ejecutar el mismo comando con JDK 21. Expected: todos los escenarios pasan.

- [ ] **Step 5: Commit**

```bash
git add firestore.rules scripts/testFirestoreRules.mjs
git commit -m "fix(rules): aísla lectura de documentos de curso [skip-rq]"
```

### Task 2: Restringir asignaciones y hacer target inmutable

**Files:**

- Modify: `scripts/testFirestoreRules.mjs`
- Modify: `firestore.rules:256-267`
- Modify: `src/shared/lib/firebase/paths.ts`
- Modify: `src/features/dashboard/data/asignacionRepository.ts`
- Modify: `src/features/dashboard/components/StudentAssignmentsBanner.tsx`

**Interfaces:**

- Consumes: `Asignacion.target = {tipo, cursoId, uid?}`.
- Produces: lectura por curso/uid y update sin retargeting.

- [ ] **Step 1: Sembrar asignaciones y escribir tests RED**

Sembrar con reglas deshabilitadas:

```js
await setDoc(doc(db, 'colegios/A/asignaciones/aCurso1'), {
  kind: 'mundo',
  worldId: 'world_1',
  target: { tipo: 'curso', cursoId: 'c1' },
  deadline: 2,
  createdAt: 1,
  createdByUid: 'uProfA1',
});
await setDoc(doc(db, 'colegios/A/asignaciones/aStu1'), {
  kind: 'mundo',
  worldId: 'world_1',
  target: { tipo: 'estudiante', cursoId: 'c1', uid: 'uStuA1' },
  deadline: 2,
  createdAt: 1,
  createdByUid: 'uProfA1',
});
await setDoc(doc(db, 'colegios/A/asignaciones/aCurso2'), {
  kind: 'mundo',
  worldId: 'world_1',
  target: { tipo: 'curso', cursoId: 'c2' },
  deadline: 2,
  createdAt: 1,
  createdByUid: 'uProfA2',
});
```

Agregar tests:

```js
await check(
  'student reads own course assignment',
  assertSucceeds(getDoc(doc(stuA1, 'colegios/A/asignaciones/aCurso1')))
);
await check(
  'student cannot read another course assignment',
  assertFails(getDoc(doc(stuA1, 'colegios/A/asignaciones/aCurso2')))
);
await check(
  'target student reads individual assignment',
  assertSucceeds(getDoc(doc(stuA1, 'colegios/A/asignaciones/aStu1')))
);
await check(
  'other student cannot read individual assignment',
  assertFails(getDoc(doc(stuA2, 'colegios/A/asignaciones/aStu1')))
);
await check(
  'teacher cannot read another course assignment',
  assertFails(getDoc(doc(profA1, 'colegios/A/asignaciones/aCurso2')))
);
await check(
  'teacher cannot retarget assignment',
  assertFails(
    setDoc(
      doc(profA1, 'colegios/A/asignaciones/aCurso1'),
      { target: { tipo: 'curso', cursoId: 'c2' } },
      { merge: true }
    )
  )
);
await check(
  'teacher cannot replace creator',
  assertFails(
    setDoc(
      doc(profA1, 'colegios/A/asignaciones/aCurso1'),
      { createdByUid: 'uProfA2' },
      { merge: true }
    )
  )
);
```

- [ ] **Step 2: Verificar RED**

Ejecutar `npm run test:rules` con JDK 21. Expected: los denies cross-course/retarget fallan bajo las reglas actuales.

- [ ] **Step 3: Implementar predicados exactos**

Reemplazar el bloque de asignaciones por:

```rules
match /asignaciones/{aid} {
  allow read: if isProfesorDe(cid, resource.data.target.cursoId)
    || (isRole('estudiante')
      && sameColegio(cid)
      && request.auth.token.cursoId == resource.data.target.cursoId
      && (resource.data.target.tipo == 'curso'
        || (resource.data.target.tipo == 'estudiante'
          && resource.data.target.uid == request.auth.uid)));

  allow create: if isProfesorDe(cid, request.resource.data.target.cursoId)
    && request.resource.data.createdByUid == request.auth.uid
    && asignacionShapeValida(request.resource.data);

  allow update: if isProfesorDe(cid, resource.data.target.cursoId)
    && request.resource.data.target == resource.data.target
    && request.resource.data.createdByUid == resource.data.createdByUid
    && asignacionShapeValida(request.resource.data);

  allow delete: if isProfesorDe(cid, resource.data.target.cursoId);
}
```

- [ ] **Step 4: Separar las queries del estudiante**

En `paths.ts`, conservar `asignacionesByCursoQuery` para docentes y agregar dos helpers sin índices compuestos:

```ts
export function asignacionesDeCursoParaEstudianteQuery(
  db: Firestore,
  colegioId: string,
  cursoId: string
) {
  return query(
    asignacionesCollectionRef(db, colegioId),
    where('target', '==', { tipo: 'curso', cursoId })
  );
}

export function asignacionesIndividualesQuery(
  db: Firestore,
  colegioId: string,
  cursoId: string,
  uid: string
) {
  return query(
    asignacionesCollectionRef(db, colegioId),
    where('target', '==', { tipo: 'estudiante', cursoId, uid })
  );
}
```

Agregar `listForStudent(colegioId, cursoId, uid)` al repositorio: ejecutar ambas queries con `Promise.all`, mapear y concatenar sus documentos. En `StudentAssignmentsBanner.tsx`, exigir `uid` y usar `listForStudent`; docentes y reportes conservan `listByCurso`.

- [ ] **Step 5: Verificar queries reales**

Run con JDK 21:

```powershell
npm run test:rules
```

Luego:

```bash
rg -n "listByCurso|listForStudent|asignacionesDeCursoParaEstudianteQuery|asignacionesIndividualesQuery" src
```

Expected: E7 verde; `StudentAssignmentsBanner` usa `listForStudent`, mientras `AssignmentsManager` y `loadCourseReport` usan `listByCurso`.

- [ ] **Step 6: Commit**

```bash
git add firestore.rules scripts/testFirestoreRules.mjs src/shared/lib/firebase/paths.ts src/features/dashboard/data/asignacionRepository.ts src/features/dashboard/components/StudentAssignmentsBanner.tsx
git commit -m "fix(rules): aísla asignaciones por curso y estudiante [skip-rq]"
```

### Task 3: Retirar regla individual de retos y auditar matriz

**Files:**

- Modify: `firestore.rules`
- Modify: `scripts/testFirestoreRules.mjs`

**Interfaces:**

- Consumes: eliminación de señales remotas del plan de privacidad.
- Produces: ningún acceso cliente a `estudiantes/{uid}/retos/*`.

- [ ] **Step 1: Eliminar el match `/retos/{retoId}` completo**

No reemplazarlo: el `match /{document=**} { allow read, write: if false; }` final lo cubre.

- [ ] **Step 2: Agregar deny explícito al test**

```js
await check(
  'student cannot persist diary-derived reto state',
  assertFails(
    setDoc(doc(stuA1, 'colegios/A/cursos/c1/estudiantes/uStuA1/retos/r1'), {
      estado: 'cumplido',
    })
  )
);
```

- [ ] **Step 3: Ejecutar E7 y auditoría AR**

Con JDK 21:

```powershell
npm run test:rules
```

Luego ejecutar `node scripts/invariantLint.mjs` y revisar con `firestore-rules-matrix`. Expected: tests exit `0`, invariant-lint sin violaciones nuevas y AR `pass`.

- [ ] **Step 4: Commit**

```bash
git add firestore.rules scripts/testFirestoreRules.mjs
git commit -m "fix(rules): retira señales individuales de retos [skip-rq]"
```
