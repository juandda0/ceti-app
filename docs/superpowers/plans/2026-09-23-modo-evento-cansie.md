# Modo evento CANSiE Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publicar Ceti web para CANSiE con acceso Google de visitante, finanzas y los cinco mundos básicos sin experiencia académica ni acceso visible de profesor.

**Architecture:** Se conserva Firebase Auth y el perfil actual. El visitante usa la intención `estudiante`, que ya evita aprovisionar un profesor en `resolveMyAccess`; la ruta raíz lo dirige a la aplicación pública aunque no tenga clase. Aprendizaje reutiliza los fallbacks existentes sin tenant: grado `9`, configuración nula y mundos canónicos.

**Tech Stack:** Expo Router, React Native Web, TypeScript, Jest, Firebase Auth, Firebase Hosting.

## Global Constraints

- No añadir dependencias.
- La interfaz pública usa vocabulario general, sin profesor, estudiante, clase, competencia, tarea o asignación.
- El acceso público ofrece solo Google y no crea usuarios anónimos.
- Mantener las rutas y servicios de profesor; solo ocultarlos del recorrido público.
- Antes de publicar, resolver el cherry-pick activo y preservar todos los cambios ajenos del árbol de trabajo.

---

### Task 1: Acceso público de visitante

**Files:**

- Modify: `src/features/auth/screens/WelcomeScreen.tsx`
- Modify: `src/features/auth/screens/LoginScreen.tsx`
- Modify: `src/shared/i18n/locales/es.json`
- Test: `src/features/auth/screens/LoginScreen.test.tsx`

**Interfaces:**

- Consumes: `loginIntent.set('estudiante')` antes de `signInWithGoogle()`.
- Produces: una única acción pública de autenticación que no abre selector de rol ni Apple.

- [ ] **Step 1: Write the failing test**

```tsx
test('inicia Google como visitante sin abrir selector de rol', async () => {
  render(<LoginScreen />);

  fireEvent.press(screen.getByRole('button', { name: 'Entrar como invitado' }));

  await waitFor(() => expect(signInWithGoogle).toHaveBeenCalledTimes(1));
  expect(loginIntent.set).toHaveBeenCalledWith('estudiante');
  expect(screen.queryByText('¿Cómo usarás Ceti?')).toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/features/auth/screens/LoginScreen.test.tsx --runInBand`

Expected: FAIL because the current screen labels its button `Continuar con Google` and opens the role sheet.

- [ ] **Step 3: Write minimal implementation**

```tsx
const onGoogle = () => {
  loginIntent.set('estudiante');
  void doSignIn();
};

<CetiButton label="Entrar como invitado" icon="logo-google" onPress={onGoogle} />
```

Remove the Apple provider, `pendingProvider`, `CetiBottomSheet`, `TouchableOpacity`, `isAppleSignInAvailable`, `signInWithApple`, and the role chooser. In `WelcomeScreen`, keep a single primary button with `label="Entrar como invitado"`; remove the secondary account action and offline shortcut from the public screen. Replace affected `welcome` copy in `es.json` with visitor-oriented text.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/features/auth/screens/LoginScreen.test.tsx --runInBand`

Expected: PASS with one test.

- [ ] **Step 5: Commit after the active cherry-pick is resolved**

```bash
git add src/features/auth/screens/WelcomeScreen.tsx src/features/auth/screens/LoginScreen.tsx src/features/auth/screens/LoginScreen.test.tsx src/shared/i18n/locales/es.json
git commit -m "feat(auth): simplifica acceso de visitante"
```

### Task 2: Onboarding sin código de clase

**Files:**

- Modify: `src/features/auth/onboarding/UserSetupScreen.tsx`
- Modify: `src/shared/i18n/locales/es.json`
- Test: `src/features/auth/onboarding/UserSetupScreen.test.tsx`

**Interfaces:**

- Consumes: `userRepository.upsertProfile()` y `useAuthStore.getState().login()`.
- Produces: perfil de visitante con nombre y avatar, seguido por `router.replace('/')`.

- [ ] **Step 1: Write the failing test**

```tsx
test('termina después de elegir nombre y avatar sin pedir código', async () => {
  render(<UserSetupScreen />);

  fireEvent.changeText(screen.getByPlaceholderText('Tu nombre...'), 'Ana');
  fireEvent.press(screen.getByRole('button', { name: 'Siguiente' }));
  fireEvent.press(screen.getAllByRole('button', { name: 'Seleccionar avatar' })[0]);
  fireEvent.press(screen.getByRole('button', { name: 'Siguiente' }));
  fireEvent.press(screen.getByRole('button', { name: 'Comenzar' }));

  await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/'));
  expect(screen.queryByText('Únete a tu curso')).toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/features/auth/onboarding/UserSetupScreen.test.tsx --runInBand`

Expected: FAIL because the current fourth step renders `ClassCodeForm`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// Steps: 0 = name, 1 = avatar, 2 = welcome
if (step === 2) void finishSetup();
```

Remove `ClassCodeForm`, `joinClass`, `pendingInvite`, `classCode`, the fourth progress dot, and the `step === 3` branch. Make the final primary button call `finishSetup` and label it with `onboarding.start`. Update the welcome copy to invite the person to explore Ceti without retos or academic terms.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/features/auth/onboarding/UserSetupScreen.test.tsx --runInBand`

Expected: PASS with one test.

- [ ] **Step 5: Commit after the active cherry-pick is resolved**

```bash
git add src/features/auth/onboarding/UserSetupScreen.tsx src/features/auth/onboarding/UserSetupScreen.test.tsx src/shared/i18n/locales/es.json
git commit -m "feat(onboarding): elimina ingreso por clase"
```

### Task 3: Entrada y mundos básicos sin clase

**Files:**

- Modify: `app/index.tsx`
- Modify: `src/features/learning/screens/WorldsScreen.tsx`
- Modify: `app/(app)/saga/[worldId].tsx`
- Test: `src/features/learning/screens/WorldsScreen.test.tsx`

**Interfaces:**

- Consumes: `resolveClassWorlds(null, isCompleted)`, que devuelve `world_1` a `world_5`, y `useStudentGrado()`, que entrega grado `9` sin curso.
- Produces: visitantes autenticados sin tenant llegan a `/(app)/saga`, ven los cinco mundos básicos y mantienen el desbloqueo secuencial.

- [ ] **Step 1: Write the failing test**

```tsx
test('muestra los cinco mundos básicos sin clase', () => {
  mockAuthState({ colegioId: null, cursoId: null, firebaseUid: 'visitor-1' });
  mockClassConfig({ config: null, loaded: true });
  mockStudentGrade('9');

  render(<WorldsScreen />);

  expect(screen.getByText('Planeta Origen')).toBeTruthy();
  expect(screen.getByText('Agujero Negro de las Deudas')).toBeTruthy();
  expect(screen.queryByText('Únete a tu curso')).toBeNull();
});
```

Mock `useQuestionBankStore` with empty answers, stable getters, and `fetchWorldQuestions: jest.fn()`; mock `useClassConfig`, `useStudentGrado`, the three remote/class components and `ScreenWrapper`. Do not mock `resolveClassWorlds` or `worldMeta`: the test must render the real default list.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/features/learning/screens/WorldsScreen.test.tsx --runInBand`

Expected: FAIL because the current no-access branch renders `ClassCodeForm` instead of the list.

- [ ] **Step 3: Write minimal implementation**

In `app/index.tsx`, replace the no-class redirect with:

```tsx
setTarget('/(app)/saga');
```

In `WorldsScreen`, remove the no-access `ClassCodeForm` return, `StudentAssignmentsBanner`, `AuthorizationPendingBanner`, competency imports, and the competency tag in `WorldCard`. Permit the existing question prefetch with the default grade when no tenant exists. Keep course-specific remote progress and custom content guarded by `hasClassAccess`.

In `app/(app)/saga/[worldId].tsx`, remove only the early redirect that rejects a missing class. Keep `isWorldAccessible(classConfig, worldId, isWorldComplete)` so locked worlds remain inaccessible.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/features/learning/screens/WorldsScreen.test.tsx app/(app)/app-tabs.test.tsx --runInBand`

Expected: PASS with the default world order and all five public tabs intact.

- [ ] **Step 5: Commit after the active cherry-pick is resolved**

```bash
git add app/index.tsx app/(app)/saga/[worldId].tsx src/features/learning/screens/WorldsScreen.tsx src/features/learning/screens/WorldsScreen.test.tsx
git commit -m "feat(learning): habilita mundos para visitantes"
```

### Task 4: Copia pública y cuestionarios

**Files:**

- Modify: `src/features/learning/screens/WorldQuizScreen.tsx`
- Modify: `src/shared/i18n/locales/es.json`
- Test: `app/(app)/app-tabs.test.tsx`

**Interfaces:**

- Consumes: las pestañas `saga`, `dinero`, `actividad`, `metas`, `profile`.
- Produces: el cuestionario no muestra competencias y la navegación pública sigue limitada a las cinco pestañas actuales.

- [ ] **Step 1: Write the failing test**

```tsx
test('mantiene solo las cinco pestañas públicas', () => {
  render(<AppTabLayout />);

  expect(mockTabNames).toEqual(['saga', 'dinero', 'actividad', 'metas', 'profile']);
  expect(mockTabNames).not.toContain('staff');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- app/(app)/app-tabs.test.tsx --runInBand`

Expected: FAIL until the explicit public-route assertion is added to the existing test.

- [ ] **Step 3: Write minimal implementation**

Remove `currentQuestion.competencia` and its `concept` style from `WorldQuizScreen`. Update only public text keys used by Welcome, Login, Onboarding, Worlds, Saga and Quiz with general terms such as `Explorar`, `Mundos`, `pregunta` and `progreso`; do not alter staff-only keys.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- app/(app)/app-tabs.test.tsx --runInBand`

Expected: PASS with the exact five tab names.

- [ ] **Step 5: Commit after the active cherry-pick is resolved**

```bash
git add app/(app)/app-tabs.test.tsx src/features/learning/screens/WorldQuizScreen.tsx src/shared/i18n/locales/es.json
git commit -m "feat(web): adapta copia para visitantes"
```

### Task 5: Verificación y despliegue web de producción

**Files:**

- Generate: `dist/` (artefacto de build; no se confirma).

**Interfaces:**

- Consumes: `firebase.json` con `hosting.public = "dist"`.
- Produces: Firebase Hosting actualizado con la exportación web validada.

- [ ] **Step 1: Validate all behavior locally**

Run:

```bash
npm test -- --runInBand
npm run typecheck
npm run lint
npx expo export --platform web
```

Expected: exit code 0 for cada comando y `dist/index.html` generado.

- [ ] **Step 2: Inspect deployment target**

Run: `firebase projects:list`

Expected: el proyecto activo de `.firebaserc` está disponible. No desplegar Functions ni reglas: este cambio no las modifica.

- [ ] **Step 3: Deploy Hosting only**

Run: `firebase deploy --only hosting`

Expected: Firebase CLI devuelve URL de Hosting de producción.

- [ ] **Step 4: Verify the live public route**

Abrir la URL devuelta y comprobar: la pantalla inicial tiene una sola acción visitante, dicha acción abre Google y la aplicación carga sin una ruta 404.

- [ ] **Step 5: Final source check**

Run:

```bash
git status --short
git diff --check
```

Expected: no incluir `dist/`, `.env` ni cambios ajenos.
