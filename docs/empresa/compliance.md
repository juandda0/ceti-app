# Compliance — Ceti (Ley 1581 / Decreto 1377, datos de menores)

> **No es asesoría legal.** Guía operativa. Revisar con abogado antes de operar
> con datos reales. Complementa (y en lo que difiera, **enmienda**) el legacy
> `docs/COMPLIANCE.md` — ver `conflictos.md`. Autoridad: decisiones cerradas.

## Marco legal

- **Ley 1581 de 2012 + Decreto 1377 de 2013:** el dato de un menor solo se trata
  de forma excepcional, atendiendo al **interés superior del menor** y previa
  **autorización del representante legal (acudiente)**.
- **CONPES 4005 (2020) / Decreto 457 de 2014:** anclan la EEF; es el mandato que
  el producto ayuda a cumplir (no es norma de datos, pero define el propósito).
- **Reforma de protección de datos 2025 (proyecto):** endurecería el
  **perfilamiento de menores** → refuerza nuestra decisión de **no perfilar**.

## Qué datos SE GUARDAN del estudiante (minimización permanente)

- **ÚNICAMENTE: email + nombre.** Nada más sobre el menor.
- **El grado NO se pide en el onboarding:** se **deriva del curso** al que el
  estudiante se une (el grado es atributo del curso, no dato capturado al menor).
- El email es la **identidad de login** (OAuth 2.0).

## Qué datos JAMÁS se guardan

- ❌ Edad/fecha de nacimiento, documento, teléfono, dirección del menor.
- ❌ **Datos del acudiente** dentro del sistema (su autorización vive por fuera).
- ❌ Datos financieros **verificables/transaccionales** del menor: no hay cuentas,
  saldos bancarios, pagos ni vínculo con dinero real moviéndose por la app.
  **Excepción RQ-ES10 (D-ES10-02):** el **diario autodeclarado** de movimientos de
  bolsillo (`users/{uid}/movimientos`) sí se guarda, con salvaguardas: solo-vista-
  propia (ni staff ni admin leen movimientos individuales), borrable por el
  estudiante, incluido en la supresión, sin perfilamiento derivado y sin
  montos/descripciones/categorías en analytics.
- ❌ **Perfil individual persistente** construido a partir de decisiones del menor
  (ver "No perfilamiento").
- ❌ PII de menores en analytics (`logEvent.ts`): nunca nombre, email ni
  identificadores que mapeen a una persona.

## No perfilamiento (bloqueante de diseño)

El evento **"Elige tu camino"** NO construye un perfil individual del menor. Sus
decisiones se agregan **por curso** para el diagnóstico del profesor; **no** se
persiste un rasgo/etiqueta individual del estudiante. Esto cumple la prohibición
de perfilamiento de menores y anticipa la reforma 2025.

## Registro por voz (RQ-ES10)

- **El audio del menor nunca toca nuestra infraestructura.** El
  reconocimiento de voz lo ejecuta el **navegador** (Web Speech API); Ceti no
  graba, almacena ni transmite audio a sus servidores. Solo el **texto**
  transcrito (≤300 caracteres) viaja a la Cloud Function de clasificación.
- **Revelar en la política de tratamiento:** (a) el vendor del navegador (p. ej.
  Google en Chrome) puede procesar el audio en sus servidores como parte del
  servicio de dictado del propio navegador; (b) **Anthropic** actúa como
  encargado que recibe el **texto transcrito** (≤300 caracteres, transmisión
  internacional a EE. UU.) únicamente para clasificarlo — no lo persiste en
  nuestro sistema y la política debe cubrirla con cláusula de transmisión
  (Decreto 1377).
- La clasificación server-side instruye al modelo **omitir nombres propios y
  cualquier PII** del texto; solo se persisten campos estructurados
  (tipo/monto/categoría) y una descripción corta neutra.
- **Sin permisos nuevos en `app.json`:** el micrófono lo gestiona el navegador
  con su propio prompt de permiso (permisos de la app se mantienen mínimos).

## Autorización del acudiente — recolección **POR FUERA del sistema**

- **El colegio recolecta y conserva** el consentimiento del acudiente por un canal
  verificable (formulario firmado / correo), **fuera** de Ceti. Esa evidencia la
  custodia el colegio.
- **Dentro del sistema, atestación ligera:** admin/profesor marca un checkbox
  _"el colegio confirma tener la autorización del acudiente"_ antes de **activar**
  al estudiante.
- **Gating de activación:** un estudiante no habilitado (sin atestación) **no
  genera datos de juego**. El sistema **no** almacena datos del acudiente ni un
  registro de consentimiento con su PII — solo el booleano de atestación + quién
  y cuándo lo marcó (trazabilidad mínima).
- El **acudiente no es usuario** de la app ni tiene panel (consistente con la
  prohibición de "app para padres").

## Edad mínima

- **`MIN_AGE = 13`.** No bajarlo. La franja 13–18 sigue siendo de menores bajo
  Ley 1581.

## Política de tratamiento de datos

- Debe existir una **política pública** enlazada in-app (URL en
  `EXPO_PUBLIC_PRIVACY_POLICY_URL`).
- Define: datos tratados (email+nombre), finalidad (EEF/cumplimiento), derechos
  del titular, y **contacto de habeas data / supresión**.

## Derechos del titular (supresión)

- Debe existir un mecanismo de **supresión** del estudiante (borra progreso,
  desvincula la cuenta, marca el cupo como suprimido). La ejercen el **profesor**
  (de su curso) y el **admin** (backend) — D-PIVOT reasigna el titular, sin dejar la
  acción sin responsable. Irreversible.

## Datos en tránsito y reposo

- Firebase/TLS en tránsito; Firestore/Auth gestionados por Google (DPA de
  Firebase). Sin PII de menores en parámetros de analytics/telemetría.

## Pendiente antes de operar con un colegio real

- Publicar y enlazar la **política de tratamiento**.
- Acordar con el colegio el **canal de autorización** del acudiente (lo conserva
  el colegio) y el procedimiento de atestación.
- Definir contacto de **habeas data / supresión**.
- Mantener permisos de la app **mínimos**.
