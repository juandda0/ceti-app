# Confirmación clara de finanzas por voz Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar una clasificación financiera comprensible después de escuchar, permitir corregirla y ejecutar solo al confirmar.

**Architecture:** `FinancialAssistantSheet` seguirá siendo la única pantalla de revisión del plan remoto. Añadirá un estado local de resumen/corrección y etiquetas de presentación para acciones de gasto, ahorro y meta; reutilizará la validación y ejecución existentes.

**Tech Stack:** Expo Router, React Native, TypeScript estricto, Zustand, Jest con Testing Library.

## Global Constraints

- No añadir dependencias ni rutas nuevas.
- No persistir acciones antes de pulsar Confirmar.
- El gasto exige una categoría válida; el ahorro puede elegir una meta; la creación de meta exige nombre y monto objetivo.
- Usar textos en español de `src/shared/i18n/locales/es.json`.

---

### Task 1: Especificar el resumen y el botón Corregir con pruebas

**Files:**
- Modify: `src/features/savings/components/FinancialAssistantSheet.test.tsx`
- Modify: `src/shared/i18n/locales/es.json`

**Interfaces:**
- Consumes: `FinancialPlan` con acciones de `movimiento`, `ahorro` y `meta`.
- Produces: pruebas que exigen que los detalles editables solo se muestren después de pulsar `Corregir`.

- [x] **Step 1: Escribir la prueba que falla**

```tsx
it('resume gasto, ahorro y meta antes de abrir Corregir', () => {
  const view = render(<FinancialAssistantSheet visible plan={plan} onChange={jest.fn()} onClose={jest.fn()} />);

  expect(view.getByText('Gasto')).toBeTruthy();
  expect(view.getByText('Categoría: Comida')).toBeTruthy();
  expect(view.getByText('Corregir')).toBeTruthy();
  expect(view.queryByLabelText('Monto de Almuerzo')).toBeNull();

  fireEvent.press(view.getByText('Corregir'));
  expect(view.getByLabelText('Monto de Almuerzo')).toBeTruthy();
});
```

- [x] **Step 2: Ejecutar la prueba para verificar que falla**

Run: `npx jest --runTestsByPath src/features/savings/components/FinancialAssistantSheet.test.tsx --runInBand --no-watchman`

Expected: FAIL porque el resumen y el botón `Corregir` aún no existen.

- [x] **Step 3: Añadir los textos de interfaz**

```json
"review": { "expense": "Gasto", "saving": "Ahorro", "newGoal": "Nueva meta", "category": "Categoría: {{value}}", "goal": "Meta: {{value}}", "noGoal": "Sin meta", "correct": "Corregir" }
```

- [x] **Step 4: Ejecutar la prueba para conservar su fallo de comportamiento**

Run: `npx jest --runTestsByPath src/features/savings/components/FinancialAssistantSheet.test.tsx --runInBand --no-watchman`

Expected: FAIL porque la hoja sigue mostrando el formulario sin pulsar Corregir.

### Task 2: Separar resumen de corrección en la hoja financiera

**Files:**
- Modify: `src/features/savings/components/FinancialAssistantSheet.tsx`
- Test: `src/features/savings/components/FinancialAssistantSheet.test.tsx`

**Interfaces:**
- Consumes: `FinancialAction`, `MOVIMIENTO_CATEGORIAS` y metas de `useSavingsStore`.
- Produces: `reviewKind(action)` para el tipo legible del resumen y un estado `editing` que revela los controles actuales.

- [x] **Step 1: Implementar el resumen mínimo**

```tsx
const [editing, setEditing] = useState(false);
useEffect(() => {
  if (visible) {
    setDraft(plan);
    setResults(null);
    setEditing(false);
  }
}, [plan, visible]);

function reviewKind(action: FinancialAction): 'expense' | 'saving' | 'newGoal' {
  if (action.domain === 'meta' && action.operation === 'crear') return 'newGoal';
  if (action.domain === 'ahorro' || (action.payload as Record<string, unknown>).tipo === 'ahorro') return 'saving';
  return 'expense';
}
```

Renderizar en cada tarjeta el tipo, la categoría solo para gasto y la meta seleccionada o `Sin meta` solo para ahorro. En modo resumen ocultar entradas, chips y quitar acción; mostrar un único botón `Corregir` que hace `setEditing(true)`.

- [x] **Step 2: Mantener el formulario existente exclusivamente en modo edición**

```tsx
{editing && !results ? /* entradas, categorías, metas y quitar acción existentes */ null}
```

El botón `Confirmar` permanece disponible en resumen y edición, sujeto a la validación existente. Al pulsar `Corregir`, gasto permite cambiar categoría; ahorro permite elegir `goalId`; una nueva meta permite editar `title` y `targetAmount`.

- [x] **Step 3: Ejecutar la prueba para verificar que pasa**

Run: `npx jest --runTestsByPath src/features/savings/components/FinancialAssistantSheet.test.tsx --runInBand --no-watchman`

Expected: PASS, incluido que `executeFinancialPlan` no se llama antes de Confirmar.

- [x] **Step 4: Añadir prueba de ahorro con meta y creación de meta**

```tsx
expect(view.getByText('Ahorro')).toBeTruthy();
fireEvent.press(view.getByText('Corregir'));
fireEvent.press(view.getByText('Viaje'));
expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ actions: expect.arrayContaining([
  expect.objectContaining({ payload: expect.objectContaining({ goalId: 'goal_1' }) })
]) }));
```

La prueba debe incluir además una acción `meta/crear` y comprobar que al confirmar se invoca `createGoal` solo después de pulsar Confirmar.

- [x] **Step 5: Ejecutar las pruebas de la hoja y del ejecutor**

Run: `npx jest --runTestsByPath src/features/savings/components/FinancialAssistantSheet.test.tsx src/features/savings/assistant/executeFinancialPlan.test.ts --runInBand --no-watchman`

Expected: PASS.

### Task 3: Validación de integración y publicación

**Files:**
- Modify: archivos de las tareas 1 y 2 solamente.

**Interfaces:**
- Consumes: exportación web de Expo y Hosting de Firebase.
- Produces: versión publicada con el flujo de revisión.

- [x] **Step 1: Verificar tipos y exportación web**

Run: `npm run typecheck && npx expo export --platform web`

Expected: ambos comandos salen con código 0 y se genera `dist`.

- [x] **Step 2: Revisar el diff limitado**

Run: `git diff --check -- src/features/savings/components/FinancialAssistantSheet.tsx src/features/savings/components/FinancialAssistantSheet.test.tsx src/shared/i18n/locales/es.json`

Expected: sin errores de espacios.

- [x] **Step 3: Desplegar Hosting**

Run: `firebase deploy --only hosting --project ceti-d3769 --non-interactive`

Expected: Hosting deploy complete.

- [x] **Step 4: Verificar la URL publicada**

Run: `curl.exe --silent --show-error --head --max-time 20 "https://ceti-d3769.web.app/welcome?release=voice-review"`

Expected: `HTTP/1.1 200 OK`.
