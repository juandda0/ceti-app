# Dependencias y Release Web Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corregir vulnerabilidades compatibles con Expo 54, clasificar remanentes y desplegar web solo tras auditoría completa verde.

**Architecture:** Dejar que npm aplique exclusivamente fixes semver compatibles; no usar `--force` ni overrides especulativos. Construir `dist/` con Expo y desplegar solo Firebase Hosting al proyecto `ceti-d3769`.

**Tech Stack:** npm, Expo SDK 54, Firebase CLI, Firebase Hosting.

## Global Constraints

- No usar `npm audit fix --force`.
- No actualizar Expo 54 ni Firebase Admin a un major en este plan.
- No desplegar Functions ni Firestore desde el comando de Hosting.
- Cualquier alerta alta/crítica bloquea este release; no se aceptan excepciones dentro del plan.
- Proyecto Firebase objetivo exacto: `ceti-d3769`.

---

### Task 1: Aplicar fixes compatibles

**Files:**

- Modify: `package-lock.json`
- Modify only if npm requires compatible direct bumps: `package.json`
- Modify: `functions/package-lock.json`
- Modify only if npm requires compatible direct bumps: `functions/package.json`

**Interfaces:**

- Consumes: rangos semver actuales de Expo 54 y Functions.
- Produces: lockfiles actualizados sin majors de plataforma.

- [ ] **Step 1: Capturar baseline**

```bash
npm audit --audit-level=high
npm --prefix functions audit --audit-level=high
npm ls expo firebase-admin --depth=0
```

- [ ] **Step 2: Aplicar solo fixes no breaking**

```bash
npm audit fix
npm --prefix functions audit fix
```

Expected: npm no propone/instala Expo 55+ ni Firebase Admin 14+.

- [ ] **Step 3: Revisar el diff antes de aceptar**

```bash
git diff -- package.json package-lock.json functions/package.json functions/package-lock.json
npm ls expo firebase-admin --depth=0
```

Expected: `expo@54.x` y `firebase-admin@13.x`; ningún cambio fuera de manifests/lockfiles.

- [ ] **Step 4: Verificar instalación y tests**

```bash
npm ci
npm --prefix functions ci
npm run typecheck
npx jest --runInBand
npm --prefix functions run build
```

Expected: todos exit `0`.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json functions/package.json functions/package-lock.json
git commit -m "fix(deps): aplica actualizaciones de seguridad compatibles [skip-rq]"
```

### Task 2: Clasificar vulnerabilidades remanentes

**Files:**

- Modify: none

**Interfaces:**

- Consumes: salida JSON posterior a Task 1.
- Produces: `pass` o bloqueo para preparar un plan de upgrade mayor.

- [ ] **Step 1: Ejecutar auditoría posterior**

```bash
npm audit --audit-level=high
npm --prefix functions audit --audit-level=high
```

- [ ] **Step 2: Resolver las rutas reportadas**

Ejecutar `npm ls --all` para los paquetes que el baseline actual reporta y repetir únicamente con cualquier nombre nuevo que muestre npm:

```bash
npm ls @babel/core @grpc/grpc-js brace-expansion fast-uri form-data image-size js-yaml nanoid postcss protobufjs shell-quote svgo tar tmp undici websocket-driver ws --all
npm --prefix functions ls @grpc/grpc-js fast-uri protobufjs undici --all
```

La salida identifica qué major directo bloquea la corrección compatible.

- [ ] **Step 3: Aplicar gate**

Si cualquiera de las dos auditorías termina distinto de `0`, detener el release y preparar un plan separado de upgrade mayor; no desplegar. Si ambas terminan en `0`, continuar sin crear archivos ni commits de evidencia.

### Task 3: Auditoría pre-release final

**Files:**

- Modify: none

**Interfaces:**

- Consumes: planes de privacidad, rules y dependencias completados.
- Produces: autorización binaria para build/deploy.

- [ ] **Step 1: Ejecutar gates completos**

```bash
npm run lint
npm run typecheck
npx jest --runInBand
npm run gates
npm audit --audit-level=high
```

Con JDK 21 en PowerShell:

```powershell
$env:JAVA_HOME='C:\Program Files\Java\jdk-21'
$env:Path=(Join-Path $env:JAVA_HOME 'bin') + ';' + $env:Path
npm run test:rules
```

Expected: todos exit `0`.

- [ ] **Step 2: Repetir revisiones humanas**

Ejecutar `compliance-privacidad` y `auditor-firestore-rules` sobre el diff completo. Expected: ambos `pass`. Cualquier `block` detiene el plan.

### Task 4: Exportar y probar web

**Files:**

- Generated, not committed: `dist/`

**Interfaces:**

- Consumes: código auditado.
- Produces: bundle estático web para Firebase Hosting.

- [ ] **Step 1: Exportar con entorno de producción**

PowerShell:

```powershell
$env:EXPO_PUBLIC_APP_ENV='production'
npx expo export --platform web
```

Expected: exit `0` y `dist/index.html` existe.

- [ ] **Step 2: Smoke local**

Servir `dist/` con una herramienta ya disponible en el repo/CLI y verificar en viewport 390×844 y escritorio:

- login/bienvenida carga sin errores de consola;
- `/saga` muestra Mundos;
- asignaciones del curso cargan sin permission-denied;
- registro por voz produce confirmación local y no genera request a `procesarRegistroVoz`.

Expected: cuatro checks pasan. No desplegar si alguno falla.

### Task 5: Desplegar exclusivamente Hosting

**Files:**

- Modify: none

**Interfaces:**

- Consumes: `dist/` verificado.
- Produces: release web en `https://ceti-d3769.web.app`.

- [ ] **Step 1: Confirmar proyecto y diff**

```bash
npx firebase use
git status --short
```

Expected: proyecto `ceti-d3769`; solo `.agents/` y `.codex/` pueden permanecer locales sin trackear.

- [ ] **Step 2: Deploy Hosting**

```bash
npx firebase deploy --only hosting --project ceti-d3769
```

Expected: exit `0` y CLI devuelve `https://ceti-d3769.web.app`.

- [ ] **Step 3: Smoke de producción**

Abrir la URL entregada y repetir bienvenida, `/saga`, asignaciones y parser local. Verificar consola sin errores nuevos.
