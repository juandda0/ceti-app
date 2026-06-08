# Requerimientos v2 — Ceti (especificación completa de la aplicación)

> **Fuente de verdad:** `docs/empresa/`. En conflicto, manda
> `docs/empresa/decisiones.md`.
>
> Este documento es **LA especificación completa de la app** y la definición de
> "terminado": Ceti está completa cuando **todo lo que dice este documento existe
> y funciona**. Reemplaza al `requerimientos.md` anterior (rediseño de mecánicas),
> que queda obsoleto.
>
> Orden de autoridad: `decisiones.md` > resto de `docs/empresa/` >
> `conflictos.md`/`estado.md` > este documento > repo/código. Donde el repo
> contradiga lo anterior, pierde. Fecha base: 2026-06-04.
>
> **Formato de cada requerimiento:** ID (`RQ-XXNN`), descripción, criterios de
> aceptación verificables (_CA_), y qué conflicto(s) de `conflictos.md` resuelve.
> La tabla de trazabilidad conflicto → RQ está al final (§8).

---

## SECCIÓN 1 — FUNDACIÓN

### 1.1 Modelo de datos Firestore (alto nivel)

```
colegios/{colegioId}
  (doc) { nombre, plan, planMaxEstudiantes, sedesEnabled:false, createdAt, createdByUid }
  sedes/{sedeId}                  # DORMANTE — no se crean docs en MVP (sedesEnabled=false)
  cursos/{cursoId}
     (doc) { nombre, grado:'9'|'10'|'11', profesorUids:string[], codigo,
             colaboracionAula:bool, createdAt, createdByUid }
     estudiantes/{uid}            # CLAVE = uid de Auth. email = identidad. SIN seudónimo studentId.
        (doc) { email, nombre, estado:'pendiente_atestacion'|'activo'|'suprimido',
                atestado:bool, atestadoPor?, atestadoAt?, politicaVersion?, joinedAt }
        progress/{worldId}
           (doc) { colegioId, cursoId, uid, competencia, xp, nivel, mastery:0..1,
                   quizScores, badges:string[], completed:bool, completedAt?, updatedAt }
        impactTest/{fase}         # fase: 'pre' | 'post'
           (doc) { score, total, takenAt, breakdown:{competencia:score} }
     agregados/{agregadoId}       # roll-up POR CURSO — SIN datos individuales
        (doc) { competencia, masteryPromedio, distribucion,
                eligeCamino:{situacionId:{opcionA:int, opcionB:int}}, updatedAt }
     asignaciones/{asignacionId}
        (doc) { worldId, deadline, fechaInicio, createdByUid, createdAt }

bancos/{bancoId}                  # bancoId = `${grado}_${worldId}_${tipo}`
  (doc) { grado, worldId, tipo:'multiple_choice'|'true_false'|'ordenar',
          items:[...], pendiente_validacion_docente:bool, validadoPor?, validadoAt?,
          generadoPor:'ia', version }
bancosEligeCamino/{bancoId}       # bancoId = `${grado}_${worldId}` — banco SEPARADO
  (doc) { grado, worldId, situaciones:[{id, enunciado,
          opcionA:{texto,consecuencia}, opcionB:{texto,consecuencia}}],
          pendiente_validacion_docente:bool, ... }

users/{uid}        (doc) { role, colegioId?, cursoId?, displayName, email, provider }  # espejo UI
membership/{uid}   (doc) { role, colegioId?, cursoId? }                                # uid→tenant
```

**Custom claims (única fuente de autorización):**
`{ role: 'admin'|'rector'|'coordinador'|'profesor'|'estudiante', colegioId?, cursoId? }`.
Sin `studentId`, sin `sedeId` activo. `admin` no lleva `colegioId` (alcance global).
El `cursoId` solo aplica al estudiante; el profesor se autoriza vía
`curso.profesorUids`.

### 1.2 Requerimientos

**RQ-FN01 — Jerarquía multi-tenant con sedes dormantes**
Tenancy efectiva `colegio → curso → estudiante`. El nivel `sede` queda en el
esquema pero **inactivo**: `colegios.sedesEnabled = false` y no se crean docs en
`sedes/`.

- _CA1_: Crear un colegio no crea ninguna sede; `sedesEnabled` nace en `false`.
- _CA2_: Ninguna pantalla de runtime requiere elegir/mostrar sede.
- _CA3_: Las reglas y `paths.ts` resuelven progreso sin `sedeId`; ningún claim activo contiene `sedeId`.
- _Resuelve:_ **#3**.

**RQ-FN02 — Identidad por email (retiro del seudónimo `studentId`)**
El estudiante se identifica por su cuenta OAuth; la clave del doc es el `uid`. Se
almacena **únicamente `email` + `nombre`** (D9).

- _CA1_: `estudiantes/{uid}` usa el `uid` de Auth como clave; no existe campo ni claim `studentId`.
- _CA2_: No se almacena edad, documento, teléfono ni grado en el doc del estudiante (el grado vive en `curso`).
- _CA3_: `paths.ts`, `firestore.rules`, claims y Functions no referencian `studentId`.
- _Resuelve:_ **#1**.

**RQ-FN03 — Custom claims como única fuente de autorización**
Las reglas leen `request.auth.token.{role, colegioId, cursoId}`. El `role` en el
store cliente es espejo de UI, nunca autoritativo.

- _CA1_: Una lectura/escritura cross-tenant se deniega si el claim no la autoriza, aunque el campo cliente diga lo contrario (probado en emulador).
- _CA2_: Los claims los fija exclusivamente una Cloud Function (provisión/asignación/join), nunca el cliente.

**RQ-FN04 — Auth OAuth 2.0 + gate de acceso por curso**
Login OAuth (Google web SSO); cualquier cuenta puede registrarse. Primer login
**sin curso** ⇒ única pantalla disponible = "unirse a curso con código". Sin
curso ⇒ **sin acceso al juego** (D8).

- _CA1_: Un usuario autenticado sin `cursoId` en claim solo puede ver la pantalla de unión por código; cualquier otra ruta lo redirige allí.
- _CA2_: Tras unirse, obtiene `colegioId`+`cursoId` y accede al juego sin re-login (refresh de token).

**RQ-FN05 — Unión a curso por código**
El estudiante ingresa un código de curso; una Function valida el código,
crea/vincula `estudiantes/{uid}` con `estado:'pendiente_atestacion'` y fija sus
claims.

- _CA1_: Código inválido/expirado ⇒ error claro, sin crear doc.
- _CA2_: Código válido ⇒ crea `estudiantes/{uid}` con `email`+`nombre`+`estado:'pendiente_atestacion'`, claims `{role:'estudiante', colegioId, cursoId}`.
- _CA3_: Un mismo `uid` no puede duplicarse en el curso (idempotente).

**RQ-FN06 — 5º rol: admin Ceti**
`admin` es un **rol con claim** (no un allowlist de email). Registra colegios,
crea cuentas de adulto y les asigna rol, crea cursos y vincula profesores.

- _CA1_: `role:'admin'` existe en el enum de roles (`tenancy.ts`, Functions) y en `firestore.rules`.
- _CA2_: El antiguo `isSuperAdmin` por allowlist de email queda retirado/reemplazado.
- _CA3_: Solo un `admin` existente puede crear otro adulto y asignarle rol (ningún adulto auto-asigna su rol — D7).
- _Resuelve:_ **#4**.

**RQ-FN07 — Bancos por `grado × mundo × tipo` + flag de validación + banco "Elige tu camino" separado**
Bancos `bancos/{grado}_{worldId}_{tipo}` para los 3 tipos, y
`bancosEligeCamino/{grado}_{worldId}` separado. Todo nace con
`pendiente_validacion_docente:true` (D5).

- _CA1_: Existe un banco por cada combinación `grado(9/10/11) × worldId(1..5) × tipo(MC/VF/ordenar)` = 45 bancos de quiz + 15 de "Elige tu camino".
- _CA2_: Cada banco lleva `pendiente_validacion_docente` (default `true`), `generadoPor:'ia'`, `version`.
- _CA3_: El banco "Elige tu camino" no es un tipo de quiz; sus ítems tienen 2 opciones **sin** `correctAnswer`.
- _CA4_: Los bancos son **read-only** para clientes; se siembran vía Admin SDK (authoring-time).
- _Resuelve:_ **#8** (y prepara #9).

**RQ-FN08 — Progreso del estudiante bajo el árbol tenant**
El progreso vive en `.../cursos/{cursoId}/estudiantes/{uid}/progress/{worldId}`,
denormalizado (`colegioId`,`cursoId`,`competencia`) para reportes
collection-group.

- _CA1_: El estudiante escribe **solo** su propio progreso (`isStudentSelf` por `uid`) y solo si `estado=='activo'`.
- _CA2_: Profesor/coordinador del tenant leen el progreso por regla de rol; rector **no** lee progreso nominal (solo agregados — matriz §1.3).

**RQ-FN09 — Agregados por curso (sin perfil individual del menor)**
La salida de "Elige tu camino" y el diagnóstico se computan como **agregados por
curso** en `cursos/{cursoId}/agregados/*`. **Prohibido** persistir la decisión
individual del menor (D4).

- _CA1_: Una decisión de "Elige tu camino" incrementa un contador agregado (`eligeCamino[situacionId][opcion]++`) y **no** se guarda en ningún doc del estudiante.
- _CA2_: No existe colección/campo `aiProfile` ni rasgo/etiqueta individual derivado de decisiones.
- _CA3_: Los agregados nunca exponen qué estudiante eligió qué.
- _Resuelve:_ **#2** (datos; la UI en §2).

**RQ-FN10 — Atestación ligera del acudiente (sin PII de acudiente) + gating**
Dentro del sistema solo hay un **booleano de atestación** ("el colegio confirma
tener la autorización") + quién/cuándo. **No** se guardan datos del acudiente ni
registro de consentimiento con su PII (D9). Pueden atestar:
profesor/coordinador/rector/admin.

- _CA1_: `estudiantes/{uid}` pasa a `estado:'activo'` solo cuando un rol autorizado marca `atestado:true`; se guarda `atestadoPor`+`atestadoAt`+`politicaVersion`.
- _CA2_: No existe colección `autorizaciones` con `canalEvidencia`/`acudienteRef` ni ningún campo con PII del acudiente.
- _CA3_: Mientras `estado!='activo'`, `firestore.rules` **impide** que el estudiante escriba progreso/impactTest (helper `estudianteActivo`).
- _CA4_: El acudiente no tiene cuenta ni pantalla.
- _Resuelve:_ **#6**.

**RQ-FN11 — Supresión de datos del estudiante (derecho del titular)**
Una Function borra `progress` + `impactTest`, marca `estado:'suprimido'`,
desvincula la cuenta. Solo rector/coordinador/admin. Irreversible.

- _CA1_: Tras suprimir, no quedan docs de progreso/impacto del `uid` bajo el curso; el cupo queda `suprimido`.
- _CA2_: La acción registra quién y cuándo (trazabilidad mínima).

**RQ-FN12 — `firestore.rules` implementa la matriz de permisos**
La matriz rol×acción (§1.3) se traduce a reglas least-privilege con helpers de
claim (`isRole`, `sameColegio`, `isProfesorDe`, `isStudentSelf`,
`estudianteActivo`). Default deny.

- _CA1_: Existe un escenario de emulador (`test:rules`) por cada celda crítica de la matriz (al menos: estudiante↔otro estudiante denegado; profesor↔curso ajeno denegado; rector↔progreso nominal denegado; coordinador↔operación permitida).
- _CA2_: `/{document=**}` cae en deny.

### 1.3 Matriz de permisos rol × acción

Alcance: **G** = global · **C** = su colegio · **U** = sus cursos · **S** = sí mismo · ❌ = no.

| Acción                                                                 | admin Ceti | rector | coordinador | profesor | estudiante |
| ---------------------------------------------------------------------- | :--------: | :----: | :---------: | :------: | :--------: |
| **— Estructura / provisión —**                                         |            |        |             |          |            |
| Crear/editar/eliminar colegio, plan, cupos                             |    ✅ G    |   ❌   |     ❌      |    ❌    |     ❌     |
| Crear cuenta de adulto y asignar/cambiar su rol                        |    ✅ G    |   ❌   |     ❌      |    ❌    |     ❌     |
| Crear/editar/eliminar curso (nombre, grado)                            |    ✅ G    |   ❌   |     ❌      |    ❌    |     ❌     |
| Vincular/desvincular profesor ↔ curso                                  |    ✅ G    |   ❌   |     ❌      |    ❌    |     ❌     |
| Generar/regenerar código de unión del curso                            |    ✅ G    |   ❌   |    ✅ C     |   ✅ U   |     ❌     |
| **— Roster / Ley 1581 —**                                              |            |        |             |          |            |
| Ver roster nominal (email+nombre) del curso                            |    ✅ G    |   ❌   |    ✅ C     |   ✅ U   |     ❌     |
| Atestar autorización acudiente → activar estudiante                    |    ✅ G    |  ✅ C  |    ✅ C     |   ✅ U   |     ❌     |
| Suprimir datos del estudiante                                          |    ✅ G    |  ✅ C  |    ✅ C     |    ❌    |     ❌     |
| Unirse a un curso con código                                           |     ❌     |   ❌   |     ❌      |    ❌    |    ✅ S    |
| **— Juego / contenido (runtime) —**                                    |            |        |             |          |            |
| Jugar mundos, quizzes, "Elige tu camino", simulador, colaborativo      |     ❌     |   ❌   |     ❌      |    ❌    |    ✅ S    |
| Asignar mundo con deadline                                             |    ✅ G    |   ❌   |    ✅ C     |   ✅ U   |     ❌     |
| Activar/desactivar modo colaborativo de aula                           |    ✅ G    |   ❌   |    ✅ C     |   ✅ U   |     ❌     |
| Leer banco de preguntas (servido estático)                             |    ✅ G    |   ❌   |    ✅ C     |   ✅ C   |   ✅ S\*   |
| Validación docente del banco (`pendiente_validacion_docente`→validado) |    ✅ G    |   ❌   |    ✅ C     |   ✅ U   |     ❌     |
| **— Reportes / diagnóstico —**                                         |            |        |             |          |            |
| Ver progreso por estudiante (nominal/operativo)                        |    ✅ G    |   ❌   |    ✅ C     |   ✅ U   |     ❌     |
| Ver diagnóstico por reglas del curso                                   |    ✅ G    |  ✅ C  |    ✅ C     |   ✅ U   |     ❌     |
| Exportar CSV/PDF operativo del curso                                   |    ✅ G    |   ❌   |    ✅ C     |   ✅ U   |     ❌     |
| Ver reportes institucionales AGREGADOS (grado/curso)                   |    ✅ G    |  ✅ C  |    ✅ C     |    ❌    |     ❌     |
| Descargar mapping curricular CONPES 4005/MEN/PISA                      |    ✅ G    |  ✅ C  |    ✅ C     |   ✅ U   |     ❌     |
| Ver/exportar pre/post-test agregado (impacto)                          |    ✅ G    |  ✅ C  |    ✅ C     |   ✅ U   |     ❌     |
| Presentar pre-test / post-test                                         |     ❌     |   ❌   |     ❌      |    ❌    |    ✅ S    |
| Ver su propio progreso / XP / badges                                   |     ❌     |   ❌   |     ❌      |    ❌    |    ✅ S    |
| **— Plataforma —**                                                     |            |        |             |          |            |
| Acceso al dashboard admin Ceti                                         |    ✅ G    |   ❌   |     ❌      |    ❌    |     ❌     |

\* El estudiante no lee la colección libremente: el contenido se le sirve estático al jugar.

**Invariantes de la matriz:** (1) rector nunca ve datos nominales del menor, solo
agregados; sus únicas escrituras son las legales de directivo (atestación,
supresión). (2) profesor no suprime. (3) admin puede todo globalmente como
respaldo, sin anular a los demás roles (D2d). (4) crear estructura = admin;
operar lo creado = coordinador/profesor.

---

## SECCIÓN 2 — CAPA ESTUDIANTE

> Toda esta capa solo es accesible para `role:'estudiante'` con `estado:'activo'`
> y un `cursoId` en claim (RQ-FN04/FN10). El grado (y por tanto el banco servido)
> se deriva del curso.

**RQ-ES01 — 5 mundos secuenciales con narrativa espacial**
Mapa (§2.x): Planeta Origen → Luna del Presupuesto → Estrella del Ahorro →
Nebulosa del Crédito → Agujero Negro de las Deudas (`world_1..5`). Desbloqueo
progresivo.

- _CA1_: Al activarse el estudiante (tras pre-test, RQ-TS01), solo el Mundo 1 está desbloqueado; el resto aparece bloqueado con candado.
- _CA2_: El Mundo N+1 se desbloquea solo al marcar `completed:true` el Mundo N.
- _CA3_: Cada mundo muestra su nombre espacial (i18n) y su competencia CONPES asociada; los `worldId`/`competencia.id` persistidos no cambian al renombrar la narrativa.
- _Resuelve:_ **#10**.

|  #  | Mundo (narrativa)           | `worldId` | Tema                             | `competencia.id` | Competencia CONPES/MEN/PISA         | Dificultad |
| :-: | --------------------------- | --------- | -------------------------------- | ---------------- | ----------------------------------- | :--------: |
|  1  | Planeta Origen              | `world_1` | Ingreso y fundamentos del dinero | `ingreso`        | Ingreso y manejo del dinero         |     1      |
|  2  | Luna del Presupuesto        | `world_2` | Presupuesto y gasto              | `presupuesto`    | Planeación y presupuesto            |     2      |
|  3  | Estrella del Ahorro         | `world_3` | Ahorro                           | `ahorro`         | Ahorro                              |     3      |
|  4  | Nebulosa del Crédito        | `world_4` | Crédito                          | `credito`        | Crédito y endeudamiento responsable |     4      |
|  5  | Agujero Negro de las Deudas | `world_5` | Deuda y riesgo                   | `deuda`          | Manejo de deudas y riesgo           |     5      |

**RQ-ES02 — Micro-teoría ligera por mundo**
Al entrar a un mundo, antes del quiz, el estudiante recibe micro-teoría
(cards/ejemplos cotidianos, **lenguaje neutro**), que le da herramientas para
responder.

- _CA1_: Cada mundo tiene ≥1 card de micro-teoría servida estática (sin IA en runtime).
- _CA2_: El texto es breve (formato card), nunca texto académico denso; lenguaje neutro (D5-enmienda).
- _CA3_: La micro-teoría es navegable y se puede saltar para reintentar el quiz.

**RQ-ES03 — Quiz de 10 preguntas, 3 tipos, auto-calificado**
Cada mundo tiene un quiz de **exactamente 10 preguntas** servidas del banco
`grado×mundo`, mezclando los 3 tipos. Calificación automática inmediata.

- _CA1_: El quiz presenta 10 ítems; no 15 ni otro número.
- _CA2_: Los 3 tipos son: selección múltiple, verdadero/falso, ordenar/secuenciar (RQ-ES04). **No** existe el tipo `calculation` ni `fill_blank` como tipo de quiz.
- _CA3_: Mezcla por quiz: **4 selección múltiple + 3 verdadero/falso + 3 ordenar**.
- _CA4_: Cada respuesta se califica al instante; al final se computa score y se actualiza `mastery`/`xp` del mundo.
- _Resuelve:_ **#9**.

**RQ-ES04 — Tercer tipo de quiz: ordenar / secuenciar (drag-to-rank)**
El estudiante arrastra ítems desordenados a su orden canónico (p. ej. priorizar
gastos, pasos para salir de deuda).

- _CA1_: Los ítems se presentan barajados; el orden canónico vive en el banco, nunca expuesto al cliente antes de responder.
- _CA2_: Calificación determinista: correcto si la secuencia == orden canónico (con score parcial por posiciones correctas).
- _CA3_: Funciona con drag en web y móvil (mismo codebase).

**RQ-ES05 — XP, niveles y badges atados a mastery**
Gamificación por dominio real, no por tiempo. XP por aciertos, niveles por XP
acumulado, badges al alcanzar umbrales de `mastery` por competencia.

- _CA1_: La `mastery` (0..1) por mundo se computa de los `quizScores`, no del tiempo gastado.
- _CA2_: Un badge de dominio se otorga cuando `mastery ≥ 0.8` en ese mundo (umbral ajustable).
- _CA3_: El estudiante ve su XP, nivel y badges propios; **nunca** un ranking público individual.

**RQ-ES06 — Evento "Elige tu camino" (decisión-consecuencia, agregado, sin perfil)**
Evento aleatorio temático del mundo: una situación, **2 opciones sin
correcta/incorrecta**, cada una con su consecuencia narrada. Banco separado
(RQ-FN07).

- _CA1_: Probabilidad de disparo al entrar a un mundo: **30%**; máximo una vez por mundo por sesión.
- _CA2_: Las situaciones son **100% temáticas** del mundo en juego (Mundo 3 → ahorro, etc.).
- _CA3_: Al elegir, se muestra la consecuencia narrada de esa opción; **ninguna** opción suma/resta "puntaje de personalidad".
- _CA4_: La elección **solo** incrementa el contador agregado del curso (RQ-FN09); **no** se persiste en ningún doc del estudiante ni construye perfil individual.
- _Resuelve:_ **#2** (UI/mecánica).

**RQ-ES07 — Feedback de alto refuerzo**
Acierto/avance → refuerzo positivo (animación + sonido). Fallo → feedback
negativo claro que invite a reintentar. **Háptica solo en móvil.**

- _CA1_: Acierto dispara animación + sonido **siempre** (web y móvil); en móvil además vibración háptica.
- _CA2_: En **web**, la vibración háptica está ausente/no-op; animación y sonido sí están.
- _CA3_: El fallo produce feedback negativo perceptible (sonido/animación) y un CTA de reintento.

**RQ-ES08 — Simulador de proyecto de vida (dinero virtual)**
Simulación estilo Banzai con **moneda virtual**: ingresos, gastos, imprevistos;
lenguaje "proyecto de vida" (MEN/Proyecta-T). **Sin dinero real, sin cuentas
bancarias.**

- _CA1_: Todo monto es moneda virtual simulada; no hay integración con dinero/bancos reales ni gift cards.
- _CA2_: El simulador presenta decisiones de presupuesto/ahorro con consecuencias virtuales; es experiencia del estudiante, no alimenta perfil individual persistente del menor.
- _CA3_: Accesible desde la capa estudiante; su estado vive como progreso simulado del propio estudiante.

**RQ-ES09 — Modo colaborativo de aula (+ leaderboard de aula opcional)**
Activable/desactivable por el profesor (`curso.colaboracionAula`). Equipos dentro
del aula; leaderboard **de aula opcional**. **Nunca** ranking global público.

- _CA1_: Si `colaboracionAula=false`, el estudiante no ve modo colaborativo ni leaderboard.
- _CA2_: Si `colaboracionAula=true`, el leaderboard es **de aula** (acotado al curso), nunca global ni inter-colegio.
- _CA3_: El leaderboard de aula no expone PII más allá del nombre dentro del propio curso.

### Conflictos resueltos en esta sección

#2-UI (RQ-ES06), #9 (RQ-ES03/ES04), #10 (RQ-ES01).

---

## SECCIÓN 3 — CAPA PROFESOR

> Accesible a `role:'profesor'` sobre sus cursos (`curso.profesorUids`), y a
> coordinador/admin sobre todo el colegio/global (matriz §1.3).

**RQ-PR01 — Dashboard del profesor**
Pantalla de entrada con la lista de **sus** cursos y, por curso, indicadores de
cabecera (n.º estudiantes activos/pendientes, % avance medio, alertas de
deadline).

- _CA1_: El profesor ve solo cursos donde su `uid ∈ profesorUids`; ningún curso ajeno.
- _CA2_: Cada tarjeta de curso muestra: total estudiantes, activos vs `pendiente_atestacion`, avance medio (% mundos completados) y nº de deadlines vencidos.

**RQ-PR02 — Roster, activación (atestación) y código de unión**
Gestión del roster del curso: ver estudiantes (email+nombre), su `estado`, marcar
la **atestación ligera** que activa al estudiante (RQ-FN10), y ver/regenerar el
código de unión.

- _CA1_: El roster lista cada estudiante con email, nombre y `estado` (pendiente/activo/suprimido).
- _CA2_: Un control "confirmar autorización del acudiente" pasa el estudiante a `activo`; queda registrado `atestadoPor`+`atestadoAt` (sin PII del acudiente).
- _CA3_: El profesor puede ver y regenerar el `codigo` del curso; regenerar invalida el anterior.
- _CA4_: El profesor **no** puede suprimir estudiantes (acción de directivo/admin).

**RQ-PR03 — Progreso por estudiante y por mundo**
Vista de progreso nominal del curso: por estudiante y por mundo (mastery, XP,
badges, completado, scores de quiz).

- _CA1_: Tabla estudiante × mundo con `mastery` (0..1), estado de completado y último score.
- _CA2_: Permite ver el detalle de un estudiante (sus 5 mundos) sin exponer datos de otro curso.
- _CA3_: Lee el progreso vía regla de rol (collection-group sobre el tenant), nunca un grant por-usuario.

**RQ-PR04 — Asignación de mundos con deadline**
El profesor asigna "completa el Mundo X antes de la fecha Y" a todo el curso
(`asignaciones/{id}`).

- _CA1_: Crear una asignación guarda `worldId`, `fechaInicio`, `deadline`, `createdByUid`.
- _CA2_: El dashboard marca asignaciones **vencidas** (deadline < hoy) y el % de estudiantes que la cumplieron.
- _CA3_: La asignación es visible para los estudiantes del curso (no la pueden crear/editar).

**RQ-PR05 — Diagnóstico del curso por reglas (no ML)**
"Dónde está flojo el curso" por competencia, computado con **reglas simples** (no
IA/ML). Incluye la salida **agregada** de "Elige tu camino" del curso.

- _CA1_: Por cada competencia/mundo, el diagnóstico muestra una señal (p. ej. mastery medio del curso bajo umbral) derivada por regla, no por modelo.
- _CA2_: Muestra la distribución agregada de "Elige tu camino" por situación (opciónA vs opciónB), **sin** identificar estudiantes (RQ-FN09).
- _CA3_: No invoca ningún servicio de IA en runtime ni adapta contenido en vivo.
- _Resuelve:_ **#7** (diagnóstico por reglas conservado; retiro de IA runtime se completa en §7).

**RQ-PR06 — Calificación automática**
Los quizzes se califican automáticamente; el profesor no califica a mano.

- _CA1_: El score de cada quiz se computa de forma determinista (de los 3 tipos auto-calificables) y se persiste en `progress`.
- _CA2_: El profesor ve los resultados sin acción manual de calificación.

**RQ-PR07 — Exportación CSV / PDF operativa (sin certificados)**
El profesor exporta el progreso/diagnóstico de **su curso** en CSV y PDF. **No**
se generan certificados/diplomas PDF (excluidos, D2).

- _CA1_: Exporta un CSV con filas estudiante × competencia (mastery, completado, score) del curso.
- _CA2_: Exporta un PDF de reporte del curso (resumen + diagnóstico por reglas).
- _CA3_: **No** existe `buildCertificateHtml` ni ninguna emisión de certificado/diploma.
- _Resuelve:_ **#5**.

**RQ-PR08 — Validación docente del banco de contenido**
El profesor (de sus mundos/grado) puede revisar el contenido generado por IA y
marcarlo validado (`pendiente_validacion_docente: false`). Proceso **posterior y
no bloqueante** (D5).

- _CA1_: El contenido se sirve a los estudiantes aunque siga `pendiente_validacion_docente:true` (no bloqueante).
- _CA2_: El profesor ve qué bancos de su grado/mundos están pendientes y puede marcarlos validados (queda `validadoPor`+`validadoAt`).
- _CA3_: El profesor **no** edita ni reescribe el banco en runtime (es read-only); solo cambia el flag de validación. (Editar/reportar ítems queda fuera del MVP.)

**RQ-PR09 — Toggle de modo colaborativo de aula**
El profesor activa/desactiva `curso.colaboracionAula` (alimenta RQ-ES09).

- _CA1_: Cambiar el toggle se refleja en la experiencia del estudiante (aparece/desaparece modo colaborativo y leaderboard de aula).
- _CA2_: El leaderboard, cuando está activo, es siempre de aula (nunca global).

### Conflictos resueltos en esta sección

#5 (RQ-PR07), #7-diagnóstico (RQ-PR05).

---

## SECCIÓN 4 — CAPA INSTITUCIONAL (rector / coordinador)

> Recordatorio de la matriz: **rector = solo lectura agregada** (+ las dos
> acciones legales de directivo: atestación y supresión). **coordinador =
> operación del colegio** (todo lo operativo a nivel `colegio`) + lectura
> agregada. Ninguno ve sedes (dormantes).

**RQ-IN01 — Dashboard institucional con scoping por rol**
Pantalla institucional que consume reportes a nivel colegio. El rol determina
lectura vs. operación.

- _CA1_: `rector` ve el dashboard en modo **solo lectura** (reportes agregados); no aparecen controles de gestión de roster, asignación ni código.
- _CA2_: `coordinador` ve el dashboard con controles operativos del colegio (roster, asignaciones, códigos, diagnóstico) además de los reportes agregados.
- _CA3_: Ningún rol institucional ve datos de un colegio ajeno (gating por `colegioId` en claim).

**RQ-IN02 — Reportes agregados por grado / curso (no nominal)**
Reportes de cumplimiento agregados por grado y por curso, distintos del reporte
operativo del profesor. Son el argumento de renovación del contrato.

- _CA1_: El reporte agrega por **grado** y por **curso**: mastery medio por competencia, % de avance, cobertura de los 5 mundos.
- _CA2_: El reporte **no expone datos nominales** del estudiante a rector (solo agregados); coordinador sí puede descender al detalle operativo (matriz).
- _CA3_: Exportable (PDF/CSV) a nivel institucional.

**RQ-IN03 — Mapping curricular CONPES 4005 / MEN / PISA descargable**
Documento de evidencia que mapea cada mundo/competencia del producto contra
CONPES 4005 / MEN / PISA. Es el entregable de cumplimiento de mayor valor de
venta.

- _CA1_: Descargable (PDF) por rector/coordinador/profesor.
- _CA2_: Lista las 5 competencias (`ingreso/presupuesto/ahorro/credito/deuda`) con su dominio CONPES/MEN/PISA asociado (de `competencias.ts`).
- _CA3_: El documento refleja la cobertura real del producto (los 5 mundos), no una lista genérica.

**RQ-IN04 — Coordinador: operación del colegio**
El coordinador ejerce, a nivel `colegio`, las capacidades operativas: gestión de
roster/activación, asignación de mundos, generación de código, diagnóstico por
reglas y exportes operativos (matriz §1.3). **No** crea estructura
(colegios/cursos/roles = admin, RQ-FN06).

- _CA1_: El coordinador puede activar estudiantes, crear asignaciones y regenerar códigos en **cualquier curso** de su colegio.
- _CA2_: El coordinador **no** puede crear/eliminar cursos ni asignar roles de adultos (esas acciones se deniegan en reglas).

**RQ-IN05 — Acciones legales de directivo (atestación + supresión)**
Rector y coordinador (además de profesor para atestación, y admin) ejercen las
acciones legales: atestación que activa al estudiante (RQ-FN10) y supresión de
datos (RQ-FN11).

- _CA1_: Rector puede atestar/activar y suprimir aunque su dashboard sea de lectura para el resto.
- _CA2_: La supresión por directivo cumple los CA de RQ-FN11 (borra progreso/impacto, marca `suprimido`, registra quién/cuándo).

### Conflictos resueltos en esta sección

Refuerza #3 (sin sede en reportes) y la distinción de la matriz aprobada; no
introduce conflictos nuevos.

---

## SECCIÓN 5 — CAPA ADMIN CETI

> `role:'admin'` (claim, alcance global, sin `colegioId`). Es el **operador de la
> plataforma**: crea toda la estructura y asigna todos los roles de adultos
> (D7/B). No anula las capacidades propias de los demás roles (D2d).

**RQ-AD01 — Dashboard propio de admin Ceti**
Panel global donde el admin administra todo: colegios, adultos, roles, cursos y
códigos. Solo accesible a `role:'admin'`.

- _CA1_: Cualquier rol distinto de `admin` que intente abrir el dashboard admin es denegado (UI + reglas).
- _CA2_: El dashboard lista todos los colegios con sus métricas de cabecera (n.º cursos, estudiantes, adultos).

**RQ-AD02 — Gestión de colegios**
Crear/editar/archivar colegios, su `plan` y `planMaxEstudiantes`.

- _CA1_: Crear un colegio nace con `sedesEnabled:false` y sin sedes (RQ-FN01).
- _CA2_: El admin puede editar plan y tope de estudiantes; el tope se respeta al unir estudiantes (no se exceden cupos del plan).

**RQ-AD03 — Gestión de adultos y asignación de roles**
Crear cuentas de adulto y asignarles rol (`rector`/`coordinador`/`profesor`) con
su `colegioId`. Ningún adulto se auto-asigna el rol (D7).

- _CA1_: El admin crea/da de alta a un adulto y le fija `role`+`colegioId` vía Cloud Function (claims).
- _CA2_: El admin puede cambiar o revocar el rol de un adulto; el cambio se refleja en sus claims.
- _CA3_: No existe ningún flujo donde un adulto se asigne su propio rol; el `isSuperAdmin` por allowlist queda retirado (RQ-FN06).
- _Resuelve:_ **#4**.

**RQ-AD04 — Creación de cursos y vínculo profesor ↔ curso**
El admin crea cursos (nombre, grado) y vincula/desvincula profesores existentes
(`profesorUids`).

- _CA1_: Crear un curso fija `grado∈{9,10,11}`, `colegioId`, genera `codigo` inicial y `colaboracionAula:false`.
- _CA2_: El admin agrega/quita `uid` de profesor en `profesorUids`; el profesor solo entonces ve ese curso.
- _CA3_: El grado del curso determina el banco servido a sus estudiantes (RQ-FN07); no se pide grado al estudiante.

**RQ-AD05 — Gestión de códigos de unión**
El admin puede generar/regenerar el código de unión de cualquier curso (también
lo hacen coordinador/profesor — matriz).

- _CA1_: Regenerar un código invalida el anterior; estudiantes ya unidos no se ven afectados.
- _CA2_: Los códigos son únicos por curso y no colisionan entre cursos.

**RQ-AD06 — Admin no anula a los demás roles**
El admin tiene alcance global de respaldo, pero las capacidades operativas siguen
disponibles para coordinador/profesor sobre su ámbito.

- _CA1_: Que el admin pueda activar/asignar/exportar globalmente no elimina esas mismas capacidades en coordinador (colegio) ni profesor (curso).
- _CA2_: No hay acción exclusiva de admin que bloquee la operación normal de un colegio ya provisionado (salvo gestión de estructura/roles, que es de admin por diseño).

### Conflictos resueltos en esta sección

#4 (RQ-AD03, junto con RQ-FN06).

---

## SECCIÓN 6 — PRE-TEST / POST-TEST DE IMPACTO

> Decisión D: **un instrumento a nivel programa** (no por mundo). Pre-test antes
> del Mundo 1; post-test al completar los 5 mundos; **mismo set de ítems**;
> resultados **agregados** para evidencia institucional; **no cuenta para XP**.
> Datos en `.../estudiantes/{uid}/impactTest/{pre|post}`.

**RQ-TS01 — Pre-test al inicio del programa**
Al activarse el estudiante, antes de desbloquear el Mundo 1, presenta el pre-test
(diagnóstico de entrada de competencia financiera).

- _CA1_: Un estudiante recién activado debe presentar el pre-test antes de poder entrar al Mundo 1.
- _CA2_: El resultado se guarda en `impactTest/pre` con `score`, `total`, `takenAt` y `breakdown` por competencia.
- _CA3_: El pre-test se presenta **una sola vez** (no repetible).

**RQ-TS02 — Post-test al completar los 5 mundos**
Al marcar `completed` el Mundo 5, se habilita el post-test (mismo set de ítems que
el pre-test).

- _CA1_: El post-test solo se habilita cuando los 5 mundos están completados.
- _CA2_: Usa el **mismo set de ítems** que el pre-test (para medir delta comparable).
- _CA3_: El resultado se guarda en `impactTest/post`; se presenta una sola vez.

**RQ-TS03 — Medición de impacto (delta agregado)**
El sistema computa la mejora pre→post como evidencia de impacto, **agregada** para
el colegio.

- _CA1_: El reporte institucional muestra el delta agregado pre→post por curso/grado y por competencia (no expone el delta nominal del menor a rector).
- _CA2_: El pre/post agregado es exportable (matriz: rector/coordinador/profesor/admin).
- _CA3_: El delta se computa solo con estudiantes que tienen ambos (`pre` y `post`); los incompletos se reportan como cobertura parcial, no se imputan.
- _Resuelve:_ **#11**.

**RQ-TS04 — El pre/post-test no afecta la gamificación**
El pre/post-test es instrumento de medición, no de juego.

- _CA1_: Presentar pre o post-test **no** otorga XP, niveles ni badges.
- _CA2_: El score del pre/post-test **no** altera `mastery` ni el desbloqueo de mundos (salvo el gating de presentación de RQ-TS01/TS02).

### Conflictos resueltos en esta sección

#11 (RQ-TS01..TS03).

---

## SECCIÓN 7 — CONTENIDO (pipeline authoring-time → validación → banco; runtime estático)

> Principio rector (D5): **la IA actúa solo en authoring-time (offline)**. En
> runtime el contenido se sirve **100% estático**, sin IA ni adaptación ML. Esto
> resuelve el conflicto #7 (retiro de stubs de IA runtime y de la selección
> adaptativa de preguntas en vivo).

**RQ-CN01 — Pipeline de generación authoring-time (IA offline)**
El contenido (micro-teoría, ítems de los 3 tipos, situaciones "Elige tu camino")
se genera **offline** con IA, por `grado × mundo × tipo`, con dificultad
progresiva (mundo 1<…<5; grado 9<10<11).

- _CA1_: La generación ocurre fuera de la app (script/herramienta authoring), nunca invocada desde el cliente en runtime.
- _CA2_: La salida cubre las 45 combinaciones de quiz + 15 de "Elige tu camino" (RQ-FN07).
- _CA3_: Cada ítem nace con `generadoPor:'ia'`, `version`, y `pendiente_validacion_docente:true`.

**RQ-CN02 — Validación → banco (flag no bloqueante)**
El contenido generado pasa por validación docente (RQ-PR08) antes de considerarse
"validado", pero **se sirve aunque siga pendiente** (no bloqueante, D5).

- _CA1_: Un banco con `pendiente_validacion_docente:true` se sirve igual a los estudiantes.
- _CA2_: La validación docente solo cambia el flag a `false` y registra `validadoPor`+`validadoAt`; no reescribe el contenido en runtime.

**RQ-CN03 — Runtime 100% estático (sin IA/ML en vivo)**
En runtime, la app **solo lee** del banco; no hay generación, adaptación ni
selección por modelo en vivo.

- _CA1_: No existe en el código de runtime ninguna llamada a un servicio de IA (`aiService.adaptQuestion`, `getRecommendedPath`, `analyzeWeaknesses`) ni `adaptiveQuiz` que seleccione preguntas por modelo.
- _CA2_: La selección de las 10 preguntas (RQ-ES03) es estática/aleatoria simple del banco `grado×mundo`, no adaptativa por ML.
- _CA3_: No existen campos `aiHints`/`isAdaptable` que impliquen adaptación en runtime (o quedan inertes/retirados).
- _Resuelve:_ **#7** (retiro completo de IA runtime; el diagnóstico por reglas de RQ-PR05 se conserva, no es ML).

**RQ-CN04 — Lenguaje neutro**
Todo el contenido usa **lenguaje neutro** (no "juvenil colombiano"), nunca teoría
densa (D5-enmienda).

- _CA1_: La micro-teoría y los ítems usan registro neutro y ejemplos cotidianos, verificable en revisión de contenido.
- _CA2_: No hay jerga regional ni texto académico denso.

**RQ-CN05 — Siembra vía Admin SDK; bancos read-only para clientes**
Los bancos se cargan con un script de siembra (Admin SDK); para clientes son
read-only.

- _CA1_: `firestore.rules` deniega escritura de `bancos/**` y `bancosEligeCamino/**` a cualquier cliente (incluido admin desde UI); solo el Admin SDK siembra.
- _CA2_: Marcar un banco como "validado" (RQ-PR08) se hace **vía Cloud Function**, no por escritura directa del cliente, para mantener los bancos estrictamente read-only desde la app.

### Conflictos resueltos en esta sección

#7 (RQ-CN03, completa el retiro de IA runtime).

---

## §8 — TRAZABILIDAD: conflicto → RQ que lo resuelve

|  #  | Conflicto (de `conflictos.md`)                |  Sev.   | RQ(s) que lo resuelve(n)                                             |
| :-: | --------------------------------------------- | :-----: | -------------------------------------------------------------------- |
|  1  | Llave del estudiante (seudónimo `studentId`)  | CRÍTICA | **RQ-FN02**                                                          |
|  2  | Perfil del menor (`aiProfile`, perfilamiento) |  ALTA   | **RQ-FN09** (datos) + **RQ-ES06** (mecánica/UI)                      |
|  3  | Sedes activas                                 |  ALTA   | **RQ-FN01** (refuerzan RQ-IN01/IN02)                                 |
|  4  | Rol admin Ceti (5º rol)                       |  ALTA   | **RQ-FN06** + **RQ-AD03**                                            |
|  5  | Certificados PDF                              |  MEDIA  | **RQ-PR07**                                                          |
|  6  | Autorización acudiente in-system              |  ALTA   | **RQ-FN10**                                                          |
|  7  | IA en runtime                                 |  ALTA   | **RQ-CN03** (retiro) + **RQ-PR05** (conserva diagnóstico por reglas) |
|  8  | Bancos de contenido (global, sin grado/flag)  | CRÍTICA | **RQ-FN07**                                                          |
|  9  | Tipos de pregunta (4 → 3, tope 10)            |  MEDIA  | **RQ-ES03** + **RQ-ES04**                                            |
| 10  | Narrativa de mundos (espacial)                |  MEDIA  | **RQ-ES01**                                                          |
| 11  | Pre/Post-test (no existe)                     |  BAJA   | **RQ-TS01 / TS02 / TS03**                                            |

**Conflictos de documentación** (de la 2ª tabla de `conflictos.md`) — se atienden
en la **Tarea 2** de esta fase (neutralización): `requerimientos.md` (reescrito =
este documento), `data-model.md` y `COMPLIANCE.md`.

## §9 — Definición de "terminado"

Ceti está **completa** cuando, para cada RQ de §§1–7, todos sus criterios de
aceptación (_CA_) están implementados y verificados. Esta especificación es el
contrato; cualquier feature fuera de aquí está fuera de alcance (D2: app completa,
no MVP recortado, pero **acotada a este documento**).

**Excluido explícitamente** (D2 / `producto.md`): certificados/diplomas PDF,
reportes/app para padres, facturación in-system, sedes activas, IA
generativa/adaptativa en runtime, dinero real/gift cards, leaderboard público
individual, perfil individual del menor.

---

## SECCIÓN 10 — MODO DEMO (RQ-DM)

> Adición formal a la spec (autorizada por el dueño; el guardián D1 la acepta).
> **Principio rector:** todo debe poder mostrar cada uno de los 5 perfiles **sin
> datos vacíos**. Ante ambigüedad, elegir lo que haga la demo más completa para un
> visitante que explora solo. Modo autónomo; vetos D4 bloquean.

**RQ-DM01 — Acceso demo de un toque en el login**
Bajo el auth normal, una sección "Simulación Ceti" con 5 accesos de un toque:
Admin Ceti · Rector · Coordinador · Profesor · Estudiante. Cada uno inicia sesión
como su usuario demo **sin credenciales**, vía **custom token** emitido por una
Cloud Function (`demoLogin`) — nunca debilitando `firestore.rules`.

- _CA1_: 5 botones; un toque autentica como el usuario demo de ese rol (custom token → `signInWithCustomToken`).
- _CA2_: La Function `demoLogin` solo puede emitir las **5 identidades demo fijas** con claims demo; no acepta parámetros que produzcan claims arbitrarios.
- _CA3_: El mecanismo no relaja ninguna regla: los demo se autorizan por los **mismos** claims (role + colegioId/cursoId) + un flag `demo:true`.

**RQ-DM02 — Colegio simulado (datos sintéticos realistas, español)**
1 colegio demo (`demo-colegio`) con rector y coordinador demo; **3 cursos** (uno
por grado 9/10/11), cada uno ~20 estudiantes sintéticos y su profesor (3
profesores; uno es **EL** profesor demo). Relaciones correctas del modelo real
(códigos de curso, roster keyed por uid, claims). El estudiante demo y el profesor
demo comparten el **mismo curso**.

- _CA1_: Existe `colegios/demo-colegio` con `sedesEnabled:false`; 3 cursos (grado 9/10/11) con `profesorUids` y `codigo`.
- _CA2_: ~60 estudiantes sintéticos en total (≈20/curso), todos keyed por `uid`, solo `email`+`nombre`, `estado:'activo'`, `atestado:true`.
- _CA3_: El profesor demo está en `profesorUids` del curso del estudiante demo; los otros 2 profesores en los otros 2 cursos.

**RQ-DM03 — Datos vivos (cero dashboards vacíos)**
Los estudiantes sintéticos (todos menos el demo) tienen progreso variado y
verosímil: mundos en distintos avances, `quizScores` de los 3 tipos, agregados de
"Elige tu camino" poblados por curso, pre-test respondido, XP/badges repartidos.

- _CA1_: El dashboard del profesor, los reportes de coordinador/rector y el panel admin muestran tablas/gráficas **llenas** y creíbles.
- _CA2_: Los `agregados/*` por curso reflejan a los sintéticos (Elige-camino, mastery promedio); **no** incluyen al estudiante demo.
- _CA3_: Cada estudiante sintético tiene `impactTest/pre`; una fracción tiene los 5 mundos completos (con `post`) para que el delta de impacto sea no vacío.

**RQ-DM04 — Estudiante demo en cero (flujo desde el inicio)**
El estudiante demo es el **único** en progreso CERO (recién unido), para demostrar
el flujo completo desde el principio.

- _CA1_: El estudiante demo no tiene docs de `progress` ni `impactTest` al iniciar.
- _CA2_: Su `estado` es `activo` (ya atestado) para que pueda jugar de inmediato.

**RQ-DM05 — Jaula de seguridad (innegociable, en rules + claims, no solo UI)**
Los 5 usuarios demo **solo** pueden ver/operar dentro de `demo-colegio`. El admin
demo administra **únicamente** el colegio demo. No pueden escalar, crear usuarios
reales, ni tocar datos fuera de la simulación.

- _CA1_: Todo token con `demo:true` que intente leer/escribir fuera de `colegios/demo-colegio/**` (o su propio `users/{uid}`/`membership/{uid}`) es **denegado** por `firestore.rules`.
- _CA2_: El admin demo (`role:'admin', demo:true`) queda confinado a `demo-colegio` (sus poderes globales se acotan en rules).
- _CA3_: Las Cloud Functions estructurales/claims (`registerColegio`, `createCurso`, `assignRole`, `generateClassCode`, `atestar`, `suppressStudentData`) **rechazan** a cualquier llamante `demo:true` (no crean usuarios/colegios reales ni claims fuera del demo).
- _CA4_: `test:rules` incluye escenarios que demuestran la jaula (demo intenta tocar dato real → deny; demo opera dentro del demo → allow donde corresponda por su rol).

**RQ-DM06 — Reseteo del estudiante demo**
Al iniciar sesión como estudiante demo, su progreso se limpia (vuelve a cero) para
que cada demo empiece fresca, **sin corromper** los agregados del curso.

- _CA1_: `demoLogin('estudiante')` borra `progress` + `impactTest` del estudiante demo antes de devolver el token.
- _CA2_: Los `agregados/*` excluyen al estudiante demo por diseño, así que el reseteo no los altera.

**RQ-DM07 — Deploy web del modo demo**
El deploy web de prueba se actualiza con el modo demo activo; el flujo se verifica
en la URL real entrando con los 5 accesos.

- _CA1_: La build web incluye la sección "Simulación Ceti" y `demoLogin` desplegado.
- _CA2_: Entrar con cada uno de los 5 accesos muestra sus funciones con datos.

### Conflictos resueltos en esta sección

Ninguno (adición nueva). No introduce PII de menor (los sintéticos usan
`@demo.ceti`), no relaja rules (cage por claim `demo`), no añade IA runtime.
