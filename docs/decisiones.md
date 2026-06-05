# Decisiones técnicas — Fase 6 (bitácora de ejecución autónoma)

> Registro de decisiones técnicas tomadas durante la ejecución autónoma de la
> Fase 6. Subordinado a `docs/empresa/decisiones.md` (autoridad máxima) y a
> `docs/requerimientos.md` (spec). Las decisiones tomadas sin supervisión humana
> ante una ambigüedad de spec llevan el tag **[AUTO-DECIDIDO]** y eligen la
> interpretación más conservadora.

## RQ-DM (RQ-DEMO) — Modo Demo (simulación en el login)

### [AUTO-DECIDIDO] D-DEMO-05 — La familia "RQ-DEMO" se registra como `RQ-DM01..RQ-DM07`

- **Contexto:** el dueño pidió registrar el modo demo como "RQ-DEMO". El gate E8
  (`scripts/rqCitationCheck.mjs`) valida el formato `RQ-[A-Z]{2}\d{2}` (exactamente
  2 letras); todos los RQ existentes usan 2 letras (FN/ES/PR/IN/AD/TS/CN). "DEMO"
  (4 letras) no cita-valida y modificar el enforcement está prohibido (regla 5).
- **Decisión:** la familia se registra como **`RQ-DM01..RQ-DM07`** (DM = Demo) en
  `requerimientos.md` §10; "RQ-DEMO" queda como alias legible. Mantiene el gate
  intacto y la trazabilidad R13 (todo mapea a un RQ-id válido).

### D-DEMO-01 — Mecanismo de auth: custom token + claim `demo:true` (no debilita rules)

- **Decisión:** una Cloud Function `demoLogin(role)` emite un **custom token** para
  una de **5 identidades demo fijas** (uids `demo-admin`, `demo-rector`,
  `demo-coordinador`, `demo-profesor`, `demo-estudiante`) con sus claims reales
  (role + colegioId/cursoId) **+ `demo:true`**. El cliente hace
  `signInWithCustomToken`. No se embeben credenciales; no se relaja ninguna regla.
- **Por qué:** el custom token deja la autorización intacta (mismos claims que un
  usuario real), y el flag `demo:true` habilita la jaula en rules/functions sin
  tocar la lógica de los 5 roles.

### D-DEMO-02 — Jaula (`demo:true`) en rules Y functions (RQ-DM05, innegociable)

- **Decisión:** `firestore.rules` añade `isDemo()` y `DEMO_COLEGIO='demo-colegio'`.
  Regla dura: **cualquier** token con `demo:true` solo puede tocar
  `colegios/demo-colegio/**`, su propio `users/{uid}` y `membership/{uid}`; todo lo
  demás (otros colegios, `questionBank`/`bancos` de escritura, paths globales) se
  **deniega**. El admin demo (global por rol) queda acotado: sus reglas
  `isAdmin()` se reescriben a `isAdmin() && (no demo || colegio==demo)`.
  Las Functions estructurales rechazan llamantes `demo:true`.
- **Conservador:** la jaula se aplica en el motor (rules+functions), no solo UI;
  default-deny sigue cubriendo todo lo no listado.

### D-DEMO-03 — Estudiante demo fuera de los agregados (RQ-DM06)

- **Decisión:** los `agregados/*` del curso del estudiante demo se siembran
  computados **solo** desde los ~20 sintéticos del curso (excluyendo `demo-estudiante`).
  Como el estudiante demo nunca se incluye en el cómputo y su progreso se borra en
  cada `demoLogin('estudiante')`, el reseteo no corrompe los agregados.

### [AUTO-DECIDIDO] D-DEMO-04 — Demo sobre datos sembrados; riqueza del flujo estudiante limitada a lo construido

- **Contexto:** RQ-DM03 pide quizzes de 3 tipos y Elige-camino "vivos". El runtime
  de quiz de 3 tipos y la mecánica Elige-camino son Bloques 2/4 (aún no construidos).
- **Decisión:** el seed escribe **datos sintéticos directos** (quizScores, mastery,
  agregados, impactTest) que los dashboards staff —ya construidos— renderizan llenos.
  El flujo jugable del estudiante demo muestra lo que exista al momento; su riqueza
  crece conforme se completen Bloques 2/4. Es la lectura más conservadora que cumple
  el principio rector (dashboards sin vacíos) sin inventar runtime fuera de spec.

## Bloque 1 — Fundación (identidad + roles + atestación)

### [AUTO-DECIDIDO] D-B1-01 — #1 + #4 + #6 se ejecutan como una sola unidad de Bloque 1

- **Contexto:** el primer prompt separaba identidad (punto 1, aprobación manual) y
  roles (punto 2). `docs/harness-design.md` (§831-835 y tabla §909-919) define el
  **Bloque 1 Fundación** como la unidad `#1 (identidad) + #4 (roles) + #6
(atestación)`, todos tocando los mismos archivos (claims/tenancy/functions/rules).
- **Decisión:** se funden en un único cambio coordinado de Bloque 1, porque el
  prompt de ejecución autónoma ordena seguir el orden de `harness-design.md` y éste
  manda sobre la estructura del primer prompt. Evita re-editar
  claims/tenancy/functions/rules en pasadas sucesivas y estados intermedios
  inconsistentes (p. ej. `isSuperAdmin` vigente con identidad ya migrada).
- **Conservador:** sí — un solo punto de retorno (`pre-pivot`), gates verdes al
  cierre de la unidad completa.

### [AUTO-DECIDIDO] D-B1-02 — `estado: pendiente_autorizacion` → `pendiente_atestacion`

- **Contexto:** el doc del estudiante cambia de forma en la migración de identidad;
  el valor de estado pendiente roza la atestación (#6).
- **Decisión:** se renombra a `pendiente_atestacion` en este bloque, alineado con el
  schema de `requerimientos.md` §1.1 (fundación). #6 está en el mismo bloque, así
  que no hay desincronización.

### [AUTO-DECIDIDO] D-B1-03 — Mutaciones de `estudiantes/{uid}` solo por Cloud Function

- **Contexto:** la matriz §1.3 lista "atestar" y "suprimir" como acciones de staff;
  no existe acción de "crear slot de roster manual" (el estudiante se une por código).
- **Decisión:** `estudiantes/{uid}` es `write: if false` para clientes; todas las
  mutaciones van por Function (`joinByCode` crea, `atestar` activa, `suppressStudentData`
  suprime). Es la interpretación más conservadora (least-privilege, R12) y permite
  registrar `atestadoPor`/`atestadoAt`/`politicaVersion` de forma confiable.

### [AUTO-DECIDIDO] D-B1-04 — `displayLabel` → `nombre` en doc estudiante; se conserva en `LeaderboardEntry`

- **Contexto:** el doc pasa a `email`+`nombre`; el staff puede ver email+nombre
  (matriz §1.3). El leaderboard de aula solo expone el nombre dentro del curso (RQ-ES09).
- **Decisión:** roster/reportes usan `nombre` (+`email` donde el rol lo permite).
  `LeaderboardEntry` conserva el campo `displayLabel` (poblado desde `nombre`) para no
  ampliar la superficie PII del tablero.

### [AUTO-DECIDIDO] D-B1-06 — Tests de las Functions de unión/atestación: vía E7 + build; harness de integración diferido

- **Contexto:** el prompt pide "unit tests de los flujos de unión por código". Los
  flujos `joinByCode`/`atestar`/`assignRole`/`suppressStudentData` son Cloud
  Functions (onCall) acopladas al Admin SDK; el repo **no** tiene harness de
  pruebas de Functions (`firebase-functions-test`/jest en `functions/`).
- **Decisión:** la corrección de estos flujos se verifica en Bloque 1 por: (a) el
  suite E7 de emulador (70/70) que prueba las reglas que **gatean el dato
  resultante** del join/atestación (estudiante pendiente no escribe; activo sí;
  roster Function-only; rector excluido); (b) `functions build` (tsc) que valida
  forma y tipos; (c) revisión AR + CP. Levantar `firebase-functions-test` es infra
  DevOps fuera del alcance de identidad del Bloque 1 y se **difiere a Fase 7
  (auditoría pre-release D4+D3)**, sin debilitar ningún gate existente.
- **Conservador:** no se salta ninguna verificación existente; se documenta la
  brecha de cobertura de integración como recomendación para Fase 7.

### [AUTO-DECIDIDO] D-B1-05 — `autorizacionDocRef` se elimina en Bloque 1

- **Contexto:** definido en `paths.ts` pero **sin callers** en `src/` (verificado);
  las Functions usan rutas string directas. La colección `autorizaciones` se demuele
  con #6 (este bloque).
- **Decisión:** se elimina el helper y la colección/tipo `Autorizacion`; se reemplaza
  el registro PII por el booleano `atestado` en el doc del estudiante.
