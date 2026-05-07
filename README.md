# Ceti

Ceti es una app móvil de **educación financiera para familias**: el adulto gestiona la familia, recompensas y visibilidad; el menor aprende con lecciones, metas y un mundo interactivo con minijuegos. La base del cliente es **Expo 54**, **React Native 0.81** y **Expo Router** para la navegación.

La arquitectura del código es **feature-first**: dominios en `src/features/*` y piezas compartidas (tema, sesión, Firebase, i18n) en `src/shared/*`.

## Funcionalidades principales

- **Roles** — flujos separados para padre/tutor (`(parent)`) e hijo (`(child)`), con autenticación y onboarding.
- **Aprendizaje** — lecciones y saga de contenido bajo `src/features/learning`.
- **Ahorros y metas** — cartera, cetis (moneda interna), metas y asignación de recompensas.
- **Mundo** — escena interactiva con Skia, zonas y minijuegos (p. ej. atrapar monedas, decisiones de gasto).
- **Sincronización** — Firestore y Cloud Functions cuando Firebase está configurado; sin variables públicas de Firebase la app puede operar en modo principalmente local.

## Requisitos

- Node LTS
- Xcode / Android Studio para builds nativos
- Cuenta [Expo](https://expo.dev) si usas EAS Build

## Puesta en marcha

```bash
npm install
# Crea `.env` a partir de `.env.example` y edítalo (no subas `.env` al repo).
# PowerShell: Copy-Item .env.example .env   —  Unix: cp .env.example .env
npm start
```

Para Android nativo necesitas `google-services.json` de Firebase en la raíz del repo (plantilla de referencia: `google-services.example.json`).

## Scripts

| Script                            | Descripción        |
| --------------------------------- | ------------------ |
| `npm start`                       | Metro + Expo       |
| `npm run android` / `npm run ios` | Run nativo         |
| `npm run web`                     | Expo web           |
| `npm run lint`                    | ESLint (expo lint) |
| `npm run typecheck`               | `tsc --noEmit`     |
| `npm test`                        | Jest               |
| `npm run format`                  | Prettier write     |

## Variables de entorno

Copia `.env.example` → `.env` (no commitear). Usa el prefijo `EXPO_PUBLIC_*` para valores que consuma el cliente. Sin `EXPO_PUBLIC_FIREBASE_*` la app funciona en modo local; con ellas se puede inicializar Auth y Firestore según `app.config.js`.

## Firebase, Functions y EAS

- **Cliente:** configuración dinámica en `app.config.js` (mezcla `app.json` + env).
- **Reglas:** plantilla en `firestore.rules`.
- **Cloud Functions:** código en `functions/` (Node 20). Build: `cd functions && npm run build`; emulador: `npm run serve`; despliegue: `npm run deploy`.
- **EAS:** perfiles en `eas.json` (`development`, `preview`, `production`). El perfil `production` no usa `developmentClient`.

## Parches de dependencias

`postinstall` ejecuta `patch-package`. Si en el repo hay archivos bajo `patches/`, no los elimines sin probar bien la app (p. ej. escenas con GL / Skia en dispositivo).

## Internacionalización

`i18next` + `react-i18next`; catálogo por defecto en `src/shared/i18n/locales/es.json`. Inicialización en `app/i18n.ts` (importada desde `app/_layout.tsx`).

## Tests y CI

- Jest + `jest-expo`, configuración en `jest.setup.js`.
- E2E de referencia con [Maestro](https://maestro.mobile.dev/) en `e2e/maestro/smoke.yaml`.

## Cumplimiento y datos

Orientación sobre COPPA / GDPR-K y datos de menores: [`docs/COMPLIANCE.md`](docs/COMPLIANCE.md).

## Estructura del repositorio

- `app/` — rutas Expo Router (`(auth)`, `(child)`, `(parent)`).
- `src/features/auth|family|learning|savings|world` — dominios de producto.
- `src/shared/` — tema, analytics (stubs / React Native Firebase opcional), sesión, i18n.
- `functions/` — Firebase Cloud Functions (TypeScript).

## Contribución

Pre-commit: Husky + `lint-staged` (Prettier). En CI: typecheck, lint, tests y auditoría de dependencias (`npm audit`) según el workflow del repo.
