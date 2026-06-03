# AGENTS.md — Ceti

> Ecosistema de agentes diseñado para **este** repositorio.
> Versión 4 · 2026-06-03 · branch `master`
>
> **Capa de ejecución:** ver [`docs/HARNESS.md`](docs/HARNESS.md) — cómo este
> ecosistema conceptual se materializa con el tooling real (Agent subagents,
> Workflow, Skills, compuertas de verificación), el flujo por fase y el
> paralelo/barrera. `AGENTS.md` manda en _qué agente existe_; `HARNESS.md` en
> _cómo se ejecuta el flujo_.

---

## 0. Contexto sobre el que se diseñó este ecosistema

**Producto:** Ceti — **SaaS B2B2C de educación financiera** vendido a colegios
privados en Colombia (CONPES 4005). El cliente que paga es el colegio; lo que
compra es cumplimiento curricular + reporting docente + tiempo ahorrado al
profesor, entregado como experiencia gamificada para estudiantes (13+).
**Multi-tenant con jerarquía de roles** `colegio → (sede, opcional) → curso →
estudiante`; roles `rector`/`coordinador`/`profesor`/`estudiante`. **No** es el
modelo familia padre/hijo (eliminado y prohibido). El acudiente aparece **sólo**
en el flujo de autorización de datos Ley 1581. Ver `CLAUDE.md` y `docs/data-model.md`.

**Stack exacto (de `package.json`):**

- Expo `~54.0.33`, React Native `0.81.5`, React `19.1.0`, expo-router `~6.0.23`
- TypeScript `~5.9.2`, Jest `^29.7.0` + `jest-expo`, ESLint `^9.25.0`, Prettier `^3.8.3`
- Firebase `^12.12.1` (Auth + Firestore) + `@react-native-firebase/{analytics,crashlytics,perf}` `^23.3.1`
- `firebase-admin` `^13.10.0` (Functions/scripts) + `@firebase/rules-unit-testing` `^5.0.1`
- Estado: Zustand `^5.0.12`, persistencia: `react-native-mmkv` + AsyncStorage
- Animaciones: `react-native-reanimated` `~4.1.1`, Lottie; `react-native-qrcode-svg` (class codes)
- Auth: `@react-native-google-signin/google-signin`, `expo-apple-authentication` (tras flag)
- Build: EAS (`eas.json` perfiles `development/preview/production`), Husky + lint-staged
- i18n: `i18next` + `react-i18next` (catálogo es en `src/shared/i18n/locales/es.json`)

**Capas y dominios:**

- `app/(auth)` (`login`, `welcome`, `onboarding/user-setup`), `app/(app)` (estudiante:
  `saga`, `savings`, `profile`, `lesson/[id]`) y `app/(staff)` (`index`, `colegio`,
  `superadmin`, `curso/[cursoId]`, `admin/index`, `admin/curso/[cursoId]`) — rutas expo-router
- `src/features/{auth,learning,savings,dashboard}` — dominios (`dashboard` = reportes
  por curso/colegio, roster, asignaciones, certificados, consola admin/superadmin)
- `src/shared/{firebase,session,analytics,storage,i18n,theme,...}` — núcleo transversal
- `functions/src/index.ts` — **Cloud Functions reales (Blaze)**: `setMemberClaims`,
  `bootstrapColegio`, `registerColegio`, `listColegios` (super-admin),
  `setAuthorizationStatus`/`suppressStudentData` (Ley 1581),
  `generateClassCode`/`joinByCode` (auto-inscripción). Único escritor confiable de claims.
- `firestore.rules` + `firestore.indexes.json` — **multi-tenant**: árbol
  `colegios/{cid}/{sedes,cursos/{cursoId}/estudiantes/{sid}/progress},asignaciones,
autorizaciones}`, `membership/{uid}`, `classCodes/{code}`, account-scoped
  `users/{uid}/{goals,deposits,lessonProgress,wallet,aiProfile}`, `questionBank`.
  Autorización por **custom claims** (`role`, `colegioId`, `sedeId`, `studentId`, `cursoId`).
- `scripts/` — `seedQuestionBank`, `seedDemoColegio`, `seedScenario`, `setRole`,
  `setSuperadmin`, `testFirestoreRules.mjs` (reglas contra emulador)
- `.github/workflows/ci.yml` — typecheck + lint + test + `npm audit` (bloqueante)

**Servicios externos conectados:** Firebase (Auth, Firestore, Cloud Functions,
Crashlytics, Perf, Analytics; proyecto `ceti-d3769`), Google Sign-In, Apple
Sign-In (flag), EAS Build/Updates.

**Flujos críticos:**

1. OAuth (Google / Apple opcional) → `users/{uid}` → onboarding → resolución de rol vía `membership/{uid}` y claims.
2. Provisión de tenant: super-admin `registerColegio` → rector; staff `setMemberClaims` (rector asigna cualquier rol, coordinador sólo profesor/estudiante).
3. Auto-inscripción estudiante: `generateClassCode` → `joinByCode` → roster en `pendiente_autorizacion`.
4. Ley 1581: `setAuthorizationStatus` ('otorgada'→`activo` / 'revocada'→pendiente); `suppressStudentData` (derecho de borrado, sólo rector/coordinador).
5. Aprendizaje del estudiante → `.../estudiantes/{sid}/progress/{worldId}` (gated por `estudianteActivo`); reportes agregados por collection-group (rector/coordinador) y por curso (profesor).
6. Ahorros simulados (moneda virtual): `users/{uid}/{goals,deposits,wallet}`.

**Zonas de riesgo identificadas:**

- **Aislamiento de tenant** — toda lectura cross-student y la query collection-group de `progress` deben filtrar por `colegioId`/rol; una fuga cross-colegio expone datos de otro cliente.
- **Cumplimiento Ley 1581/Decreto 1377 (+ COPPA/GDPR-K)** — `docs/COMPLIANCE.md` declara MIN_AGE=13, minimización de PII y de analytics, consentimiento del acudiente. El flujo de autorización y supresión maneja datos sensibles de menores.
- **Regresión de permisos por rol** — cambios en `firestore.rules` o en las Functions de claims pueden ampliar privilegios (p. ej. coordinador asignando rector) o romper el gate `estudianteActivo`. Requieren `test:rules` verde.
- **`classCodes` no enumerables** — los códigos de clase sólo los toca el Admin SDK; las reglas niegan al cliente. Exponerlos permitiría inscripción no autorizada.
- **Cobertura de tests aún parcial** — `dashboard` tiene tests de cómputo (`courseReport`, `schoolReport`, `mastery`, etc.), pero faltan repos, screens y session sync; el `test:rules` no puede ser opcional.
- **E2E por rol** — los flujos sensibles ahora son por rol (onboarding estudiante con gate Ley 1581, reportes de staff); el smoke Maestro debe cubrir al menos un flujo real por rol antes de release.

---

## 1. Núcleo (activos desde el día 1)

### 1.1 Orchestrator

- **Capa:** Coordinación
- **Responsabilidad:** Único punto de entrada. Lee la solicitud, decide qué agente(s) invocar, en qué orden, y consolida resultados. **No** escribe código de feature ni reglas; sólo enruta y agrega contexto.
- **Input:** prompt del usuario + estado de repo (git status, branch).
- **Output:** plan de ejecución, llamadas a sub-agentes, resumen final.
- **Cuándo se invoca:** siempre, primer turno.
- **Gates duros:** ninguno; impone los de otros agentes.
- **Justificación:** stack heterogéneo (cliente RN + reglas + scripts + functions + i18n + EAS) — sin enrutador, cualquier cambio mediano dispara conflictos entre dominios.

### 1.2 Mobile-Feature-Builder

- **Capa:** Cliente
- **Responsabilidad:** Implementa pantallas y lógica de dominio bajo `app/(app|auth)/*` y `src/features/{auth,learning,savings}/*`. Sigue arquitectura feature-first, Zustand stores, repositorios contra Firestore. **No** edita `firestore.rules`, `functions/`, ni `eas.json`.
- **Input:** especificación de feature, paths objetivo.
- **Output:** diff de código TS/TSX + actualizaciones a stores/repositorios.
- **Cuándo se invoca:** cualquier tarea de UI o lógica de dominio cliente.
- **Gates duros:** los Outputs deben pasar `TypeCheck-Lint-Gate` antes de commit.
- **Justificación:** la app es el 90% del repo; expo-router + Zustand + Firebase v12 modular tiene patrones específicos (ej. `initializeAuth` + `getReactNativePersistence` en `src/shared/lib/firebase/app.ts`) que no son obvios.

### 1.3 Firestore-Rules-Auditor

- **Capa:** Seguridad
- **Responsabilidad:** Revisa cualquier diff que toque `firestore.rules`, `firestore.indexes.json` o que cree paths nuevos (árbol de tenencia `colegios/*` o account-scoped `users/{uid}/*`). Valida menor privilegio, **aislamiento de tenant** (`sameColegio`), gates de claims (`isStaff`/`isProfesorDe`/`isStudentSelf`/`estudianteActivo`), validación de tipos/rangos en `progress`, fugas en la query collection-group, idempotencia y compatibilidad con cliente. Corre `npm run test:rules`.
- **Input:** diff de reglas/índices + paths nuevos detectados en repositorios cliente.
- **Output:** veredicto `pass`/`fail`, lista de violaciones, sugerencia de regla.
- **Cuándo se invoca:** auto en cualquier PR que modifique `firestore.rules`, `firestore.indexes.json`, `src/features/**/data/*Repository.ts` o las Functions de claims.
- **Gates duros:** **bloquea merge** si encuentra `allow ... if true`, paths sin gate de claims, fuga cross-colegio (read sin filtro por `colegioId`), o nuevos campos PII sin validación. Marca como "needs review" cualquier path que el cliente escriba con datos de menores.
- **Justificación:** la autorización entera se apoya en custom claims + aislamiento de tenant (`firestore.rules` cabecera y helpers `sameColegio`/`estudianteActivo`); un error de menor privilegio expone datos de **otro colegio**. Usa el skill `firebase-security-rules-auditor`.

### 1.4 Test-Writer

- **Capa:** Tests
- **Responsabilidad:** Genera tests Jest para repositorios (`*Repository.ts`), stores Zustand y utilidades puras (`xp`, `pinCrypto`, `sanitizeForFirestore`, `levels`). Prioriza módulos sin tests existentes. Sigue patrón de `useAuthStore.test.ts`. **No** mockea Firestore con stubs triviales; usa el emulador o fakes representativos.
- **Input:** path del módulo + comportamiento esperado.
- **Output:** archivo `*.test.ts(x)` adyacente al módulo.
- **Cuándo se invoca:** tras cualquier cambio en `src/features/**/data/*` o `src/shared/{utils,lib}/*`; también de forma proactiva sobre código sin cobertura.
- **Gates duros:** ninguno (escribe; no bloquea).
- **Justificación:** sólo 4 archivos `.test.ts` en todo `src/` mientras hay ≥15 repositorios y stores activos. Cobertura crítica nula sobre `walletRepository`, `goalsRepository`, `depositsRepository`, `lessonProgressRepository`, `userRepository`, `useUserStore`, `pinCrypto`.

### 1.5 Test-Reviewer

- **Capa:** Tests
- **Responsabilidad:** Audita tests nuevos/modificados. Detecta tests que verifican implementación en lugar de comportamiento, mocks que esconden errores reales (especialmente sobre Firestore), tests deterministas con sleeps, y cobertura aparente vs. real. **No** escribe tests.
- **Input:** diff de tests + módulo bajo prueba.
- **Output:** veredicto `pass`/`needs-rework` + comentarios.
- **Cuándo se invoca:** después de `Test-Writer`, antes de aceptar el commit de tests.
- **Gates duros:** **bloquea merge** de tests con `expect(true).toBe(true)`, mocks sin assertion sobre args, o cobertura de happy-path sin error-path en repositorios.
- **Justificación:** el feedback de `docs/COMPLIANCE.md` deja claro que el código debe asumir hostilidad sobre datos de menores; un test verde con mock equivocado es peor que no tenerlo.

### 1.6 COPPA-GDPRK-Guard

- **Capa:** Seguridad / Cumplimiento
- **Responsabilidad:** Audita cambios que puedan introducir PII de menores o eventos con datos identificables. Cubre: `logEvent.ts`, `crashlytics.ts`, `analytics`, nuevos campos de `users/{uid}` o `aiProfile`, copy de consentimiento, edad mínima. Verifica que MIN_AGE=13 se respete en `UserSetupScreen`.
- **Input:** diff de cualquier archivo bajo `src/shared/lib/analytics/*`, `src/services/ai/*`, `src/features/auth/screens/*`, `firestore.rules`.
- **Output:** lista de violaciones + sugerencia de remediación.
- **Cuándo se invoca:** auto en cualquier diff que toque los paths anteriores; obligatorio antes de cualquier release.
- **Gates duros:** **bloquea merge** si detecta nombres/correos de menor en parámetros de analytics, campos PII sin justificación o sin consentimiento documentado, o cambio que baje MIN_AGE.
- **Justificación:** `docs/COMPLIANCE.md` es explícito: "Eventos evitan PII de menores en parámetros". Sin este gate, cualquier nuevo `logEvent('xxx', { name, email })` rompe COPPA silenciosamente.

### 1.7 TypeCheck-Lint-Gate

- **Capa:** Calidad
- **Responsabilidad:** Ejecuta `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test` localmente antes de marcar listo cualquier cambio. **No** modifica código (excepto `prettier --write` automático).
- **Input:** working tree con cambios.
- **Output:** reporte pass/fail por step.
- **Cuándo se invoca:** al cierre de toda tarea que tocó código TS/TSX.
- **Gates duros:** **bloquea commit** si falla cualquiera de los 4 steps. Replica exactamente lo que corre `ci.yml`.
- **Justificación:** el repo ya tiene Husky pre-commit pero sólo corre `lint-staged` (prettier); typecheck y tests sólo corren en CI, dejando que diffs rotos lleguen al PR. Este gate cierra ese hueco.

### 1.8 E2E-Maestro-Author

- **Capa:** Tests
- **Responsabilidad:** Mantiene la suite Maestro como verificación real, no decorativa. Convierte `e2e/maestro/smoke.yaml` (hoy 2 líneas: `launchApp` + `assertVisible: 'Ceti'`) en flujos vivos: login OAuth con cuenta de prueba, onboarding `user-setup` (incluyendo gate MIN_AGE=13), completar una lección, crear meta, registrar depósito y validar saldo en `wallet/state`. Añade flujos nuevos cada vez que aparezca una feature crítica.
- **Input:** flujo o feature objetivo, selectores estables, credenciales de cuenta de prueba.
- **Output:** YAMLs en `e2e/maestro/`, doc de ejecución local (Maestro Studio + CLI), checklist de pre-release.
- **Cuándo se invoca:** desde el día 1 sobre `smoke.yaml`; tras cualquier feature crítica nueva; antes de cualquier release a beta o producción.
- **Gates duros:** **bloquea a `EAS-Release-Manager`** — ningún `eas build --profile preview/production` puede salir sin smoke verde en device/emulador. También bloquea cualquier PR que rompa un flujo Maestro ya existente.
- **Justificación:** Ceti llega a usuarios reales adolescentes (13+) con flujos sensibles de onboarding y ahorro. Que el smoke actual sea `assertVisible: 'Ceti'` equivale a no tener E2E; promover este agente al núcleo lo hace responsabilidad permanente, no extensión opcional.

---

## 2. Extensiones (activadas a demanda)

### 2.1 AI-Service-Integrator

> **DIFERIDO por invariante (MVP):** `CLAUDE.md` prohíbe IA generativa en el MVP
> ("Where is the course weak?" se computa con reglas simples, no ML; bancos
> generativos/adaptativos son V3+). No activar sin levantar el invariante
> (actualizar `CLAUDE.md` + regla en el mismo cambio).

- **Capa:** Dominio
- **Responsabilidad:** Sustituye los stubs de `src/services/ai/aiService.ts` (`adaptQuestion`, `getRecommendedPath`, `analyzeWeaknesses`) por integración real con Claude API. Implementa prompt caching, manejo de errores, cuotas. Coordina con `AIProfile-Functions-Migrator` si la llamada debe moverse a Functions por seguridad.
- **Input:** stubs actuales + tipos de `aiService.types.ts` + perfil de usuario en `users/{uid}/aiProfile`.
- **Output:** implementación, tests, doc de coste.
- **Cuándo se invoca:** cuando el producto decida activar AI personalization.
- **Gates duros:** debe pasar `COPPA-GDPRK-Guard` (PII de menor a proveedor externo) y `Firestore-Rules-Auditor` (paths de `aiProfile`).
- **Justificación:** los stubs llevan comentarios `TODO(AI): call AI provider` explícitos en `src/services/ai/aiService.ts:36, 58, 79`.

### 2.2 AIProfile-Functions-Migrator

> **OBSOLETO / DIFERIDO:** la deuda que justificaba este agente ya no existe —
> `firestore.rules` actual define `match /aiProfile/{docId} { allow write: if false; }`
> (bloqueo de escritura cliente ya aplicado; lectura sólo `isSelf`). La pieza de
> Function queda diferida junto con la IA (invariante MVP, ver 2.1).

- **Capa:** Dominio · **tarea única y acotada**
- **Responsabilidad:** **Migrar la escritura de `users/{uid}/aiProfile/state` desde el cliente a Cloud Functions.** Concretamente: (a) implementar una Callable / Firestore-triggered Function en `functions/src/` que reciba la actualización validada, (b) cambiar `firestore.rules:47-50` para `allow write: if false` en `aiProfile/{docId}` dejando lectura sólo a `isSelf`, (c) reemplazar las llamadas cliente directas por invocación a la Function, (d) añadir tests de seguridad: cliente no autorizado intentando escribir debe recibir `permission-denied`. **No** se expande a otras Cloud Functions: este agente nace y muere con la migración del perfil de IA.
- **Input:** estado actual de `firestore.rules`, `functions/src/index.ts` (hoy `export {};`), llamadas cliente que escriben `aiProfile` (búsqueda por `userAiProfileDocRef`).
- **Output:** función desplegada, regla actualizada, diff cliente, prueba de regresión.
- **Cuándo se invoca:** **una sola vez**, como pre-requisito para soltar `AI-Service-Integrator` a producción.
- **Gates duros:** debe pasar `Firestore-Rules-Auditor` (cambio de `allow write` cliente→Admin SDK) y `COPPA-GDPRK-Guard` (campos PII saliendo del cliente).
- **Justificación:** `firestore.rules:47` lleva el comentario explícito _"Perfil de IA: escrito por el cliente (MVP). En producción migrar a Cloud Functions."_ y `functions/src/index.ts` sólo contiene `export {};`. Es deuda anotada con scope cerrado; no necesita un agente genérico de Functions.

### 2.3 Dependency-Auditor

- **Capa:** Seguridad
- **Responsabilidad:** Corre `npm audit --audit-level=high` (cliente y `functions/`), verifica compatibilidad de versiones Expo SDK 54 / RN 0.81 / Firebase 12 / Reanimated 4 al actualizar.
- **Input:** `package.json`, `package-lock.json`.
- **Output:** reporte de vulnerabilidades + sugerencia de bump.
- **Cuándo se invoca:** cron semanal; al actualizar cualquier dependencia.
- **Gates duros:** bloquea PR que añada un paquete con vulnerabilidad `high` sin justificación.
- **Justificación:** CI actual ya ejecuta `npm audit --audit-level=high` de forma bloqueante; este agente procesa el ruido (deduplica, prioriza, propone bumps) en lugar de fallar el build sin contexto.

### 2.4 OAuth-Auth-Specialist

- **Capa:** Dominio
- **Responsabilidad:** Toda modificación a `LoginScreen.tsx`, `oauth.ts`, `authSession.ts`, `authProfileBootstrap.ts`, `useAuthStore`, integración Google/Apple Sign-In, persistencia `initializeAuth` + `getReactNativePersistence`. Verifica SHA-1 en Android, `iosUrlScheme`, flag `EXPO_PUBLIC_FEATURE_APPLE_SIGNIN`.
- **Input:** issue/cambio de auth.
- **Output:** diff + checklist de validación en device.
- **Cuándo se invoca:** cualquier ticket que toque login/onboarding.
- **Gates duros:** debe pasar `COPPA-GDPRK-Guard`.
- **Justificación:** `.env.example` y `app.config.js` muestran que la configuración OAuth tiene 3 client IDs distintos + URL scheme condicional + un flag de feature; un error suele manifestarse como `DEVELOPER_ERROR` opaco en device.

### 2.5 i18n-Curator

- **Capa:** Cliente
- **Responsabilidad:** Garantiza que toda string visible al usuario use `t('...')` y exista en `src/shared/i18n/locales/es.json`. Detecta strings hardcoded en `*.tsx`. Prepara estructura para añadir idiomas futuros.
- **Input:** diff de pantallas / componentes.
- **Output:** patch a `es.json` + reemplazos en JSX.
- **Cuándo se invoca:** tras `Mobile-Feature-Builder` en cualquier pantalla nueva.
- **Gates duros:** ninguno; recomendación.
- **Justificación:** `react-i18next` ya está instalado y `app/_layout.tsx` importa `@shared/i18n`; sin curador, los devs caerán en string-literals y romperán la futura localización.

### 2.6 EAS-Release-Manager

- **Capa:** Docs+Deploy
- **Responsabilidad:** Maneja `eas.json` (perfiles `development`/`preview`/`production`), runtime versions, channels OTA, `expo-updates`. Coordina builds antes de release.
- **Input:** versión a sacar, tipo de release.
- **Output:** comandos `eas build` / `eas update`, changelog.
- **Cuándo se invoca:** release a beta interna o producción.
- **Gates duros:** **bloqueado por `E2E-Maestro-Author`** — no procede ningún build de `preview`/`production` sin smoke verde y al menos un flujo Maestro real (onboarding + lesson + deposit) ejecutado.
- **Justificación:** `eas.json` ya tiene tres perfiles y `app.config.js` linka un `EAS_PROJECT_ID` fijo — la operación de release requiere conocer ese pipeline y verificarlo contra usuarios reales antes de subir.

---

## 3. Mapa de conexiones

### 3.1 Cadenas secuenciales (A → B)

```
Orchestrator
   └── Mobile-Feature-Builder
          ├── TypeCheck-Lint-Gate          (obligatorio)
          ├── Test-Writer
          │      └── Test-Reviewer         (obligatorio)
          └── i18n-Curator                  (si hay strings)

Orchestrator
   └── (cambio de firestore.rules o nuevo path)
          └── Firestore-Rules-Auditor      (gate hard)

Orchestrator
   └── (cambio en auth / analytics / aiProfile / edad)
          └── COPPA-GDPRK-Guard            (gate hard)

Orchestrator
   └── AI-Service-Integrator
          ├── AIProfile-Functions-Migrator  (si la llamada se mueve a server)
          ├── Firestore-Rules-Auditor       (paths nuevos)
          └── COPPA-GDPRK-Guard             (PII saliente)

Orchestrator
   └── (feature crítica nueva)
          └── E2E-Maestro-Author            (añade flujo Maestro)

Orchestrator
   └── EAS-Release-Manager
          └── E2E-Maestro-Author            (gate hard: smoke verde)
```

### 3.2 Pares paralelos (A ∥ B)

- `Test-Writer` ∥ `Mobile-Feature-Builder` (cuando los tests apuntan a módulos puros como `xp`, `pinCrypto`, repositorios sin UI).
- `Firestore-Rules-Auditor` ∥ `COPPA-GDPRK-Guard` (ven el mismo diff pero auditan ángulos distintos).
- `i18n-Curator` ∥ `Test-Writer` (después de `Mobile-Feature-Builder`).
- `E2E-Maestro-Author` ∥ `Test-Writer` (Maestro cubre flujos device, Jest cubre unidades).

### 3.3 Independientes (a demanda / cron)

- `Dependency-Auditor` — cron semanal.
- `OAuth-Auth-Specialist` — sólo cuando un ticket toca auth.
- `AIProfile-Functions-Migrator` — una sola vez, como pre-requisito de AI en producción.

### 3.4 Tabla de gates duros

| Agente que bloquea        | A quién bloquea                                 | Por qué                                                                                                                               |
| ------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `TypeCheck-Lint-Gate`     | Cualquier commit con código TS/TSX              | El CI ya lo exige; falta cerrar el hueco pre-PR                                                                                       |
| `Firestore-Rules-Auditor` | Merge a `master` con diff en `firestore.rules`  | Riesgo de exponer datos de usuario; `aiProfile` ya marcado como deuda                                                                 |
| `COPPA-GDPRK-Guard`       | Merge que toque analytics, auth, aiProfile, age | MIN_AGE=13, consentimiento parental documentado en `docs/COMPLIANCE.md`                                                               |
| `Test-Reviewer`           | Tests escritos por `Test-Writer`                | Evitar verde falso por mock erróneo                                                                                                   |
| `E2E-Maestro-Author`      | `EAS-Release-Manager` (núcleo → release)        | Usuarios reales adolescentes con flujos de onboarding y ahorro; smoke real obligatorio antes de cualquier build de preview/production |
| `Dependency-Auditor`      | PR que añada paquete con vuln `high`            | `npm audit` ya es bloqueante en CI; este agente procesa los hallazgos                                                                 |

---

## 4. CI/CD — jobs recurrentes

### 4.1 Cron propuesto

| Agente                                         | Cron                  | Justificación                                                                      |
| ---------------------------------------------- | --------------------- | ---------------------------------------------------------------------------------- |
| `Dependency-Auditor`                           | `0 8 * * MON` (lunes) | `npm audit` semanal; Expo SDK suele tener parches cada 1–2 semanas                 |
| `Firestore-Rules-Auditor` (auditoría completa) | `0 10 * * SUN`        | Aunque corre en PR, una pasada full semanal evita drift                            |
| `E2E-Maestro-Author`                           | `0 6 * * *` (diario)  | Smoke contra emulador en CI nocturno detecta regresiones antes del próximo release |

### 4.2 Workflow GitHub Actions sugerido

Añadir a `.github/workflows/` un nuevo archivo `security-audit.yml`:

```yaml
name: Security Audit (weekly)

on:
  schedule:
    - cron: '0 8 * * 1' # lunes 08:00 UTC
  workflow_dispatch:

jobs:
  npm-audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: npm
      - run: npm ci
      - name: Audit (root)
        run: npm audit --audit-level=high
      - name: Audit (functions)
        working-directory: functions
        run: npm ci && npm audit --audit-level=high

  firestore-rules-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - name: Install Firebase tools
        run: npm install -g firebase-tools
      - name: Validate rules syntax
        run: firebase --project=demo emulators:exec --only firestore "echo OK"
```

`ci.yml` ya corre `npm audit --audit-level=high` de forma bloqueante (sin `continue-on-error`); `Dependency-Auditor` se encarga semanalmente de mantener limpio el árbol para que ese gate no se vuelva un freno arbitrario.

---

## 5. Restricciones honradas

- 12 agentes totales (8 núcleo + 4 extensiones). Bajo el límite de 20.
- El núcleo creció a 8 (sobre el original de 7) por decisión explícita: `E2E-Maestro-Author` se promueve porque los usuarios son adolescentes con flujos sensibles, no es opcional.
- Ningún agente es genérico: cada justificación cita un archivo o estado concreto del repo.
- `Orchestrator` es el único punto de entrada.
- `Test-Writer` y `Test-Reviewer` están en el núcleo (justificado por la cobertura actual: 4 tests para todo `src/`).
- `AIProfile-Functions-Migrator` tiene scope cerrado (no es autor genérico de Cloud Functions).
- Nombres en inglés, descriptivos, sin metáforas.

---

## 6. Historial

- **v1 — 2026-05-27** — diseño inicial, post-refactor single-user.
- **v2 — 2026-05-27** — `Firebase-Functions-Author` renombrado a `AIProfile-Functions-Migrator` con scope cerrado a la migración de `aiProfile`. `E2E-Maestro-Author` promovido de Extensiones a Núcleo (1.8), con gate duro sobre `EAS-Release-Manager`. `ci.yml` deja de tolerar fallos de `npm audit`.
- **v3 — 2026-05-27** — Eliminado `Dead-Code-Pruner`: la limpieza one-shot que justificaba su existencia se ejecutó (Skia desinstalado, referencias a `childId`/`familyId`/`features/world`/`features/family`/`CoinCatch` ya no existen en `src/`). Eliminado `Docs-Updater`: `README.md` y `docs/COMPLIANCE.md` se sanearon manualmente como parte de esta misma pasada; no hay deuda documental pendiente que justifique un agente vigilante. Total: 14 → 12 agentes.
- **v4 — 2026-06-03** — Refresco al contexto **B2B2C** (pivot ≈ Fase 12): §0 reescrito (multi-tenant `colegio→curso→estudiante`, roles, Cloud Functions reales de claims/Ley 1581/class-codes/super-admin, feature `dashboard`, `test:rules`); zonas de riesgo recalibradas a aislamiento de tenant, regresión de permisos por rol y `classCodes` no enumerables. `Firestore-Rules-Auditor` (1.3) actualizado a aislamiento de tenant + `test:rules` (su justificación citaba un comentario de `aiProfile` ya removido). `AI-Service-Integrator` (2.1) y `AIProfile-Functions-Migrator` (2.2) marcados DIFERIDO/OBSOLETO por invariante MVP (sin IA generativa; `aiProfile` ya `allow write: if false`). Añadido enlace a `docs/HARNESS.md` como capa de ejecución.
