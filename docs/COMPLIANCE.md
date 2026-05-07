# Cumplimiento COPPA / GDPR-K (orientación)

**No es asesoría legal.** Ceti está dirigida a familias con menores. Antes de publicar en tiendas en EE. UU. u otros mercados con leyes estrictas sobre menores, revisa con abogado.

## Autenticación y datos personales (PII)

1. **OAuth (Google; Apple opcional con flag)**  
   Tras iniciar sesión, Firebase Auth recibe identificadores de la cuenta del proveedor (p. ej. UID, correo, nombre para mostrar, foto). Esto se refleja en el documento `users/{uid}` en Firestore según el flujo de onboarding (padre o hijo).

2. **Menores**  
   El flujo de hijo incluye creación de perfil local + documento en `users` y enlace a la familia mediante **código de invitación** canjeado vía Cloud Function (`redeemInvitation`). El padre genera códigos en `invitations/{code}`. No se pide correo propio del menor más allá del que pueda proveer el OAuth del dispositivo gestionado por el adulto.

3. **Base legal (orientación)**  
   Para menores, en muchas jurisdicciones se requiere **consentimiento verifiable del padre/madre/tutor** antes de recoger datos personales. El código facilita el vínculo familia–hijo vía invitación emitida por el padre; define en producto/legal el texto de consentimiento y la versión aceptada.

4. **Almacenamiento local**  
   Estado de app persistido con **MMKV** (nativo) o AsyncStorage en web; datos remotos bajo **reglas Firestore** (`firestore.rules`) y **Custom Claims** sincronizados con `syncUserClaims`.

## Principios aplicados en el código

1. **Minimización de datos en analytics**  
   Eventos evitan PII de menores en parámetros (sin nombres ni identificadores legibles en Analytics). Identificadores técnicos opacos locales no se envían como PII en los eventos de ejemplo.

2. **PIN parental**  
   Almacenamiento como digest (no en claro) cuando se usa el flujo con PIN; límites de intentos en memoria frente a fuerza bruta donde aplique.

3. **Consentimiento y orden de flujos**  
   El padre completa onboarding de seguridad antes de flujos sensibles del hijo en la medida en que la navegación lo permite; debe acompañarse de copy legal revisado por abogado.

4. **Datos en reposo y en tránsito**  
   Firebase / TLS para tránsito; Firestore y Auth gestionados por Google según contrato DPA de Firebase. Revisar reglas antes de producción.

5. **Herramientas de diagnóstico**  
   Opcionalmente **Crashlytics**, **Performance** y **Analytics** de Firebase en builds nativos (ver `app.config.js`). Desactivar o anonimizar en entornos donde no proceda.

## Pendiente recomendado antes de tienda

- Publicar **política de privacidad** y enlace in-app.
- Flujo explícito de aceptación parental y registro de versión/fecha.
- Evaluar edad recolectada y requisitos locales (LATAM vs EE. UU.).
- Revisar permisos en `app.json` (cámara, mic, ubicación): mantener **mínimos**; hoy no se declaran permisos extendidos para esas funciones salvo los que añadas tú.

## Contacto DPO / privacidad

Definir correo o formulario de contacto en la política pública antes del lanzamiento.
