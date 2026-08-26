# Asistente Financiero por Voz Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir lenguaje natural en planes multiacción editables para consultar y administrar movimientos, ahorros y metas tras confirmación explícita.

**Architecture:** Una callable autenticada usa Groq solo para producir JSON validado y nunca escribe datos. El cliente vuelve a validar, presenta un único sheet editable y ejecuta cada acción mediante los stores existentes con resultados individuales.

**Tech Stack:** Expo 57, React Native 0.86, TypeScript strict, Zustand 5, Firebase Functions v2, Groq, Jest, React Native Testing Library, Maestro.

## Global Constraints

- Máximo 300 caracteres y cinco acciones por solicitud.
- No almacenar audio, transcript, respuesta completa, UID ni perfiles derivados.
- Ninguna acción se ejecuta antes del resumen y confirmación explícita.
- No añadir proveedor de IA, dependencia de formularios ni memoria conversacional.
- Reutilizar `callFunction`, `groqCaller`, stores, repositorios y componentes CETI existentes.

---

### Task 1: Contrato cerrado del plan en Cloud Functions

**Files:**

- Create: `functions/src/financialPlan.ts`
- Create: `functions/src/financialPlan.test.ts`

**Interfaces:**

- Produces: `parseFinancialPlan(raw: string, requestId: string): FinancialPlan`.
- Produces: `FinancialPlanError` para entradas o respuestas inválidas.
- Produces: `FinancialAction` con dominios `movimiento|ahorro|meta` y operaciones `consultar|crear|editar|eliminar`.

- [ ] **Step 1: Escribir pruebas del parser**

```ts
import { parseFinancialPlan } from './financialPlan';

test('acepta hasta cinco acciones y asigna IDs estables', () => {
  const plan = parseFinancialPlan(
    JSON.stringify({
      actions: [
        {
          domain: 'movimiento',
          operation: 'crear',
          payload: {
            tipo: 'gasto',
            monto: 12000,
            descripcion: 'almuerzo',
            categoria: 'comida',
            fecha: 10,
          },
        },
        { domain: 'meta', operation: 'eliminar', resourceId: 'goal_1', payload: {} },
      ],
    }),
    'req_1'
  );
  expect(plan.actions.map((a) => a.actionId)).toEqual(['req_1:0', 'req_1:1']);
});

test.each([
  '{}',
  '{"actions":[]}',
  '{"actions":[{"domain":"usuario","operation":"eliminar","payload":{}}]}',
  '{"actions":[{"domain":"movimiento","operation":"crear","payload":{"monto":-1}}]}',
])('rechaza plan inválido %s', (raw) => expect(() => parseFinancialPlan(raw, 'r')).toThrow());
```

- [ ] **Step 2: Ejecutar y confirmar fallo**

Run: `npx jest --runInBand functions/src/financialPlan.test.ts`

Expected: FAIL porque el módulo no existe.

- [ ] **Step 3: Implementar tipos y validación sin dependencias**

Definir unions discriminadas para:

```ts
export type FinancialAction =
  | {
      actionId: string;
      domain: 'movimiento';
      operation: 'consultar';
      payload: { desde?: number; hasta?: number; tipo?: 'gasto' | 'ahorro' };
      needsInput: string[];
    }
  | {
      actionId: string;
      domain: 'movimiento';
      operation: 'crear';
      payload: {
        tipo: 'gasto' | 'ahorro';
        monto: number;
        descripcion: string;
        categoria: MovimientoCategoria;
        fecha: number;
        goalId?: string;
      };
      needsInput: string[];
    }
  | {
      actionId: string;
      domain: 'movimiento';
      operation: 'editar' | 'eliminar';
      resourceId: string;
      payload: Record<string, unknown>;
      needsInput: string[];
    }
  | {
      actionId: string;
      domain: 'ahorro';
      operation: 'consultar' | 'crear' | 'editar' | 'eliminar';
      resourceId?: string;
      payload: Record<string, unknown>;
      needsInput: string[];
    }
  | {
      actionId: string;
      domain: 'meta';
      operation: 'consultar' | 'crear' | 'editar' | 'eliminar';
      resourceId?: string;
      payload: Record<string, unknown>;
      needsInput: string[];
    };
```

Validar objetos, enums, campos permitidos, enteros `1..100_000_000`, texto máximo 140, `actions.length` entre 1 y 5 y rechazar campos adicionales. Añadir `actionId = requestId + ':' + index` después de validar.

- [ ] **Step 4: Verificar parser y build**

Run: `npx jest --runInBand functions/src/financialPlan.test.ts`

Expected: PASS.

Run: `npm --prefix functions run build`

Expected: exit code 0.

- [ ] **Step 5: Commit**

```bash
git add functions/src/financialPlan.ts functions/src/financialPlan.test.ts
git commit -m "feat(voz): valida planes financieros multiaccion (RQ-ES10 RQ-ES11)"
```

### Task 2: Callable de planificación con contexto mínimo

**Files:**

- Create: `functions/src/financialAssistant.ts`
- Create: `functions/src/financialAssistant.test.ts`
- Modify: `functions/src/index.ts`

**Interfaces:**

- Produces: `buildFinancialPrompt(context: FinancialContext): string` sin PII.
- Produces: `parseFinancialContext(value: unknown): FinancialContext` con campos cerrados.
- Produces callable `planificarAccionesFinancieras({ text, requestId, context })`.
- Consumes: `groqCaller(GROQ_API_KEY.value())` y `parseFinancialPlan`.

- [ ] **Step 1: Escribir pruebas del prompt y contexto**

```ts
test('el prompt usa IDs opacos y no acepta identidad', () => {
  const context = parseFinancialContext({
    goals: [{ id: 'g1', title: 'Bici', targetAmount: 300000 }],
    movements: [
      {
        id: 'm1',
        tipo: 'gasto',
        monto: 10000,
        descripcion: 'almuerzo',
        categoria: 'comida',
        fecha: 10,
      },
    ],
  });
  expect(buildFinancialPrompt(context)).toContain('g1');
  expect(() => parseFinancialContext({ uid: 'u1', goals: [], movements: [] })).toThrow();
});
```

Añadir casos de texto vacío, más de 300 caracteres, más de 30 recursos de contexto y plan inválido del modelo.

- [ ] **Step 2: Ejecutar y confirmar fallo**

Run: `npx jest --runInBand functions/src/financialAssistant.test.ts`

Expected: FAIL porque el módulo no existe.

- [ ] **Step 3: Implementar el servicio puro**

```ts
export async function planFinancialActions(
  input: unknown,
  callModel: ModelCaller
): Promise<FinancialPlan> {
  const { text, requestId, context } = parseRequest(input);
  const raw = await callModel(SYSTEM_PROMPT, JSON.stringify({ text, context }));
  return parseFinancialPlan(raw, requestId);
}
```

El `SYSTEM_PROMPT` debe exigir JSON, máximo cinco acciones, usar únicamente IDs recibidos, marcar referencias ambiguas en `needsInput` y no inventar recursos.

- [ ] **Step 4: Exponer la callable**

En `functions/src/index.ts`:

```ts
export const planificarAccionesFinancieras = onCall(
  { secrets: [GROQ_API_KEY] },
  async (request) => {
    requireAuth(request.auth);
    if (request.auth.token.role !== 'estudiante') {
      throw new HttpsError('permission-denied', 'Solo estudiantes usan el asistente financiero.');
    }
    try {
      return await planFinancialActions(
        request.data,
        groqCaller(GROQ_API_KEY.value(), { maxTokens: 1200, timeoutMs: 20_000 })
      );
    } catch (error) {
      if (error instanceof FinancialPlanError) {
        throw new HttpsError('invalid-argument', error.message);
      }
      throw new HttpsError('unavailable', 'No pude organizar la solicitud.');
    }
  }
);
```

- [ ] **Step 5: Verificar y commit**

Run: `npx jest --runInBand functions/src/financialAssistant.test.ts functions/src/financialPlan.test.ts`

Run: `npm --prefix functions run build`

Expected: ambos exit code 0.

```bash
git add functions/src/financialAssistant.ts functions/src/financialAssistant.test.ts functions/src/index.ts
git commit -m "feat(functions): planifica acciones financieras por voz (RQ-ES10 RQ-ES11)"
```

### Task 3: Cliente y fallback local

**Files:**

- Create: `src/features/savings/assistant/financialPlan.ts`
- Create: `src/features/savings/assistant/financialPlan.test.ts`
- Modify: `src/features/savings/data/vozService.ts`
- Test: `src/features/savings/data/vozParser.test.ts`

**Interfaces:**

- Produces: `parseClientFinancialPlan(value: unknown): FinancialPlan`.
- Produces: `buildFinancialContext(movements, goals, operations): FinancialContext` limitado a 30 recursos recientes y sin identidad.
- Produces: `vozService.planificar(text, context, requestId): Promise<FinancialPlan>`.
- Consumes: `callFunction('planificarAccionesFinancieras', ...)` y `parsearRegistroVoz` como fallback.

- [ ] **Step 1: Escribir pruebas de validación y fallback**

```ts
it('rechaza una acción o campo desconocido del servidor', () => {
  expect(() =>
    parseClientFinancialPlan({
      actions: [
        {
          actionId: 'r:0',
          domain: 'usuario',
          operation: 'eliminar',
          payload: {},
          needsInput: [],
        },
      ],
    })
  ).toThrow();
});

it('convierte fallback local en borrador editable', async () => {
  callFunctionMock.mockRejectedValue(new Error('offline'));
  const plan = await vozService.planificar(
    'gasté 12 mil en almuerzo',
    { goals: [], movements: [] },
    'r'
  );
  expect(plan.source).toBe('local');
  expect(plan.actions[0]).toMatchObject({ domain: 'movimiento', operation: 'crear' });
});
```

- [ ] **Step 2: Ejecutar y confirmar fallo**

Run: `npx jest --runInBand src/features/savings/assistant/financialPlan.test.ts src/features/savings/data/vozParser.test.ts`

Expected: FAIL porque el contrato y `planificar` no existen.

- [ ] **Step 3: Implementar validación cliente y servicio**

Repetir los enums y límites del contrato server en un parser cliente estricto; la frontera no confía en la respuesta de red. En `vozService.planificar`, truncar a 300 caracteres, llamar la Function y validar. En catch, convertir cada `ClasificacionMovimiento` local a una acción `crear` con `needsInput: []` y `source: 'local'`; si el parser devuelve `no_entendido`, relanzar el error.

- [ ] **Step 4: Verificar y commit**

Run: `npx jest --runInBand src/features/savings/assistant/financialPlan.test.ts src/features/savings/data/vozParser.test.ts`

Run: `npm run typecheck`

Expected: exit code 0.

```bash
git add src/features/savings/assistant/financialPlan.ts src/features/savings/assistant/financialPlan.test.ts src/features/savings/data/vozService.ts src/features/savings/data/vozParser.test.ts
git commit -m "feat(voz): consume planes IA con fallback local (RQ-ES10 RQ-ES11)"
```

### Task 4: Ejecutor determinista e idempotente

**Files:**

- Create: `src/features/savings/assistant/executeFinancialPlan.ts`
- Create: `src/features/savings/assistant/executeFinancialPlan.test.ts`

**Interfaces:**

- Produces: `executeFinancialPlan(actions, dependencies): Promise<ActionResult[]>`.
- Consumes: `createExpense/updateExpense/deleteExpense`, `createGoal/updateGoal/deleteGoal`, `createOperation/updateOperation/deleteOperation` y `projection`.

- [ ] **Step 1: Escribir pruebas por operación y lote parcial**

```ts
it('ejecuta varias acciones en orden y reporta cada resultado', async () => {
  const result = await executeFinancialPlan([createExpenseAction, deleteGoalAction], deps);
  expect(deps.createExpense).toHaveBeenCalledTimes(1);
  expect(deps.deleteGoal).toHaveBeenCalledWith('goal_1');
  expect(result.map((x) => x.status)).toEqual(['success', 'success']);
});

it('no repite un actionId confirmado', async () => {
  await executeFinancialPlan([createExpenseAction], deps);
  await executeFinancialPlan([createExpenseAction], deps);
  expect(deps.createExpense).toHaveBeenCalledTimes(1);
});

it('continúa y marca error individual', async () => {
  deps.deleteGoal.mockResolvedValue({ ok: false, reason: 'not_found' });
  const result = await executeFinancialPlan([deleteGoalAction, querySavingsAction], deps);
  expect(result.map((x) => x.status)).toEqual(['error', 'success']);
});
```

- [ ] **Step 2: Ejecutar y confirmar fallo**

Run: `npx jest --runInBand src/features/savings/assistant/executeFinancialPlan.test.ts`

Expected: FAIL porque el ejecutor no existe.

- [ ] **Step 3: Implementar dispatch mínimo**

Usar un `Set<string>` de IDs confirmados durante la sesión y un `switch` exhaustivo por `domain/operation`. `movimiento/crear` con `tipo:gasto` llama `createExpense`; con `tipo:ahorro` llama `createOperation({ type:'aporte', ... })`. `movimiento/editar|eliminar` despacha al store que contiene el `resourceId`. `ahorro/crear|editar|eliminar` usa `createOperation|updateOperation|deleteOperation`; `meta/crear|editar|eliminar` usa `createGoal|updateGoal|deleteGoal`. Las consultas leen `movimientos`, `goals` y `projection()` y devuelven datos estructurados. Rechazar acciones con `needsInput.length > 0` antes de ejecutar.

- [ ] **Step 4: Verificar y commit**

Run: `npx jest --runInBand src/features/savings/assistant/executeFinancialPlan.test.ts`

Expected: PASS.

```bash
git add src/features/savings/assistant/executeFinancialPlan.ts src/features/savings/assistant/executeFinancialPlan.test.ts
git commit -m "feat(finanzas): ejecuta planes confirmados sin duplicados (RQ-ES10 RQ-ES11)"
```

### Task 5: Sheet multiacción editable

**Files:**

- Create: `src/features/savings/components/FinancialAssistantSheet.tsx`
- Create: `src/features/savings/components/FinancialAssistantSheet.test.tsx`
- Modify: `src/features/savings/components/VoiceCaptureSheet.tsx`
- Modify: `src/features/savings/screens/MovimientosScreen.tsx`
- Modify: `src/shared/i18n/locales/es.json`

**Interfaces:**

- Consumes: `FinancialPlan`, `executeFinancialPlan` y componentes `CetiBottomSheet`, `CetiButton`.
- Produces: `FinancialAssistantSheet({ visible, plan, onChange, onClose })`.

- [ ] **Step 1: Escribir prueba de interacción**

```tsx
it('permite editar, quitar y confirmar un lote', async () => {
  render(<FinancialAssistantSheet visible plan={plan} onChange={onChange} onClose={onClose} />);
  expect(screen.getByText('2 acciones')).toBeTruthy();
  fireEvent.changeText(screen.getByLabelText('Monto de Almuerzo'), '15000');
  fireEvent.press(screen.getByLabelText('Quitar Eliminar meta Bici'));
  fireEvent.press(screen.getByText('Confirmar acciones'));
  await waitFor(() =>
    expect(executeMock).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ payload: expect.objectContaining({ monto: 15000 }) }),
      ])
    )
  );
});

it('bloquea confirmar cuando falta una decisión', () => {
  render(
    <FinancialAssistantSheet
      visible
      plan={ambiguousPlan}
      onChange={jest.fn()}
      onClose={jest.fn()}
    />
  );
  expect(screen.getByText('Confirmar acciones')).toBeDisabled();
});
```

- [ ] **Step 2: Ejecutar y confirmar fallo**

Run: `npx jest --runInBand src/features/savings/components/FinancialAssistantSheet.test.tsx`

Expected: FAIL porque el componente no existe.

- [ ] **Step 3: Implementar el sheet**

Renderizar una tarjeta por acción con título legible, inputs de monto/texto/fecha, chips de categoría y selector de recurso cuando `needsInput` lo requiera. Eliminar una tarjeta actualiza el plan. El botón confirma solo si queda al menos una acción y todas pasan `parseClientFinancialPlan`. Tras ejecutar, reemplazar cada tarjeta por su resultado `success|error` sin cerrar automáticamente si hay errores.

En `VoiceCaptureSheet`, añadir la prop `onSubmitText: (text: string) => void` y una alternativa accesible “Escribir en lugar de hablar” que abre un `TextInput` multilínea limitado a 300 caracteres y llama `onSubmitText(text.trim())`. El micrófono sigue siendo la acción primaria; esta entrada permite operar cuando Speech Recognition no está disponible y hace el flujo E2E reproducible.

- [ ] **Step 4: Integrar el flujo de audio**

En `MovimientosScreen`, reemplazar `clasificarRegistroLocal` y los tres sheets de clasificación por:

```ts
const context = buildFinancialContext(movimientos, goals, operations);
const plan = await vozService.planificar(texto, context, `voice_${Date.now()}`);
setFinancialPlan(plan);
setAssistantVisible(true);
```

Mantener `VoiceCaptureSheet` para captura y processing. Abrir `FinancialAssistantSheet` al terminar la planificación. No ejecutar desde `onTranscript`.

- [ ] **Step 5: Verificar y commit**

Run: `npx jest --runInBand src/features/savings/components/FinancialAssistantSheet.test.tsx`

Run: `npm run typecheck`

Run: `npm run lint`

Expected: exit code 0, sin errores nuevos.

```bash
git add src/features/savings/components/FinancialAssistantSheet.tsx src/features/savings/components/FinancialAssistantSheet.test.tsx src/features/savings/components/VoiceCaptureSheet.tsx src/features/savings/screens/MovimientosScreen.tsx src/shared/i18n/locales/es.json
git commit -m "feat(voz): añade resumen editable multiaccion (RQ-ES10 RQ-ES11)"
```

### Task 6: Verificación integral y smoke móvil

**Files:**

- Create: `e2e/maestro/asistente-financiero-voz.yaml`

- [ ] **Step 1: Añadir flujo Maestro**

```yaml
appId: com.juanndda.ceti
name: Asistente financiero multiacción
---
- launchApp
- tapOn: 'Mi dinero'
- tapOn: 'Toca y dime qué ahorraste o gastaste'
- tapOn: 'Escribir en lugar de hablar'
- tapOn: 'Solicitud financiera'
- inputText: 'gaste 12000 en almuerzo y crea una meta bicicleta de 500000'
- tapOn: 'Organizar'
- assertVisible: 'Resumen de acciones'
- assertVisible: '2 acciones'
- tapOn: 'Monto de Almuerzo'
- eraseText
- inputText: '15000'
- tapOn: 'Confirmar acciones'
- assertVisible: 'Acción completada'
- assertVisible: 'Bicicleta'
```

- [ ] **Step 2: Ejecutar verificación completa**

Run: `npx jest --runInBand`

Run: `npm --prefix functions run build`

Run: `npm run typecheck`

Run: `npm run lint`

Run: `npm run lint:invariants`

Run: `$env:JAVA_HOME='C:\Program Files\Java\jdk-21'; $env:Path="$env:JAVA_HOME\bin;$env:Path"; npm run test:rules`

Run: `npm audit --audit-level=high`

Expected: todos exit code 0; lint conserva como máximo warnings preexistentes.

- [ ] **Step 3: Ejecutar smoke de dispositivo**

Run: `maestro test e2e/maestro/asistente-financiero-voz.yaml`

Expected: PASS en creación, edición, eliminación, consulta y lote mixto.

- [ ] **Step 4: Commit**

```bash
git add e2e/maestro/asistente-financiero-voz.yaml
git commit -m "test(voz): cubre asistente financiero multiaccion (RQ-ES10 RQ-ES11)"
```

### Task 7: Integración y despliegue de producción

**Files:** None.

- [ ] **Step 1: Repetir auditoría pre-release**

Ejecutar `source-command-auditoria-pre-release`. Expected: privacidad `pass`, reglas `pass`, E4 verde, E7 verde y audit sin altas/críticas.

- [ ] **Step 2: Organizar Git por fast-forward**

```bash
git fetch --prune origin
git push -u origin feat/mi-dinero-retos
git checkout master
git pull --ff-only origin master
git merge --ff-only feat/mi-dinero-retos
git push origin master
```

Expected: ninguna reescritura de historia; `master` local y remoto apuntan al mismo commit.

- [ ] **Step 3: Desplegar backend y reglas**

Run: `npx firebase deploy --only functions,firestore:rules,firestore:indexes`

Expected: Functions, reglas e índices desplegados sin errores.

- [ ] **Step 4: Construir y enviar aplicaciones móviles**

Run: `npx eas build --platform all --profile production --auto-submit --non-interactive`

Expected: builds Android/iOS creados y submissions aceptadas por las tiendas. Si faltan credenciales o acuerdos de tienda, detenerse y reportar el identificador del build sin alterar Git ni repetir envíos.
