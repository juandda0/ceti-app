# Ceti backend (Spring Boot)

Reemplaza a Firebase (Auth, Firestore + rules, Cloud Functions, Hosting).
Spring Boot 4.1 · Java 21 · Postgres 16 (Flyway) · JWT propio.

## Correr en local

```bash
docker compose up --build        # desde la raíz: Postgres :5433 + API :8080
```

App Expo: `EXPO_PUBLIC_API_URL=http://localhost:8080`. Con `EXPO_PUBLIC_DEV_LOGIN=1`
(y `CETI_DEV_LOGIN=true` en el backend, ya puesto en compose) el login muestra
"Entrar (modo desarrollo)" para probar sin Google.

Tests (necesitan Docker para Testcontainers):

```bash
cd backend && mvn test
```

## Variables de entorno

| Variable | Obligatoria | Uso |
| --- | --- | --- |
| `DATABASE_URL`, `DATABASE_USER`, `DATABASE_PASSWORD` | sí | JDBC de Postgres |
| `CETI_JWT_SECRET` | sí | Firma HS256 de la sesión (≥ 32 bytes) |
| `CETI_GOOGLE_CLIENT_IDS` | sí | OAuth client IDs aceptados como `aud` (web, iOS, Android), coma-separados. El primero debe ser el Web |
| `CETI_GOOGLE_CLIENT_SECRET` | web | Secret del client Web (canje del code del popup) |
| `CETI_CORS_ORIGINS` | sí | Orígenes web permitidos |
| `GROQ_API_KEY` | IA | Asistente financiero y authoring docente |
| `CETI_ADMIN_EMAILS` | no | Admins extra (el raíz ya está en `application.yml`) |
| `CETI_TOKEN_TTL` | no | Vida del token (por defecto `30d`) |
| `CETI_DEV_LOGIN` | no | `true` solo en local/E2E. Nunca en producción |

## Modelo

- **Sesión:** `POST /api/auth/google` (`idToken` nativo o `code` del popup web) → `{token, user}`.
  El token solo lleva el id; rol y tenant se leen de la BD en cada request, así una
  supresión o un cambio de rol aplica al instante.
- **Autorización:** la matriz de `firestore.rules` vive en `tenancy/CursoAccess`
  (aislamiento de colegio, profesor del curso, gate de atestación Ley 1581). Las finanzas
  personales cuelgan de `/api/me/**`: el dueño sale del token, nunca de la URL.
- **Contenido global (R8):** `content/` se empaqueta en el jar y se sirve desde memoria.
  Cambiar un banco = commit + redeploy; no hay seed.
- **Agregados (RQ-FN09):** se calculan al leer desde `progress`, sin datos nominales.

| Antes (Firebase) | Ahora |
| --- | --- |
| `resolveMyAccess` / `joinByCode` | `POST /api/me/access`, `POST /api/me/join` |
| `crearMiCurso` | `POST /api/cursos` |
| `listColegios` / `registerColegio` | `GET/POST /api/admin/colegios` |
| `generateClassCode` | `POST /api/colegios/{cid}/cursos/{id}/codigo` |
| `atestar` / `suppressStudentData` | `POST …/estudiantes/{uid}/atestacion` · `…/supresion` |
| `planificarAccionesFinancieras` | `POST /api/ia/plan-financiero` |
| `generarBorradorMundo` / `generarItemContenido` | `POST /api/ia/borrador-mundo` · `/api/ia/item-contenido` |
| `onProgressWriteAggregate` (trigger) | `GET …/cursos/{id}/agregado` (calculado al leer) |
| `users/{uid}`, `goals`, `deposits`, `movimientos`, `config/presupuestos` | `/api/me`, `/api/me/finanzas`, `PUT/DELETE /api/me/{goals,deposits,movimientos,presupuestos}` |
| `cursos/{id}/config/mundos`, `contenido/*` | `GET/PUT/DELETE …/config`, `GET …/contenido/{docId}`, `POST …/contenido/batch` |
| `…/estudiantes/{uid}/progress/*` | `GET/PUT …/estudiantes/{uid}/progress[/{worldId}]` |
| `colegios/{cid}/asignaciones` | `POST /api/colegios/{cid}/asignaciones`, `GET …/cursos/{id}/asignaciones` |
| `bancos`, `bancosEligeCamino`, `microteoria` | `GET /api/content/{bancos,elige-camino,microteoria}/{id}` |

## Deploy

Imagen: `docker build -f backend/Dockerfile .` (contexto = raíz, porque empaqueta `content/`).
Corre en cualquier host de contenedores (Cloud Run, Fly, Render…) con un Postgres
gestionado. Health check: `GET /actuator/health`. La web se publica aparte (`vercel.json`).
