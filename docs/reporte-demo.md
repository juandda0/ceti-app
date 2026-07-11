# Reporte — Modo Demo (Simulación Ceti) · RQ-DM

> **[Actualizado por D-PIVOT 2026-07-09]** El demo ahora expone solo 2 perfiles
> (profesor, estudiante); admin es backend sin UI.

> Acceso de un toque a los 2 perfiles sobre un colegio simulado, con jaula de
> seguridad en `firestore.rules` **y** Cloud Functions. Gates verdes; vetos D4
> (AR + CP) en `pass`. Spec: `docs/requerimientos.md` §10. Decisiones:
> `docs/decisiones.md` (D-DEMO-01..04).

## 1. Cómo funciona el acceso demo

1. En la pantalla de login (`src/features/auth/screens/LoginScreen.tsx`), bajo el
   auth normal, hay una sección **"Simulación Ceti"** con 2 botones:
   Profesor · Estudiante.
2. Al tocar un botón, el cliente llama la Cloud Function pública
   **`demoLogin({ role })`** → devuelve `{ token }` (custom token).
3. El cliente hace `signInWithCustomToken(auth, token)`. El pipeline normal
   (`onAuthStateChanged` → `readCetiClaims`) toma el control y enruta al
   dashboard/juego del rol — **sin credenciales, sin tocar `firestore.rules`**.
4. Los 2 usuarios demo llevan los **mismos** claims que un usuario real
   (`role` + `colegioId`/`cursoId`) **+ `demo:true`** (D-DEMO-01).

| Botón      | uid (fijo)        | claims                                                                          |
| ---------- | ----------------- | ------------------------------------------------------------------------------- |
| Profesor   | `demo-profesor`   | `{ role:'profesor', demo:true, colegioId:'demo-colegio' }`                      |
| Estudiante | `demo-estudiante` | `{ role:'estudiante', demo:true, colegioId:'demo-colegio', cursoId:'demo-9A' }` |

`demoLogin` es público pero **no parametrizable**: `role` solo selecciona uno de
los 2 pares `(uid, claims)` fijos en `DEMO_USERS`; ningún input produce uid/claims
arbitrarios (verificado por AR + CP).

## 2. Mapa del colegio simulado (`colegios/demo-colegio`)

Sembrado por `scripts/seedDemo.ts` (Admin SDK, idempotente):

- **1 colegio** `demo-colegio` ("Colegio Demo Ceti", `sedesEnabled:false`).
- **3 cursos**, uno por grado, cada uno con su código de unión y su profesor:
  | curso | grado | código | profesor | estudiantes |
  | ---------- | :---: | -------- | --------------- | :---------: |
  | `demo-9A` | 9 | `DEMO9A` | `demo-profesor` | ~20 + demo |
  | `demo-10A` | 10 | `DEMO10A`| `demo-profesor-2` | ~20 |
  | `demo-11A` | 11 | `DEMO11A`| `demo-profesor-3` | ~20 |
- **~60 estudiantes sintéticos** (nombres españoles, emails `@demo.ceti`, solo
  `email`+`nombre`, `estado:'activo'`, `atestado:true`). Progreso **variado**:
  unos terminaron los 5 mundos, otros a mitad, otros recién empiezan → ~~XP/niveles/
  badges~~ `mastery`/`quizScores` repartidos, `impactTest/pre` para todos y `post`
  para los que completaron (delta de impacto no vacío). _[ENMENDADO por D-CUT:
  XP/niveles/badges retirados; la demo se apoya en `mastery`.]_
- **Agregados por curso** (`agregados/{competencia}`): `masteryPromedio` +
  contadores `eligeCamino` A/B — computados **solo** desde los sintéticos.
- **El estudiante demo** (`demo-estudiante`, en `demo-9A`): **progreso CERO**,
  `activo` + `atestado` (puede jugar de inmediato). Es el único en cero, y está
  **excluido de los agregados**.
- El **profesor demo** y el **estudiante demo** comparten `demo-9A`.

## 3. Jaula de seguridad (RQ-DM05, en rules + functions)

**Insight:** el profesor/estudiante demo ya quedan confinados
por su claim `colegioId:'demo-colegio'` (vía `sameColegio`). El único rol global es
el `admin` (backend, sin UI ni perfil demo), sobre el que la jaula `isDemo()` sigue
vigente en `firestore.rules` por diseño defensivo.

- **`firestore.rules`:** `isDemo()` (accessor seguro `token.get('demo',false)`) +
  `adminHere(cid) = isAdmin() && (!isDemo() || cid=='demo-colegio')`. **Todo**
  `isAdmin()` cid-scoped del subárbol `colegios/{cid}` se reemplazó por
  `adminHere(cid)`; el collection-group de progreso guarda al admin demo a
  `demo-colegio`. Un admin **real** (sin `demo`) sigue global.
- **Cloud Functions:** `assertDemoScope(caller, colegioId)` (lanza si demo y
  colegio ≠ demo) aplicado en `assertStaffOfCurso` (antes del bypass admin),
  `createCurso` y `joinByCode`; `assertNotDemo` bloquea a demo en `assignRole` y
  `registerColegio`; `listColegios` devuelve solo el demo colegio a un demo.
- **Tests (`scripts/testFirestoreRules.mjs`):** sección "Demo cage" — el admin demo
  es **denegado** al leer/crear en el colegio real `A` y en collection-group sobre
  `A`, y **permitido** dentro de `demo-colegio`. **test:rules: 78/78.**

## 4. Reseteo del estudiante demo (RQ-DM06)

`demoLogin('estudiante')` borra `progress` + `impactTest` del `demo-estudiante`
**antes** de devolver el token → cada demo empieza fresca. Como los agregados se
computan **excluyendo** al estudiante demo (D-DEMO-03), el reseteo nunca los
corrompe.

## 5. Guion sugerido de demostración (máximo efecto)

1. **Estudiante demo** primero: entra en cero, muestra el mapa de mundos y el
   flujo desde el inicio (pre-test → Mundo 1). Deja claro que es "el alumno nuevo".
2. **Profesor demo** (mismo salón `demo-9A`): dashboard lleno — roster de ~20,
   progreso por estudiante/mundo, diagnóstico por reglas, asignaciones, exporte.
   También opera su curso (código de unión, atestación) y consume la reportería
   institucional agregada (sin dato nominal del menor, por grado/curso) con el
   delta de impacto pre/post.

## 6. Deploy (RQ-DM07)

> Requiere credenciales Firebase del dueño (Blaze + `firebase login`/service
> account). Pasos exactos:

```bash
# 1. Desplegar rules + functions (incluye demoLogin y la jaula)
cd functions && npm run build && cd ..
npx firebase-tools@latest deploy --only firestore:rules,functions --project <PROJECT_ID>

# 2. Sembrar el colegio demo (Admin SDK; crea los 2 usuarios demo + datos vivos)
$env:GOOGLE_APPLICATION_CREDENTIALS = "<ruta service account>"
$env:GOOGLE_CLOUD_PROJECT = "<PROJECT_ID>"
npx ts-node --project tsconfig.scripts.json scripts/seedDemo.ts

# 3. Build web + deploy hosting
npx expo export --platform web
npx firebase-tools@latest deploy --only hosting --project <PROJECT_ID>

# 4. Verificar en la URL real: entrar con los 2 accesos y confirmar datos.
```

**Estado del deploy (HECHO — 2026-06-19):** Modo Demo en vivo en
**https://ceti-d3769.web.app**. El deploy todo-o-nada se completó con éxito; el
smoke test (`demoLogin(profesor)` → custom token, hosting HTTP 200) pasó.

**Setup real que hizo falta** (más allá de los pasos 1–4 de arriba), documentado
para reproducir un futuro deploy:

1. **ADC del dueño** — `gcloud auth application-default login` y luego
   `gcloud auth application-default set-quota-project ceti-d3769`. firebase-tools
   debe usar la cuenta `juandiegodiazave@gmail.com` (es la que ve `ceti-d3769`):
   `firebase login:use juandiegodiazave@gmail.com`.
2. **`FUNCTIONS_DISCOVERY_TIMEOUT=120`** antes del deploy de functions — en
   Windows/cold-start el discovery excede los 10 s por defecto y aborta con
   `Cannot determine backend specification. Timeout after 10000`.
3. **Borrar 3 functions legacy** del modelo pre-pivot que aún vivían en el
   proyecto y bloqueaban el deploy en modo no-interactivo:
   ```bash
   firebase functions:delete bootstrapColegio setAuthorizationStatus setMemberClaims --region us-central1 --force
   ```
4. **Conceder Token Creator a la SA de runtime** (requisito de
   `auth.createCustomToken()` que usa `demoLogin`; sin esto da 500
   `iam.serviceAccounts.signBlob denied`):
   ```bash
   gcloud iam service-accounts add-iam-policy-binding \
     932622471052-compute@developer.gserviceaccount.com \
     --member="serviceAccount:932622471052-compute@developer.gserviceaccount.com" \
     --role="roles/iam.serviceAccountTokenCreator" --project=ceti-d3769
   ```
   (La propagación IAM tarda ~1 min antes de que `demoLogin` deje de dar 500.)

**Pendiente del dueño:** verificación final en navegador entrando con los 2
accesos en https://ceti-d3769.web.app. Todo el código está commit+tag
(`demo-mode`), con gates verdes y vetos AR+CP en `pass`.
