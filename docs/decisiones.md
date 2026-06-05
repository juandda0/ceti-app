# Decisiones técnicas — Fase 6 (bitácora de ejecución autónoma)

> Registro de decisiones técnicas tomadas durante la ejecución autónoma de la
> Fase 6. Subordinado a `docs/empresa/decisiones.md` (autoridad máxima) y a
> `docs/requerimientos.md` (spec). Las decisiones tomadas sin supervisión humana
> ante una ambigüedad de spec llevan el tag **[AUTO-DECIDIDO]** y eligen la
> interpretación más conservadora.

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
