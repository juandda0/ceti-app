---
description: Valida el contenido generado — corre el flujo VC (4 rúbricas) → E2 (Zod estructural) → E3 (bank-insertion-gate) sobre content/.
allowed-tools: Read, Grep, Glob, Bash
---

Valida los bancos de contenido bajo `content/` (pipeline authoring-time, R8):

1. **VC (validador-contenido, 4 rúbricas).** Para cada banco en `content/bancos/`
   sin veredicto en `content/validation/`, invoca al agente `validador-contenido`
   (pedagógico · coherencia temática · dificultad progresiva · precisión
   financiera) y escribe su veredicto a `content/validation/<bancoId>.json`.
2. **E2 — estructura (Zod-equivalente).** Corre `node scripts/contentSchemas.mjs`
   (schemas S5 + ensamblaje 4+3+3, R9).
3. **E3 — gate determinista.** Corre `node scripts/bankGate.mjs` (Zod + veredicto VC
   = pass en las 4 rúbricas + flag `pendiente_validacion_docente` + caducables R14 +
   unicidad/dificultad). Solo lo aprobado va a `content/approved/`.

Reporta celda/ítem y causa de cada rechazo **explícitamente** (sin caps
silenciosos). El gate NO llama al LLM: es determinista. Nada se siembra aquí; la
siembra (Admin SDK, read-only R8) es un paso aparte sobre lo aprobado.
