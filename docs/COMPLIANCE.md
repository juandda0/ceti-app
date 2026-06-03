# Cumplimiento — Ley 1581 de 2012 / Decreto 1377 de 2013 (datos de menores)

**No es asesoría legal.** Ceti es un SaaS **B2B2C** que un colegio privado contrata
para sus estudiantes (13+). El tratamiento de datos de menores en Colombia está
regido por la **Ley 1581 de 2012** y el **Decreto 1377 de 2013**: el dato de un
menor solo puede tratarse de forma excepcional, atendiendo al interés superior
del menor y previa **autorización del representante legal (acudiente)**. Este
documento es la guía operativa; revisar con abogado antes de operar con datos
reales.

> Regla de oro del producto: **no se cargan datos reales de menores sin el flujo
> de autorización completo.** Es bloqueante, no opcional (ver
> [`ceti-invariants.mdc`](../.cursor/rules/ceti-invariants.mdc)).

## 1. Minimización de PII (modelo Banzai)

- El estudiante se identifica por un **seudónimo provisto por el colegio**
  (`studentId`), no por nombre/correo/edad personales. Ver
  [`docs/data-model.md`](data-model.md).
- La cuenta de auth (`users/{uid}`) se vincula al seudónimo vía
  `estudiantes/{studentId}.uidVinculado`; ese es el único punto de unión.
- **Prohibido** escribir nombre, correo o edad del menor fuera de lo estrictamente
  necesario. `firestore.rules` y los repos deben respetarlo.
- **Analytics sin PII**: los parámetros de `src/shared/lib/analytics/logEvent.ts`
  nunca llevan nombre, correo, edad, apodo ni identificadores que mapeen a una
  persona/menor.

## 2. Flujo de autorización del acudiente (bloqueante)

1. El colegio crea el cupo del estudiante en el roster. Nace en estado
   **`pendiente_autorizacion`**.
2. Mientras esté pendiente, `firestore.rules` **impide** que el estudiante
   genere datos: la escritura de `progress` exige `estudiante.estado == 'activo'`
   (helper `estudianteActivo`). Sin consentimiento, no hay datos del menor.
3. El acudiente otorga la autorización por un canal verificable (formulario
   firmado / correo del acudiente). El colegio la **registra** con la Cloud
   Function `setAuthorizationStatus`, que:
   - escribe `colegios/{cid}/autorizaciones/{studentId}` con `estado: 'otorgada'`,
     `politicaVersion`, `otorgadaAt`, `canalEvidencia`, `registradaPor`;
   - cambia `estudiante.estado` a **`activo`**.
4. El estudiante queda habilitado para usar la app y generar progreso.

> El acudiente **no** es un usuario de la app ni tiene panel; solo firma el
> consentimiento. El registro queda como evidencia auditable. (Un flujo
> self-service con enlace tokenizado para el acudiente es mejora de V2.)

## 3. Registro de autorizaciones

`colegios/{cid}/autorizaciones/{studentId}` es el registro de consentimientos:
estado, versión de la política aceptada, fecha, canal de evidencia y quién la
registró. Escribible solo vía Admin/Function (`firestore.rules`:
`autorizaciones` → `write: if false`).

## 4. Supresión de datos (derecho del titular)

La Cloud Function `suppressStudentData` (solo rector/coordinador) ejerce el
derecho de supresión: borra el `progress` del estudiante, marca el cupo como
**`suprimido`**, desvincula `uidVinculado` y deja la autorización en `revocada`.
Es irreversible.

## 5. Política de tratamiento de datos

- Debe existir una **política de tratamiento** pública y enlazada **in-app**
  (URL en `EXPO_PUBLIC_PRIVACY_POLICY_URL`, expuesta vía
  `src/shared/constants/legal.ts`).
- La versión aceptada se guarda en cada autorización (`politicaVersion`) para
  trazabilidad ante cambios de política.

## 6. Edad mínima y otras normativas

- `MIN_AGE = 13` se valida en `UserSetupScreen`. No bajarlo.
- Para la franja 13–18, además de Ley 1581, considerar GDPR-K (si hay usuarios
  UE) y COPPA (si hay usuarios EE. UU. <13, fuera de alcance por `MIN_AGE`).
- **PIN local** (si se usa): se guarda como digest vía
  `src/features/auth/utils/pinCrypto.ts`, nunca en claro.
- La reforma de protección de datos 2025 (proyecto) podría endurecer reglas
  sobre perfilamiento de menores — monitorear; refuerza la decisión de **no IA
  generativa / perfilamiento en MVP**.

## 7. Datos en tránsito y en reposo

Firebase/TLS en tránsito; Firestore y Auth gestionados por Google bajo el DPA de
Firebase. Crashlytics/Performance/Analytics solo en builds nativos
(`app.config.js`), no-op en web; sin PII en sus parámetros.

## 8. Pendiente antes de operar con un colegio real

- Publicar la **política de tratamiento de datos** y enlazarla in-app.
- Acordar con el colegio el **canal de autorización** del acudiente y conservar la
  evidencia.
- Definir contacto de **habeas data / supresión** (correo o formulario).
- Revisar permisos en `app.json` (cámara, mic, ubicación): mantener **mínimos**.

## Contacto habeas data / privacidad

Definir correo o formulario de contacto en la política pública antes de operar.
