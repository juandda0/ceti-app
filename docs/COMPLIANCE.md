# Cumplimiento COPPA / GDPR-K (orientación)

**No es asesoría legal.** Ceti es una app **single-user** dirigida a adolescentes (13+) y jóvenes adultos. Aunque la edad mínima coloca a la mayor parte de la audiencia fuera del alcance estricto de COPPA, GDPR-K y normativas locales LATAM/UE pueden seguir aplicando para usuarios de 13–15. Revisa con abogado antes de publicar en tiendas.

## Autenticación y datos personales (PII)

1. **OAuth (Google; Apple opcional con flag)**
   Tras iniciar sesión, Firebase Auth recibe identificadores de la cuenta del proveedor (UID, correo, nombre para mostrar, foto). Esto se refleja en el documento `users/{uid}` en Firestore durante el bootstrap (`src/shared/lib/firebase/authProfileBootstrap.ts`).

2. **Onboarding y edad mínima**
   `UserSetupScreen` exige edad ≥ `MIN_AGE = 13` antes de habilitar el resto del flujo. No se recoge correo del usuario más allá del que provea el OAuth del proveedor.

3. **Base legal (orientación)**
   Para usuarios entre 13 y la mayoría de edad local, varias jurisdicciones exigen consentimiento informado y, según el caso, verificación adicional. Define en producto/legal el texto de consentimiento mostrado en onboarding y registra la versión aceptada.

4. **Almacenamiento local**
   Estado de app persistido con **MMKV** (nativo) o AsyncStorage en web (ver `src/shared/lib/storage/mmkv.ts`); datos remotos bajo `firestore.rules`, todos bajo la ruta `users/{uid}/*` con guardia `isSelf(uid)`.

## Principios aplicados en el código

1. **Minimización de datos en analytics**
   Los eventos evitan PII en parámetros (sin nombres, correos ni edades en `logEvent`). Identificadores técnicos opacos no se envían como PII en los eventos de ejemplo.

2. **PIN local**
   Cuando el flujo lo use, se almacena como digest (no en claro) mediante `src/features/auth/utils/pinCrypto.ts`; límites de intentos en memoria contra fuerza bruta donde aplique.

3. **Datos en reposo y en tránsito**
   Firebase / TLS para tránsito; Firestore y Auth gestionados por Google según contrato DPA de Firebase. Revisar reglas antes de producción.

4. **Herramientas de diagnóstico**
   Opcionalmente **Crashlytics**, **Performance** y **Analytics** de Firebase en builds nativos (ver `app.config.js`). Desactivar o anonimizar en entornos donde no proceda.

5. **Perfil de IA (deuda anotada)**
   `users/{uid}/aiProfile/state` es escribible por el propio cliente como MVP (`firestore.rules:47`). Antes de activar AI en producción debe migrarse a Cloud Functions con escritura sólo desde Admin SDK.

## Pendiente recomendado antes de tienda

- Publicar **política de privacidad** y enlace in-app.
- Flujo explícito de aceptación del usuario y registro de versión/fecha del consentimiento.
- Evaluar requisitos locales para la franja 13–18 (LATAM vs UE vs EE. UU.).
- Revisar permisos en `app.json` (cámara, mic, ubicación): mantener **mínimos**.
- Completar la migración de `aiProfile` a Cloud Functions antes de soltar AI personalization.

## Contacto DPO / privacidad

Definir correo o formulario de contacto en la política pública antes del lanzamiento.
