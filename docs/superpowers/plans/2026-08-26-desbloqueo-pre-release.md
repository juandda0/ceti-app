# Desbloqueo Pre-Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cerrar los hallazgos de privacidad, aislamiento tenant y escalamiento de claims que bloquean producción.

**Architecture:** Se endurecen los puntos compartidos existentes: reglas Firestore, validación de `assignRole` y emisores de telemetría. No se añaden servicios ni dependencias.

**Tech Stack:** TypeScript, Zustand, Firebase Functions v2, Firestore Rules, Jest, Firebase Emulator.

## Global Constraints

- No enviar UID, transcript, categorías, montos ni detalles financieros a Analytics o Crashlytics.
- Un estudiante solo accede a su slot activo del colegio y curso presentes en sus claims.
- `admin` solo se concede por `CETI_ADMIN_EMAILS`; `assignRole` solo asigna `profesor` sin `cursoId`.
- Mantener default deny y las APIs públicas existentes salvo el input inseguro de `assignRole`.

---

### Task 1: Telemetría sin datos financieros ni UID

**Files:**

- Modify: `src/features/savings/store/useSavingsStore.ts`
- Modify: `src/features/savings/components/ConfirmMovimientosListSheet.tsx`
- Modify: `src/shared/lib/firebase/authSession.ts`
- Test: `src/features/savings/store/useSavingsStore.test.ts`
- Test: `src/features/savings/components/ConfirmMovimientosListSheet.test.tsx`

**Interfaces:**

- Consumes: `logEvent(name, params?)` y `clearCrashlyticsUserId()` existentes.
- Produces: eventos de metas/lotes sin payload financiero y sesiones sin UID en Crashlytics.

- [ ] **Step 1: Escribir pruebas que expongan los payloads prohibidos**

```ts
it('goal_created no envía categoría financiera', async () => {
  await useSavingsStore.getState().createGoal({
    title: 'Bicicleta',
    iconId: 'bike',
    category: 'custom',
    targetAmount: 500000,
  });
  expect(logEvent).toHaveBeenCalledWith('goal_created');
});
```

En la prueba del sheet, confirmar dos filas y verificar:

```ts
expect(logEvent).toHaveBeenCalledWith('movimientos_multi_confirmado');
expect(logEvent).not.toHaveBeenCalledWith(
  'movimientos_multi_confirmado',
  expect.objectContaining({ cantidad: expect.anything() })
);
```

- [ ] **Step 2: Ejecutar las pruebas y confirmar el fallo**

Run: `npx jest --runInBand src/features/savings/store/useSavingsStore.test.ts src/features/savings/components/ConfirmMovimientosListSheet.test.tsx`

Expected: FAIL porque los eventos reciben `category` y `cantidad`.

- [ ] **Step 3: Retirar los datos prohibidos**

Cambiar ambos emisores de metas a:

```ts
void logEvent('goal_created');
```

Cambiar el evento del lote a:

```ts
void logEvent('movimientos_multi_confirmado');
```

En `authSession.ts`, eliminar la llamada que pasa `user.uid` y conservar únicamente:

```ts
clearCrashlyticsUserId();
```

- [ ] **Step 4: Verificar pruebas y typecheck**

Run: `npx jest --runInBand src/features/savings/store/useSavingsStore.test.ts src/features/savings/components/ConfirmMovimientosListSheet.test.tsx`

Expected: PASS.

Run: `npm run typecheck`

Expected: exit code 0.

- [ ] **Step 5: Commit**

```bash
git add src/features/savings/store/useSavingsStore.ts src/features/savings/store/useSavingsStore.test.ts src/features/savings/components/ConfirmMovimientosListSheet.tsx src/features/savings/components/ConfirmMovimientosListSheet.test.tsx src/shared/lib/firebase/authSession.ts
git commit -m "fix(privacidad): retira datos financieros de telemetria [skip-rq]"
```

### Task 2: Aislamiento del estudiante por tenant y curso activo

**Files:**

- Modify: `firestore.rules`
- Test: `scripts/testFirestoreRules.mjs`

**Interfaces:**

- Consumes: claims `role`, `colegioId`, `cursoId` y roster `estado`.
- Produces: `isEstudianteActivoEnCurso(cid, cursoId, uid): bool` usado por lecturas y escrituras nominales.

- [ ] **Step 1: Añadir regresiones del mismo UID en paths antiguos**

Crear un contexto con el UID del estudiante A pero claims del curso B:

```js
const stuMoved = env
  .authenticatedContext('uStuA1', {
    role: 'estudiante',
    colegioId: 'colB',
    cursoId: 'cursoB1',
  })
  .firestore();

await check(
  'moved student cannot read old roster slot',
  assertFails(getDoc(doc(stuMoved, 'colegios/colA/cursos/cursoA1/estudiantes/uStuA1')))
);
await check(
  'moved student cannot read old progress',
  assertFails(
    getDoc(doc(stuMoved, 'colegios/colA/cursos/cursoA1/estudiantes/uStuA1/progress/world_1'))
  )
);
await check(
  'moved student cannot read old impact test',
  assertFails(
    getDoc(doc(stuMoved, 'colegios/colA/cursos/cursoA1/estudiantes/uStuA1/impactTest/pre'))
  )
);
```

- [ ] **Step 2: Ejecutar la matriz y confirmar el fallo**

Run (PowerShell): `$env:JAVA_HOME='C:\Program Files\Java\jdk-21'; $env:Path="$env:JAVA_HOME\bin;$env:Path"; npm run test:rules`

Expected: las tres regresiones fallan porque las lecturas todavía están permitidas.

- [ ] **Step 3: Centralizar el predicado correcto en rules**

Reemplazar `isEstudianteSelf` por:

```text
function isEstudianteActivoEnCurso(cid, cursoId, uid) {
  return isRole('estudiante')
    && request.auth.uid == uid
    && sameColegio(cid)
    && request.auth.token.cursoId == cursoId
    && estudianteActivo(cid, cursoId, uid);
}
```

Usarlo en lecturas de roster, `progress` e `impactTest`, y en sus escrituras. Retirar las comprobaciones duplicadas de colegio, curso y estado de las reglas de escritura.

- [ ] **Step 4: Ejecutar la matriz completa**

Run (PowerShell): `$env:JAVA_HOME='C:\Program Files\Java\jdk-21'; $env:Path="$env:JAVA_HOME\bin;$env:Path"; npm run test:rules`

Expected: 165 pruebas o más, 0 fallos.

- [ ] **Step 5: Commit**

```bash
git add firestore.rules scripts/testFirestoreRules.mjs
git commit -m "fix(rules): aísla lecturas históricas del estudiante [skip-rq]"
```

### Task 3: Claims sin escalamiento a admin

**Files:**

- Create: `functions/src/assignRolePolicy.ts`
- Create: `functions/src/assignRolePolicy.test.ts`
- Modify: `functions/src/index.ts`

**Interfaces:**

- Produces: `parseProfessorAssignment(data: unknown): { role: 'profesor'; colegioId: string }`.
- Consumes: `applyClaims(uid, payload)` existente.

- [ ] **Step 1: Escribir la política como pruebas**

```ts
import { parseProfessorAssignment } from './assignRolePolicy';

test('solo acepta profesor con colegio', () => {
  expect(parseProfessorAssignment({ role: 'profesor', colegioId: 'colA' })).toEqual({
    role: 'profesor',
    colegioId: 'colA',
  });
});
test.each([
  { role: 'admin' },
  { role: 'estudiante', colegioId: 'colA' },
  { role: 'profesor', colegioId: 'colA', cursoId: 'cursoA1' },
])('rechaza %o', (input) => expect(() => parseProfessorAssignment(input)).toThrow());
```

- [ ] **Step 2: Ejecutar y confirmar el fallo**

Run: `npx jest --runInBand functions/src/assignRolePolicy.test.ts`

Expected: FAIL porque el módulo no existe.

- [ ] **Step 3: Implementar la política mínima y usarla**

```ts
export function parseProfessorAssignment(data: unknown) {
  if (typeof data !== 'object' || data === null) throw new Error('invalid assignment');
  const value = data as Record<string, unknown>;
  if (
    value.role !== 'profesor' ||
    typeof value.colegioId !== 'string' ||
    !value.colegioId.trim() ||
    'cursoId' in value
  )
    throw new Error('invalid assignment');
  return { role: 'profesor' as const, colegioId: value.colegioId.trim() };
}
```

En `assignRole`, convertir el error a `HttpsError('invalid-argument', ...)`, llamar `applyClaims(targetUid, assignment)` y eliminar el cableado opcional a `cursoId`.

- [ ] **Step 4: Verificar funciones**

Run: `npx jest --runInBand functions/src/assignRolePolicy.test.ts`

Expected: PASS, 4 casos.

Run: `npm --prefix functions run build`

Expected: exit code 0.

- [ ] **Step 5: Commit**

```bash
git add functions/src/assignRolePolicy.ts functions/src/assignRolePolicy.test.ts functions/src/index.ts
git commit -m "fix(auth): impide escalar claims con assignRole [skip-rq]"
```

### Task 4: Repetir gates pre-release

**Files:** None.

- [ ] **Step 1: Ejecutar gates**

Run: `npm run lint:invariants`

Run: `$env:JAVA_HOME='C:\Program Files\Java\jdk-21'; $env:Path="$env:JAVA_HOME\bin;$env:Path"; npm run test:rules`

Run: `npm audit --audit-level=high`

Run: `npx jest --runInBand`

Run: `npm run typecheck`

Run: `npm run lint`

Expected: todos exit code 0; lint puede conservar solo warnings preexistentes.
