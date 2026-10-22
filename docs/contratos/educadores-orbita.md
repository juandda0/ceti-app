# Contrato entre sesiones: Educadores ↔ Órbita

> Acordado el 2026-10-22 entre la sesión **Estrategia de retención de profesores e instituciones** (Educadores: cobros y retención del módulo profe) y la sesión **Diseño de gamificación educativa** (Órbita: gamificación del estudiante). Ambas trabajan en el mismo árbol y la misma rama.

## Dueños

| Ruta | Dueño |
|---|---|
| `src/features/educadores/**` | Educadores |
| `src/features/dashboard/**`, `app/(staff)/**` | Educadores |
| `functions/src/educadores/**` y las líneas `export … from './educadores/…'` de `functions/src/index.ts` | Educadores |
| `functions/**` (resto) | Educadores (Órbita no toca `functions/`) |
| `docs/contratos/**`, `docs/educadores/**` | Educadores |
| `src/features/orbita/**` | Órbita |
| `src/features/learning/**`, `app/(app)/**` | Órbita |
| `src/features/avatar/hooks/useProgresoAvatar.ts` | Órbita |
| `src/features/auth/onboarding/UserSetupScreen.tsx` (+ test), `src/features/auth/screens/ProfileScreen.tsx` | Órbita |
| Notificaciones push (`expo-notifications`, permisos, horarios, límites) | Órbita |
| `docs/gamificacion-orbita.html` | Órbita |
| `scripts/salon/**`, `src/features/salon/**`, `app/dev/salon.tsx`, `app/dev/entrar.tsx`, `docs/salon-demo.md`, `docs/salon-capturas/**`; en `src/shared/lib/firebase/app.ts`, solo la conexión a emuladores (`USA_EMULADORES`); en `firebase.json`, el bloque `emulators`; en `package.json`, los scripts `salon:*` | Salón demo (emuladores locales, sesión iniciada por Educadores). Lee el juego con el dominio de Órbita, sin tocarlo |

## Archivos compartidos

`src/shared/i18n/locales/es.json`, `firestore.rules`, `firestore.indexes.json`, `functions/src/index.ts`, `app/_layout.tsx`, `app.json`, `package.json`, `package-lock.json`.

1. Nunca se reescribe un archivo compartido entero: solo ediciones puntuales, leyendo antes.
2. Cada sesión commitea solo sus rutas (`git add <rutas>`, nunca `-A` ni `.`).
3. Una dependencia nueva se avisa antes por mensaje. Órbita añadió `expo-notifications ~57.0.24`. Educadores no añade dependencias de cliente.
4. Si un gate (typecheck, lint, jest) falla en archivos del otro, se avisa y no se arregla.

Bloques delimitados:

- `firestore.rules`: Educadores usa `// ── EDUCADORES (inicio) ──` … `// ── EDUCADORES (fin) ──` a nivel de `documents` (colecciones `suscripciones`, `pagos`, `bitacoras`, `fundadores`, `eventosPago`). Órbita usa `// ── ORBITA (inicio) ──` … `// ── ORBITA (fin) ──` dentro de `match /users/{userId}` (subcolección `juego/{docId}`, solo el dueño).
- `es.json`: Educadores usa el namespace `educadores.*` (y el `profe.*` existente). Órbita usa `orbita.*` y edita `quiz.*`, `galaxia.*`, `onboarding.*`, `profile.*`.
- `app/_layout.tsx`: Órbita añade una línea para su sincronización junto a `startUserRemoteSync`.

## Contratos de datos

- **A. El plan del profe nunca le quita nada al estudiante.** Los permisos por plan (`puede(plan, funcion)`) solo controlan herramientas del profe.
- **B. Agregados de flota.** Si Órbita escribe agregados por curso, van en `colegios/{cid}/cursos/{cursoId}/agregados/orbita`. Educadores solo los lee y nunca lee el documento de juego individual de un estudiante. En esta pasada Órbita no escribe agregados.
- **C. Bitácora del profe.** Se muestra en la app y se envía por correo desde el servidor. Sin push por ahora. Si más adelante hay push para profes, usa la API de Órbita con una categoría `profe` y sus límites.
- **D. Flota de clase y meta del profe.** El dominio es de Órbita (Fase 3). Educadores construye la pantalla del profe sobre ese contrato cuando exista.
- **E. Firma estable.** Órbita importa sin modificar `src/features/dashboard/data/worldProgressRepository.ts`. Educadores no cambia la firma de `upsert` ni de `getStudentProgress` sin avisar.
- `retoEvaluator` y `StudentAssignmentsBanner` siguen siendo de Educadores; Órbita no los toca en esta pasada.

## Módulos internos de Educadores (sesiones paralelas)

Educadores se implementa en cuatro sesiones que comparten este árbol. Cada una toca solo lo suyo; la sesión líder ("Estrategia de retención de profesores e instituciones") integra, corre los gates y commitea. Ninguna sesión de módulo hace commit ni deploy.

| Módulo | Dueño de |
|---|---|
| Líder | `functions/src/educadores/dominio/**`, `functions/src/educadores/plan.ts`, `src/features/educadores/data/suscripcionRepository.ts`, `src/features/educadores/hooks/useMiPlan.ts`, `docs/contratos/**` |
| Servidor · cobros | `functions/src/educadores/{wompi,suscripciones,correo,facturacion}.ts` (+ tests), bloque `EDUCADORES` de `firestore.rules` (colecciones de cobro), `firestore.indexes.json`, `docs/educadores/**`, líneas `export` de cobros en `functions/src/index.ts` |
| Servidor · límites | `functions/src/educadores/{limites,invitaciones,bitacoraSemanal}.ts` (+ tests), ediciones a `resolveMyAccess`, `crearMiCurso`, `joinByCode`, `generarBorradorMundo`, `generarItemContenido` en `functions/src/index.ts`; en `firestore.rules`, la regla de `invitados` y `tienePlanEdicion()` dentro del bloque `EDUCADORES` y su uso en las reglas de `contenido` y `config` |
| App · planes | `src/features/educadores/{screens,components}/**`, `src/features/educadores/data/wompiTokens.ts` y demás `data/` nuevos de cobro, `app/(staff)/{planes,suscripcion,pago}.tsx`, ediciones en `StaffProfileScreen`, `CreateClassScreen`, `CreateWorldScreen`, `ContentEditorScreen`, `ClassWorldsManager`, `GenerateContentSheet`, `dev/demoProfe.ts`; en `StaffHomeScreen` y `CourseManageScreen`, solo el banner de prueba y el bloqueo; `es.json` → `educadores.{planes,muro,suscripcion,pago,estado,soporte,exportar}` |
| App · retención | `src/features/educadores/retencion/**`, `src/features/educadores/dev/demoRetencion.ts`, `app/(staff)/bitacora.tsx`, `app/(staff)/notas/[cursoId].tsx`, `CourseDashboardScreen`, `SchoolReportScreen`; en `StaffHomeScreen` y `CourseManageScreen`, solo insertar su tarjeta o sección; `es.json` → `educadores.{bitacora,notas,adopcion,lista,teaser}` |

Callables (nombres fijos): `cotizarPlan`, `crearCheckoutPlan`, `suscribirConMedio`, `gestionarSuscripcion`, `wompiEventos` (HTTP), `cicloSuscripciones` (programada) son de cobros; `invitarLista`, `activarLicenciaNave`, `bitacoraSemanal` (programada) son de límites. Los errores de límite usan `HttpsError` con `details.codigo` ∈ `limite_clases`, `limite_estudiantes`, `requiere_plan`, `limite_ia`.
