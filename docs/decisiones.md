# Decisiones técnicas — Fase 6 (bitácora de ejecución autónoma)

> Registro de decisiones técnicas tomadas durante la ejecución autónoma de la
> Fase 6. Subordinado a `docs/empresa/decisiones.md` (autoridad máxima) y a
> `docs/requerimientos.md` (spec). Las decisiones tomadas sin supervisión humana
> ante una ambigüedad de spec llevan el tag **[AUTO-DECIDIDO]** y eligen la
> interpretación más conservadora.

## RQ-ES10 — Registro de movimientos por voz + dashboard propio

### D-ES10-01 — Excepción estrecha a R7: clasificación por IA server-side del registro por voz

- **Contexto:** el dueño ordenó (2026-07-08) que el registro de ahorros/gastos del
  estudiante sea por voz, clasificado por IA. R7/D5 prohíben IA en runtime; R15
  exige cambio coordinado y decisión humana.
- **Decisión (del dueño):** se abre una **excepción única y estrecha**: la Cloud
  Function `procesarRegistroVoz` clasifica el **texto** transcrito (nunca audio)
  con `claude-haiku-4-5` y devuelve `{tipo, monto, descripcion, categoria,
confianza}` sin escribir en BD. Sigue prohibido: IA en el cliente, almacenar o
  transmitir audio a servidores propios, y usar el resultado para
  generar/adaptar/seleccionar contenido o perfilar al menor. El gate E4 gana el
  grupo `ia-cliente` (SDKs/hosts de IA bloqueados en `src/`+`app/`) para acotar la
  excepción estructuralmente. Cambio coordinado aplicado: `ceti-invariants.mdc` +
  `CLAUDE.md` + `requerimientos.md` (RQ-ES10) en el mismo commit.

### D-ES10-02 — Excepción estrecha a R10: diario autodeclarado de bolsillo real

- **Contexto:** el dueño decidió que los movimientos dictados son **dinero de
  bolsillo real** del estudiante (no moneda simulada), contra la recomendación de
  mantener el marco simulado.
- **Decisión (del dueño):** se permite el **diario autodeclarado** en
  `users/{uid}/movimientos`, solo-vista-propia (isSelf; ni staff ni admin leen),
  con borrado por el estudiante e inclusión en `suppressStudentData`. Sigue
  prohibido todo lo transaccional (cuentas, pagos, transferencias, gift cards) y
  mezclar Cetis con COP reales. `docs/empresa/compliance.md`, `producto.md` y
  `vision.md` se actualizan en el mismo cambio.

### D-ES10-03 — La voz es el único camino de registro; el formulario manual se elimina

- **Contexto:** el dueño ordenó eliminar el registro manual (DepositModal), contra
  la recomendación técnica de conservarlo como fallback.
- **Decisión (del dueño):** solo voz. La tarjeta de confirmación/edición
  post-clasificación se conserva (el estudiante corrige tipo/monto/categoría/
  descripción antes de guardar; también sirve de entrada cuando la clasificación
  falla, pre-llenada con el transcript). **Riesgo aceptado:** navegadores sin
  `SpeechRecognition` (p. ej. Firefox) no pueden registrar; se muestra "usa
  Chrome/Edge/Safari". La creación de metas (NewGoalModal) se conserva.

### [AUTO-DECIDIDO] D-ES10-04 — Puente movimientos→metas: doble escritura deposit+movimiento

- **Contexto:** al eliminar el DepositModal, las metas (RQ-ES08) perderían su única
  fuente de progreso. Un movimiento `ahorro` puede apuntar a una meta.
- **Decisión:** si el movimiento confirmado es `ahorro` con `goalId`,
  `useMovimientosStore.addMovimiento` invoca además
  `useSavingsStore.addDeposit(monto, descripcion, goalId)` (firma existente
  verificada). Reusa el 100% de la lógica de progreso/sync de metas; el doble
  registro (deposit + movimiento) queda documentado como intencional.
- **Conservador:** sí — cero cambios en el modelo de metas existente.

### [AUTO-DECIDIDO] D-ES10-05 — Deuda preexistente: la supresión no borra `users/{uid}/goals|deposits|wallet`

- **Contexto:** al incluir `users/{uid}/movimientos` en `suppressStudentData` se
  verificó que la supresión hoy tampoco borra las subcolecciones account-scoped
  previas (`goals`, `deposits`, `wallet`).
- **Decisión:** fuera del alcance de RQ-ES10 (tocarlas es unidad propia con su
  revisión CP); se registra aquí como deuda candidata a unidad de compliance.
- **[ACTUALIZADO por D-CUT: `wallet` eliminado del producto; esa parte de la deuda
  queda resuelta. `goals`/`deposits` siguen pendientes.]**

### [AUTO-DECIDIDO] D-ES10-06 — El registro por voz también crea/abona metas, por palabra clave

- **Contexto:** el dueño pidió que el mismo micrófono sirva para (a) registrar
  gasto/ahorro, (b) abonar a una meta existente, y (c) crear una meta nueva; la
  IA distingue la intención por una **palabra clave**.
- **Decisión:** la clasificación server-side gana un campo `intencion`
  (`movimiento | abonar_meta | crear_meta`). Palabras clave: **"nueva meta"** /
  "crear meta" → `crear_meta`; **"abonar"** / "aportar a mi meta" → `abonar_meta`;
  cualquier otra cosa → `movimiento`. Para las intenciones de meta,
  `descripcion` = nombre de la meta y `monto` = objetivo (crear) o abono (abonar).
  El cliente ramifica: `crear_meta` → hoja de confirmación que llama
  `useSavingsStore.addGoal` (RQ-ES08); `abonar_meta` → empareja el nombre a una
  meta existente (`matchGoal`) y abre la confirmación de movimiento como ahorro
  con `goalId` (reusa el puente D-ES10-04); `movimiento` → flujo actual.
- **Alcance/invariantes:** sigue siendo la misma feature de clasificación de
  texto server-side (R7 excepción D-ES10-01) sobre datos propios del estudiante
  (R5/R10 excepción D-ES10-02); no añade PII ni cambia reglas. Se mapea a
  RQ-ES10 (no requiere RQ nuevo). Intención desconocida degrada a `movimiento`
  (nunca crea una meta por error de clasificación).

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

> \*\*[Enmendado por D-PIVOT 2026-07-09 — autoridad viva: `docs/empresa/decisiones.md`
>
> > §D-PIVOT]** El demo mantiene solo 2 identidades (`demo-profesor`,
> > `demo-estudiante`); `demo-admin`/`demo-rector`/`demo-coordinador` se eliminan
> > (rector y coordinador dejan de existir; `admin` es claim **solo de backend\*\*, sin UI).

- **Decisión:** una Cloud Function `demoLogin(role)` emite un **custom token** para
  una de **2 identidades demo fijas** (uids `demo-profesor`, `demo-estudiante`) con
  sus claims reales (role + colegioId/cursoId) **+ `demo:true`**. El cliente hace
  `signInWithCustomToken`. No se embeben credenciales; no se relaja ninguna regla.
- **Por qué:** el custom token deja la autorización intacta (mismos claims que un
  usuario real), y el flag `demo:true` habilita la jaula en rules/functions sin
  tocar la lógica de los roles.

### D-DEMO-02 — Jaula (`demo:true`) en rules Y functions (RQ-DM05, innegociable)

- **Decisión:** `firestore.rules` añade `isDemo()` y `DEMO_COLEGIO='demo-colegio'`.
  Regla dura: **cualquier** token con `demo:true` solo puede tocar
  `colegios/demo-colegio/**`, su propio `users/{uid}` y `membership/{uid}`; todo lo
  demás (otros colegios, `questionBank`/`bancos` de escritura, paths globales) se
  **deniega**. El claim `admin` (global por rol; ya sin perfil demo tras D-PIVOT)
  queda acotado en rules por defensa —`isAdmin()` se reescribe a
  `isAdmin() && (no demo || colegio==demo)`— por si un token demo lo portara.
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
  roster Function-only; rector excluido del dato nominal —`rector` luego eliminado
  por D-PIVOT); (b) `functions build` (tsc) que valida
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
