# Ceti

App de educación financiera para familias (Expo 54, React Native 0.81, Expo Router). Arquitectura **feature-first** bajo `src/features/*` y utilidades compartidas en `src/shared/*`.

## Requisitos

- Node LTS
- Xcode / Android Studio para builds nativos
- Cuenta [Expo](https://expo.dev) para EAS (opcional)

## Scripts

| Script                            | Descripción        |
| --------------------------------- | ------------------ |
| `npm start`                       | Metro + Expo       |
| `npm run android` / `npm run ios` | Run nativo         |
| `npm run lint`                    | ESLint (expo lint) |
| `npm run typecheck`               | `tsc --noEmit`     |
| `npm test`                        | Jest               |
| `npm run format`                  | Prettier write     |

## Variables de entorno

Copia `.env.example` → `.env` (no commitear). Prefijo `EXPO_PUBLIC_*` para claves usadas en cliente. Firebase opcional: sin `EXPO_PUBLIC_FIREBASE_*` la app funciona solo en modo local; con ellas se inicializa Auth (anónimo) + Firestore.

## Firebase y EAS

- Config dinámica: `app.config.js` mezcla `app.json` + env.
- Reglas plantilla: `firestore.rules`.
- Perfiles de build: `eas.json` (`development`, `preview`, `production`). El perfil `production` no usa `developmentClient`.

## Parche `expo-gl`

Existe `patches/expo-gl+16.0.10.patch`; `postinstall` ejecuta `patch-package`. No eliminar sin probar escena 3D en dispositivo.

## i18n

`i18next` + `react-i18next`, catálogo por defecto `src/shared/i18n/locales/es.json`. Inicialización en `app/i18n.ts` (importada desde `app/_layout.tsx`).

## Tests y CI

- Jest + `jest-expo`, setup en `jest.setup.js`.
- Flujo E2E sugerido: [Maestro](https://maestro.mobile.dev/) — ver `e2e/maestro/smoke.yaml`.

## Cumplimiento

Documento orientativo: [`docs/COMPLIANCE.md`](docs/COMPLIANCE.md) (COPPA / GDPR-K, datos de menores).

## Estructura rápida

- `app/` — rutas Expo Router (`(auth)`, `(child)`, `(parent)`).
- `src/features/auth|family|learning|savings|world` — dominios.
- `src/shared/` — tema, analytics (stubs / RN Firebase opcional), sesión, i18n.

## Contribución

Pre-commit: Husky + `lint-staged` (Prettier). CI: GitHub Actions (typecheck, lint, test, `npm audit`).
