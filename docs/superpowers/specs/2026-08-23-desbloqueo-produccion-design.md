# Desbloqueo seguro de producción

## Objetivo

Eliminar los bloqueos de privacidad, autorización y dependencias detectados por
la auditoría pre-release del 23 de agosto de 2026, sin desplegar hasta que todos
los gates obligatorios estén verdes.

El trabajo se divide en tres workstreams independientes y revisables:

1. Privacidad de menores.
2. Aislamiento de cursos en Firestore.
3. Dependencias y toolchain de release.

## Decisión de producto

Se prioriza cumplimiento inmediato sobre conservar todo el alcance actual:

- Los retos financieros siguen pudiendo asignarse y evaluarse localmente, pero
  su estado no sale del dispositivo ni se muestra nominalmente al profesor.
- El registro por voz no envía texto libre a Groq. La interpretación pasa a ser
  local y determinista; una frase no reconocida solicita reformulación.
- No se crean excepciones documentales para legitimar el comportamiento actual.

## Workstream 1: privacidad

### Retos financieros

- Eliminar la persistencia `colegios/{cid}/cursos/{cursoId}/estudiantes/{uid}/retos/*`.
- Eliminar repositorio, sincronización y lectura nominal de esas señales.
- Conservar `evaluarReto` como cálculo local para feedback exclusivo del
  estudiante.
- El reporte docente conserva las columnas/consignas de retos, pero no una
  matriz `uid → estado`. La UI no debe inferir ausencia como `sin_empezar`.
- Retirar las reglas y paths que soportaban la señal individual.

### Supresión

El documento `estudiantes/{uid}` queda restringido a la whitelist:

`email`, `nombre`, `estado`, `atestado`, `atestadoPor`, `atestadoAt`,
`politicaVersion`, `joinedAt`, `uidVinculado`.

`suppressStudentData` conserva `estado:'suprimido'` y `atestado:false`, pero deja
de escribir `suprimidoAt` y `suprimidoPor` en el documento del menor. No se crea
otra colección de auditoría en este cambio: la supresión efectiva y los logs
administrativos de Firebase son suficientes para desbloquear el release.

### Registro por voz

- Mantener Web Speech API para transcribir audio en el navegador; el audio nunca
  sale del dispositivo.
- Reemplazar la callable `procesarRegistroVoz` por un parser local determinista
  sobre el texto transcrito.
- Reutilizar enums, normalización monetaria y validadores existentes cuando sea
  posible.
- El parser devuelve como máximo cinco movimientos con `tipo`, `monto`,
  `descripcion`, `categoria` y una confianza determinista.
- Si no puede resolver tipo o monto, devuelve un resultado no reconocido y la UI
  pide reformular. No inventa valores ni envía texto a un tercero.
- Retirar la excepción runtime de Groq, el secreto y el contador `vozUso` cuando
  queden sin consumidores.

La clasificación determinista no necesita cubrir lenguaje natural ilimitado. Su
contrato mínimo cubre los formatos ya probados para montos, tipo de movimiento,
categorías y hasta cinco movimientos en una frase.

## Workstream 2: aislamiento Firestore

### Cursos

`colegios/{cid}/cursos/{cursoId}` se lee solamente cuando:

- el profesor cumple `isProfesorDe(cid, cursoId)`, o
- el estudiante tiene claims `colegioId == cid` y `cursoId == cursoId`.

Esto evita que un estudiante obtenga el `codigo` de otras clases. La callable
`joinByCode` mantiene la validación mediante `classCodes/{code}`, que sigue siendo
deny-all para clientes.

### Asignaciones

- Profesor: lectura y escritura solo si imparte `target.cursoId`.
- Estudiante: lectura de una asignación de su curso; si `target.tipo` es
  `estudiante`, además `target.uid == request.auth.uid`.
- Update: `target` y `createdByUid` son inmutables.
- Delete: solo el profesor del curso objetivo existente.

El cliente mantiene consultas por `target.cursoId`; no se amplía el acceso para
hacer funcionar consultas mal acotadas.

### Pruebas obligatorias

El emulador debe demostrar al menos:

- estudiante de C1 no lee el documento de C2;
- profesor de C1 no lee el documento de C2;
- estudiante de C1 no lee asignación de C2;
- estudiante objetivo lee su asignación individual;
- otro estudiante del mismo curso no la lee;
- profesor no puede cambiar `target` ni `createdByUid` mediante update;
- `classCodes/*` permanece inaccesible para clientes.

Los tests usan JDK 21 mediante `JAVA_HOME` del proceso; no modifican la
configuración global de Java.

## Workstream 3: dependencias

- Ejecutar primero `npm audit fix` sin `--force` y revisar el diff.
- No aceptar actualizaciones mayores automáticas de Expo, Firebase Admin u otras
  dependencias centrales dentro de este workstream.
- Verificar `npm ls` y clasificar cualquier alerta restante como runtime de web,
  backend desplegado o toolchain/dev-only.
- Una vulnerabilidad crítica o alta alcanzable en el bundle web o Functions
  bloquea producción.
- Si solo queda una corrección que exige Expo 55+ o un major de Firebase Admin,
  abrir un plan separado de actualización; no usar `overrides` sin demostrar
  compatibilidad.

## Secuencia de entrega

1. Privacidad: retirar cruces de datos del menor y Groq.
2. Firestore: cerrar lecturas y updates cross-course.
3. Dependencias: aplicar actualizaciones compatibles y evaluar remanentes.
4. Auditoría pre-release completa.
5. Export web, smoke test y Firebase Hosting solo con todos los gates verdes.

Cada workstream tiene su propio ciclo test-first y commit. No se mezclan cambios
de producto, rules y dependencias en un mismo commit.

## Gates de salida

- `compliance-privacidad`: `pass`.
- `auditor-firestore-rules`: `pass`.
- `npm run test:rules`: exit `0` con JDK 21.
- `npm audit --audit-level=high`: sin hallazgos altos/críticos alcanzables en
  producción; cualquier excepción dev-only queda documentada con ruta de
  dependencia.
- `npm run lint`, `npm run typecheck`, `npx jest --runInBand`,
  `npm run gates`: exit `0`.
- `npx expo export --platform web`: genera `dist/` sin errores.
- Smoke web: login, acceso a Mundos, lectura de asignaciones y registro por voz
  determinista funcionan en viewport móvil y escritorio.

## Rollback

No hay migración destructiva previa al deploy. Los documentos legacy de retos
individuales dejan de ser accesibles y de escribirse; su eliminación de datos ya
persistidos se ejecuta solo mediante una tarea explícita y auditada posterior.

Si el parser local reduce demasiado la tasa de reconocimiento, se revierte solo
su UI/servicio local; Groq no se reactiva sin una nueva revisión de privacidad.

## Fuera de alcance

- Agregados anónimos de cumplimiento de retos.
- Cambiar de Expo SDK o hacer upgrades mayores automáticos.
- Rediseñar pantallas no afectadas por los bloqueos.
- Desplegar Functions, rules o Hosting antes de que la auditoría completa pase.
