---
name: content-authoring-pipeline
description: Use when generating content banks at authoring-time (offline) — the generator→validator→Zod→gate→seed flow. Covers parametrization over grado×worldId×tipo, progressive difficulty, neutral language with Colombian constants, and the year-constants file. Used by the generador-contenido agent. Triggers: "generate a bank", "authoring pipeline", "seed content", "difficulty per cell", "economia-CO constants".
---

# Content authoring pipeline (offline → runtime estático)

Procedimiento **generador → validador → Zod → gate → banco** que produce el
contenido estático que el runtime consume (R7: la IA solo actúa aquí,
authoring-time, nunca en runtime). Lo usa **GC** (`generador-contenido`). Schemas:
ver `content-schemas` (S5).

## Parametrización (cobertura)

Recorre la rejilla completa:

- **Quiz**: `grado (9/10/11) × worldId (world_1..5) × tipo (MC/VF/ordenar)` = **45 bancos**.
- **EligeCamino**: `grado × worldId` = **15 bancos**.
- **Micro-teoría**: por `worldId`.
- **Pre/Post-test**: instrumento único a nivel programa.

## Dificultad progresiva (R8)

Matriz objetivo de `dificultad` por celda, **monótona**:

- Por mundo dentro de un grado: `world_1 < world_2 < ... < world_5`.
- Por grado dentro de un mundo: `9 < 10 < 11`.

Rango objetivo por celda (guía; el gate E3 verifica que `dificultad` cae dentro):

|         | world_1 | world_2 | world_3 | world_4 | world_5 |
| ------- | ------- | ------- | ------- | ------- | ------- |
| **9°**  | 1       | 1–2     | 2       | 2–3     | 3       |
| **10°** | 2       | 2–3     | 3       | 3–4     | 4       |
| **11°** | 3       | 3–4     | 4       | 4–5     | 5       |

## Lenguaje neutro + Colombia (R14 / CN04)

- Tono **neutro** (registro/forma), no jerga juvenil.
- Ejemplos cotidianos válidos en Colombia; "neutro" no borra el contexto-país.
- Cifras caducables (SMMLV, UVT, tasas, topes, precios) **solo** vía `constRef`
  resuelto desde `content/constants/economia-CO.<año>.json` — nunca literal quemado.

## Flujo

```
GC genera JSON por celda → content/bancos/*.json
   ↓
VC valida (rúbrica híbrida) → content/validation/<bancoId>.json
   ↓
E2 Zod estructural (S5) + ensamblaje 4+3+3
   ↓
E3 bank-insertion-gate (escritor único, determinista)
   ↓
seedQuestionBank.mjs (Admin SDK) siembra SOLO lo aprobado (R8/CN05)
```

## Constantes anuales (`economia-CO.<año>.json`)

```json
{
  "anio": 2026,
  "SMMLV": 0,
  "auxilioTransporte": 0,
  "UVT": 0,
  "tasaUsura": 0,
  "salarioMinimoIntegral": 0
}
```

Un ítem la referencia con `constRef: 'SMMLV'` (no un número). Cuando cambian las
cifras, se crea el archivo del nuevo año; el contenido no se reescribe.

## Checklist

- [ ] 45 celdas quiz + 15 EligeCamino cubiertas (+ micro-teoría + pre/post).
- [ ] `dificultad` de cada ítem dentro del rango de su celda (matriz arriba).
- [ ] Cero literales caducables — todo monto/tasa vía `constRef`.
- [ ] EligeCamino **sin** `correctAnswer` ni puntaje (R5).
- [ ] Todo banco nace `pendiente_validacion_docente: true`, `generadoPor: 'ia'`, `version`.
- [ ] Pasa Zod (S5) → VC → gate E3 antes de sembrar.
