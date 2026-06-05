---
name: content-schemas
description: Use when generating, validating, or reviewing content banks (quiz items, Elige-camino situations, micro-teoría, pre/post-test). Defines the Zod schemas per item/bank type with valid/invalid examples. Shared by the generador-contenido and validador-contenido agents and the bank-insertion gate (E3). Triggers: "content schema", "quiz item shape", "validate a bank", "banco JSON".
---

# Content schemas (Zod, por tipo, con ejemplos)

Schemas estructurales del contenido de Ceti. Compartido por **GC**
(`generador-contenido`), **VC** (`validador-contenido`) y el gate **E3**
(`scripts/contentSchemas.mjs` / `bankGate.mjs`). La _estructura_ vive aquí; la
_norma_ en R8/R9/R14; el _check_ en E2/E3.

## Ítems

**`multiple_choice`**

```
{ id, enunciado, opciones: string[4], correctIndex: 0..3,
  explicacion?, competencia, dificultad: 1..5 }
```

**`true_false`**

```
{ id, enunciado, respuesta: boolean, explicacion?, competencia, dificultad: 1..5 }
```

**`ordenar`**

```
{ id, enunciado, elementos: string[3..6],
  ordenCanonico: number[]  // permutación de índices de `elementos`
  explicacion?, competencia, dificultad: 1..5 }
```

`ordenCanonico` está marcado **no-servible-al-cliente** (RQ-ES04 CA1): nunca se
expone antes de responder.

## Bancos

**Banco quiz** `bancos/{grado}_{worldId}_{tipo}`

```
{ bancoId: `${grado}_${worldId}_${tipo}`,
  grado: '9' | '10' | '11',
  worldId: 'world_1'..'world_5',
  tipo: 'multiple_choice' | 'true_false' | 'ordenar',
  items: [...],
  pendiente_validacion_docente: true,
  generadoPor: 'ia',
  version: int }
```

**minItems por tipo** (para poder ensamblar el quiz 4+3+3): MC ≥ 4, VF ≥ 3,
ordenar ≥ 3.

**Ensamblaje del quiz** (schema aparte — R9 / E2): exactamente **4 MC + 3 VF + 3
ordenar = 10**, tomados de los 3 bancos del mismo `grado×worldId`.

**Banco `EligeCamino`** `bancosEligeCamino/{grado}_{worldId}`

```
{ bancoId: `${grado}_${worldId}`, grado, worldId,
  situaciones: [{ id, enunciado,
    opcionA: { texto, consecuencia },
    opcionB: { texto, consecuencia } }],
  pendiente_validacion_docente: true }
```

**Sin** `correctAnswer`, **sin** puntaje (R5 / RQ-ES06): son decisiones sin
correcta/incorrecta, y el output analítico es agregado por curso, no individual.

**Micro-teoría**

```
{ worldId, cards: [{ titulo, cuerpo /*breve*/, ejemplo? }] }   // lenguaje neutro, formato card (RQ-ES02)
```

**Pre/Post-test**: instrumento único a nivel programa, **mismo set de ítems**;
cada ítem mapea a una `competencia` para el `breakdown` (RQ-TS).

## Caducables (R14)

Montos/tasas **no** van como literal. Campo `constRef` (p. ej. `'SMMLV'`) resuelto
desde `content/constants/economia-CO.<año>.json`. El schema marca los campos
numéricos sensibles; el patrón-lint vive en E3.

## Ejemplos válido / inválido

- ✅ MC con `correctIndex: 2` y `opciones` de longitud 4.
- ❌ MC con `correctIndex: 4` → fuera de rango (0..3).
- ❌ MC con `opciones` de 3 strings → longitud inválida.
- ✅ `ordenar` con `elementos:[a,b,c]` y `ordenCanonico:[2,0,1]` (permutación).
- ❌ `ordenar` con `ordenCanonico:[0,0,1]` → no es permutación.
- ✅ `EligeCamino` con `opcionA/opcionB` y sus `consecuencia`.
- ❌ `EligeCamino` con `correctAnswer` → prohibido (R5).
- ❌ Cualquier banco sin `pendiente_validacion_docente: true` al nacer → inválido (R8).
- ❌ Ítem con `"$1.300.000"` quemado en vez de `constRef: 'SMMLV'` → viola R14.
