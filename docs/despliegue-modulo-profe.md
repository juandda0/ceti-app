# Despliegue del módulo del profesor (F0–F9)

Lista para llevar a producción (`ceti-d3769`) las fases F0 a F9 del módulo del profesor. Son los commits `9136931` (F0) a `f12cd55` (F8c) y los de la F9 (`80e8d06` 9a, `a22e4a1` 9b, `c8f9bdf` 9c, `fbce625` 9d y el de esta lista, 9e) de la rama `codex/integracion-cinco-pestanas`. Nada de esto se ha desplegado todavía.

Los cobros, Wompi, Alegra y el correo tienen su runbook en [educadores/operacion.md](educadores/operacion.md). Esta lista remite a él cuando hace falta.

## 1. Orden de despliegue y cómo revertir

### Antes de empezar

- [ ] Despliega desde un worktree limpio del commit, no desde el árbol de trabajo (otras sesiones dejan cambios sin commit): `git worktree add ../ceti-deploy <último commit de la F9>`.
- [ ] En el worktree corre `npm ci` en la raíz y en `functions/`. `functions/` tiene una dependencia nueva: `unpdf`. Copia `.env` desde el repo.
- [ ] Inicia sesión con la cuenta dueña del proyecto: `firebase login` y `gcloud auth application-default login` con `juandiegodiazave@gmail.com`. Luego corre `gcloud auth application-default set-quota-project ceti-d3769`.
- [ ] Revisa el runtime de Functions. `functions/package.json` pide `"node": "20"` y la memoria del proyecto dice que Google retira Node 20 el 2026-10-30. Si el CLI lo rechaza, sube `engines.node` en un commit aparte y vuelve a correr las pruebas.
- [ ] Corre las verificaciones en el worktree:
  - `npx tsc --noEmit -p tsconfig.json`
  - `npx jest`
  - `npm --prefix functions run build`
  - `FIRESTORE_EMULATOR_HOST=127.0.0.1:8099 node scripts/testFirestoreRules.mjs` (267 casos, con el emulador prendido)
- [ ] Haz un respaldo de Firestore: `gcloud firestore export gs://<bucket>/antes-modulo-profe --project ceti-d3769`. Hace falta porque aceptar una invitación de entidad mueve clases y borra el original (`mudarClase`).

### Orden

1. [ ] **Índices.** Corre `firebase deploy --only firestore:indexes --project ceti-d3769` y espera a que queden listos (sección 2).
2. [ ] **Reglas.** Corre `firebase deploy --only firestore:rules --project ceti-d3769`. Las reglas van antes que las funciones: las funciones nuevas escriben claims `{role, clases}` y documentos nuevos. Las reglas nuevas aceptan también los claims de antes (`colegioId`/`cursoId`).
3. [ ] **Secretos y parámetros** (sección 4). Deben existir antes de desplegar las funciones.
4. [ ] **Functions.** Corre `FUNCTIONS_DISCOVERY_TIMEOUT=120 firebase deploy --only functions --project ceti-d3769`.
5. [ ] **Contenido.** Siembra los bancos con el script (sección 6) justo antes del hosting. La web vieja no filtra las preguntas `prueba: true`, así que conviene que pase poco tiempo entre los dos pasos.
6. [ ] **Hosting web.** En el worktree corre `npx expo export -p web` y luego `firebase deploy --only hosting --project ceti-d3769`.
7. [ ] **Build de EAS** (sección 5). Sube antes `version` en `app.json`.

### Cómo revertir

- [ ] **Hosting.** En la consola, abre Hosting → Historial de versiones → Revertir a la versión anterior.
- [ ] **Functions.** Despliega desde un worktree del commit anterior. El CLI pide borrar las funciones que ya no están en el código; en modo no interactivo hay que pasar `--force`. Las programadas dejan de correr cuando se borran.
- [ ] **Reglas.** Úsalas con cuidado. Desde la F1, los estudiantes que se unen a una clase reciben claims `{clases}` que las reglas viejas no entienden. Si vuelves a las reglas viejas, esos estudiantes pierden el acceso a su clase. Es mejor corregir hacia adelante. Si de verdad hace falta, revierte desde Firestore → Reglas → historial.
- [ ] **Índices.** No hace falta revertirlos. Un índice de más no rompe nada.
- [ ] **Contenido.** Corre el script desde un worktree del commit anterior con `--escribir`. Así vuelven los documentos que cambiaron. Los documentos nuevos (grados 1, 4, 6 y 8 y `world_6`) se quedan, porque el script nunca borra. La app vieja no los lee.
- [ ] **Datos.** Restaura el respaldo con `gcloud firestore import` (sobrescribe los documentos que traiga el respaldo).
- [ ] **App nativa.** Una build publicada no se revierte. Deja la build anterior disponible en las tiendas hasta comprobar la nueva.

## 2. Índices

Estos son los índices nuevos de `firestore.indexes.json` en el rango (`git diff 9136931^ f12cd55 -- firestore.indexes.json`). Son los mismos que pide la memoria de la F5.

- [ ] **Índice compuesto** de `comunicados` (alcance COLLECTION) con `tipo` ASC y `creadoAt` DESC. Lo usa la lista de anuncios del estudiante, que filtra por `tipo == 'anuncio'`.
- [ ] **fieldOverride** de `acudiente.correoActivo` con orden ASC en alcance COLLECTION y en COLLECTION_GROUP. Lo usa `resumenAcudientesSemanal`: `collectionGroup('acudiente').where('correoActivo', '==', true)`.

No hay más índices nuevos. Las consultas nuevas de `progress` usan el índice que ya existía (`colegioId` + `cursoId`, collection group). La biblioteca pública consulta sin `orderBy` y ordena en el cliente.

Para esperar a que terminen de construirse:

- [ ] Corre `gcloud firestore indexes composite list --project ceti-d3769` hasta que `comunicados` salga en `READY`.
- [ ] Corre `gcloud firestore indexes fields describe correoActivo --collection-group=acudiente --project ceti-d3769` y comprueba que los dos índices estén listos.
- [ ] También lo puedes ver en la consola: Firestore → Índices (pestañas Compuestos y Exenciones de campo).
- [ ] Si un log de Functions o la app dicen `FAILED_PRECONDITION: The query requires an index`, falta un índice. Agrégalo a `firestore.indexes.json` (el error trae el enlace).

**F9.** No hay índices compuestos nuevos. Todas las consultas nuevas son de un solo campo (Firestore las indexa solo):

- `tareasAbiertas` con `orderBy('creadaAt')`, y sus `entregas` con `where('calificada', '==', true)`.
- `muro` con `where('estado', '==', 'publicada')` o `where('uid', '==', …)`.
- `bibliotecaPublica` con `where('oculto', '==', true)` (moderación).
- `ltiPlataformas` con `where('colegioId', '==', …)` o `where('issuer', '==', …)`.

- [ ] **Política TTL** (consola: Firestore → TTL) en la colección `ltiEstados`, campo `expiraAt`. Sin ella los `state` vencidos de LTI se quedan (no son un riesgo: se rechazan a los 10 minutos), pero ocupan espacio.

## 3. Cloud Functions nuevas o cambiadas

Todas están en `us-central1` (no hay `region` ni `setGlobalOptions`).

### Nuevas: callables (`onCall`)

- [ ] **F0** (`index.ts`): `salirDeMiClase`, `retirarEstudiante`, `editarMiCurso`, `borrarMiCurso`.
- [ ] **F4** (`index.ts`):
  - `extraerTextoPdf` (512 MiB, 60 s, sin secreto; usa `unpdf`).
  - `sugerirOpcionesErradas` (secreto `GROQ_API_KEY`).
- [ ] **F5:**
  - `enviarComunicado`.
  - `gestionarAcudiente`.
  - `verResumenAcudiente` y `bajaAcudiente`, que son públicas, sin login, para la ruta `/acudiente/[token]`.
- [ ] **F6 entidades** (`educadores/entidades.ts`): `crearEntidad`, `invitarProfeEntidad`, `cancelarInvitacionProfe`, `misInvitacionesEntidad`, `responderInvitacionEntidad`, `sacarProfeEntidad`, `cambiarRolProfeEntidad`, `gestionarCoDocente`.
- [ ] **F6 panel y biblioteca:** `verPanelEntidad`, `guardarEvaluacionEntidad`, `publicarEnBiblioteca`, `usarDeBiblioteca`, `retirarDeBiblioteca`.
- [ ] **F6 facturación:** `guardarDatosFacturacion`, `cotizarPlanEntidad`, `registrarOrdenCompra` y `activarLicenciaEntidad`. La última exige el claim `role: 'admin'`.
- [ ] **F7** (`educadores/cumplimiento.ts`): `gestionarPrueba`, `verCoberturaClase`, `cerrarPeriodoEntidad`.
- [ ] **F8:**
  - `operarClaseVivo`.
  - `emitirCertificados`, `verCertificado` (pública, para `/certificado/[codigo]`) y `revocarCertificado`.
  - `publicarEnBibliotecaPublica`, `usarDeBibliotecaPublica`, `reportarPublicacion`, `retirarDeBibliotecaPublica`.

### Nuevas: disparadores y programadas

- [ ] **F1:** `onIntentoClase` (`onDocumentCreated` en `colegios/{cid}/cursos/{cursoId}/estudiantes/{uid}/intentos/{intentoId}`).
- [ ] **F5:** `alertasProfe` (`onSchedule`, `every day 07:00`, `America/Bogota`, 540 s, 512 MiB).
- [ ] **F5:** `resumenAcudientesSemanal` (`onSchedule`, `every sunday 18:00`, `America/Bogota`, 540 s, 512 MiB). Encola correos en `mail`.

### Cambiadas por dentro (ya existían)

- [ ] `index.ts`:
  - `resolveMyAccess`, `joinByCode` y `generateClassCode`: hasta 5 clases, claims `{clases}` y estado `retirado`.
  - `suppressStudentData`: borra también buzón, acudiente, notificaciones, certificados y grupos.
  - `generarBorradorMundo`: acepta `fuente`.
  - `onProgressWriteAggregate`.
- [ ] `adopcionDiaria`: programada, `every day 05:00`, Bogotá. Ya no cuenta a los retirados.
- [ ] `bitacoraSemanal`: programada, `every sunday 19:00`, Bogotá.
- [ ] `invitarLista` y `activarLicenciaNave`: licencias de entidad.
- [ ] Cobros (`cotizarPlan`, `crearCheckoutPlan`, `suscribirConMedio`, `gestionarSuscripcion`, `wompiEventos`, `cicloSuscripciones` a las `every day 06:00`): ciclo semestral, Piloto $129.000 y Comandante $259.000.

### Las que piden secretos

- [ ] `GROQ_API_KEY`: `generarBorradorMundo`, `generarItemContenido`, `sugerirOpcionesErradas`, `planificarAccionesFinancieras` y, desde la F9, `sugerirCalificacion`.
- [ ] `WOMPI_*` y `ALEGRA_*`: `crearCheckoutPlan`, `suscribirConMedio`, `gestionarSuscripcion`, `wompiEventos` y `cicloSuscripciones`.
- [ ] El CLI exige que existan todos los secretos del codebase, aunque despliegues con `--only functions:x`. En el deploy del 2026-10-29 se quitó a mano el `export … from './educadores/suscripciones'` en el worktree porque faltaban los de Wompi y Alegra. Ahora el semestral los necesita, así que créalos (sección 4).

**F9.**

- [ ] **Callables** (`educadores/claseAbierta.ts`): `gestionarTareaAbierta`, `entregarTareaAbierta`, `calificarEntrega`, `sugerirCalificacion` (secreto `GROQ_API_KEY`) y `muroClase`.
- [ ] **Callables** (`educadores/entidades.ts` y `educadores/bibliotecaPublica.ts`): `gestionarDominiosEntidad` y `moderarBibliotecaPublica` (exige el claim `role: 'admin'`).
- [ ] **LTI 1.3** (`integraciones/lti.ts`): el callable `gestionarPlataformaLti` y dos funciones HTTP públicas, `ltiLogin` (GET o POST) y `ltiLaunch` (POST). Sus URL son las que el admin pega en Moodle o Canvas (Colegio → Conexiones). Si se usa un dominio propio para las funciones, pon `CETI_FUNCTIONS_URL` (sección 4).
- [ ] **Cambiadas:** casi todas las callables de la clase ahora exigen el permiso «edita» (`soloCalificar`, F9a): `operarClaseVivo`, `enviarComunicado`, `emitirCertificados`, `revocarCertificado`, `gestionarAcudiente`, `invitarLista`, `gestionarPrueba`, `publicarEnBiblioteca`, `usarDeBiblioteca`, `publicarEnBibliotecaPublica`, `usarDeBibliotecaPublica`, `gestionarCoDocente` (acción nueva `permiso`) y las de `index.ts` que operan la clase (`atestar`, `generateClassCode`, `retirarEstudiante`, `editarMiCurso`, `borrarMiCurso`, `suppressStudentData` y las de IA). `misInvitacionesEntidad` crea la invitación por dominio. `suppressStudentData` borra también entregas de tareas abiertas y preguntas del muro.

## 4. Secretos y configuración

### Secretos (`defineSecret`)

En el rango no aparece ningún secreto nuevo. Todos tienen que existir en `ceti-d3769`:

- [ ] `GROQ_API_KEY`. Ya existe. Ahora lo usan más callables de IA, y el plan gratis de Groq tiene poco cupo (8K TPM).
- [ ] `WOMPI_PRIVATE_KEY`, `WOMPI_INTEGRITY_SECRET`, `WOMPI_EVENTS_SECRET`. Se crean con `firebase functions:secrets:set <NOMBRE>` (operacion.md §1).
- [ ] `ALEGRA_USER`, `ALEGRA_TOKEN`. Si todavía no hay cuenta de Alegra, crea cada uno con el valor `pendiente` (operacion.md §1 y §4).

### Parámetros (`defineString`) en `functions/.env.ceti-d3769`

En modo no interactivo el CLI no toma los valores por defecto, así que escríbelos todos:

- [ ] `CETI_OPS_EMAIL`. Ahora lo usa también `registrarOrdenCompra` (correo `orden_compra_ops`).
- [ ] `URL_APP`. Es el enlace del correo `invitacion_entidad`. Por defecto vale `https://ceti-d3769.web.app`.
- [ ] `URL_RETORNO_PAGO`, `WOMPI_ENV` y `WOMPI_PUBLIC_KEY`. Si `WOMPI_PUBLIC_KEY` queda vacío, los pagos quedan apagados.
- [ ] `ALEGRA_CLIENTE_ID`, `ALEGRA_ITEM_ID` y `ALEGRA_IVA_ID`. Pueden quedar vacíos sin Alegra.
- [ ] `CETI_ADMIN_EMAILS` (variable de entorno, opcional): más correos de admin de Ceti, aparte del raíz.
- [ ] `CETI_FUNCTIONS_URL` (F9, opcional): base de las URL de LTI. Vacío = `https://us-central1-ceti-d3769.cloudfunctions.net`.

### Proveedores de inicio de sesión (F9)

- [ ] **Google:** ya está activo. Revisa que el dominio de la web esté en Authentication → Settings → Authorized domains.
- [ ] **Microsoft:** en Azure (Entra ID) registra una app «multitenant», con la URI de redirección `https://ceti-d3769.firebaseapp.com/__/auth/handler`. Luego actívalo en Firebase → Authentication → Sign-in method → Microsoft, con el ID de aplicación y el secreto. Hoy solo funciona en la web; en el celular necesita su propia configuración nativa.
- [ ] Deja «Una cuenta por correo» (la opción por defecto). Si un profe ya entró con Google, Microsoft le dice que entre con Google primero (la app muestra ese mensaje).

### Variables `EXPO_PUBLIC_*`

- [ ] La única nueva en el rango es `EXPO_PUBLIC_APP_URL`. Es la base del enlace del acudiente en el celular. Si falta, usa `https://ceti-d3769.web.app`. En web se usa el origen de la página.
- [ ] Para el semestral en la app hacen falta `EXPO_PUBLIC_WOMPI_PUBLIC_KEY` y `EXPO_PUBLIC_WOMPI_ENV`. Ya existían, pero no están en `.env`.
- [ ] `.env` está en `.gitignore` y no hay `.easignore`, así que EAS no lo sube. Confirma que las `EXPO_PUBLIC_*` estén como variables de EAS: `eas env:list --environment production`.

### Correo

- [ ] Confirma que la extensión **Trigger Email from Firestore** (`firebase/firestore-send-email`) esté instalada en `ceti-d3769` y escuche la colección `mail` (operacion.md §5). `firebase.json` no la declara, así que se instala en la consola.
- [ ] Plantillas nuevas en el rango: `resumen_acudiente`, `invitacion_entidad`, `orden_compra_ops` y `nave_cupo_ops`.

### Push

- [ ] Las notificaciones salen por Expo Push (`https://exp.host/--/api/v2/push/send`, sin token de acceso). En el emulador no se envían.
- [ ] Para que lleguen a un celular, EAS necesita las credenciales de push: FCM V1 para Android (`eas credentials`, sube la cuenta de servicio de Firebase) y la llave APNs para iOS.

## 5. Dependencias nativas y build de EAS

Dependencias nativas nuevas en `package.json` (`git diff 9136931^ f12cd55 -- package.json`):

- [ ] `expo-camera` ~57.0.6 (F0, lector del QR de la clase).
- [ ] `expo-print` ~57.0.2, `expo-sharing` ~57.0.24 y `expo-file-system` ~57.0.7 (F3, exportar a PDF y Excel).
- [ ] `expo-document-picker` ~57.0.3 (F4, PDF del profe para la IA).
- [ ] `expo-speech` ~57.0.3 (F8, leer en voz alta).
- [ ] `fflate` también es nueva, pero es solo JS y no pide build.

Permisos:

- [ ] Cámara: el plugin `expo-camera` de `app.json` trae `cameraPermission` («Ceti usa la cámara solo para leer el código QR de la clase de tu profe.»). Con eso escribe `NSCameraUsageDescription` en iOS. El micrófono queda apagado (`microphonePermission: false`, `recordAudioAndroid: false`).
- [ ] `expo-speech`, `expo-print`, `expo-sharing`, `expo-file-system` y `expo-document-picker` no piden permisos en `app.json`.

Build:

- [ ] Sube `version` en `app.json`. Hoy vale `1.0.0`. `runtimeVersion` usa la política `appVersion`: si no cambia la versión, un `eas update` con estos módulos nativos les llegaría a las builds viejas, que no los tienen.
- [ ] Prueba interna en un celular: `eas build --profile preview --platform all`. El perfil `development` es la dev build con simulador en iOS.
- [ ] Tiendas: `eas build --profile production --platform all` (canal `production`, `autoIncrement`) y luego `eas submit --profile production`.

## 6. Datos

### Contenido por defecto

El script es `scripts/produccion/sembrarContenido.cjs` (también `npm run produccion:sembrar -- <opciones>`). Escribe `content/bancos` en `bancos/` y `bancosEligeCamino/`, y `content/microteoria` en `microteoria/`. Valida todo antes de escribir. Solo escribe lo que cambió (`set()` del documento completo) y nunca borra.

- [ ] Corre la prueba de cobertura de desempeños, que el script no revisa: `npx jest src/features/learning/data/contenidoBancos.test.ts`.
- [ ] Usa ADC (`gcloud auth application-default login`). No pongas ninguna clave dentro del repo: el script la rechaza.
- [ ] Haz primero el dry-run, que solo lee:

  ```bash
  node scripts/produccion/sembrarContenido.cjs --proyecto ceti-d3769 --dry-run
  ```

  Lo esperado:
  - Los grados 1, 4, 6 y 8 y todos los `world_6` salen en «crear».
  - Los de 9 a 11 salen en «actualizar»: traen `ambito`, `desempeno` y las preguntas `prueba`.
  - Lo marcado con `?` está en Firestore pero no en `content/`. El script no lo toca; revísalo a mano.

- [ ] Después escribe:

  ```bash
  node scripts/produccion/sembrarContenido.cjs --proyecto ceti-d3769 --escribir --confirmo-produccion
  ```

  Al terminar, vuelve a leer y comprueba que todo quedó igual a `content/`.

- [ ] Repite el dry-run. Debe decir «se escribirían 0 documentos».
- [ ] Para un solo grado o mundo usa `--solo <prefijo>`, por ejemplo `--solo 1_` o `--solo 9_world_6`. Ojo: `--solo 1` también toma 10 y 11.
- [ ] `content/approved` y `content/validation` no se suben. La app no los lee, y no existen para las celdas nuevas.
- [ ] Ningún docente ha revisado las 942 preguntas, que van con `pendiente_validacion_docente: true`. La revisión docente sigue pendiente; la nota de la F7 lista los ítems dudosos.

### Otros datos

- [ ] No hay que sembrar contadores. `contadores/cotizaciones-AAAA` y `suscripciones/{uid}/uso/{mes}.clasesVivo` se crean solos.
- [ ] Licencias de entidad: un admin de Ceti (claim `role: 'admin'`) llama a `activarLicenciaEntidad({colegioId, cotizacionId})` cuando entra el pago (operacion.md §7b). Ninguna pantalla de la app la llama (tampoco a `activarLicenciaNave`), así que hay que invocarla por fuera de la app.
- [ ] Biblioteca pública: desde la F9 el admin de Ceti modera en su panel (Admin → «Biblioteca pública · mundos ocultos»): volver a mostrar o retirar.
- [ ] Dominios y LTI de cada institución: los configura su admin en Colegio → Conexiones. No hay nada que sembrar.

## 7. Pasos manuales y verificación después del despliegue

### Lo que nunca se probó en real

- [ ] Push en un celular real con la build nueva: anuncio, mensaje y alerta.
- [ ] Voz (`expo-speech`, es-CO) en un celular: en una lección con «leer en voz alta» y en la clase en vivo.
- [ ] Clase en vivo en celulares: el profe proyecta en la web y los estudiantes responden en el celular.
- [ ] Cobro semestral en Wompi: primero en sandbox y luego en producción (operacion.md §3).
- [ ] Factura de entidad en Alegra: queda `emision_manual`. Emítela a mano y comprueba los datos del NIT.
- [ ] Correo de invitación de entidad: debe llegar y el enlace debe abrir la app.
- [ ] Rutas de Groq (IA) en vivo: `generarBorradorMundo` con `fuente`, `extraerTextoPdf` con un PDF real, `sugerirOpcionesErradas` y «Crear un repaso con IA».
- [ ] PDF del certificado desde el botón, en la web (iframe de impresión) y en el celular.

### Para correr las programadas sin esperar

- [ ] En Cloud Scheduler, abre `firebase-schedule-alertasProfe-us-central1` y `firebase-schedule-resumenAcudientesSemanal-us-central1` y elige «Forzar ejecución». Revisa los logs y la colección `mail`.

### Humo por fase

- [ ] **F0:**
  - Unirse por código y por QR (cámara en el celular).
  - Salir de la clase y retirar a un estudiante.
  - Editar, archivar y borrar una clase vacía.
- [ ] **F1:**
  - Un estudiante en 2 clases cambia de espacio.
  - Una lección en la clase crea `intentos` y `onIntentoClase` llena `resumen/clase`.
- [ ] **F2:** abrir la ficha del estudiante. Con Cadete se ven solo los últimos 7 días.
- [ ] **F3:** Análisis de la clase y exportar a xlsx y a PDF (en el celular, con la hoja de compartir).
- [ ] **F4:** mapa del mundo, editor de Elige camino, los tipos emparejar, completar y numérica, y el banco del profe.
- [ ] **F5:**
  - Anuncio y mensaje; el estudiante los ve en «Tu profe dice».
  - Alertas.
  - Enlace público del acudiente sin login y baja del resumen.
- [ ] **F6:**
  - Crear una entidad, invitar a un profe y aceptar; comprobar que la clase se mudó con su avance.
  - Agregar un co-docente.
  - Panel de la entidad y escala SIEE.
  - Biblioteca de la entidad.
  - Cotización y orden de compra (llega el correo a operaciones).
  - Programa en una universidad.
- [ ] **F7:**
  - Una clase de 2° juega el banco `1_*` y el mundo 6 aparece.
  - Prueba de entrada y salida.
  - Informe de cobertura de la clase.
  - Cierre de periodo.
  - Descargar el PDF y el Word del PEI desde el botón.
- [ ] **F8:**
  - Grupos («Armar al azar») y filtro en Análisis.
  - Adaptaciones en la ficha.
  - Insignias.
  - Emitir certificados y verificarlos en `/certificado/[codigo]` sin login, y revocar uno.
  - Biblioteca pública: publicar, copiar a otra clase y reportar.
- [ ] **F9:**
  - Co-docente en «Ve y califica»: ve el aviso, no abre clase en vivo ni cambia mundos, sí califica y da insignias.
  - Cadete pasa su cupo de clases en vivo y aparece el muro de planes.
  - Moderación de la biblioteca en el panel del admin de Ceti.
  - Requisitos de un mundo (fecha y nota) y lo que ve el estudiante; calendario de la clase y el .ics en Google Calendar.
  - Tarea abierta: crear, responder, calificar y «Sugerir con IA» con Groq en vivo (nunca se probó con la llave real).
  - Muro de preguntas: encender, preguntar, responder.
  - Entrar con Google Workspace y con Microsoft 365 en la web; el dominio de una entidad crea la invitación.
  - LTI con un Moodle real (CINTIA u otro): registrar la plataforma, un enlace con `ceti_codigo` y abrirlo como estudiante y como profe. Algunos Moodle piden la llave pública de la herramienta aunque solo se use el lanzamiento: si la pide, por ahora no hay (queda pendiente con AGS).
  - Planilla de notas en Excel y CSV, y que el sistema académico del colegio la acepte.
  - «Compartir en Google Classroom» con una cuenta de Classroom.
