# Ceti

Ceti es una app móvil de **educación financiera single-user** para adolescentes (13+) y jóvenes adultos: el usuario aprende con lecciones, crea metas de ahorro y gestiona su cartera personal (cetis, la moneda interna). La base del cliente es **Expo 54**, **React Native 0.81** y **Expo Router** para la navegación.

La arquitectura del código es **feature-first**: dominios en `src/features/*` y piezas compartidas (tema, sesión, Firebase, i18n) en `src/shared/*`.

## Funcionalidades principales

- **Onboarding** — autenticación con Google (Apple opcional tras flag) y configuración de perfil en `(auth)/onboarding/user-setup` con MIN_AGE = 13.
- **Aprendizaje** — saga de lecciones bajo `src/features/learning` (`story`, `quiz`, `interactive`, `simulation`, `goal_creator`, `choose_path`).
- **Ahorros y metas** — cartera, cetis (moneda interna), metas y depósitos (aplicados inmediatamente, sin pending).
- **Sincronización** — Firestore cuando Firebase está configurado; sin variables públicas de Firebase la app opera en modo principalmente local.

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
- **Cloud Functions:** estructura preparada en `functions/` (Node 20) pero `src/index.ts` está vacío hoy (sólo `export {};`). Reservado para la migración futura de `aiProfile` cliente → server.
- **EAS:** perfiles en `eas.json` (`development`, `preview`, `production`). El perfil `production` no usa `developmentClient`.

## Parches de dependencias

`postinstall` ejecuta `patch-package`. Si en el repo hay archivos bajo `patches/`, no los elimines sin probar la app en dispositivo.

## Internacionalización

`i18next` + `react-i18next`; catálogo por defecto en `src/shared/i18n/locales/es.json`. Inicialización importando `@shared/i18n` desde `app/_layout.tsx`.

## Tests y CI

- Jest + `jest-expo`, configuración en `jest.setup.js`.
- E2E de referencia con [Maestro](https://maestro.mobile.dev/) en `e2e/maestro/smoke.yaml`.

## Cumplimiento y datos

Orientación sobre COPPA / GDPR-K y datos de menores: [`docs/COMPLIANCE.md`](docs/COMPLIANCE.md).

## Estructura del repositorio

- `app/` — rutas Expo Router (`(auth)` para login/onboarding, `(app)` para saga/savings/profile, `lesson/[id]` para lecciones individuales).
- `src/features/auth|learning|savings` — dominios de producto.
- `src/shared/` — tema, analytics (stubs / React Native Firebase opcional), sesión, i18n.
- `src/services/ai/` — abstracción AI (hoy stubs; preparada para integrar Claude API).
- `functions/` — estructura para Firebase Cloud Functions (vacío hoy).

## Smoke test (sincronización single-user)

Tras desplegar reglas (`npx firebase deploy --only firestore:rules`), valida en dispositivos reales o emuladores:

1. **Onboarding** — login OAuth + `user-setup` con edad ≥ 13; aparece el doc `users/{uid}` en consola Firebase.
2. **Lecciones** — completar una lección actualiza `users/{uid}/lessonProgress/{lessonId}` y suma XP en `users/{uid}` al sincronizar.
3. **Metas** — crear una meta escribe `users/{uid}/goals/{goalId}`.
4. **Depósitos** — registrar un depósito escribe `users/{uid}/deposits/{depositId}` y actualiza `users/{uid}/wallet/state` (sin pending; aplicado inmediatamente).
5. **Persistencia** — logout/login del mismo usuario en otro dispositivo: cartera, metas, racha y XP coherentes con lo que está en Firestore.

## Contribución

Pre-commit: Husky + `lint-staged` (Prettier). En CI: typecheck, lint, tests y auditoría de dependencias (`npm audit`) según el workflow del repo.
