# Privacidad de menores Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Impedir que estados derivados del diario y texto libre de menores salgan del dispositivo, y restaurar la whitelist exacta del roster.

**Architecture:** Conservar `evaluarReto` como función pura local y retirar toda su sincronización con Firestore. Sustituir la callable de Groq por un parser TypeScript puro usado directamente por `vozService`, manteniendo el contrato de confirmación actual.

**Tech Stack:** React Native, TypeScript estricto, Zustand/MMKV, Jest, Firebase Functions.

## Global Constraints

- No persistir rasgos o estados derivados del comportamiento de un menor.
- No enviar texto libre del menor a servicios propios o de terceros.
- `estudiantes/{uid}` solo admite la whitelist de `compliance-ley1581`.
- El audio permanece en Web Speech API y nunca sale del dispositivo.
- No añadir dependencias.
- Mantener confirmación editable antes de guardar movimientos.

---

### Task 1: Mantener retos exclusivamente locales

**Files:**

- Delete: `src/features/dashboard/data/retoSync.ts`
- Delete: `src/features/dashboard/data/retoSync.test.ts`
- Delete: `src/features/dashboard/data/retoEstadoRepository.ts`
- Delete: `src/features/dashboard/hooks/useRetoCompletionSync.ts`
- Modify: `src/shared/lib/firebase/paths.ts`
- Modify: `src/shared/types/tenancy.ts`
- Modify: `src/features/dashboard/data/loadCourseReport.ts`
- Modify: `src/features/dashboard/screens/CourseDashboardScreen.tsx`
- Modify: callers returned by `rg -n "useRetoCompletionSync|RetoEstadoDoc|retoEstadoRepository|retoEstados" src app`
- Test: `src/features/dashboard/data/retoEvaluator.test.ts`

**Interfaces:**

- Consumes: `evaluarReto(reto, diario, now)` para feedback local del estudiante.
- Produces: `CourseReportWithRetos` con `retoColumns` y sin `retoEstados`.

- [ ] **Step 1: Escribir el test que fija la frontera local**

Agregar a `src/features/dashboard/data/retoEvaluator.test.ts`:

```ts
it('devuelve solo estado y avance locales, sin identidad ni coordenadas tenant', () => {
  const result = evaluarReto(reto({ cantidad: 2 }), diarioCon(2), NOW);
  expect(result).toEqual({ estado: 'cumplido', avance: 2 });
  expect(Object.keys(result).sort()).toEqual(['avance', 'estado']);
});
```

- [ ] **Step 2: Ejecutar el test antes de retirar sincronización**

Run:

```bash
npx jest src/features/dashboard/data/retoEvaluator.test.ts --runInBand
```

Expected: PASS; establece el contrato local existente antes de borrar la salida remota.

- [ ] **Step 3: Retirar el modelo y paths remotos**

En `src/shared/types/tenancy.ts`, eliminar `RetoEstado`, `RetoEstadoDoc` y cualquier export usado solo por la señal persistida. En `src/shared/lib/firebase/paths.ts`, eliminar:

```ts
estudianteRetosCollectionRef;
estudianteRetoEstadoDocRef;
```

Eliminar los tres archivos de sincronización/repositorio listados y todos sus imports/callers. No sustituirlos por otro transporte.

- [ ] **Step 4: Simplificar el reporte docente**

Cambiar el contrato en `loadCourseReport.ts` a:

```ts
export interface CourseReportWithRetos extends CourseReport {
  retoColumns: RetoColumn[];
}
```

Eliminar la importación de `retoEstadoRepository`, el fan-out `signalArrays`, la construcción de `retoEstados` y devolver:

```ts
return { ...base, retoColumns };
```

En `CourseDashboardScreen.tsx`, conservar el título y la consigna de cada `retoColumn`, pero eliminar resumen de estados y filas por estudiante. La tarjeta queda:

```tsx
{
  report.retoColumns.map((col) => (
    <View key={col.id} style={[styles.retoCard, { backgroundColor: colors.background.secondary }]}>
      <Text style={[styles.diagHead, { color: colors.text.primary }]}>
        {t(`assignments.retoItem_${col.tipo}`, { n: col.cantidad })}
      </Text>
      <Text style={[styles.diagItemSub, { color: colors.text.tertiary }]}>
        {t('dashboard.retoSeguimientoPrivado')}
      </Text>
    </View>
  ));
}
```

Agregar `dashboard.retoSeguimientoPrivado` a `src/shared/i18n/locales/es.json` con:

```json
"retoSeguimientoPrivado": "Cada estudiante consulta su avance de forma privada en su dispositivo."
```

- [ ] **Step 5: Verificar ausencia de frontera remota**

Run:

```bash
rg -n "useRetoCompletionSync|RetoEstadoDoc|retoEstadoRepository|retoEstados|estudianteRetoEstado" src app
npx jest src/features/dashboard/data/retoEvaluator.test.ts src/features/dashboard/data/courseReport.test.ts --runInBand
npm run typecheck
```

Expected: `rg` no devuelve coincidencias; tests y typecheck terminan con exit `0`.

- [ ] **Step 6: Commit**

```bash
git add src app
git commit -m "fix(privacy): mantiene retos financieros en el dispositivo [skip-rq]"
```

### Task 2: Restaurar la whitelist del roster

**Files:**

- Modify: `functions/src/index.ts`
- Modify: `src/shared/types/tenancy.ts`
- Test: `functions/src/index.ts` mediante invariant-lint y tests de Functions existentes

**Interfaces:**

- Consumes: `suppressStudentData({ colegioId, cursoId, uid })`.
- Produces: roster suprimido con `{estado:'suprimido', atestado:false}` y ningún campo fuera de whitelist.

- [ ] **Step 1: Crear una comprobación mecánica que falle**

Agregar temporalmente al flujo de verificación del task este comando antes de editar:

```bash
rg -n "suprimidoAt|suprimidoPor" functions/src/index.ts src/shared/types/tenancy.ts
```

Expected: encuentra las escrituras y propiedades actuales.

- [ ] **Step 2: Eliminar campos no permitidos**

Cambiar el `estRef.set` de `suppressStudentData` a:

```ts
await estRef.set(
  {
    estado: 'suprimido',
    atestado: false,
  },
  { merge: true }
);
```

Eliminar `suprimidoAt` y `suprimidoPor` de `Estudiante` en `tenancy.ts`. No crear otra colección de auditoría.

- [ ] **Step 3: Verificar whitelist**

Run:

```bash
rg -n "suprimidoAt|suprimidoPor" functions/src/index.ts src/shared/types/tenancy.ts
npm run typecheck
npm --prefix functions run build
node scripts/invariantLint.mjs
```

Expected: `rg` sin coincidencias; los tres comandos restantes terminan con exit `0`.

- [ ] **Step 4: Commit**

```bash
git add functions/src/index.ts src/shared/types/tenancy.ts
git commit -m "fix(privacy): restringe roster a la whitelist Ley 1581 [skip-rq]"
```

### Task 3: Reemplazar Groq por parser local determinista

**Files:**

- Create: `src/features/savings/data/vozParser.ts`
- Create: `src/features/savings/data/vozParser.test.ts`
- Modify: `src/features/savings/data/vozService.ts`
- Modify: `src/features/savings/data/vozService.test.ts`
- Modify: `src/features/savings/screens/MovimientosScreen.tsx`
- Modify: `functions/src/index.ts`
- Delete: `functions/src/vozClasificacion.ts`
- Delete: `functions/src/vozClasificacion.test.ts`
- Modify: `functions/src/index.ts` imports and secret declarations

**Interfaces:**

- Consumes: texto transcrito de Web Speech API, máximo 300 caracteres.
- Produces: `parsearRegistroVoz(texto): ClasificacionMovimiento[]` con 1..5 resultados; no reconocido usa `intencion:'no_entendido'`.

- [ ] **Step 1: Escribir tests del parser local**

Crear `vozParser.test.ts` con casos mínimos:

```ts
import { parsearRegistroVoz } from './vozParser';

describe('parsearRegistroVoz', () => {
  it('clasifica un gasto con miles y categoría conocida', () => {
    expect(parsearRegistroVoz('gasté 5 mil en un helado')).toEqual([
      expect.objectContaining({
        intencion: 'movimiento',
        tipo: 'gasto',
        monto: 5000,
        categoria: 'comida',
      }),
    ]);
  });

  it('clasifica ahorro y fecha relativa', () => {
    expect(parsearRegistroVoz('ayer ahorré 20 lucas')).toEqual([
      expect.objectContaining({ tipo: 'ahorro', monto: 20000, offsetDias: -1 }),
    ]);
  });

  it('separa hasta cinco movimientos unidos por y/luego', () => {
    expect(parsearRegistroVoz('gasté 2 mil en bus y luego 5 mil en comida')).toHaveLength(2);
  });

  it('no inventa datos cuando falta el monto', () => {
    expect(parsearRegistroVoz('compré un helado')).toEqual([
      expect.objectContaining({ intencion: 'no_entendido', monto: 0, confianza: 0 }),
    ]);
  });
});
```

- [ ] **Step 2: Verificar RED**

Run:

```bash
npx jest src/features/savings/data/vozParser.test.ts --runInBand
```

Expected: FAIL porque `vozParser.ts` no existe.

- [ ] **Step 3: Implementar el parser mínimo**

Crear `vozParser.ts` con:

```ts
import type { ClasificacionMovimiento } from './vozService';

const NO_ENTENDIDO: ClasificacionMovimiento = {
  intencion: 'no_entendido',
  tipo: 'gasto',
  monto: 0,
  descripcion: '',
  categoria: 'otros',
  confianza: 0,
  offsetDias: 0,
};

const multiplicadores: Record<string, number> = {
  mil: 1000,
  luca: 1000,
  lucas: 1000,
};

function montoDe(texto: string): number | null {
  const match = texto.match(/(\d+(?:[.,]\d+)?)\s*(mil|luca|lucas)?/i);
  if (!match) return null;
  const base = Number(match[1].replace(',', '.'));
  const monto = Math.round(base * (multiplicadores[match[2]?.toLowerCase()] ?? 1));
  return Number.isSafeInteger(monto) && monto > 0 ? monto : null;
}

function categoriaDe(texto: string): ClasificacionMovimiento['categoria'] {
  if (/helado|comida|almuerzo|desayuno|cena|mercado/i.test(texto)) return 'comida';
  if (/bus|taxi|transporte|metro/i.test(texto)) return 'transporte';
  if (/colegio|libro|curso|educaci[oó]n/i.test(texto)) return 'educacion';
  if (/ropa|camisa|pantal[oó]n|zapatos/i.test(texto)) return 'ropa';
  if (/celular|computador|tecnolog[ií]a/i.test(texto)) return 'tecnologia';
  if (/regalo/i.test(texto)) return 'regalos';
  if (/cine|juego|entretenimiento/i.test(texto)) return 'entretenimiento';
  return 'otros';
}

function parsearUno(texto: string): ClasificacionMovimiento {
  const monto = montoDe(texto);
  if (monto === null) return NO_ENTENDIDO;
  const tipo = /ahorr|guard|abon/i.test(texto) ? 'ahorro' : 'gasto';
  return {
    intencion: 'movimiento',
    tipo,
    monto,
    descripcion: texto.trim().slice(0, 140),
    categoria: categoriaDe(texto),
    confianza: 1,
    offsetDias: /\bayer\b/i.test(texto) ? -1 : 0,
  };
}

export function parsearRegistroVoz(texto: string): ClasificacionMovimiento[] {
  const partes = texto
    .slice(0, 300)
    .split(/\s+(?:y luego|luego|y)\s+/i)
    .map((parte) => parte.trim())
    .filter(Boolean)
    .slice(0, 5);
  if (partes.length === 0) return [NO_ENTENDIDO];
  const items = partes.map(parsearUno);
  return items.some((item) => item.intencion === 'no_entendido') ? [NO_ENTENDIDO] : items;
}
```

- [ ] **Step 4: Verificar GREEN**

Run:

```bash
npx jest src/features/savings/data/vozParser.test.ts --runInBand
```

Expected: 4 tests PASS.

- [ ] **Step 5: Cablear servicio local y retirar callable**

En `vozService.ts`, eliminar `callFunction`, `RespuestaVoz` y `normalizarRespuestaVoz`. Exportar:

```ts
import { parsearRegistroVoz } from './vozParser';

export const vozService = {
  clasificarRegistroLocal: async (texto: string): Promise<ClasificacionMovimiento[]> =>
    parsearRegistroVoz(texto.slice(0, VOZ_MAX_CHARS)),
};
```

En `MovimientosScreen.tsx`, reemplazar:

```ts
const r = await vozService.procesarRegistroVoz(texto);
const items = normalizarRespuestaVoz(r);
```

por:

```ts
const items = await vozService.clasificarRegistroLocal(texto);
```

Eliminar la rama `resource-exhausted`; el parser local no tiene cuota ni error de red. Retirar de `functions/src/index.ts` la exportación `procesarRegistroVoz`, `GROQ_API_KEY`, `vozUsoRef`, presupuesto de voz e imports exclusivos. Eliminar `vozClasificacion.ts` y su test.

- [ ] **Step 6: Verificar que no sale texto del dispositivo**

Run:

```bash
rg -n "procesarRegistroVoz|GROQ_API_KEY|groqCaller|vozUso|clasificarTexto|callFunction<RespuestaVoz>" src functions
npx jest src/features/savings/data/vozParser.test.ts src/features/savings/data/vozService.test.ts --runInBand
npm run typecheck
npm --prefix functions run build
```

Expected: `rg` sin coincidencias; tests, typecheck y build de Functions terminan con exit `0`.

- [ ] **Step 7: Commit**

```bash
git add src functions
git commit -m "fix(privacy): clasifica el diario de voz en el dispositivo [skip-rq]"
```

### Task 4: Auditoría de privacidad

**Files:**

- Modify: none
- Test: árbol completo

**Interfaces:**

- Consumes: Tasks 1–3.
- Produces: veredicto `pass` de `compliance-privacidad`.

- [ ] **Step 1: Ejecutar gates mecánicos**

```bash
node scripts/invariantLint.mjs
npm run i18n:check
npm run typecheck
npx jest --runInBand
```

Expected: todos exit `0`.

- [ ] **Step 2: Repetir auditoría CP**

Revisar el diff completo con `compliance-ley1581`. Expected: `pass`, sin estados derivados persistidos, sin campos fuera de whitelist y sin texto libre enviado a terceros.
