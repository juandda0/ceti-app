# Dark Theme Default Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hacer que CETI inicie en modo oscuro cuando no existe una preferencia persistida.

**Architecture:** Se conserva el store Zustand persistido y su API actual. El único cambio funcional es su valor inicial; la misma clave de almacenamiento mantiene intactas las preferencias existentes.

**Tech Stack:** TypeScript, Zustand 5, Jest 29.

## Global Constraints

- Mantener la clave `ceti-theme-storage`.
- No añadir migraciones ni dependencias.
- No modificar paletas, componentes o pantallas.

---

### Task 1: Tema inicial oscuro

**Files:**

- Create: `src/shared/store/useThemeStore.test.ts`
- Modify: `src/shared/store/useThemeStore.ts:15`

**Interfaces:**

- Consumes: `useThemeStore.getState()`, `useThemeStore.setState()` y `ThemeState.toggleTheme()` existentes.
- Produces: `ThemeState.mode` inicia en `'dark'` cuando no se rehidrata una preferencia.

- [x] **Step 1: Escribir la prueba que falla**

```ts
import { useThemeStore } from './useThemeStore';

describe('useThemeStore', () => {
  beforeEach(() => useThemeStore.setState({ mode: 'dark' }));

  it('inicia en modo oscuro', () => {
    expect(useThemeStore.getInitialState().mode).toBe('dark');
  });

  it('mantiene la alternancia entre oscuro y claro', () => {
    useThemeStore.getState().toggleTheme();
    expect(useThemeStore.getState().mode).toBe('light');
    useThemeStore.getState().toggleTheme();
    expect(useThemeStore.getState().mode).toBe('dark');
  });
});
```

- [x] **Step 2: Ejecutar la prueba y confirmar el fallo**

Run: `npm test -- --runInBand src/shared/store/useThemeStore.test.ts`

Expected: FAIL en `inicia en modo oscuro`, con valor recibido `light`.

- [x] **Step 3: Cambiar el valor inicial**

En `src/shared/store/useThemeStore.ts`, cambiar únicamente:

```ts
mode: 'dark',
```

- [x] **Step 4: Verificar la prueba y los checks estáticos**

Run: `npm test -- --runInBand src/shared/store/useThemeStore.test.ts`

Expected: PASS, 2 pruebas aprobadas.

Run: `npm run typecheck`

Expected: exit code 0.

Run: `npm run lint`

Expected: exit code 0 sin errores nuevos.

- [ ] **Step 5: Revisar y comprometer el cambio**

```bash
git diff --check
git diff -- src/shared/store/useThemeStore.ts src/shared/store/useThemeStore.test.ts
git add src/shared/store/useThemeStore.ts src/shared/store/useThemeStore.test.ts
git commit -m "feat(theme): usa modo oscuro por defecto"
```
